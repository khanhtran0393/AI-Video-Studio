'State âm thanh 4 nguồn — migrate từ toggle «tắt» cũ.'
from __future__ import annotations
import os

def migrate_audio_mix_values(values: dict[str, object]) -> None:
    if values.get('_audio_mix_v2'):
        sync_legacy_audio_keys(values)
        return None
    av = int(values.get('audio_volume', 100) or 0)
    rv = bool(values.get('remove_original_vocal'))
    rb = bool(values.get('remove_original_bgm'))
    mute = bool(values.get('mute_original_audio'))
    if mute or av <= 0:
        values['video_vocal_enabled'] = False
        values['video_bgm_enabled'] = False
        values['video_vocal_volume'] = 0
        values['video_bgm_volume'] = 0
    elif rv and rb:
        values['video_vocal_enabled'] = False
        values['video_bgm_enabled'] = False
        values['video_vocal_volume'] = 0
        values['video_bgm_volume'] = 0
    else:
        values['video_vocal_enabled'] = not rv
        values['video_bgm_enabled'] = not rb
        values['video_vocal_volume'] = av if values['video_vocal_enabled'] else 0
        values['video_bgm_volume'] = av if values['video_bgm_enabled'] else 0
    values.setdefault('video_vocal_stem_path', '')
    values.setdefault('video_instrumental_stem_path', '')
    values['_audio_mix_v2'] = True
    sync_legacy_audio_keys(values)

def sync_legacy_audio_keys(values: dict[str, object]) -> None:
    v_on = bool(values.get('video_vocal_enabled'))
    b_on = bool(values.get('video_bgm_enabled'))
    v_vol = int(values.get('video_vocal_volume', 0) or 0)
    b_vol = int(values.get('video_bgm_volume', 0) or 0)
    values['mute_original_audio'] = not v_on and (not b_on)
    values['audio_volume'] = max(v_vol, b_vol, 0)
    values['remove_original_vocal'] = not v_on and b_on
    values['remove_original_bgm'] = not b_on and v_on
    if v_on and b_on:
        values['remove_original_vocal'] = False
        values['remove_original_bgm'] = False
    if not v_on and (not b_on):
        values['remove_original_vocal'] = False
        values['remove_original_bgm'] = False
    values['vocal_sep_cache_path'] = str(values.get('video_vocal_stem_path', '') or values.get('video_instrumental_stem_path', '') or '')

def video_mix_needs_stems(values: dict[str, object]) -> bool:
    v_on = bool(values.get('video_vocal_enabled'))
    b_on = bool(values.get('video_bgm_enabled'))
    v_vol = max(0, int(values.get('video_vocal_volume', 0) or 0))
    b_vol = max(0, int(values.get('video_bgm_volume', 0) or 0))
    use_v = v_on and v_vol > 0
    use_b = b_on and b_vol > 0
    return (False if use_v and use_b and (v_vol == b_vol) else True) if use_v or use_b else False

def original_video_volume(values: dict[str, object]) -> int:
    migrate_audio_mix_values(values)
    vols = []
    if bool(values.get('video_vocal_enabled')):
        vols.append(int(values.get('video_vocal_volume', 0) or 0))
    if bool(values.get('video_bgm_enabled')):
        vols.append(int(values.get('video_bgm_volume', 0) or 0))
    return max(0, min(100, max(vols))) if vols else 0

def set_original_video_volume(values: dict[str, object], volume: int) -> None:
    migrate_audio_mix_values(values)
    vol = max(0, min(100, int(volume)))
    intent = str(values.get('stem_sep_intent', 'both') or 'both').strip().lower()
    if intent not in frozenset({'music', 'both', 'vocal'}):
        intent = 'both'
    if vol <= 0:
        values['video_vocal_enabled'] = False
        values['video_bgm_enabled'] = False
        values['video_vocal_volume'] = 0
        values['video_bgm_volume'] = 0
    elif intent == 'music':
        values['video_bgm_enabled'] = True
        values['video_bgm_volume'] = vol
        values['video_vocal_enabled'] = False
        values['video_vocal_volume'] = 0
    elif intent == 'vocal':
        values['video_vocal_enabled'] = True
        values['video_vocal_volume'] = vol
        values['video_bgm_enabled'] = False
        values['video_bgm_volume'] = 0
    else:
        values['video_vocal_enabled'] = True
        values['video_bgm_enabled'] = True
        values['video_vocal_volume'] = vol
        values['video_bgm_volume'] = vol
    sync_legacy_audio_keys(values)

def sync_video_stem_paths_for_file(values: dict[str, object], video_path: str) -> None:
    from core.demucs_separate import video_instrumental_stem_cache_path, video_vocal_stem_cache_path
    path = str(video_path or '').strip()
    if path:
        vocal_cache = video_vocal_stem_cache_path(path)
        inst_cache = video_instrumental_stem_cache_path(path)
        values['video_vocal_stem_path'] = vocal_cache if os.path.isfile(vocal_cache) else ''
        values['video_instrumental_stem_path'] = inst_cache if os.path.isfile(inst_cache) else ''
        sync_legacy_audio_keys(values)
    else:
        values['video_vocal_stem_path'] = ''
        values['video_instrumental_stem_path'] = ''
        sync_legacy_audio_keys(values)
        return None