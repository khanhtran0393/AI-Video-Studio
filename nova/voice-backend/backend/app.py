"""Voice Studio — backend FastAPI.

Luồng bất đồng bộ: POST tạo task -> trả task_id -> GET /api/status thăm dò ->
tải file khi completed. Model chạy tuần tự qua 1 worker + mutex (giống G-Labs).
"""
from __future__ import annotations

import os
import shutil
import threading
import time
import uuid
from pathlib import Path
from queue import Queue
from typing import Optional

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import voicebank
from audio_utils import concat_wavs, pitch_shift_wav, split_sentences, to_mp3, wav_duration, write_srt
from engines import get_asr_engine, get_tts_engine

app = FastAPI(title="Voice Studio", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Nạp giọng NHÀ MÁY (có sẵn cho khách, không cần clone) vào VoiceBank khi khởi động.
try:
    _seeded = voicebank.seed_factory()
    if _seeded:
        print(f"[voicebank] đã nạp {_seeded} giọng nhà máy")
except Exception as _e:  # noqa
    print(f"[voicebank] seed_factory lỗi: {_e}")

# ---- Hàng chờ + trạng thái task ----
TASKS: dict[str, dict] = {}
_QUEUE: "Queue[str]" = Queue()
_MODEL_LOCK = threading.Lock()  # bảo đảm inference tuần tự
_started = time.time()


def _new_task(kind: str, payload: dict) -> str:
    tid = uuid.uuid4().hex[:12]
    TASKS[tid] = {
        "id": tid, "kind": kind, "status": "pending",
        "progress": 0, "total": 0, "results": None, "error": None,
        "payload": payload, "created_at": time.time(),
    }
    _QUEUE.put(tid)
    return tid


def _worker() -> None:
    while True:
        tid = _QUEUE.get()
        task = TASKS.get(tid)
        if not task:
            continue
        task["status"] = "running"
        task.setdefault("timings", {})
        task["timings"]["queue_wait_ms"] = round(
            (time.time() - task.get("created_at", time.time())) * 1000, 2,
        )
        try:
            with _MODEL_LOCK:
                if task["kind"] == "tts":
                    _run_tts(task)
                elif task["kind"] == "asr":
                    _run_asr(task)
            task["status"] = "completed"
        except Exception as e:  # noqa
            task["status"] = "failed"
            task["error"] = str(e)
        finally:
            _QUEUE.task_done()


def _resolve_voice(payload: dict) -> tuple[Optional[str], Optional[str], dict]:
    """Trả (ref_audio, ref_text, attributes) từ preset_id hoặc trực tiếp."""
    pid = payload.get("preset_id")
    if pid:
        v = voicebank.get_voice(pid)
        if not v:
            raise ValueError(f"Không tìm thấy giọng {pid}")
        return v.get("ref_audio"), v.get("ref_text", ""), v.get("attributes", {})
    return payload.get("ref_audio"), payload.get("ref_text"), payload.get("attributes", {})


def _normalize_device_preference(value) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip().lower()
    if v in ("auto", "cpu", "mps", "cuda"):
        return v if v != "auto" else None
    return None


def _resolve_tts_engine(payload: dict) -> tuple[str, object]:
    requested = (payload.get("engine") or "").strip().lower()
    candidates = [requested] if requested else []
    fallback = (config.TTS_ENGINE or "mock").strip().lower()
    candidates.append(fallback)
    last_err = None
    for engine_name in candidates:
        if not engine_name:
            continue
        try:
            return engine_name, get_tts_engine(engine_name)
        except Exception as e:
            last_err = e
            continue

    raise ValueError(f"Engine TTS không hợp lệ ({requested!r}) và không thể fallback vào '{fallback}'.") from last_err


def _chunk_sentences(sentences: list[str], max_chars: int = 240) -> list[str]:
    """Gộp nhiều câu liên tiếp thành 1 khối (<= max_chars) → ít lần gọi model → NHANH hơn nhiều."""
    chunks, cur = [], ""
    for s in sentences:
        if cur and len(cur) + 1 + len(s) > max_chars:
            chunks.append(cur)
            cur = s
        else:
            cur = (cur + " " + s).strip() if cur else s
    if cur:
        chunks.append(cur)
    return chunks


def _run_tts(task: dict) -> None:
    from engines import TTSRequest

    t_start = time.time()
    task.setdefault("timings", {})

    p = task["payload"]
    sentences = split_sentences(p["text"])
    if not sentences:
        raise ValueError("Văn bản trống")

    ref_audio, ref_text, attributes = _resolve_voice(p)
    # Merge tham số nâng cao từ top-level body vào attributes (ưu tiên body vì
    # user vừa chỉnh slider; preset.attributes chỉ là default). Pattern đồng bộ
    # với voice-studio/backend/app.py — drift giữa 2 bản đã bị bắt bởi
    # `voice-contract-test.js:146` (assert `_ADVANCED_KEYS`).
    _ADVANCED_KEYS = ("top_p", "top_k", "repetition_penalty", "diffusion_steps", "generation_speed")
    for _k in _ADVANCED_KEYS:
        _v = p.get(_k)
        if _v is not None:
            try:
                attributes[_k] = float(_v) if _k not in ("top_k", "diffusion_steps") else int(_v)
            except (TypeError, ValueError):
                pass  # giá trị không parse được → engine dùng mặc định
    engine_name, engine = _resolve_tts_engine(p)
    lang = p.get("language", "vi")
    speed = float(p.get("speed", 1.0))
    pitch = float(p.get("pitch", 0.0) or 0.0)
    gap_ms = int(p.get("gap_ms", 100))
    device_preference = _normalize_device_preference(p.get("device_preference"))
    try:
        engine.set_device_preference(device_preference)
    except Exception:
        pass

    job_dir = config.OUTPUT_DIR / task["id"]
    job_dir.mkdir(parents=True, exist_ok=True)

    # ── Fast path: VieNeu trên GPU (CUDA/MPS/XPU) ─────────────────────────
    # Gọi model MỘT lần với toàn bộ văn bản → Vieneu v3 Turbo tự tách câu và
    # gộp nhiều chunk vào cùng 1 forward (static batching, theo độ dài phoneme)
    # → throughput GPU cao hơn hẳn so với gọi rời từng khối. Frontend của app
    # chỉ dùng results.merged nên SRT 1 dòng là đủ (phụ đề thật đi đường Whisper).
    # THEO TÙY CHỌN NGƯỜI DÙNG:
    #   - gpu_batch=False (body) → tắt; True → ép bật; None → tự động.
    #   - Tự động chỉ bật khi gap_ms đang là MẶC ĐỊNH (100) — user chỉnh khoảng
    #     lặng thì đi đường từng khối để gap được áp đúng ý user.
    #   - chunk_chars=0 (muốn từng câu) hoặc env VOICE_VIENEU_NO_BATCH=1 để tắt.
    cc = p.get("chunk_chars")
    cc = 240 if cc is None else int(cc)
    hw = _probe_hardware()
    gpu_batch = p.get("gpu_batch")
    auto_ok = int(p.get("gap_ms", 100)) == 100 and cc != 0
    if (
        engine_name == "vieneu"
        and (gpu_batch is True or (gpu_batch is None and auto_ok))
        and hw.get("device") in ("cuda", "mps", "xpu")
        and not os.environ.get("VOICE_VIENEU_NO_BATCH")
        and len(sentences) > 1
    ):
        task["total"] = 1
        wav = job_dir / "line_000.wav"
        t_synth = time.time()
        engine.synthesize(
            TTSRequest(
                text=p["text"].strip(), language=lang, ref_audio=ref_audio,
                ref_text=ref_text, device_preference=device_preference,
                speed=speed, attributes=attributes,
            ),
            wav,
        )
        task["timings"]["synth_total_ms"] = round((time.time() - t_synth) * 1000, 2)
        if abs(pitch) >= 1e-6:
            pitch_shift_wav(wav, pitch)
        merged_wav = job_dir / "output.wav"
        concat_wavs([wav], merged_wav)
        write_srt([{"text": p["text"].strip(), "duration": wav_duration(merged_wav)}],
                  job_dir / "output.srt")
        mp3 = job_dir / "output.mp3"
        try:
            to_mp3(merged_wav, mp3)
            merged_url = f"/api/files/{task['id']}/output.mp3"
        except Exception:
            merged_url = f"/api/files/{task['id']}/output.wav"
        task["progress"] = 1
        task["results"] = {
            "merged": merged_url,
            "srt": f"/api/files/{task['id']}/output.srt",
            "lines": [{"text": p["text"].strip(), "file": f"/api/files/{task['id']}/output.wav",
                       "duration": round(wav_duration(merged_wav), 2)}],
            "mode": "vieneu-gpu-batch",
        }
        task["timings"]["total_ms"] = round((time.time() - t_start) * 1000, 2)
        return

    # ── Đường tổng quát (OmniVoice/XTTS, VieNeu CPU, chunk_chars=0) ────────
    # TĂNG TỐC: gộp câu thành khối ~240 ký tự (2-4 câu) → giảm số lần gọi model.
    max_chars = cc
    if max_chars > 0:
        t_chunk = time.time()
        sentences = _chunk_sentences(sentences, max_chars)
        task["timings"]["chunking_ms"] = round((time.time() - t_chunk) * 1000, 2)
    task["total"] = len(sentences)

    from concurrent.futures import ThreadPoolExecutor

    parts, srt_items, line_files = [], [], []

    def _post(wav, _pitch):
        # Hậu kỳ chạy ở thread pool: pitch (ffmpeg subprocess) + đo thời lượng
        # song song trong khi model render khối kế tiếp → GPU không phải chờ.
        if abs(_pitch) >= 1e-6:
            pitch_shift_wav(wav, _pitch)
        return wav_duration(wav)

    with ThreadPoolExecutor(max_workers=2) as post:
        futs = []
        t_synth = time.time()
        for i, sent in enumerate(sentences):
            wav = job_dir / f"line_{i:03d}.wav"
            engine.synthesize(
                TTSRequest(
                    text=sent,
                    language=lang,
                    ref_audio=ref_audio,
                    ref_text=ref_text,
                    device_preference=device_preference,
                    speed=speed,
                    attributes=attributes,
                ),
                wav,
            )
            futs.append((sent, wav, post.submit(_post, wav, pitch)))
            task["progress"] = i + 1
        task["timings"]["synth_total_ms"] = round((time.time() - t_synth) * 1000, 2)
        for sent, wav, fut in futs:
            dur = fut.result()
            parts.append(wav)
            srt_items.append({"text": sent, "duration": dur})
            line_files.append({"text": sent, "file": f"/api/files/{task['id']}/{wav.name}", "duration": round(dur, 2)})

    # Ghép + xuất SRT + MP3
    merged_wav = job_dir / "output.wav"
    concat_wavs(parts, merged_wav, gap_ms=gap_ms)
    srt = job_dir / "output.srt"
    write_srt(srt_items, srt, gap_ms=gap_ms)
    mp3 = job_dir / "output.mp3"
    try:
        to_mp3(merged_wav, mp3)
        merged_url = f"/api/files/{task['id']}/output.mp3"
    except Exception:
        merged_url = f"/api/files/{task['id']}/output.wav"

    task["results"] = {
        "merged": merged_url,
        "srt": f"/api/files/{task['id']}/output.srt",
        "lines": line_files,
    }
    task["timings"]["total_ms"] = round((time.time() - t_start) * 1000, 2)


def _run_asr(task: dict) -> None:
    p = task["payload"]
    engine = get_asr_engine(config.ASR_ENGINE)
    r = engine.transcribe(p["audio_path"], language=p.get("language"))
    # Xuất SRT từ segment
    job_dir = config.OUTPUT_DIR / task["id"]
    job_dir.mkdir(parents=True, exist_ok=True)
    srt_items = []
    for s in r["segments"]:
        srt_items.append({"text": s["text"], "duration": max(0.1, s["end"] - s["start"])})
    if srt_items:
        write_srt(srt_items, job_dir / "transcript.srt")
    r["srt"] = f"/api/files/{task['id']}/transcript.srt" if srt_items else None
    task["results"] = r


threading.Thread(target=_worker, daemon=True).start()


# ---- Schemas ----
class TTSBody(BaseModel):
    text: str
    language: str = "vi"
    preset_id: Optional[str] = None
    engine: Optional[str] = None
    ref_audio: Optional[str] = None
    ref_text: Optional[str] = None
    device_preference: Optional[str] = None
    speed: float = 1.0
    # Cao độ theo NỬA CUNG (semitone): -12..+12, 0 = giữ nguyên.
    # OmniVoice/VieNeu/XTTS đều không nhận pitch → backend xử lý hậu kỳ bằng ffmpeg.
    pitch: float = 0.0
    gap_ms: int = 100
    # GPU batch (VieNeu + GPU): None = tự động (chỉ bật khi gap_ms mặc định),
    # True = ép bật, False = tắt hẳn — người dùng toàn quyền.
    gpu_batch: Optional[bool] = None
    # Số ký tự tối đa mỗi khối đọc (gộp nhiều câu để giảm lần gọi model).
    # 0 = tắt gộp, đọc từng câu. Frontend gửi 400 cho kịch bản dài → nhanh hơn.
    chunk_chars: Optional[int] = 240
    attributes: dict = {}
    # Các tham số nâng cao cho sampling/generation (dành riêng cho OmniVoice và các engine hỗ trợ)
    top_p: Optional[float] = None          # 0.0-1.0, nucleus sampling (sáng tạo/ổn định)
    top_k: Optional[int] = None            # số token top-k để lọc
    repetition_penalty: Optional[float] = None  # >1.0 để giảm lặp (VieNeu/OmniVoice)
    generation_speed: Optional[float] = None   # tốc độ generation riêng (OmniVoice)
    diffusion_steps: Optional[int] = None      # số bước diffusion (cho engine hỗ trợ)


class SaveVoiceBody(BaseModel):
    name: str
    ref_audio: Optional[str] = None
    ref_text: str = ""
    tags: list[str] = []
    attributes: dict = {}


# ---- Dò phần cứng (gọi 1 lần rồi cache) ----
_HW_CACHE: dict = {"data": None}


def _probe_hardware() -> dict:
    """Dò thiết bị tính toán + đề xuất thông số đọc tối ưu CHO TỪNG MÁY.

    Máy người dùng rất khác nhau (GPU 4-24GB, CPU 2-56 nhân) → kích thước khối
    đọc (chunk_chars) và độ dài đoạn render tối ưu cũng phải khác. Frontend gọi
    /api/hardware ngay khi backend lên để tự chỉnh — khỏi đo lại mỗi task.
    """
    if _HW_CACHE["data"]:
        return _HW_CACHE["data"]
    info = {
        "device": "cpu", "gpu": None, "vram_gb": 0.0,
        "cpu_cores": os.cpu_count() or 2, "ram_gb": 0.0,
        "torch": None, "cuda_available": False,
    }
    try:
        import torch  # nạp lười — backend chưa cài torch vẫn trả được CPU profile

        info["torch"] = torch.__version__
        if torch.cuda.is_available():
            info["device"] = "cuda"
            info["cuda_available"] = True
            p = torch.cuda.get_device_properties(0)
            info["gpu"] = p.name
            info["vram_gb"] = round(p.total_memory / (1024 ** 3), 1)
        elif getattr(torch, "xpu", None) and torch.xpu.is_available():
            # Intel GPU (Arc) — cần torch bản XPU; VieNeu chạy qua env VOICE_VIENEU_MODE=xpu
            info["device"] = "xpu"
            try:
                info["gpu"] = torch.xpu.get_device_name(0)
            except Exception:
                info["gpu"] = "Intel GPU"
        elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            info["device"] = "mps"
    except Exception:
        pass
    try:
        import psutil  # tuỳ chọn — thiếu thì bỏ qua RAM

        info["ram_gb"] = round(psutil.virtual_memory().total / (1024 ** 3), 1)
    except Exception:
        pass
    cores = info["cpu_cores"]
    if info["device"] in ("cuda", "mps", "xpu"):
        profile = "gpu"
        if info["vram_gb"] >= 6:
            chunk = 600       # VRAM rộng → khối to, giảm số lần gọi model
        elif info["vram_gb"] >= 3.5:
            chunk = 480       # như GTX 1050 Ti 4GB — vừa sức, không sợ OOM
        else:
            chunk = 400
        seg = 500 if chunk >= 480 else 400
    elif cores >= 8:
        profile = "cpu"
        chunk, seg = 400, 350
    else:
        profile = "cpu-weak"
        chunk, seg = 200, 250   # đoạn nhỏ → có audio sớm, không dính trần chờ
    info["profile"] = profile
    info["recommended"] = {"chunk_chars": chunk, "seg_words": seg}
    _HW_CACHE["data"] = info
    return info


@app.get("/api/hardware")
def api_hardware():
    return _probe_hardware()


# ---- Endpoints ----
@app.get("/api/health")
def health():
    return {
        "status": "ok", "uptime": round(time.time() - _started, 1),
        "queued": _QUEUE.qsize(), "tts_engine": config.TTS_ENGINE,
        "asr_engine": config.ASR_ENGINE,
    }


@app.post("/api/prewarm")
def api_prewarm(body: dict = Body(default=None)):
    """Nạp sẵn engine TTS để lần đọc đầu không mất thời gian tải model."""
    engine_name = (body or {}).get("engine")
    if not engine_name:
        engine_name = config.TTS_ENGINE or "mock"
    try:
        _, engine = _resolve_tts_engine({"engine": engine_name})
        engine.load()
        return {"status": "prewarmed", "engine": engine_name}
    except Exception as e:
        raise HTTPException(400, f"Không thể nạp engine {engine_name}: {str(e)}")


@app.get("/api/voices")
def api_voices():
    vs = voicebank.list_voices()
    return {"voices": vs, "count": len(vs)}


@app.post("/api/voices")
def api_save_voice(body: SaveVoiceBody):
    try:
        return voicebank.save_voice(
            body.name, ref_audio=body.ref_audio, ref_text=body.ref_text,
            tags=body.tags, attributes=body.attributes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e) or "Không lưu được giọng")


@app.patch("/api/voices/{pid}")
def api_update_voice(pid: str, fields: dict):
    v = voicebank.update_voice(pid, **fields)
    if v is None:
        raise HTTPException(404, "Không tìm thấy giọng")
    return v


@app.delete("/api/voices/{pid}")
def api_delete_voice(pid: str):
    try:
        if not voicebank.delete_voice(pid):
            raise HTTPException(404, "Không tìm thấy giọng")
    except PermissionError as e:
        raise HTTPException(403, str(e) or "Không xoá được giọng có sẵn")
    return {"deleted": pid}


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    """Tải lên file mẫu âm thanh, trả về đường dẫn cục bộ để dùng làm ref_audio."""
    up_dir = config.DATA_DIR / "uploads"
    up_dir.mkdir(exist_ok=True)
    dst = up_dir / f"{uuid.uuid4().hex[:8]}_{file.filename}"
    with open(dst, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"path": str(dst), "name": file.filename}


@app.post("/api/tts")
def api_tts(body: TTSBody):
    tid = _new_task("tts", body.model_dump())
    return {"task_id": tid, "status": "pending", "poll_url": f"/api/status/{tid}"}


@app.post("/api/asr")
async def api_asr(file: UploadFile = File(...), language: str = Form(None)):
    up_dir = config.DATA_DIR / "uploads"
    up_dir.mkdir(exist_ok=True)
    dst = up_dir / f"{uuid.uuid4().hex[:8]}_{file.filename}"
    with open(dst, "wb") as f:
        shutil.copyfileobj(file.file, f)
    tid = _new_task("asr", {"audio_path": str(dst), "language": language})
    return {"task_id": tid, "status": "pending", "poll_url": f"/api/status/{tid}"}


@app.get("/api/status/{tid}")
def api_status(tid: str):
    t = TASKS.get(tid)
    if not t:
        raise HTTPException(404, "Không tìm thấy task")
    return {
        "id": t["id"], "kind": t["kind"], "status": t["status"],
        "progress": t["progress"], "total": t["total"],
        "results": t["results"], "error": t["error"],
        "timings": t.get("timings"),
    }


@app.get("/api/files/{tid}/{name}")
def api_file(tid: str, name: str):
    path = config.OUTPUT_DIR / tid / name
    if not path.exists():
        raise HTTPException(404, "File không tồn tại")
    return FileResponse(path)


# ---- Phục vụ UI tĩnh (đặt cuối để không nuốt /api) ----
# UI tĩnh là tuỳ chọn: bản đóng gói chỉ ship backend API, không có thư mục ui.
# Nếu mount khi thiếu thư mục, StaticFiles ném RuntimeError khi import app → uvicorn không khởi động được.
if config.UI_DIR.exists():
    app.mount("/", StaticFiles(directory=str(config.UI_DIR), html=True), name="ui")

