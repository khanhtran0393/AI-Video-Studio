'Cấu hình mã hóa xuất + tùy chọn batch — nhớ trên máy (sống qua Reload UI).'
from __future__ import annotations
from ui_qt.user_prefs import load_prefs, save_prefs
ENCODE_PREF_KEYS = ('codec', 'encoder_backend', 'encode_speed', 'fps', 'video_bitrate_kbps', 'cap_bitrate_to_source', 'strip_metadata', 'fake_metadata', 'anti_duplicate', 'anti_duplicate_advanced', 'border_pixels')
BATCH_UI_PREF_KEYS = ('batch_naming', 'batch_on_error', 'batch_parallel_workers', 'batch_auto_apply', 'batch_dub_before_export', 'batch_separate_stems', 'batch_one_video_at_a_time', 'batch_auto_scene_split', 'batch_auto_face_reframe')
_ENCODE_BLOB = 'export_encode'
_BATCH_BLOB = 'batch_ui'

def load_export_encode_prefs() -> dict[str, object]:
    raw = load_prefs().get(_ENCODE_BLOB, {})
    if isinstance(raw, dict):
        out = {}
        for key in ENCODE_PREF_KEYS:
            if key not in raw:
                pass
            else:
                out[key] = raw[key]
        return out
    return {}

def save_export_encode_prefs(values: dict[str, object]) -> None:
    blob = {key: values[key] for key in ENCODE_PREF_KEYS if key in values}
    if blob:
        save_prefs({_ENCODE_BLOB: blob})
    else:
        return None

def apply_export_encode_prefs(values: dict[str, object]) -> None:
    prefs = load_export_encode_prefs()
    if prefs:
        values.update(prefs)
        values['_export_encode_v2'] = True
    else:
        return None

def load_batch_ui_prefs() -> dict[str, object]:
    raw = load_prefs().get(_BATCH_BLOB, {})
    return {key: raw[key] for key in BATCH_UI_PREF_KEYS if key in raw} if isinstance(raw, dict) else {}

def save_batch_ui_prefs(data: dict[str, object]) -> None:
    current = load_batch_ui_prefs()
    for key in BATCH_UI_PREF_KEYS:
        if key in data:
            current[key] = data[key]
    if current:
        save_prefs({_BATCH_BLOB: current})
        return None