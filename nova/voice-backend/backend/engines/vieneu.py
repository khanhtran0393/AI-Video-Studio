"""Engine TTS dùng VieNeu-TTS (Apache-2.0) — tiếng Việt native + instant voice cloning.

Mặc định chạy VieNeu-TTS v3 Turbo (48 kHz) trên CPU qua ONNX Runtime (torch-free).
Hai chế độ giọng:
  - Built-in theo tên: attributes.voice = "Adam" (xem list_preset_voices()).
  - Clone zero-shot: ref_audio (+ ref_text khuyến nghị).
Remote mode: đặt env VOICE_VIENEU_API_BASE để gọi server LMDeploy thay vì inference local.

Lưu ý: v3 Turbo không nhận tham số `speed` (API hiện tại), nên req.speed bị bỏ qua.
Ngoài ra API không có tham số `language` — VieNeu tự nhận En/Vi code-switching.
"""
from __future__ import annotations

import os
from pathlib import Path

from .base import TTSEngine, TTSRequest


class VieNeuEngine(TTSEngine):
    name = "vieneu"

    def __init__(self) -> None:
        self._model = None
        self._precision = os.environ.get("VOICE_VIENEU_PRECISION", "int8")
        self._backend = os.environ.get("VOICE_VIENEU_BACKEND") or None
        self._api_base = os.environ.get("VOICE_VIENEU_API_BASE") or None

    def load(self) -> None:
        if self._model is not None:
            return
        from vieneu import Vieneu

        # Mode đặc biệt (xpu = Intel GPU, turbo_gpu, fast, standard...) → chỉ truyền
        # mode + device để không đụng tham số của mode mặc định (v3turbo).
        mode = os.environ.get("VOICE_VIENEU_MODE")
        if mode:
            kwargs: dict = {"mode": mode.strip().lower()}
            dev = os.environ.get("VOICE_VIENEU_DEVICE")
            if dev:
                kwargs["device"] = dev.strip()
            self._model = Vieneu(**kwargs)
            return

        kwargs = {"precision": self._precision}
        if self._backend:
            kwargs["backend"] = self._backend
        if self._api_base:
            kwargs.update({"mode": "remote", "api_base": self._api_base})
        # GPU: trần số chunk gộp vào 1 forward (static batching). Mặc định 8 —
        # đủ nhanh trên GPU nhỏ (4GB), tránh tăng vọt VRAM như mặc định 32.
        # Ghi đè bằng env VOICE_VIENEU_MAX_BATCH (GPU lớn → 16/32).
        try:
            kwargs["max_batch_size"] = max(1, int(os.environ.get("VOICE_VIENEU_MAX_BATCH", "8")))
        except ValueError:
            kwargs["max_batch_size"] = 8
        # CPU/ONNX: số thread intra-op (0 = mặc định engine, ~nhân vật lý cap 8).
        try:
            threads = int(os.environ.get("VOICE_VIENEU_THREADS", "0"))
            if threads > 0:
                kwargs["threads"] = threads
        except ValueError:
            pass
        self._model = Vieneu(**kwargs)

    def unload(self) -> None:
        if self._model is not None:
            try:
                self._model.close()
            except Exception:
                pass
        self._model = None

    def synthesize(self, req: TTSRequest, out_path: Path) -> Path:
        self.load()
        import numpy as np
        import soundfile as sf

        attrs = req.attributes or {}
        kwargs: dict = {"text": req.text}

        # Ưu tiên clone zero-shot; nếu không có thì dùng giọng built-in theo tên.
        if req.ref_audio:
            kwargs["ref_audio"] = req.ref_audio
            if req.ref_text:
                kwargs["ref_text"] = req.ref_text
            if attrs.get("denoise"):
                kwargs["denoise"] = True
        elif attrs.get("voice"):
            kwargs["voice"] = attrs["voice"]
        # else: giọng mặc định của model

        # Tham số nâng cao từ frontend (chỉ áp dụng cho v3turbo — engine mặc định
        # của VieNeu). Các engine khác (standard/fast/turbo) hardcode sampling
        # params, nên truyền vào cũng vô hại: hoặc dùng (v3turbo), hoặc bỏ qua
        # im lặng → giữ nguyên hành vi cũ cho máy đang chạy mode khác.
        #   - top_p, top_k, repetition_penalty: 3 tham số LM-sampling chính.
        #   - diffusion_steps, generation_speed: KHÔNG áp dụng cho VieNeu (LM-based,
        #     không phải diffusion). Bỏ qua lộ liễu, KHÔNG map sang field khác
        #     (Luật 10 — không fallback ngầm).
        # Pattern đồng bộ với voice-studio/backend/engines/vieneu.py (drift đã bị
        # bắt bởi voice-contract-test scan).
        for k, conv in (
            ("top_p", float),
            ("top_k", int),
            ("repetition_penalty", float),
        ):
            v = attrs.get(k)
            if v is not None:
                try:
                    kwargs[k] = conv(v)
                except (TypeError, ValueError):
                    pass

        audio = self._model.infer(**kwargs)
        # VieNeu trả np.float32 @ 48 kHz. Ghi PCM 16-bit để khớp pipeline WAV.
        arr = np.asarray(audio)
        if arr.ndim > 1:
            arr = arr[0]
        sr = int(os.environ.get("VOICE_VIENEU_SR", "48000"))
        sf.write(str(out_path), arr.astype(np.float32), sr, subtype="PCM_16")
        return out_path