"""Engine TTS dùng OmniVoice (k2-fsa, Apache-2.0).

600+ ngôn ngữ, tiếng Việt native, clone giọng + thiết kế giọng theo thuộc tính.
Cài ở venv riêng (.venv-omni) vì cần transformers>=5.3 (xung đột với coqui-tts).

Ba chế độ đều qua model.generate():
  - Clone:  ref_audio (+ ref_text tuỳ chọn, không có thì auto Whisper)
  - Design: instruct="female, low pitch, british accent"
  - Auto:   không prompt gì
"""
from __future__ import annotations

import os
from pathlib import Path

from .base import TTSEngine, TTSRequest

# Cache ref_text đã transcribe: giọng clone KHÔNG có text mẫu thì model TỰ
# transcribe ref_audio bằng Whisper BÊN TRONG mỗi lần generate() → văn bản dài
# (nhiều khối) là N lần Whisper lặp lại cùng một file mẫu. Transcribe đúng 1 lần
# rồi cache theo (đường dẫn + mtime + ngôn ngữ) → các khối sau miễn phí.
_REF_TEXT_CACHE: dict[str, str] = {}


def _ref_text_auto(ref_audio: str, language: str) -> str:
    try:
        mtime = Path(ref_audio).stat().st_mtime_ns
    except OSError:
        return ""
    key = f"{ref_audio}:{mtime}:{language}"
    if key in _REF_TEXT_CACHE:
        return _REF_TEXT_CACHE[key]
    try:
        from engines import get_asr_engine  # lazy — tránh vòng import khi nạp module

        r = get_asr_engine("whisper").transcribe(ref_audio, language=language or None)
        text = (r.get("text") or "").strip()
    except Exception as e:  # noqa — hỏng ASR: degrade lộ liễu, model tự transcribe như cơ chế cũ
        print(f"[omnivoice] WARN pre-transcribe ref_audio lỗi ({e}) — model sẽ tự transcribe trong generate()")
        return ""
    if text:
        _REF_TEXT_CACHE[key] = text
    return text


class OmniVoiceEngine(TTSEngine):
    name = "omnivoice"

    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"

    def load(self) -> None:
        if self._model is not None:
            return
        import torch
        from omnivoice import OmniVoice

        # TỐI ƯU CPU: torch mặc định dùng hết logical cores (hyper-thread) —
        # chặn về số nhân VẬT LÝ thường nhanh hơn. Env VOICE_TORCH_THREADS ghi đè.
        try:
            threads = int(os.environ.get("VOICE_TORCH_THREADS", "0"))
        except ValueError:
            threads = 0
        if threads <= 0:
            try:
                import psutil

                threads = psutil.cpu_count(logical=False) or 0
            except Exception:
                threads = 0
        if threads > 0:
            torch.set_num_threads(threads)

        if torch.backends.mps.is_available():
            self._device = "mps"
        elif torch.cuda.is_available():
            self._device = "cuda"
        else:
            self._device = "cpu"
        dtype = torch.float32 if self._device == "cpu" else torch.float16
        repo = os.environ.get("VOICE_OMNI_MODEL", "k2-fsa/OmniVoice")
        self._model = OmniVoice.from_pretrained(repo, device_map=self._device, dtype=dtype)

    def unload(self) -> None:
        self._model = None
        try:
            import torch

            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except Exception:
            pass

    def synthesize(self, req: TTSRequest, out_path: Path) -> Path:
        self.load()
        import soundfile as sf
        from omnivoice.models.omnivoice import OmniVoiceGenerationConfig

        kwargs = {"text": req.text, "speed": float(req.speed)}

        # Chuẩn hoá số (tiếng Việt dùng num2words) nếu bật.
        if req.attributes.get("normalize_text"):
            kwargs["normalize_text"] = True

        # Tham số nâng cao từ frontend (đọc từ attributes — _run_tts đã merge top-level
        # field vào đây, xem app.py:148 block _ADVANCED_KEYS):
        #   - diffusion_steps   → num_step (OmniVoiceGenerationConfig)
        #   - generation_speed  → guidance_scale (đảo nghịch: slider thấp = guidance thấp
        #                        = sinh nhanh hơn nhưng kém chất lượng; slider cao = ngược lại)
        #   - top_p / top_k / repetition_penalty: OmniVoice diffusion KHÔNG có các tham số
        #     LLM-sampling này → bỏ qua, KHÔNG fallback ngầm sang num_step/guidance_scale
        #     (Luật 10). Nếu sau này model bổ sung, sẽ map thẳng tên field.
        # Pattern đồng bộ với voice-studio/backend/engines/omnivoice.py — trước đây file
        # này đọc `req.top_p`/etc. trực tiếp nhưng TTSRequest không có những field đó →
        # AttributeError tại runtime. Drift đã được voice-contract-test scan bắt.
        gen_cfg_overrides: dict = {}
        raw_diff_steps = req.attributes.get("diffusion_steps")
        if raw_diff_steps is not None:
            try:
                n = int(raw_diff_steps)
                if n > 0:
                    gen_cfg_overrides["num_step"] = n
            except (TypeError, ValueError):
                pass

        raw_gen_speed = req.attributes.get("generation_speed")
        if raw_gen_speed is not None:
            try:
                # Slider generation_speed ∈ [0.5, 1.5] (1.0 = mặc định).
                # Map sang guidance_scale ∈ [1.0, 4.0] theo: gs = 1.0 + 3.0 * speed
                # (speed < 1.0 → gs < 4.0, nhanh hơn; speed > 1.0 → gs > 4.0, chậm/chất hơn).
                speed_norm = max(0.1, min(2.0, float(raw_gen_speed)))
                gen_cfg_overrides["guidance_scale"] = 1.0 + 3.0 * speed_norm
            except (TypeError, ValueError):
                pass

        if gen_cfg_overrides:
            kwargs["generation_config"] = OmniVoiceGenerationConfig.from_dict(gen_cfg_overrides)

        instruct = req.attributes.get("instruct")
        if req.ref_audio:
            kwargs["ref_audio"] = req.ref_audio
            if req.ref_text:
                kwargs["ref_text"] = req.ref_text
            else:
                # Không có text mẫu: transcribe ĐÚNG 1 LẦN (cache theo file mẫu) thay
                # vì để model tự Whisper bên trong MỖI lần generate() (mỗi khối một lần).
                rt = _ref_text_auto(req.ref_audio, req.language)
                if rt:
                    kwargs["ref_text"] = rt
                # rt rỗng → không truyền ref_text, model tự xử lý như cơ chế cũ
        elif instruct:
            kwargs["instruct"] = instruct
        # else: auto voice (không prompt)

        audio = self._model.generate(**kwargs)
        # audio: list các np.ndarray (T,) @ 24kHz. Ghi PCM 16-bit để khớp pipeline.
        sf.write(str(out_path), audio[0], 24000, subtype="PCM_16")
        return out_path
