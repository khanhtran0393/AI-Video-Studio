'Bảng tóm tắt nhanh — chụp lại toàn bộ cấu hình đang edit thành danh sách\ndòng dữ liệu (nhãn + giá trị + nơi cần nhảy tới nếu muốn sửa). Module THUẦN\n(không import Qt) để test được độc lập với việc dựng UI.\n'
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from core.video_look import COLOR_FILTER_CHOICES, TRANSITION_LABEL_BY_STYLE
from ui_qt.background_layers import background_layers_master_enabled, ensure_background_layers
from ui_qt.blend_layers import blend_layers_master_enabled, ensure_blend_layers
from ui_qt.blur_zones import ensure_blur_zones
from ui_qt.media_overlays import ensure_media_overlays, media_overlays_master_enabled
from ui_qt.state import ProjectState
from ui_qt.text_overlays import ensure_text_overlays
from ui_qt.user_prefs import get_last_export_folder
_WORKFLOW_STASH_KEY = '_workflow_node_stash'
_LANGUAGE_LABELS: 'dict[str, str]' = {'auto': 'Tự nhận biết', 'vi': 'Tiếng Việt', 'en': 'Tiếng Anh', 'zh': 'Tiếng Trung', 'ja': 'Tiếng Nhật', 'ko': 'Tiếng Hàn', 'th': 'Tiếng Thái', 'fr': 'Tiếng Pháp', 'de': 'Tiếng Đức', 'es': 'Tiếng Tây Ban Nha'}
_VIDEO_EFFECT_LABELS: 'dict[str, str]' = {'none': 'Không dùng', 'grain': 'Film grain', 'vignette': 'Vignette', 'vintage': 'Vintage', 'lightleak': 'Light leak', 'glow': 'Glow', 'lightsweep': 'Quét sáng', 'stripe': 'Sọc nhiễu anti-reup', 'tv': 'TV cũ CRT', 'camera': 'Camera', 'camera_rec': 'Camera REC', 'custom': 'Tuỳ chỉnh từ file'}
_COLOR_FILTER_LABELS: 'dict[str, str]' = dict(((value, label) for label, value in COLOR_FILTER_CHOICES))
_TRANSITION_MODE_LABELS: 'dict[str, str]' = {'one_for_all': '1 kiểu cho tất cả', 'random': 'Ngẫu nhiên (pool)'}
_NAMING_MODE_LABELS: 'dict[str, str]' = {'stem_edit': 'Tên gốc + _edit', 'stem_xuat': 'Tên gốc + _xuat', 'title_target': 'Tiêu đề đích (up luôn)', 'stem_exact': 'Giữ nguyên tên gốc', 'queue_index': 'Theo thứ tự queue'}

@dataclass(frozen=True, slots=True)
class SummaryRow:
    __doc__ = '1 dòng trong bảng tóm tắt: nhãn + giá trị hiện tại + nơi nhảy tới khi sửa.'
    label: 'str'
    value: 'str'
    module_id: 'str'
    focus_node: 'str | None' = None
    focus_control: 'str | None' = None
    overlay_part: 'str | None' = None
    subtitle_part: 'str | None' = None
    toggle_key: 'str | None' = None

@dataclass(frozen=True, slots=True)
class WorkflowNode:
    __doc__ = '1 node quy trình xuất (thứ tự thật) — chỉ Bật/Tắt, không chi tiết giá trị.'
    id: 'str'
    label: 'str'
    enabled: 'bool'
    always_on: 'bool' = False
    module_id: 'str' = 'media'
    focus_node: 'str | None' = None
    focus_control: 'str | None' = None
    overlay_part: 'str | None' = None
    subtitle_part: 'str | None' = None
    togglable: 'bool' = True

@dataclass(frozen=True, slots=True)
class BoardRow:
    __doc__ = '1 dòng bảng quản lý toàn cục (quy trình hoặc cấu hình phụ).'
    id: 'str'
    label: 'str'
    value: 'str'
    enabled: 'bool'
    group: 'str'
    always_on: 'bool' = False
    togglable: 'bool' = False
    node_id: 'str | None' = None
    toggle_key: 'str | None' = None
    module_id: 'str' = 'media'
    focus_node: 'str | None' = None
    focus_control: 'str | None' = None
    overlay_part: 'str | None' = None
    subtitle_part: 'str | None' = None

def _on_off(flag: bool) -> str:
    return 'Bật' if flag else 'Tắt'

def _yes_no(flag: bool) -> str:
    return 'Có' if flag else 'Không'

def _pct(values: dict, key: str, default: int=0) -> str:
    try:
        return f'{int(values.get(key, default) or default)}%'
    except (TypeError, ValueError):
        return f'{default}%'

def _selected_asset(state: ProjectState):
    return next((asset for asset in state.assets if asset.id == state.selected_id), None)

def _has_overlay_assets(values: dict) -> bool:
    return any((str(item.get('path', '') or '').strip() for item in ensure_media_overlays(values)))

def _has_blend_assets(values: dict) -> bool:
    return any((str(item.get('path', '') or '').strip() for item in ensure_blend_layers(values)))

def _has_background_assets(values: dict) -> bool:
    return any((str(item.get('path', '') or '').strip() for item in ensure_background_layers(values)))

def _text_overlay_items_with_content(values: dict) -> list[dict]:
    return [item for item in ensure_text_overlays(values) if str(item.get('content') or '').strip()]

def _has_text_overlay_content(values: dict) -> bool:
    return True if _text_overlay_items_with_content(values) else bool(str(values.get('text_overlay_content', '') or '').strip())

def _blur_style_label(values: dict) -> str:
    style = str(values.get('blur_zone_style', 'blur') or 'blur').strip().lower()
    return {'blur': 'Làm mờ', 'black': 'Đen', 'color': 'Màu'}.get(style, style)

def _mix_audio_enabled(values: dict) -> bool:
    return bool(values.get('video_bgm_enabled') or values.get('video_vocal_enabled') or values.get('background_audio_enabled') or values.get('voice_audio_enabled') or (not bool(values.get('mute_original_audio'))))

def _transition_active(values: dict) -> bool:
    trans_ms = int(values.get('timeline_transition_ms', 0) or 0)
    trans_style = str(values.get('timeline_transition_style', 'cut') or 'cut')
    return trans_ms > 0 and trans_style != 'cut'

def _stash_get(values: dict) -> dict:
    raw = values.get(_WORKFLOW_STASH_KEY)
    if isinstance(raw, dict):
        return raw
    bag = {}
    values[_WORKFLOW_STASH_KEY] = bag
    return bag

def workflow_node_enabled(values: dict, node_id: str) -> bool:
    if node_id in ('source', 'export'):
        return True
    if node_id == 'scene':
        from core.scene_clip_fx import effective_auto_scene_split
        return effective_auto_scene_split(values)
    if node_id == 'face':
        from core.scene_clip_fx import effective_auto_face_reframe
        return effective_auto_face_reframe(values)
    if node_id == 'subtitle':
        return bool(values.get('subtitle_enabled'))
    if node_id == 'title':
        return bool(values.get('video_title_enabled'))
    if node_id == 'text':
        items = _text_overlay_items_with_content(values)
        return any((bool(item.get('enabled', True)) for item in items)) if items else bool(values.get('text_overlay_enabled')) and bool(str(values.get('text_overlay_content', '') or '').strip())
    if node_id == 'tts':
        return bool(values.get('voice_audio_enabled'))
    if node_id == 'background':
        return _has_background_assets(values) and background_layers_master_enabled(values)
    if node_id == 'overlay':
        return _has_overlay_assets(values) and media_overlays_master_enabled(values)
    if node_id == 'blend':
        return _has_blend_assets(values) and blend_layers_master_enabled(values)
    if node_id == 'blur':
        return bool(values.get('blur_zone_enabled'))
    if node_id == 'filter':
        from core.lut_stack import active_lut_layers, lut_stack_master_enabled
        return True if str(values.get('color_filter', 'none') or 'none') != 'none' else bool(active_lut_layers(values.get('color_lut_stack'), master=True)) if lut_stack_master_enabled(values) else False
    if node_id == 'effect':
        from core.video_effect_stack import active_effect_layers, normalize_effect_stack
        if bool(values.get('video_effect_master_enabled', True)):
            stack = normalize_effect_stack(values.get('video_effect_stack'))
            return bool(active_effect_layers(stack, master=True)) if stack else str(values.get('video_effect', 'none') or 'none') not in frozenset({'', 'none'})
        return False
    return bool(values.get('logo_enabled')) and bool(str(values.get('logo_path', '') or '').strip()) if node_id == 'logo' else bool(values.get('cover_enabled')) and bool(str(values.get('cover_path', '') or '').strip()) if node_id == 'cover' else _transition_active(values) if node_id == 'transition' else _mix_audio_enabled(values) if node_id == 'mix' else False

def apply_workflow_node_enabled(values: dict[str, object], node_id: str, enabled: bool) -> tuple[bool, str]:
    if node_id in ('source', 'export'):
        return (False, 'Bước này luôn Bật')
    want = bool(enabled)
    stash = _stash_get(values)
    if node_id == 'scene':
        values['batch_auto_scene_split'] = want
        return (True, '')
    if node_id == 'face':
        values['batch_auto_face_reframe'] = want
        return (True, '')
    if node_id == 'subtitle':
        values['subtitle_enabled'] = want
        return (True, '')
    if node_id == 'title':
        values['video_title_enabled'] = want
        return (True, '')
    if node_id == 'text':
        if not want or _has_text_overlay_content(values):
            items = ensure_text_overlays(values)
            if want:
                prev = stash.get('text_overlay_enabled_flags')
                if isinstance(prev, dict) and items:
                    for idx, item in enumerate(items):
                        key = str(item.get('id') or idx)
                        if key in prev:
                            item['enabled'] = bool(prev[key])
                        elif str(item.get('content') or '').strip():
                            item['enabled'] = True
                else:
                    for item in items:
                        if str(item.get('content') or '').strip():
                            item['enabled'] = True
                values['text_overlays'] = items
                values['text_overlay_enabled'] = True
            else:
                stash['text_overlay_enabled_flags'] = {str(item.get('id') or idx): bool(item.get('enabled', True)) for idx, item in enumerate(items)}
                for item in items:
                    item['enabled'] = False
                values['text_overlays'] = items
                values['text_overlay_enabled'] = False
            return (True, '')
        return (False, 'Chưa có chữ phụ họa — nhập chữ trước')
    if node_id == 'tts':
        values['voice_audio_enabled'] = want
        return (True, '')
    if node_id == 'background':
        if not want or _has_background_assets(values):
            values['background_layers_master_enabled'] = want
            if want:
                values['background'] = 'custom'
            return (True, '')
        return (False, 'Chưa có nền — chọn file trước')
    if node_id == 'overlay':
        if not want or _has_overlay_assets(values):
            values['media_overlays_master_enabled'] = want
            return (True, '')
        return (False, 'Chưa có lớp phủ — chọn file trước')
    if node_id == 'blend':
        if not want or _has_blend_assets(values):
            values['blend_layers_master_enabled'] = want
            return (True, '')
        return (False, 'Chưa có hòa trộn — chọn file trước')
    if node_id == 'blur':
        values['blur_zone_enabled'] = want
        if want:
            ensure_blur_zones(values)
        return (True, '')
    if node_id == 'filter':
        current = str(values.get('color_filter', 'none') or 'none')
        if want:
            values['color_lut_stack_master_enabled'] = True
            prev = str(stash.get('color_filter', '') or '').strip()
            values['color_filter'] = prev if prev and prev != 'none' else 'warm'
        else:
            values['color_lut_stack_master_enabled'] = False
            if current != 'none':
                stash['color_filter'] = current
            values['color_filter'] = 'none'
        return (True, '')
    if node_id == 'effect':
        current = str(values.get('video_effect', 'none') or 'none')
        if want:
            values['video_effect_master_enabled'] = True
            prev = str(stash.get('video_effect', '') or '').strip()
            values['video_effect'] = prev if prev and prev != 'none' else 'grain'
        else:
            values['video_effect_master_enabled'] = False
            if current != 'none':
                stash['video_effect'] = current
        return (True, '')
    if node_id == 'logo':
        path = str(values.get('logo_path', '') or '').strip()
        if not want or path:
            values['logo_enabled'] = want
            return (True, '')
        return (False, 'Chưa có logo — chọn file trước')
    if node_id == 'cover':
        path = str(values.get('cover_path', '') or '').strip()
        if not want or path:
            values['cover_enabled'] = want
            return (True, '')
        return (False, 'Chưa có ảnh bìa — chọn file trước')
    if node_id == 'transition':
        if want:
            prev = stash.get('transition')
            if isinstance(prev, dict):
                values['timeline_transition_style'] = str(prev.get('style', 'fade') or 'fade')
                values['timeline_transition_ms'] = int(prev.get('ms', 250) or 250)
            else:
                values['timeline_transition_style'] = 'fade'
                values['timeline_transition_ms'] = 250
            if not _transition_active(values):
                values['timeline_transition_style'] = 'fade'
                values['timeline_transition_ms'] = 250
        else:
            stash['transition'] = {'style': str(values.get('timeline_transition_style', 'fade') or 'fade'), 'ms': int(values.get('timeline_transition_ms', 250) or 250)}
            values['timeline_transition_style'] = 'cut'
            values['timeline_transition_ms'] = 0
        return (True, '')
    if node_id == 'mix':
        keys = ('mute_original_audio', 'video_bgm_enabled', 'video_vocal_enabled', 'background_audio_enabled', 'voice_audio_enabled')
        if want:
            prev = stash.get('mix')
            if isinstance(prev, dict):
                for key in keys:
                    if key in prev:
                        values[key] = prev[key]
            else:
                values['mute_original_audio'] = False
                values['video_bgm_enabled'] = True
                values['video_vocal_enabled'] = True
        else:
            stash['mix'] = {key: values.get(key) for key in keys}
            values['mute_original_audio'] = True
            values['video_bgm_enabled'] = False
            values['video_vocal_enabled'] = False
            values['background_audio_enabled'] = False
            values['voice_audio_enabled'] = False
        return (True, '')
    return (False, 'Không hỗ trợ Bật/Tắt node này')

def build_workflow_nodes(state: ProjectState) -> list[WorkflowNode]:
    values = state.values
    return [WorkflowNode('source', 'Nguồn video', True, always_on=True, togglable=False, module_id='media'), WorkflowNode('scene', 'Tách cảnh', workflow_node_enabled(values, 'scene'), module_id='media', focus_node='image_adjustments', focus_control='batch_auto_scene_split'), WorkflowNode('face', 'Căn mặt', workflow_node_enabled(values, 'face'), module_id='media', focus_node='image_adjustments', focus_control='batch_auto_face_reframe'), WorkflowNode('background', 'Nền', workflow_node_enabled(values, 'background'), module_id='effects', overlay_part='background'), WorkflowNode('subtitle', 'Phụ đề', workflow_node_enabled(values, 'subtitle'), module_id='subtitle', subtitle_part='edit'), WorkflowNode('title', 'Tiêu đề', workflow_node_enabled(values, 'title'), module_id='subtitle', overlay_part='title', focus_control='video_title_enabled'), WorkflowNode('text', 'Chữ phụ họa', workflow_node_enabled(values, 'text'), module_id='subtitle', overlay_part='text', focus_control='text_overlay_enabled'), WorkflowNode('tts', 'Giọng đọc', workflow_node_enabled(values, 'tts'), module_id='tts', focus_control='voice_audio_enabled'), WorkflowNode('overlay', 'Lớp phủ', workflow_node_enabled(values, 'overlay'), module_id='effects', overlay_part='overlay'), WorkflowNode('blend', 'Hòa trộn', workflow_node_enabled(values, 'blend'), module_id='effects', overlay_part='blend'), WorkflowNode('blur', 'Vùng mờ', workflow_node_enabled(values, 'blur'), module_id='media', overlay_part='blur', focus_control='blur_zone_enabled'), WorkflowNode('filter', 'Bộ lọc', workflow_node_enabled(values, 'filter'), module_id='filters', focus_control='color_filter'), WorkflowNode('effect', 'Hiệu ứng', workflow_node_enabled(values, 'effect'), module_id='look', overlay_part='effect', focus_control='video_effect'), WorkflowNode('logo', 'Logo', workflow_node_enabled(values, 'logo'), module_id='effects', overlay_part='logo'), WorkflowNode('cover', 'Ảnh bìa', workflow_node_enabled(values, 'cover'), module_id='media', focus_node='image_adjustments', focus_control='cover_enabled'), WorkflowNode('transition', 'Chuyển tiếp', workflow_node_enabled(values, 'transition'), module_id='transitions', focus_control='timeline_transition_ms'), WorkflowNode('mix', 'Mix âm', workflow_node_enabled(values, 'mix'), module_id='tts', focus_node='audio_mix'), WorkflowNode('export', 'Xuất video', True, always_on=True, togglable=False, module_id='batch')]

def _workflow_value_hint(state: ProjectState, node_id: str, *, live_overrides: dict[str, object] | None) -> str:
    values = state.values
    overrides = live_overrides or {}
    if node_id == 'source':
        videos = [a for a in state.assets if getattr(a, 'kind', '') == 'video']
        if videos:
            selected = _selected_asset(state)
            name = ''
            if selected is not None and getattr(selected, 'path', ''):
                name = Path(str(selected.path)).name
            return f'{len(videos)} video' + f' · {name}' if name else f'{len(videos)} video' + ''
        return 'Chưa có video'
    if node_id == 'scene':
        clip_count = 0
        try:
            from core.timeline_clips import clips_from_values, clips_on_track
            clip_count = len(clips_on_track(clips_from_values(values), 0))
        except Exception:
            clip_count = 0
        return f'{clip_count} clip' if clip_count else 'Tự tách khi xuất'
    if node_id == 'face':
        plate = str(values.get('face_reframe_plate', '1:1') or '1:1')
        return f'khung {plate}'
    if node_id == 'background':
        from ui_qt.background_layers import ensure_background_layers
        n = sum((1 for item in ensure_background_layers(values) if str(item.get('path', '') or '').strip()))
        return f'{n} lớp' if n else 'Chưa có file'
    if node_id == 'subtitle':
        lang = str(values.get('subtitle_target_language', 'vi') or 'vi')
        return _LANGUAGE_LABELS.get(lang, lang)
    if node_id == 'title':
        content = str(values.get('video_title_content', '') or '').strip()
        if content:
            short = content if len(content) <= 28 else content[:25] + '…'
            return short
        return 'Từ tên file' if values.get('video_title_from_filename', True) else 'Trống'
    if node_id == 'text':
        items = _text_overlay_items_with_content(values)
        n = len(items) or (1 if str(values.get('text_overlay_content', '') or '').strip() else 0)
        if n:
            sample = ''
            sample = str((items[0].get('content') if items else values.get('text_overlay_content', '')) or '').strip()
            short = sample if len(sample) <= 18 else sample[:15] + '…'
            return f'{n} lớp' + f' · {short}' if short else f'{n} lớp' + ''
        return 'Chưa có chữ'
    if node_id == 'tts':
        return _pct(values, 'voice_audio_volume', 100)
    if node_id == 'overlay':
        n = sum((1 for item in ensure_media_overlays(values) if str(item.get('path', '') or '').strip()))
        return f'{n} lớp' if n else 'Chưa có file'
    if node_id == 'blend':
        n = sum((1 for item in ensure_blend_layers(values) if str(item.get('path', '') or '').strip()))
        return f'{n} lớp' if n else 'Chưa có file'
    if node_id == 'blur':
        zones = ensure_blur_zones(values)
        n = sum((1 for z in zones if z.get('enabled', True)))
        return f'{_blur_style_label(values)} · {n} vùng'
    if node_id == 'filter':
        fid = str(values.get('color_filter', 'none') or 'none')
        filter_label = _COLOR_FILTER_LABELS.get(fid, fid)
        from core.lut_stack import normalize_lut_stack
        lut_names = [str(item.get('title') or item.get('rel') or 'LUT') for item in normalize_lut_stack(values.get('color_lut_stack')) if item.get('enabled', True)]
        if lut_names:
            extra = ' + '.join(lut_names[:3])
            return extra if fid == 'none' else f'{filter_label} · {extra}'
        return filter_label
    if node_id == 'effect':
        from core.video_effect_stack import ensure_effect_stack, effect_title
        stack = ensure_effect_stack(values)
        if stack:
            n = len(stack)
            eid = str(values.get('selected_video_effect_id') or stack[-1]['id'])
            label = effect_title(eid)
            return label if n == 1 else f'{label} · {n} FX'
        eid = str(values.get('video_effect', 'none') or 'none')
        return _VIDEO_EFFECT_LABELS.get(eid, eid)
    if node_id == 'logo':
        path = str(values.get('logo_path', '') or '').strip()
        return Path(path).name if path else 'Chưa có file'
    if node_id == 'cover':
        path = str(values.get('cover_path', '') or '').strip()
        if path:
            try:
                sec = float(values.get('cover_duration_sec', 2.0) or 2.0)
            except (TypeError, ValueError):
                sec = 2.0
            return f' · {sec}gs'
        return 'Chưa có file'
    if node_id == 'transition':
        style = str(values.get('timeline_transition_style', 'fade') or 'fade')
        return 'Cắt thẳng' if style == 'cut' and int(values.get('timeline_transition_ms', 0) or 0) <= 0 else TRANSITION_LABEL_BY_STYLE.get(style, style)
    if node_id == 'mix':
        parts = []
        if not values.get('mute_original_audio'):
            parts.append('gốc')
        if values.get('voice_audio_enabled'):
            parts.append('TTS')
        if values.get('background_audio_enabled'):
            parts.append('BGM+')
        return ' · '.join(parts) if parts else 'Tắt âm'
    if node_id == 'export':
        folder = get_last_export_folder('') or '(chưa chọn)'
        naming = str(overrides.get('batch_naming', values.get('batch_naming', 'stem_edit')) or 'stem_edit')
        short = _NAMING_MODE_LABELS.get(naming, naming)
        try:
            folder_name = Path(folder).name if folder and folder != '(chưa chọn)' else folder
        except Exception:
            folder_name = folder
        return f'{short} · {folder_name}'
    return ''

def build_summary_board(state: ProjectState, *, live_overrides: dict[str, object] | None) -> tuple[list[BoardRow], list[BoardRow]]:
    values = state.values
    overrides = live_overrides or {}
    pipe = []
    for node in build_workflow_nodes(state):
        pipe.append(BoardRow(id=f'pipe:{node.id}', label=node.label, value=_workflow_value_hint(state, node.id, live_overrides=overrides), enabled=bool(node.enabled), group='pipe', always_on=bool(node.always_on), togglable=bool(node.togglable) and (not node.always_on), node_id=node.id, module_id=node.module_id, focus_node=node.focus_node, focus_control=node.focus_control, overlay_part=node.overlay_part, subtitle_part=node.subtitle_part))
    target_lang = str(values.get('subtitle_target_language', 'vi') or 'vi')
    asset = _selected_asset(state)
    source_dir = ''
    if asset is not None and getattr(asset, 'path', ''):
        try:
            source_dir = str(Path(asset.path).expanduser().resolve().parent)
        except OSError:
            source_dir = str(Path(asset.path).parent)
    naming_mode = str(overrides.get('batch_naming', values.get('batch_naming', 'stem_edit')) or 'stem_edit')
    parallel = overrides.get('batch_parallel_workers', values.get('batch_parallel_workers', 0))
    try:
        parallel_i = int(parallel or 0)
    except (TypeError, ValueError):
        parallel_i = 0
    extra = [BoardRow(id='extra:lang', label='Ngôn ngữ dịch', value=_LANGUAGE_LABELS.get(target_lang, target_lang), enabled=True, group='extra', module_id='subtitle', subtitle_part='ai'), BoardRow(id='extra:video_bgm', label='Nhạc gốc', value=f"{_on_off(bool(values.get('video_bgm_enabled')))} · {_pct(values, 'video_bgm_volume', 100)}", enabled=bool(values.get('video_bgm_enabled')), group='extra', togglable=True, toggle_key='video_bgm_enabled', module_id='tts', focus_node='audio_mix'), BoardRow(id='extra:bgm_add', label='Nhạc nền thêm', value=f"{_on_off(bool(values.get('background_audio_enabled')))} · {_pct(values, 'background_audio_volume', 35)}", enabled=bool(values.get('background_audio_enabled')), group='extra', togglable=True, toggle_key='background_audio_enabled', module_id='tts', focus_control='background_audio_enabled'), BoardRow(id='extra:export_folder', label='Thư mục xuất', value=get_last_export_folder('') or '(chưa chọn)', enabled=True, group='extra', module_id='batch'), BoardRow(id='extra:source_folder', label='Thư mục nguồn', value=source_dir or '(chưa có video)', enabled=True, group='extra', module_id='media'), BoardRow(id='extra:naming', label='Kiểu tên đầu ra', value=_NAMING_MODE_LABELS.get(naming_mode, naming_mode), enabled=True, group='extra', module_id='batch'), BoardRow(id='extra:parallel', label='Luồng render', value='Tự động (theo máy)' if parallel_i == 0 else f'{parallel_i} luồng', enabled=True, group='extra', module_id='batch')]
    return (pipe, extra)

def active_pipeline_labels(state: ProjectState) -> list[str]:
    return [n.label for n in build_workflow_nodes(state) if n.enabled]

def build_summary_rows(state: ProjectState, *, live_overrides: dict[str, object] | None) -> list[SummaryRow]:
    values = state.values
    overrides = live_overrides or {}
    rows = []
    target_lang = str(values.get('subtitle_target_language', 'vi') or 'vi')
    rows.append(SummaryRow('Ngôn ngữ dịch', _LANGUAGE_LABELS.get(target_lang, target_lang), 'subtitle', subtitle_part='ai'))
    translate_on = bool(values.get('subtitle_translate_enabled', True))
    rows.append(SummaryRow('Tự dịch phụ đề', _on_off(translate_on), 'subtitle', subtitle_part='ai', focus_control='subtitle_translate_enabled', toggle_key='subtitle_translate_enabled'))
    voice_on = bool(values.get('voice_audio_enabled'))
    rows.append(SummaryRow('Giọng đọc (TTS)', f"{_on_off(voice_on)} · {_pct(values, 'voice_audio_volume', 100)}", 'tts', focus_control='voice_audio_enabled', toggle_key='voice_audio_enabled'))
    bgm_video_on = bool(values.get('video_bgm_enabled'))
    rows.append(SummaryRow('Nhạc gốc (trong video)', f"{_on_off(bgm_video_on)} · {_pct(values, 'video_bgm_volume', 100)}", 'tts', focus_node='audio_mix', toggle_key='video_bgm_enabled'))
    bgm_add_on = bool(values.get('background_audio_enabled'))
    rows.append(SummaryRow('Nhạc nền (nhạc thêm)', f"{_on_off(bgm_add_on)} · {_pct(values, 'background_audio_volume', 35)}", 'tts', focus_control='background_audio_enabled', toggle_key='background_audio_enabled'))
    rows.append(SummaryRow('Phụ đề', _on_off(bool(values.get('subtitle_enabled'))), 'subtitle', subtitle_part='edit', toggle_key='subtitle_enabled'))
    rows.append(SummaryRow('Thư mục xuất', get_last_export_folder('') or '(chưa chọn)', 'batch'))
    asset = _selected_asset(state)
    source_dir = ''
    if asset is not None and getattr(asset, 'path', ''):
        try:
            source_dir = str(Path(asset.path).expanduser().resolve().parent)
        except OSError:
            source_dir = str(Path(asset.path).parent)
    rows.append(SummaryRow('Thư mục nguồn', source_dir or '(chưa có video)', 'media'))
    naming_mode = str(overrides.get('batch_naming', values.get('batch_naming', 'stem_edit')) or 'stem_edit')
    rows.append(SummaryRow('Kiểu tên video đầu ra', _NAMING_MODE_LABELS.get(naming_mode, naming_mode), 'batch'))
    parallel = overrides.get('batch_parallel_workers', values.get('batch_parallel_workers', 0))
    try:
        parallel_i = int(parallel or 0)
    except (TypeError, ValueError):
        parallel_i = 0
    rows.append(SummaryRow('Luồng chạy render', 'Tự động (theo máy)' if parallel_i == 0 else f'{parallel_i} luồng', 'batch'))
    has_overlay = any((str(item.get('path', '') or '').strip() for item in ensure_media_overlays(values)))
    rows.append(SummaryRow('Lớp phủ (overlay)', _yes_no(has_overlay), 'effects', overlay_part='overlay'))
    has_blend = any((str(item.get('path', '') or '').strip() for item in ensure_blend_layers(values)))
    rows.append(SummaryRow('Hòa trộn (blend)', _yes_no(has_blend), 'effects', overlay_part='blend'))
    effect = str(values.get('video_effect', 'none') or 'none')
    rows.append(SummaryRow('Hiệu ứng', _VIDEO_EFFECT_LABELS.get(effect, effect), 'look', overlay_part='effect', focus_control='video_effect'))
    color_filter = str(values.get('color_filter', 'none') or 'none')
    from core.lut_stack import normalize_lut_stack
    lut_names = [str(item.get('title') or item.get('rel') or 'LUT') for item in normalize_lut_stack(values.get('color_lut_stack')) if item.get('enabled', True)]
    filter_label = _COLOR_FILTER_LABELS.get(color_filter, color_filter)
    if lut_names:
        extra = ' + '.join(lut_names[:3])
        if len(lut_names) > 3:
            extra += f' +{len(lut_names) - 3}'
        filter_label = extra if color_filter == 'none' else f'{filter_label} · {extra}'
    rows.append(SummaryRow('Bộ lọc', filter_label, 'filters', focus_control='color_filter'))
    trans_ms = int(values.get('timeline_transition_ms', 0) or 0)
    trans_style = str(values.get('timeline_transition_style', 'cut') or 'cut')
    trans_mode = str(values.get('timeline_transition_mode', 'one_for_all') or 'one_for_all')
    trans_active = _transition_active(values)
    trans_value = f'{_yes_no(trans_active)} · {TRANSITION_LABEL_BY_STYLE.get(trans_style, trans_style)} · {_TRANSITION_MODE_LABELS.get(trans_mode, trans_mode)}' if trans_active else 'Không (cắt thẳng)'
    rows.append(SummaryRow('Chuyển tiếp', trans_value, 'transitions', focus_control='timeline_transition_ms'))
    clip_count = 0
    try:
        from core.timeline_clips import clips_from_values, clips_on_track
        clip_count = len(clips_on_track(clips_from_values(values), 0))
    except Exception:
        clip_count = 0
    auto_scene = bool(values.get('batch_auto_scene_split'))
    scene_now = _yes_no(clip_count > 1) + (f' ({clip_count} clip)' if clip_count else '')
    rows.append(SummaryRow('Tự tách cảnh (khi xuất)', f'{_on_off(auto_scene)} · hiện tại: {scene_now}', 'media', focus_node='image_adjustments', focus_control='batch_auto_scene_split', toggle_key='batch_auto_scene_split'))
    auto_face = bool(values.get('batch_auto_face_reframe'))
    plate = str(values.get('face_reframe_plate', '1:1') or '1:1')
    pan = str(values.get('face_reframe_pan_axis', 'horizontal') or 'horizontal')
    pan_label = {'horizontal': 'ngang', 'vertical': 'dọc', 'free': 'tự do', 'random': 'random'}.get(pan, pan)
    subject = str(values.get('face_reframe_subject_mode', 'face_then_object') or 'face_then_object')
    subject_label = {'face_then_object': 'mặt→vật', 'face': 'chỉ mặt', 'object': 'chỉ vật', 'center': 'giữa'}.get(subject, subject)
    rows.append(SummaryRow('Tự căn mặt theo video', f'{_on_off(auto_face)} · khung {plate} · nhích {pan_label} · {subject_label}', 'media', focus_node='image_adjustments', focus_control='batch_auto_face_reframe', toggle_key='batch_auto_face_reframe'))
    logo_path = str(values.get('logo_path', '') or '').strip()
    logo_on = bool(values.get('logo_enabled')) and bool(logo_path)
    rows.append(SummaryRow('Logo', f'{_on_off(logo_on)} · {Path(logo_path).name}' if logo_path else 'Không', 'effects', overlay_part='logo', toggle_key='logo_enabled' if logo_path else None))
    return rows