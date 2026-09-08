"""Deeper integration test: verify that the engines forward the advanced
attributes to the underlying model's API call. Uses a fake model that records
the kwargs it was called with — no real TTS model is loaded.

This catches the regression that the previous wiring had: frontend sliders
were silently dropped because the engines never read the attributes dict.

Run: `python nova/scripts/test_voice_engine_wiring.py`.
Đã move từ `voice-studio/backend/tmp_test_engine_wiring.py` sang `nova/scripts/`
theo AGENTS.md §8 (script kiểm định chính thức ở nova/scripts).
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

# nova/scripts/ → nova/voice-studio/backend
ROOT = Path(__file__).resolve().parent.parent / "voice-studio" / "backend"
sys.path.insert(0, str(ROOT))

from engines.base import TTSRequest  # noqa: E402

_OMNI_PKG = "omnivoice"
_OMNI_MODELS = "omnivoice.models"
_OMNI_MODEL = "omnivoice.models.omnivoice"


def _install_omni_stubs(captured: dict) -> None:
    pkg = types.ModuleType(_OMNI_PKG)
    models = types.ModuleType(_OMNI_MODELS)
    model = types.ModuleType(_OMNI_MODEL)

    class FakeGenCfg:
        def __init__(self, **kw):
            self.kwargs = kw

        @classmethod
        def from_dict(cls, d):
            return cls(**d)

    class FakeModel:
        def generate(self, **kw):
            captured["kwargs"] = kw
            import numpy as np
            return [np.zeros(24000, dtype="float32")]

    model.OmniVoice = FakeModel
    model.OmniVoiceGenerationConfig = FakeGenCfg
    models.omnivoice = model
    pkg.models = models
    sys.modules[_OMNI_PKG] = pkg
    sys.modules[_OMNI_MODELS] = models
    sys.modules[_OMNI_MODEL] = model


def test_omnivoice_uses_diffusion_params() -> None:
    """OmniVoice must receive num_step + guidance_scale via generation_config.
    top_p/top_k must NOT leak (OmniVoice has no such field)."""
    from engines import omnivoice as omni_mod

    captured: dict = {}
    _install_omni_stubs(captured)
    eng = omni_mod.OmniVoiceEngine()
    eng._model = sys.modules[_OMNI_MODEL].OmniVoice()

    req = TTSRequest(
        text="xin chào",
        language="vi",
        attributes={
            "diffusion_steps": 24,
            "generation_speed": 1.2,
            "top_p": 0.5,   # IGNORED — OmniVoice has no LLM sampling
            "top_k": 50,
        },
    )
    eng.synthesize(req, _tmp_wav())
    kw = captured["kwargs"]
    assert "generation_config" in kw, f"no gc: {kw!r}"
    gc = kw["generation_config"]
    assert gc.kwargs.get("num_step") == 24, f"num_step: {gc.kwargs!r}"
    # 1.2 → 1.0 + 3.0*1.2 = 4.6
    assert abs(gc.kwargs.get("guidance_scale") - 4.6) < 1e-6, f"gs: {gc.kwargs!r}"
    assert "top_p" not in kw, f"top_p leaked: {kw!r}"
    assert "top_k" not in kw, f"top_k leaked: {kw!r}"
    print("test_omni OK: num_step=24, guidance_scale=4.6, no LLM leak")


def test_vieneu_uses_lm_sampling_params() -> None:
    """VieNeu must receive top_p/top_k/repetition_penalty on infer()."""
    from engines import vieneu as vn_mod

    captured: dict = {}

    class FakeModel:
        def infer(self, **kw):
            captured["kwargs"] = kw
            import numpy as np
            return np.zeros(48000, dtype="float32")

        def close(self):
            pass

    eng = vn_mod.VieNeuEngine()
    eng._model = FakeModel()
    eng._precision, eng._backend, eng._api_base = "int8", None, None

    req = TTSRequest(
        text="xin chào",
        language="vi",
        attributes={
            "top_p": 0.7,
            "top_k": 40,
            "repetition_penalty": 1.5,
            "diffusion_steps": 16,    # IGNORED — VieNeu has no diffusion
            "generation_speed": 0.9,  # IGNORED
        },
    )
    eng.synthesize(req, _tmp_wav())
    kw = captured["kwargs"]
    assert kw.get("top_p") == 0.7, f"top_p: {kw!r}"
    assert kw.get("top_k") == 40, f"top_k: {kw!r}"
    assert kw.get("repetition_penalty") == 1.5, f"rep_pen: {kw!r}"
    assert "diffusion_steps" not in kw, f"diff leaked: {kw!r}"
    assert "generation_speed" not in kw, f"gen leaked: {kw!r}"
    print("test_vieneu OK: top_p=0.7, top_k=40, rep_pen=1.5, no diffusion leak")


def test_backward_compat() -> None:
    """Both engines with empty attributes must behave exactly as before."""
    from engines import omnivoice as omni_mod
    from engines import vieneu as vn_mod

    omni_captured: dict = {}
    _install_omni_stubs(omni_captured)
    omni = omni_mod.OmniVoiceEngine()
    omni._model = sys.modules[_OMNI_MODEL].OmniVoice()
    omni.synthesize(TTSRequest(text="x", language="en", attributes={}), _tmp_wav())
    assert "generation_config" not in omni_captured["kwargs"], omni_captured["kwargs"]

    vn_captured: dict = {}

    class FakeVN:
        def infer(self, **kw):
            vn_captured["kwargs"] = kw
            import numpy as np
            return np.zeros(1000, dtype="float32")

        def close(self):
            pass

    vn = vn_mod.VieNeuEngine()
    vn._model = FakeVN()
    vn.synthesize(TTSRequest(text="x", language="en", attributes={}), _tmp_wav())
    for k in ("top_p", "top_k", "repetition_penalty", "diffusion_steps", "generation_speed"):
        assert k not in vn_captured["kwargs"], f"{k} leaked: {vn_captured['kwargs']!r}"

    print("test_bc OK: empty attrs → no extra kwargs on either engine")


def _tmp_wav() -> Path:
    import tempfile
    f = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    f.close()
    return Path(f.name)


if __name__ == "__main__":
    test_omnivoice_uses_diffusion_params()
    test_vieneu_uses_lm_sampling_params()
    test_backward_compat()
    print("\nALL ENGINE WIRING TESTS PASSED ✓")
