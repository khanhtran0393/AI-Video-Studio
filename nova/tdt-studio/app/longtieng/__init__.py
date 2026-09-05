'\nlongtieng — Lồng tiếng (TTS) package cho Video Tools Pro.\n'
try:
    from exporter.ssl_winstore import ensure_windows_ca as _ensure_windows_ca
    _ensure_windows_ca()
except Exception:
    pass
from .longtieng_engine import EDGE_VOICES, LANG_LABELS, VIENEW_VOICES, VIENEW_MODELS, DEFAULT_VIENEW_MODEL, VBEE_VOICES, ENGINE_LABELS, scan_ngochuyen_voices, NGOCHUYEN_VOICES, run_tts_async, generate_all_voices
from .longtieng_merge import merge_voice_audio, stretch_video_for_tts, compute_stretch_plan
from .longtieng_ui import LongTiengPanel
from .longtieng_translator import run_full_pipeline as run_translator_pipeline
__all__ = ['LongTiengPanel', 'EDGE_VOICES', 'LANG_LABELS', 'VIENEW_VOICES', 'VIENEW_MODELS', 'DEFAULT_VIENEW_MODEL', 'VBEE_VOICES', 'ENGINE_LABELS', 'NGOCHUYEN_VOICES', 'scan_ngochuyen_voices', 'run_tts_async', 'generate_all_voices', 'merge_voice_audio', 'stretch_video_for_tts', 'compute_stretch_plan', 'run_translator_pipeline']