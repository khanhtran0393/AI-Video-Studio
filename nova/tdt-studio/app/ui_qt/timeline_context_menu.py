'Timeline clip context menu — CapCut-lite, reusable action catalog.\n\nMột nguồn sự thật cho nhãn / shortcut / điều kiện enable.\nÁp dụng chung cho mọi clip video trên timeline (không hardcode theo 1 file).\n'
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class ContextAction:
    id: 'str'
    label: 'str' = ''
    shortcut: 'str' = ''
    kind: 'str' = 'action'
CLIP_CONTEXT_ACTIONS: 'tuple[ContextAction, ...]' = (ContextAction('duplicate', 'Bản sao'), ContextAction('_sep1', kind='separator'), ContextAction('scene_split', 'Tách cảnh', kind='submenu'), ContextAction('speech', 'Bản chép lời'), ContextAction('stem_sep', 'Tách âm thanh', kind='submenu'), ContextAction('_sep2', kind='separator'), ContextAction('copy', 'Sao chép', 'Ctrl+C'), ContextAction('paste', 'Dán', 'Ctrl+V'), ContextAction('split', 'Tách tại playhead', 'Ctrl+S'), ContextAction('delete', 'Xóa', 'Del'))
SCENE_SPLIT_ACTIONS: 'tuple[ContextAction, ...]' = (ContextAction('scene_split_one', 'Video đang chọn'), ContextAction('scene_split_all', 'Tất cả video trong dự án'))
STEM_SEP_ACTIONS: 'tuple[ContextAction, ...]' = (ContextAction('stem_music', 'Tách nhạc'), ContextAction('stem_vocal', 'Tách giọng nói'), ContextAction('stem_both', 'Tách cả 2'))
STEM_MODE_BY_ACTION = {'stem_music': 'music', 'stem_vocal': 'vocal', 'stem_both': 'both', 'vocal_sep': 'vocal', 'manual': 'both', 'music': 'music', 'vocal': 'vocal', 'both': 'both'}
STEM_MODE_LABELS = {'music': 'Tách nhạc', 'vocal': 'Tách giọng nói', 'both': 'Tách cả 2'}

def normalize_stem_mode(mode: str | None) -> str:
    key = str(mode or '').strip().lower()
    return STEM_MODE_BY_ACTION.get(key, 'both')

def clip_action_enabled(action_id: str, *, has_selection: bool, can_paste: bool, has_video: bool) -> bool:
    return bool(can_paste) if action_id == 'paste' else bool(has_video) if action_id in frozenset({'stem_vocal', 'scene_split_all', 'vocal_sep', 'stem_music', 'speech', 'stem_sep', 'scene_split', 'stem_both', 'scene_split_one'}) else bool(has_selection) if action_id in frozenset({'split', 'duplicate', 'delete', 'copy'}) else False

def apply_stem_separation_intent(values: dict[str, object], mode: str | None) -> str:
    from core.audio_mix_state import migrate_audio_mix_values, sync_legacy_audio_keys
    resolved = normalize_stem_mode(mode)
    migrate_audio_mix_values(values)
    if resolved == 'music':
        values['video_bgm_enabled'] = True
        values['video_bgm_volume'] = 100
        values['video_vocal_enabled'] = False
        values['video_vocal_volume'] = 0
    elif resolved == 'vocal':
        values['video_vocal_enabled'] = True
        values['video_vocal_volume'] = 100
        values['video_bgm_enabled'] = False
        values['video_bgm_volume'] = 0
    else:
        values['video_bgm_enabled'] = True
        values['video_bgm_volume'] = 100
        values['video_vocal_enabled'] = True
        values['video_vocal_volume'] = 100
    values['stem_sep_intent'] = resolved
    sync_legacy_audio_keys(values)
    return resolved

def stem_cache_ready_for_mode(video_path: str, mode: str | None) -> bool:
    import os
    from core.demucs_separate import video_instrumental_stem_cache_path, video_vocal_stem_cache_path
    path = str(video_path or '').strip()
    if path:
        resolved = normalize_stem_mode(mode)
        has_v = os.path.isfile(video_vocal_stem_cache_path(path))
        has_i = os.path.isfile(video_instrumental_stem_cache_path(path))
        return has_i if resolved == 'music' else has_v if resolved == 'vocal' else has_v and has_i
    return False

def ensure_stems_requestable(values: dict[str, object], mode: str | None='vocal') -> bool:
    before = (bool(values.get('video_vocal_enabled')), int(values.get('video_vocal_volume', 0) or 0), bool(values.get('video_bgm_enabled')), int(values.get('video_bgm_volume', 0) or 0))
    apply_stem_separation_intent(values, mode)
    after = (bool(values.get('video_vocal_enabled')), int(values.get('video_vocal_volume', 0) or 0), bool(values.get('video_bgm_enabled')), int(values.get('video_bgm_volume', 0) or 0))
    return before != after