"""Engine TTS thật dùng XTTS-v2 (coqui-tts) — clone giọng zero-shot.

Hai chế độ nạp model:
  1. Checkpoint cục bộ (vd viXTTS — có tiếng Việt): đặt env VOICE_XTTS_DIR trỏ tới
     thư mục chứa config.json + model.pth + vocab.json. Nạp qua API Xtts thấp cấp.
  2. Model gốc coqui: VOICE_XTTS_MODEL (mặc định xtts_v2). KHÔNG có tiếng Việt.

Tải viXTTS: chạy scripts/download_vixtts.py -> lưu vào data/models/viXTTS,
rồi set VOICE_XTTS_DIR=<đường-dẫn-đó>.
"""
from __future__ import annotations

import os
from pathlib import Path

from .base import TTSEngine, TTSRequest

# Ngôn ngữ XTTS-v2 gốc; viXTTS thêm "vi".
_XTTS_LANGS = {
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko", "hi",
}

# Mẫu giọng mặc định khi người dùng không đưa file mẫu (chế độ "thiết kế giọng").
_DEFAULT_REF = Path(__file__).resolve().parent.parent.parent / "data" / "default_speaker.wav"


class XTTSEngine(TTSEngine):
    name = "xtts"

    def __init__(self) -> None:
        self._api = None       # chế độ coqui TTS.api
        self._model = None     # chế độ checkpoint (viXTTS)
        self._config = None
        self._device = "cpu"

    def _pick_device(self) -> str:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
        return "cpu"

    def load(self) -> None:
        if self._api is not None or self._model is not None:
            return
        self._device = self._pick_device()
        ckpt_dir = os.environ.get("VOICE_XTTS_DIR", "")

        if ckpt_dir and Path(ckpt_dir).is_dir():
            # --- Chế độ checkpoint viXTTS ---
            from TTS.tts.configs.xtts_config import XttsConfig
            from TTS.tts.models.xtts import Xtts

            from .vi_patch import apply_patch  # thêm hỗ trợ tiếng Việt cho tokenizer
            apply_patch()

            cfg = XttsConfig()
            cfg.load_json(str(Path(ckpt_dir) / "config.json"))
            model = Xtts.init_from_config(cfg)
            model.load_checkpoint(
                cfg, checkpoint_dir=ckpt_dir, use_deepspeed=False,
                vocab_path=str(Path(ckpt_dir) / "vocab.json"),
            )
            # MPS đôi khi kém ổn với XTTS; cho phép ép CPU qua env.
            if self._device == "mps" and os.environ.get("VOICE_XTTS_FORCE_CPU"):
                self._device = "cpu"
            model.to(self._device)
            self._model, self._config = model, cfg
        else:
            # --- Chế độ model gốc coqui ---
            from TTS.api import TTS

            name = os.environ.get("VOICE_XTTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
            self._api = TTS(name).to(self._device)

    def unload(self) -> None:
        self._api = None
        self._model = None
        self._config = None
        try:
            import torch

            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except Exception:
            pass

    def _lang(self, req: TTSRequest) -> str:
        lang = req.language.lower()
        if lang == "vi":
            return "vi"  # chỉ hợp lệ khi dùng viXTTS
        return lang if lang in _XTTS_LANGS else "en"

    def _builtin_speaker(self) -> str | None:
        """Tên giọng dựng sẵn đầu tiên (dùng khi không có file mẫu)."""
        try:
            if self._api is not None:
                names = self._api.synthesizer.tts_model.speaker_manager.speaker_names
            elif self._model is not None:
                names = list(self._model.speaker_manager.speakers.keys())
            else:
                return None
            return names[0] if names else None
        except Exception:
            return None

    def synthesize(self, req: TTSRequest, out_path: Path) -> Path:
        self.load()
        lang = self._lang(req)
        # Ưu tiên file mẫu để clone; nếu không có -> giọng dựng sẵn (chế độ thiết kế).
        ref = req.ref_audio or (str(_DEFAULT_REF) if _DEFAULT_REF.exists() else None)
        speaker = None if ref else (req.attributes.get("speaker") or self._builtin_speaker())
        if ref is None and speaker is None:
            raise ValueError("Cần file mẫu âm thanh hoặc một giọng dựng sẵn")

        if self._model is not None:
            # Chế độ viXTTS
            import torch
            import torchaudio

            kwargs = {"language": lang, "speed": req.speed}
            if ref:
                kwargs["speaker_wav"] = ref
            else:
                kwargs["speaker_id"] = speaker
            out = self._model.synthesize(req.text, self._config, **kwargs)
            wav = out["wav"]
            if not isinstance(wav, torch.Tensor):
                wav = torch.tensor(wav)
            torchaudio.save(str(out_path), wav.unsqueeze(0).cpu(), 24000)
        else:
            kwargs = {"text": req.text, "language": lang, "file_path": str(out_path), "speed": req.speed}
            if ref:
                kwargs["speaker_wav"] = ref
            else:
                kwargs["speaker"] = speaker
            self._api.tts_to_file(**kwargs)
        return out_path
