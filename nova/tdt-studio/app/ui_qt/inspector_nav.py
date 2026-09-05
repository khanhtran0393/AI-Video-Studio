'CapCut-style inspector navigation — một bảng map duy nhất cho timeline/preview/library.'
from __future__ import annotations
from dataclasses import dataclass
MEDIA_MODULE_IDS = frozenset({'media', 'exporter'})

def normalize_module_id(module_id: str) -> str:
    mid = str(module_id or '').strip()
    return 'media' if mid in MEDIA_MODULE_IDS else mid

@dataclass(frozen=True, slots=True)
class InspectorTarget:
    module_id: 'str'
    focus_node: 'str | None' = None
    focus_control: 'str | None' = None
    overlay_part: 'str | None' = None
    subtitle_part: 'str | None' = None
    preview_kind: 'str | None' = None
    library_nav: 'str | None' = None
    status_hint: 'str' = ''
PREVIEW_KIND_TARGETS: 'dict[str, InspectorTarget]' = {'video': InspectorTarget('media', focus_node='image_adjustments', preview_kind='video', status_hint='Hình — transform / crop'), 'subtitle': InspectorTarget('subtitle', focus_node='subtitles', subtitle_part='edit', preview_kind='subtitle', status_hint='Phụ đề — sửa bảng câu'), 'title': InspectorTarget('subtitle', overlay_part='title', focus_control='video_title_enabled', preview_kind='title', status_hint='Văn bản — tiêu đề video'), 'text': InspectorTarget('subtitle', overlay_part='text', focus_control='text_overlay_enabled', preview_kind='text', status_hint='Văn bản — chữ phụ họa'), 'logo': InspectorTarget('effects', overlay_part='logo', focus_control='logo_opacity', preview_kind='logo', library_nav='logo', status_hint='Lớp — logo'), 'overlay': InspectorTarget('effects', overlay_part='media', focus_control='effect_overlay_opacity', preview_kind='overlay', library_nav='overlay', status_hint='Lớp — lớp phủ'), 'blend': InspectorTarget('effects', overlay_part='blend', preview_kind='blend', library_nav='blend', status_hint='Lớp — hòa trộn'), 'background': InspectorTarget('effects', overlay_part='background', preview_kind='background', library_nav='background', status_hint='Lớp — nền'), 'blur': InspectorTarget('media', focus_node='image_adjustments', focus_control='blur_zone_enabled', preview_kind='blur', status_hint='Điều chỉnh — vùng mờ')}
_OVERLAY_PART_LIBRARY_NAV = {'media': 'overlay', 'overlay': 'overlay', 'blend': 'blend', 'background': 'background', 'logo': 'logo'}

def library_nav_for_overlay_part(overlay_part: str | None) -> str | None:
    return _OVERLAY_PART_LIBRARY_NAV.get(str(overlay_part or '').strip())

def target_for_preview_kind(kind: str) -> InspectorTarget | None:
    return PREVIEW_KIND_TARGETS.get(str(kind or '').strip())

def target_for_timeline_layer(layer_id: str) -> InspectorTarget | None:
    lid = str(layer_id or '')
    if lid in frozenset({'track-video_0', 'track-video'}):
        return PREVIEW_KIND_TARGETS['video']
    if lid == 'track-subtitle':
        return PREVIEW_KIND_TARGETS['subtitle']
    if lid == 'track-sfx':
        return InspectorTarget('tts', focus_node='audio_mix', focus_control='sfx_section', status_hint='Âm thanh — SFX')
    if lid.startswith('dyn_audio:'):
        return InspectorTarget('tts', focus_node='audio_mix', status_hint='Âm thanh — track tách')
    if lid == 'layer-blur':
        return PREVIEW_KIND_TARGETS['blur']
    if lid == 'layer-video-title':
        return PREVIEW_KIND_TARGETS['title']
    if lid == 'layer-text-overlay' or lid.startswith('layer-text-overlay-'):
        return PREVIEW_KIND_TARGETS['text']
    if lid in frozenset({'layer-logo', 'layer-text-logo'}):
        return PREVIEW_KIND_TARGETS['logo']
    if lid.startswith('layer-blend-') or lid == 'track-blend_layer':
        return PREVIEW_KIND_TARGETS['blend']
    if lid.startswith('layer-background-') or lid == 'track-background_layer':
        return PREVIEW_KIND_TARGETS['background']
    if lid.startswith('layer-overlay-') or lid == 'track-media_overlay':
        return PREVIEW_KIND_TARGETS['overlay']
    if lid == 'layer-voice':
        return InspectorTarget('tts', focus_node='audio_mix', focus_control='tts_engine', status_hint='Âm thanh — giọng đọc / TTS')
    if lid == 'layer-source-audio':
        return InspectorTarget('tts', focus_node='audio_mix', focus_control='mute_original_audio', status_hint='Âm thanh — âm gốc')
    if lid == 'layer-bgm':
        return InspectorTarget('tts', focus_node='audio_mix', focus_control='background_audio_enabled', status_hint='Âm thanh — nhạc nền')

def target_for_asset_kind(kind: str) -> InspectorTarget | None:
    k = str(kind or '').strip()
    if k == 'video':
        return InspectorTarget('media', focus_node='video_output', status_hint='Media — video')
    if k == 'subtitle':
        return InspectorTarget('subtitle', focus_node='subtitles', status_hint='Phụ đề')
    if k == 'audio':
        return InspectorTarget('tts', focus_node='audio_mix', status_hint='Âm thanh')
TRANSITION_TARGET = InspectorTarget('transitions', focus_control='timeline_transition_ms', status_hint='Chuyển tiếp — thời lượng / kiểu')