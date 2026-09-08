"""One-shot smoke: import app + engines, instantiate TTSBody with all 5
advanced fields, confirm import chain still works. No model load.

Run: `python nova/scripts/test_voice_smoke_imports.py`.
Đã move từ `voice-studio/backend/tmp_smoke_imports.py` sang `nova/scripts/`
theo AGENTS.md §8 (script kiểm định chính thức ở nova/scripts).
"""
import sys
from pathlib import Path

# nova/scripts/ → nova/voice-studio/backend
ROOT = Path(__file__).resolve().parent.parent / "voice-studio" / "backend"
sys.path.insert(0, str(ROOT))

import app as app_mod  # noqa: E402
import engines.omnivoice  # noqa: E402
import engines.vieneu  # noqa: E402
import engines.xtts  # noqa: E402

assert hasattr(app_mod, "TTSBody"), "TTSBody missing"
b = app_mod.TTSBody(
    text="hi",
    top_p=0.5,
    top_k=10,
    repetition_penalty=1.1,
    diffusion_steps=20,
    generation_speed=0.8,
)
print("TTSBody fields:", b.top_p, b.top_k, b.repetition_penalty, b.diffusion_steps, b.generation_speed)
print("engines import OK: omnivoice, vieneu, xtts")
print("SMOKE OK")
