'Audio intent lúc bấm — 9 key độc lập. Thuần, không Qt, không I/O.'
from __future__ import annotations
import copy
from typing import Any
AUDIO_INTENT_KEYS: 'tuple[str, ...]' = ('subtitle_enabled', 'voice_audio_enabled', 'voice_audio_volume', 'video_vocal_enabled', 'video_vocal_volume', 'video_bgm_enabled', 'video_bgm_volume', 'background_audio_enabled', 'background_audio_volume')
_ENABLED_KEYS = frozenset((key for key in AUDIO_INTENT_KEYS if key.endswith('_enabled')))
_VOLUME_KEYS = frozenset((key for key in AUDIO_INTENT_KEYS if key.endswith('_volume')))

def _as_bool(value: Any) -> bool:
    return bool(value)

def _as_int_volume(value: Any) -> int:
    try:
        pass
    except (TypeError, ValueError):
        return 0

def capture_audio_intent(values: dict[str, Any] | None) -> dict[str, Any]:
    source = values if isinstance(values, dict) else {}
    intent = {}
    for key in AUDIO_INTENT_KEYS:
        intent[key] = (_as_bool if key in _ENABLED_KEYS else _as_int_volume)(source.get(key))
    return copy.deepcopy(intent)

def apply_audio_intent(target_dict: dict[str, Any], intent: dict[str, Any] | None) -> None:
    if isinstance(target_dict, dict):
        payload = intent if isinstance(intent, dict) else {}
        for key in AUDIO_INTENT_KEYS:
            if key not in payload:
                pass
            else:
                target_dict[key] = (_as_bool if key in _ENABLED_KEYS else _as_int_volume)(payload[key])
    else:
        return None

def validate_audio_intent(intent: dict[str, Any] | None) -> list[str]:
    reasons = []
    if isinstance(intent, dict):
        for key in AUDIO_INTENT_KEYS:
            if key not in intent:
                reasons.append(f'thiếu {key}')
                continue
            if key in _ENABLED_KEYS:
                continue
            try:
                volume = int(intent[key])
                enabled_key = key.replace('_volume', '_enabled')
                if volume == 0 and _as_bool(intent.get(enabled_key)):
                    reasons.append(f'{enabled_key} bật nhưng {key}=0 (hợp lệ, giữ nguyên)')
            except (TypeError, ValueError):
                reasons.append(f'{key} không phải số')
        audio_enabled = ('voice_audio_enabled', 'video_vocal_enabled', 'video_bgm_enabled', 'background_audio_enabled')
        if all((not _as_bool(intent.get(key)) for key in audio_enabled)):
            reasons.append('mọi kênh audio tắt')
        return reasons
    return ['intent không phải dict']