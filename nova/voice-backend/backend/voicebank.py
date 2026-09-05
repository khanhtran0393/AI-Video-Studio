"""Voice Bank — lưu/nạp/xoá preset giọng dưới dạng JSON + file mẫu âm thanh."""
from __future__ import annotations

import json
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

from config import VOICEBANK_DIR

# Thư mục giọng "nhà máy" đóng gói theo app (đọc-only nguồn) — nạp vào VoiceBank khi khởi động.
PRESETS_DIR = Path(__file__).resolve().parent / "presets"


def _preset_path(pid: str) -> Path:
    return VOICEBANK_DIR / f"{pid}.json"


def seed_factory() -> int:
    """Nạp giọng NHÀ MÁY vào VoiceBank. Idempotent, chạy mỗi lần mở app.

    Ba nguồn:
      - Có ``file`` WAV: copy vào voicebank, dùng làm ref_audio (clone).
      - Không file nhưng ``attributes.voice``: giọng built-in của engine (VieNeu).
      - Không file nhưng ``attributes.instruct``: giọng "thiết kế" theo mô tả (OmniVoice)
        — dùng cho các ngôn ngữ ngoài Việt/Anh (zh, ja, ko, es, fr, de...).
    Bỏ qua mục không có nguồn → không tạo giọng rỗng.
    """
    manifest = PRESETS_DIR / "presets.json"
    if not manifest.exists():
        return 0
    try:
        items = json.loads(manifest.read_text(encoding="utf-8"))
    except Exception:
        return 0
    n = 0
    for it in items:
        pid = it.get("id")
        if not pid:
            continue
        attrs = it.get("attributes") or {}
        wav_name = it.get("file")
        builtin = str(attrs.get("voice") or "").strip()
        instruct = str(attrs.get("instruct") or "").strip()
        dst = None
        if wav_name:
            src = PRESETS_DIR / wav_name
            if not src.exists():
                continue  # chưa có file mẫu → bỏ qua, không tạo giọng rỗng
            dst = VOICEBANK_DIR / f"{pid}{src.suffix or '.wav'}"
            try:
                if (not dst.exists()) or dst.stat().st_size != src.stat().st_size:
                    shutil.copy(src, dst)
            except Exception:
                continue
        elif not builtin and not instruct:
            continue  # không có nguồn nào (wav/builtin/instruct) → bỏ qua
        prev = get_voice(pid) or {}
        voice = {
            "id": pid,
            "name": it.get("name", pid),
            "ref_audio": str(dst) if dst else None,
            "ref_text": it.get("ref_text", ""),
            "tags": it.get("tags", []),
            "attributes": attrs,
            "is_favorite": bool(it.get("is_favorite", False)),
            "is_factory": True,
            "created_at": prev.get("created_at", time.time()),
        }
        _preset_path(pid).write_text(json.dumps(voice, ensure_ascii=False, indent=2), encoding="utf-8")
        n += 1
    return n


def list_voices() -> list[dict]:
    out = []
    for p in sorted(VOICEBANK_DIR.glob("*.json")):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    # Yêu thích lên đầu.
    out.sort(key=lambda v: (not v.get("is_favorite", False), v.get("name", "")))
    return out


def get_voice(pid: str) -> Optional[dict]:
    p = _preset_path(pid)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def save_voice(name: str, ref_audio: Optional[str] = None, ref_text: str = "",
               tags: Optional[list[str]] = None, attributes: Optional[dict] = None) -> dict:
    name = (name or "").strip()
    if not name:
        raise ValueError("Đặt tên cho giọng trước.")
    pid = "spk_" + uuid.uuid4().hex[:8]
    stored_ref = None
    if ref_audio:
        src = Path(ref_audio)
        if not src.exists():
            raise ValueError("Không tìm thấy file giọng mẫu.")
        dst = VOICEBANK_DIR / f"{pid}{src.suffix or '.wav'}"
        shutil.copy(src, dst)
        stored_ref = str(dst)
    voice = {
        "id": pid,
        "name": name,
        "ref_audio": stored_ref,
        "ref_text": ref_text,
        "tags": tags or [],
        "attributes": attributes or {},
        "is_favorite": False,
        "is_factory": False,
        "created_at": time.time(),
    }
    _preset_path(pid).write_text(json.dumps(voice, ensure_ascii=False, indent=2), encoding="utf-8")
    return voice


def update_voice(pid: str, **fields) -> Optional[dict]:
    v = get_voice(pid)
    if v is None:
        return None
    fields.pop("id", None)
    # Giọng nhà máy không được đổi cờ / file mẫu qua PATCH.
    if v.get("is_factory"):
        fields.pop("is_factory", None)
        fields.pop("ref_audio", None)
    v.update(fields)
    _preset_path(pid).write_text(json.dumps(v, ensure_ascii=False, indent=2), encoding="utf-8")
    return v


def delete_voice(pid: str) -> bool:
    v = get_voice(pid)
    if v is None:
        return False
    if v.get("is_factory"):
        raise PermissionError("Không xoá được giọng có sẵn")
    # Xoá file mẫu kèm theo nếu nằm trong voicebank.
    ref = v.get("ref_audio")
    if ref:
        try:
            rp = Path(ref).resolve()
            if rp.parent == VOICEBANK_DIR.resolve() and rp.exists():
                rp.unlink(missing_ok=True)
        except OSError:
            pass
    _preset_path(pid).unlink(missing_ok=True)
    return True
