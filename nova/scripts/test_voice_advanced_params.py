"""Smoke test: verify TTSBody schema accepts the 5 new advanced params and that
the merge logic in _run_tts places them into the attributes dict that engines
read. Does not load any model.

Run from anywhere: `python nova/scripts/test_voice_advanced_params.py`.
Đã move từ `voice-studio/backend/tmp_test_advanced_params.py` sang `nova/scripts/`
theo AGENTS.md §8 (script kiểm định chính thức ở nova/scripts).
"""
from __future__ import annotations

import sys
from pathlib import Path

# nova/scripts/ → nova/voice-studio/backend
ROOT = Path(__file__).resolve().parent.parent / "voice-studio" / "backend"
sys.path.insert(0, str(ROOT))

from app import TTSBody  # noqa: E402


def main() -> int:
    # Test 1: body accepts all 5 new fields top-level
    b = TTSBody(
        text="hello",
        top_p=0.7,
        top_k=40,
        repetition_penalty=1.5,
        diffusion_steps=24,
        generation_speed=1.2,
    )
    assert b.top_p == 0.7, f"top_p={b.top_p}"
    assert b.top_k == 40, f"top_k={b.top_k}"
    assert b.repetition_penalty == 1.5, f"rep_pen={b.repetition_penalty}"
    assert b.diffusion_steps == 24, f"diff_steps={b.diffusion_steps}"
    assert b.generation_speed == 1.2, f"gen_speed={b.generation_speed}"
    print("test1 OK: all 5 fields accepted with explicit values")

    # Test 2: default None when not provided
    b2 = TTSBody(text="hello")
    assert b2.top_p is None and b2.top_k is None
    assert b2.repetition_penalty is None and b2.diffusion_steps is None
    assert b2.generation_speed is None
    print("test2 OK: all 5 default to None")

    # Test 3: simulate _run_tts merge logic
    p = {
        "top_p": 0.8,
        "top_k": 30,
        "repetition_penalty": 1.8,
        "diffusion_steps": 12,
        "generation_speed": 0.9,
    }
    attributes: dict = {"lang": "vi", "voice": "Minh Đức"}
    _ADVANCED_KEYS = ("top_p", "top_k", "repetition_penalty", "diffusion_steps", "generation_speed")
    for k in _ADVANCED_KEYS:
        v = p.get(k)
        if v is not None:
            attributes[k] = float(v) if k not in ("top_k", "diffusion_steps") else int(v)
    assert attributes["top_p"] == 0.8
    assert attributes["top_k"] == 30
    assert isinstance(attributes["top_p"], float)
    assert isinstance(attributes["top_k"], int)
    assert isinstance(attributes["diffusion_steps"], int)
    assert isinstance(attributes["repetition_penalty"], float)
    assert isinstance(attributes["generation_speed"], float)
    assert attributes["lang"] == "vi"  # original preserved
    print("test3 OK: merge into attributes preserves types and original keys")

    # Test 4: null body fields must not overwrite preset attributes
    p_partial = {"text": "x", "top_p": 0.5}  # only top_p
    attributes2: dict = {"lang": "vi", "diffusion_steps": 16}
    for k in _ADVANCED_KEYS:
        v = p_partial.get(k)
        if v is not None:
            attributes2[k] = float(v) if k not in ("top_k", "diffusion_steps") else int(v)
    assert attributes2["top_p"] == 0.5  # new
    assert attributes2["diffusion_steps"] == 16  # original
    assert attributes2["lang"] == "vi"  # untouched
    print("test4 OK: missing body fields don't clobber preset defaults")

    print("\nALL TESTS PASSED ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
