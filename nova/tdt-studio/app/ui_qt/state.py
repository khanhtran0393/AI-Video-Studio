from __future__ import annotations
import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path
from core.sort_utils import media_basename_sort_key
from core.subtitles import SubtitleDocument
from core.tts_source_cues import TTS_SOURCE_VALUE_KEY, persistable_tts_source_copy
from ui_qt.subtitle_source_document import SOURCE_DOC_KEY, get_source_subtitles, persistable_source_subtitles_copy, set_subtitle_row_visible
from services_media import MediaInfo
NODE_IDS = ('video_output', 'motion', 'image_adjustments', 'overlays', 'look_effects', 'audio_mix', 'export_encode', 'finish', 'user_defaults', 'subtitles')
DEFAULT_EXPORT_VALUES = {'aspect_ratio': '9:16', 'quality': '1080p', 'codec': 'auto', 'encoder_backend': 'auto', 'encode_speed': 'fast', '_export_encode_v2': True, 'fps': 30, 'video_bitrate_kbps': 0, 'cap_bitrate_to_source': True, 'trim_start_ms': 0, 'trim_end_ms': 0, 'offset_x': 0, 'offset_y': 0, 'scale_percent': 100, 'face_reframe_plate': '1:1', 'face_reframe_pan_axis': 'horizontal', 'face_reframe_subject_mode': 'face_then_object', **{'adjust_advanced_enabled': True, 'adjust_frame_enabled': True, 'adjust_scene_group_enabled': True, 'batch_auto_scene_split': False, 'batch_auto_face_reframe': False, 'scene_trim_enabled': False, 'scene_mirror_enabled': False, 'scene_warp_enabled': False, 'scene_mirror_mode': 'off', 'scene_trim_side': 'off', 'scene_trim_ms': 200, 'scene_warp_mode': 'off', 'scene_warp_x_min': 100, 'scene_warp_x_max': 120, 'scene_warp_y_min': 100, 'scene_warp_y_max': 120, 'scene_warp_uniform': False}, **{'scene_fx_seed': 0, 'scale_x_percent': 100, 'scale_y_percent': 100, 'clip_volume_percent': 100, 'crop_enabled': False, 'crop_left_percent': 0, 'crop_top_percent': 0, 'crop_right_percent': 100, 'crop_bottom_percent': 100, 'crop_lock_aspect': False, 'uniform_scale_enabled': True, 'preview_snap_enabled': True, 'preview_workspace_theme': 'dark', 'preview_workspace_color': '#121820', 'preview_canvas_color': '#05070C', 'preview_pasteboard_enabled': True, 'timeline_track_hidden': {}}, **{'timeline_track_locked': {}, 'timeline_subtitle_source_visible': True, 'timeline_subtitle_working_visible': True, 'timeline_clips': [], 'timeline_audio_clips': [], 'selected_timeline_clip_id': '', 'selected_timeline_clip_ids': [], 'timeline_transition_ms': 0, 'timeline_transition_style': 'cut', 'timeline_transition_mode': 'one_for_all', 'timeline_transition_random_pool': ['fade', 'dissolve', 'slide_left', 'slide_right', 'wipe_left', 'circle_open', 'smooth_left', 'zoom_in'], 'timeline_transition_seed': 0, 'rotation_degrees': 0, 'mirror_enabled': False, 'speed': 1.0, 'motion': 'still', 'auto_zoom_enabled': False}, **{'auto_zoom_val': 1.3, 'auto_zoom_sec': 3.0, 'auto_zoom_hold': 0.5, 'auto_zoom_rand': False, 'motion_intensity_percent': 50, 'color_filter': 'none', 'color_filter_strength': 70, 'color_lut_stack': [], 'color_lut_stack_master_enabled': True, 'video_effect_master_enabled': True, 'selected_lut_rel': '', 'video_blend_enabled': False, 'video_blend_mode': 'normal', 'video_blend_opacity': 100, 'blur_zone_enabled': False, 'blur_zone_position': 'bottom', 'blur_zone_style': 'blur'}, **{'blur_zone_color': '#000000', 'blur_zone_height_percent': 18, 'blur_zone_dynamic': True, 'blur_zones': [{'enabled': True, 'y': 0.82, 'height': 0.18, 'x': 0.0, 'width': 1.0}], 'blur_zone_index': 0, 'blur_zone_rotation_degrees': 0.0, 'cover_enabled': False, 'cover_path': '', 'cover_duration_sec': 2.0, 'seo_description': '', 'background': 'black', 'blur_strength': 20, 'background_blur_strength': 40, '_bg_mode_v2': True, 'background_layers_master_enabled': False, 'background_layers': [], 'background_layer_index': 0}, **{'background_layer_path': '', 'background_layer_enabled': True, 'background_layer_start_ms': 0, 'background_layer_end_ms': 0, 'background_layer_fit_mode': 'cover', 'background_layer_x_norm': 0.5, 'background_layer_y_norm': 0.5, 'background_layer_scale_percent': 100, 'background_layer_rotation_degrees': 0.0, 'background_layer_opacity': 100, 'text_overlay_enabled': False, 'text_overlay_content': '', 'text_overlay_style': 'static', 'text_overlay_position': 'bottom', 'text_overlay_x_norm': 0.5, 'text_overlay_y_norm': 0.94, 'text_overlay_scale_percent': 100}, **{'text_overlay_box_width_percent': 90, 'text_overlay_layout_scale_percent': 100, 'text_overlay_rotation_degrees': 0.0, 'text_overlay_start_ms': 0, 'text_overlay_end_ms': 0, 'text_overlay_font': 'Arial', 'text_overlay_text_color': '#FFFFFF', 'text_overlay_outline_color': '#000000', 'text_overlay_outline_width': 3, 'text_overlay_shadow_enabled': True, 'text_overlay_shadow_depth': 1, 'text_overlay_bg_enabled': False, 'text_overlay_bg_color': '#000000', 'text_overlay_bg_opacity': 55, 'text_overlay_bold': True, 'text_overlay_italic': False, 'text_overlays': []}, **{'text_overlay_index': 0, 'text_overlay_motion_style': 'marquee', 'video_title_enabled': False, 'video_title_from_filename': True, 'video_title_language_mode': 'auto_target', 'video_title_content': '', 'video_title_position': 'top', 'video_title_x_norm': 0.5, 'video_title_y_norm': 0.06, 'video_title_scale_percent': 100, 'video_title_scale_x_percent': 100, 'video_title_scale_y_percent': 100, 'video_title_box_width_percent': 92, 'video_title_layout_scale_percent': 100, 'video_title_rotation_degrees': 0.0, 'video_title_start_ms': 0, 'video_title_end_ms': 0}, **{'video_title_font': 'Arial', 'video_title_text_color': '#FFFFFF', 'video_title_outline_color': '#000000', 'video_title_outline_width': 3, 'video_title_shadow_enabled': True, 'video_title_shadow_depth': 1, 'video_title_bg_enabled': False, 'video_title_bg_color': '#000000', 'video_title_bg_opacity': 55, 'video_title_bold': True, 'video_title_italic': False, 'video_title_anim': 'none', 'video_effect': 'none', 'video_effect_strength': 50, 'video_effect_stack': [], 'selected_video_effect_id': '', 'lightsweep_cycle_sec': 3.2}, **{'lightsweep_duration_sec': 1.2, 'lightsweep_width_percent': 18, 'lightsweep_soft_percent': 55, 'lightsweep_glow_percent': 40, 'lightsweep_opacity_percent': 70, 'lightsweep_direction': 'tl_br', 'lightsweep_apply_mode': 'video', 'effect_overlay_enabled': False, 'effect_overlay_path': '', 'effect_overlay_opacity': 50, 'effect_overlay_scale_percent': 100, 'effect_overlay_blend_enabled': False, 'effect_overlay_blend_mode': 'normal', 'effect_overlay_x_norm': 0.5, 'effect_overlay_y_norm': 0.5, 'effect_overlay_rotation_degrees': 0, 'effect_overlay_mask_enabled': False}, **{'effect_overlay_mask_shape': 'circle', 'effect_overlay_mask_width_percent': 100, 'effect_overlay_mask_height_percent': 100, 'effect_overlay_mask_feather_percent': 20, 'effect_overlay_mask_feather_bias': 0, 'effect_overlay_mask_feather_axis': 'y', 'effect_overlay_mask_corner_radius_percent': 18, 'media_overlays_master_enabled': False, 'media_overlays': [], 'media_overlay_index': 0, 'blend_layers_master_enabled': False, 'blend_layers': [], 'blend_layer_index': 0, 'blend_layer_path': '', 'blend_layer_enabled': True, 'blend_layer_opacity': 15, 'blend_layer_mode': 'screen'}, **{'blend_layer_x_norm': 0.5, 'blend_layer_y_norm': 0.5, 'blend_layer_scale_percent': 100, 'blend_layer_rotation_degrees': 0, 'blend_layer_start_ms': 0, 'blend_layer_end_ms': 0, 'strip_metadata': True, 'fake_metadata': False, 'anti_duplicate': False, 'anti_duplicate_advanced': False, 'border_pixels': 0, 'logo_enabled': False, 'logo_path': '', 'logo_position': 'top_right', 'logo_x_norm': 0.5, 'logo_y_norm': 0.5, 'logo_rmbg': False}, **{'logo_opacity': 82, 'logo_blend_enabled': False, 'logo_blend_mode': 'normal', 'logo_scale_percent': 18, 'logo_scale_aspect': 0.0, 'logo_rotation_degrees': 0, 'logo_start_ms': 0, 'logo_end_ms': 0, 'logo_motion': 'static', 'logo_motion_speed': 120.0, 'applied_edit_preset_id': '', 'applied_edit_preset_name': '', 'audio_volume': 100, 'mute_original_audio': False, 'remove_original_vocal': False, 'remove_original_bgm': False, 'vocal_sep_cache_path': ''}, **{'video_vocal_enabled': True, 'video_vocal_volume': 100, 'video_bgm_enabled': True, 'video_bgm_volume': 100, 'video_vocal_stem_path': '', 'video_instrumental_stem_path': '', '_audio_mix_v2': True, 'voice_audio_enabled': False, 'voice_audio_path': '', 'voice_tts_key': '', 'voice_audio_volume': 100, 'background_audio_enabled': False, 'background_audio_path': '', 'background_audio_volume': 35, 'background_audio_start_ms': 0, 'background_audio_end_ms': 0, 'subtitle_enabled': False}, **{'subtitle_burn_source': True, 'subtitle_burn_working': True, 'subtitle_path': '', 'subtitle_provider': 'gemini', 'subtitle_model': 'gemini-3.6-flash', 'subtitle_source_language': 'auto', 'subtitle_target_language': 'vi', 'subtitle_translate_enabled': True, 'subtitle_prompt': 'Dịch tự nhiên, đúng ngữ cảnh, giữ nguyên tên riêng.', 'subtitle_font': 'Arial', 'subtitle_font_size': 48, 'subtitle_box_width_percent': 90, 'subtitle_layout_font_size': 48, 'subtitle_scale_percent': 100, 'subtitle_scale_x_percent': 100, 'subtitle_scale_y_percent': 100, 'subtitle_rotation_degrees': 0.0}, **{'subtitle_text_color': '#FFFFFF', 'subtitle_outline_color': '#000000', 'subtitle_outline_width': 3, 'subtitle_shadow_enabled': True, 'subtitle_shadow_depth': 1, 'subtitle_bg_enabled': False, 'subtitle_bg_color': '#000000', 'subtitle_bg_opacity': 55, 'subtitle_bold': True, 'subtitle_italic': False, 'subtitle_anim': 'none', 'subtitle_karaoke_color': '#00E5FF', 'subtitle_position': 'bottom', 'subtitle_margin_bottom': 70, 'subtitle_margin_bottom_source': 140, 'subtitle_margin_refs_center': True, 'subtitle_stt_engine': 'capcut_api'}, **{'subtitle_stt_model': 'CapCut ASR cloud', 'subtitle_ocr_top_percent': 55, 'subtitle_ocr_sample_interval': 0.5, 'subtitle_ocr_confidence': 30, 'tts_engine': 'edge', 'tts_voice': 'vi-VN-HoaiMyNeural', 'tts_speed': 1.0, 'tts_pitch': 0, 'tts_api_key': '', 'tts_model_repo': '', 'tts_ref_audio': '', 'tts_ref_text': '', 'tts_smart_voice': True, 'tts_proxy': '', 'tts_relay_url': '', 'tts_relay_secret': '', 'tts_max_workers': 0}, **{'tts_fit_mode': 'stretch_video', 'tts_fit_max_speed': 1.2}}
EDIT_TEMPLATE_VALUE_KEYS = frozenset({'subtitle_outline_width', 'subtitle_model', 'color_lut_stack', 'background_layers', 'tts_pitch', 'tts_ref_audio', 'timeline_transition_random_pool', 'subtitle_bg_enabled', 'crop_enabled', 'scene_warp_mode', 'auto_zoom_hold', 'motion', 'tts_relay_url', 'timeline_transition_ms', 'adjust_scene_group_enabled', 'background_layer_y_norm', 'auto_zoom_sec', 'auto_zoom_enabled', 'subtitle_scale_x_percent', 'tts_proxy', 'auto_zoom_val', 'encoder_backend', 'tts_ref_text', 'scene_warp_y_max', 'preview_workspace_theme', 'preview_pasteboard_enabled', 'tts_speed', 'background_layer_start_ms', 'subtitle_bg_opacity', 'background_layer_scale_percent', 'preview_canvas_color', 'subtitle_font', 'subtitle_layout_font_size', 'border_pixels', 'background_layer_path', 'subtitle_anim', 'subtitle_margin_refs_center', 'subtitle_margin_bottom', 'cap_bitrate_to_source', 'color_filter_strength', 'video_bitrate_kbps', 'background', 'subtitle_italic', 'video_blend_opacity', 'subtitle_source_language', 'fake_metadata', 'quality', 'timeline_transition_mode', 'background_layer_fit_mode', 'scene_warp_uniform', 'mute_original_audio', 'subtitle_ocr_top_percent', 'crop_top_percent', 'video_title_anim', 'subtitle_karaoke_color', 'background_layers_master_enabled', 'scene_warp_y_min', 'motion_intensity_percent', 'auto_zoom_rand', 'subtitle_prompt', 'subtitle_shadow_enabled', 'subtitle_box_width_percent', 'subtitle_outline_color', 'strip_metadata', 'crop_left_percent', 'preview_workspace_color', 'encode_speed', 'scene_trim_enabled', 'subtitle_font_size', 'subtitle_scale_percent', 'selected_lut_rel', 'video_blend_enabled', 'scene_mirror_enabled', 'tts_max_workers', 'timeline_transition_seed', 'subtitle_provider', 'subtitle_translate_enabled', 'tts_fit_mode', 'background_layer_end_ms', 'subtitle_text_color', 'tts_smart_voice', 'subtitle_stt_model', 'background_layer_enabled', 'face_reframe_pan_axis', 'face_reframe_plate', 'background_layer_x_norm', 'scene_trim_side', 'blur_strength', 'anti_duplicate_advanced', 'subtitle_target_language', 'video_blend_mode', 'background_layer_index', 'background_layer_rotation_degrees', 'aspect_ratio', 'color_filter', 'preview_snap_enabled', 'subtitle_rotation_degrees', 'subtitle_stt_engine', 'subtitle_bold', 'adjust_frame_enabled', 'background_layer_opacity', 'codec', 'anti_duplicate', 'tts_model_repo', 'scene_warp_x_min', 'crop_right_percent', 'crop_bottom_percent', 'scene_trim_ms', 'face_reframe_subject_mode', 'subtitle_scale_y_percent', 'adjust_advanced_enabled', 'timeline_transition_style', 'background_audio_volume', 'voice_audio_volume', 'scene_warp_x_max', 'uniform_scale_enabled', 'scene_mirror_mode', 'tts_voice', 'mirror_enabled', 'subtitle_bg_color', 'subtitle_ocr_sample_interval', 'color_lut_stack_master_enabled', 'crop_lock_aspect', 'subtitle_shadow_depth', 'tts_api_key', 'fps', 'subtitle_position', 'tts_fit_max_speed', 'speed', 'tts_engine', 'batch_auto_face_reframe', 'background_blur_strength', 'scene_warp_enabled', 'tts_relay_secret', 'subtitle_ocr_confidence', 'audio_volume', 'batch_auto_scene_split', 'video_effect_master_enabled'})

def migrate_export_encode_defaults(values: dict[str, object]) -> None:
    if values.get('_export_encode_v2'):
        return None
    backend = str(values.get('encoder_backend', 'cpu') or 'cpu').strip().lower()
    speed = str(values.get('encode_speed', 'balanced') or 'balanced').strip().lower()
    if backend in frozenset({'', 'cpu'}) and speed in frozenset({'', 'balanced'}):
        values['encoder_backend'] = 'auto'
        values['encode_speed'] = 'fast'
    elif backend in frozenset({'', 'cpu'}) and speed == 'fast':
        values['encoder_backend'] = 'auto'
    values['_export_encode_v2'] = True

def preserved_template_values(values: dict[str, object]) -> dict[str, object]:
    merged = dict(DEFAULT_EXPORT_VALUES)
    for key in EDIT_TEMPLATE_VALUE_KEYS:
        if key in values:
            merged[key] = values[key]
    migrate_export_encode_defaults(merged)
    return merged

@dataclass(frozen=True)
class Asset:
    id: 'str'
    kind: 'str'
    name: 'str'
    detail: 'str'
    path: 'str | None' = None
    duration_ms: 'int' = 0
    width: 'int' = 0
    height: 'int' = 0
    fps: 'float' = 0.0
    video_codec: 'str' = ''
    audio_codec: 'str' = ''
    has_audio: 'bool' = False
    bitrate_kbps: 'int' = 0

@dataclass
class ProjectState:
    assets: 'tuple[Asset, ...]'
    selected_id: 'str | None'
    subtitles: 'SubtitleDocument' = field(default_factory=SubtitleDocument)
    values: 'dict[str, object]' = field(default_factory=lambda: dict(DEFAULT_EXPORT_VALUES))
    asset_settings: 'dict[str, dict[str, object]]' = field(default_factory=dict)
    sfx_events: 'list[dict]' = field(default_factory=list)
    node_ids: 'tuple[str, ...]' = NODE_IDS

    @property
    def selected_asset(self) -> Asset | None:
        return None if self.selected_id is None else next((asset for asset in self.assets if asset.id == self.selected_id), None)

    @property
    def selected_kind(self) -> str | None:
        asset = self.selected_asset
        if asset is not None:
            return asset.kind

    def select(self, asset_id: str) -> None:
        if any((asset.id == asset_id for asset in self.assets)):
            self.selected_id = asset_id
        else:
            raise KeyError(asset_id)

    def snapshot_asset_settings(self, asset_id: str | None=None) -> None:
        target_id = asset_id or self.selected_id
        if target_id:
            asset = next((item for item in self.assets if item.id == target_id), None)
            if asset is None or asset.kind != 'video':
                return None
            self.asset_settings[target_id] = bag = {key: self.values.get(key, default) for key, default in DEFAULT_EXPORT_VALUES.items()}
            source = persistable_tts_source_copy(self.values)
            if source is not None:
                bag[TTS_SOURCE_VALUE_KEY] = source
            origin = persistable_source_subtitles_copy(self.values)
            if origin is not None:
                bag[SOURCE_DOC_KEY] = origin
                return None
        else:
            return None

    def restore_asset_settings(self, asset_id: str) -> bool:
        saved = self.asset_settings.get(asset_id)
        if saved:
            self.values.update(saved)
            source = persistable_tts_source_copy(saved)
            if source is not None:
                self.values[TTS_SOURCE_VALUE_KEY] = source
            else:
                self.values.pop(TTS_SOURCE_VALUE_KEY, None)
            origin = persistable_source_subtitles_copy(saved)
            if origin is not None:
                self.values[SOURCE_DOC_KEY] = origin
            else:
                self.values.pop(SOURCE_DOC_KEY, None)
            return True
        self.values.pop(TTS_SOURCE_VALUE_KEY, None)
        self.values.pop(SOURCE_DOC_KEY, None)
        return False

    def apply_current_settings_to_videos(self, *, subtitle_workspace: str | Path | None) -> int:
        from ui_qt.asset_export import apply_export_template_to_videos
        return apply_export_template_to_videos(self, subtitle_workspace=subtitle_workspace)

    def add_media(self, info: MediaInfo, *, select: bool) -> Asset:
        asset_id = _media_id(info.path)
        existing = next((asset for asset in self.assets if asset.id == asset_id), None)
        if existing is not None:
            if select:
                self.selected_id = existing.id
            return existing
        asset = Asset(asset_id, 'video', info.name, f'{_format_duration(info.duration_ms)} · {info.width}×{info.height}', path=info.path, duration_ms=info.duration_ms, width=info.width, height=info.height, fps=info.fps, video_codec=info.video_codec, audio_codec=info.audio_codec, has_audio=info.has_audio, bitrate_kbps=info.bitrate_kbps)
        self.assets = sort_project_assets((*self.assets, asset))
        if select:
            self.selected_id = asset.id
        return asset

    def replace_video_source(self, asset_id: str, info: MediaInfo) -> Asset:
        old = next((asset for asset in self.assets if asset.id == asset_id), None)
        if old is None or old.kind != 'video':
            raise KeyError(asset_id)
        replacement = Asset(asset_id, 'video', info.name, f'{_format_duration(info.duration_ms)} · {info.width}×{info.height}', path=info.path, duration_ms=info.duration_ms, width=info.width, height=info.height, fps=info.fps, video_codec=info.video_codec, audio_codec=info.audio_codec, has_audio=info.has_audio, bitrate_kbps=info.bitrate_kbps)
        self.assets = tuple((asset for asset in self.assets if asset.id != asset_id)) + (replacement,)
        self.selected_id = asset_id
        return replacement

    def remove_video_asset(self, asset_id: str) -> None:
        target = next((asset for asset in self.assets if asset.id == asset_id), None)
        if target is None or target.kind != 'video':
            raise KeyError(asset_id)
        self.assets = tuple((asset for asset in self.assets if asset.id != asset_id))
        self.asset_settings.pop(asset_id, None)
        if self.selected_id == asset_id:
            self.selected_id = next((a.id for a in self.assets if a.kind == 'video'), None)
        if self.subtitles.segments:
            src = str(self.subtitles.source_path or '')
            if target.path:
                if src:
                    if Path(target.path).stem in src:
                        self.clear_subtitles()
            return None

    def clear_subtitles(self) -> None:
        previous_selection = self.selected_id
        self.assets = tuple((existing for existing in self.assets if existing.kind != 'subtitle'))
        self.subtitles = SubtitleDocument()
        self.values['subtitle_enabled'] = False
        self.values['subtitle_path'] = ''
        self.values.pop('tts_source_document', None)
        remaining_ids = {existing.id for existing in self.assets}
        if previous_selection in remaining_ids:
            self.selected_id = previous_selection
            return None
        self.selected_id = next((existing.id for existing in self.assets), None)

    def set_subtitles(self, document: SubtitleDocument) -> Asset | None:
        if document.segments:
            previous_selection = self.selected_id
            asset = Asset('subtitle-project', 'subtitle', os.path.basename(document.source_path) if document.source_path else 'Phụ đề dự án', f'{len(document.segments)} câu · {_format_duration(document.duration_ms)}', path=document.source_path or None, duration_ms=document.duration_ms)
            self.assets = tuple((existing for existing in self.assets if existing.kind != 'subtitle')) + (asset,)
            self.subtitles = document
            self.values['subtitle_enabled'] = True
            self.values['subtitle_path'] = document.source_path
            set_subtitle_row_visible(self.values, 'subtitle', True)
            if get_source_subtitles(self).segments:
                set_subtitle_row_visible(self.values, 'subtitle_source', True)
            remaining_ids = {existing.id for existing in self.assets}
            self.selected_id = previous_selection if previous_selection in remaining_ids else asset.id
            return asset
        self.clear_subtitles()

def _media_id(path: str) -> str:
    normalized = os.path.normcase(os.path.abspath(path))
    digest = hashlib.sha1(normalized.encode('utf-8')).hexdigest()[:12]
    return f'video-{digest}'

def _format_duration(duration_ms: int) -> str:
    total_seconds = max(0, duration_ms // 1000)
    hours, remainder = (divmod(total_seconds, 3600)[0], divmod(total_seconds, 3600)[1])
    minutes, seconds = (divmod(remainder, 60)[0], divmod(remainder, 60)[1])
    return f'{minutes}02d:{seconds}02d' if hours else f':{seconds}02d'

def sort_project_assets(assets: tuple[Asset, ...]) -> tuple[Asset, ...]:
    videos = [asset for asset in assets if asset.kind == 'video']
    others = [asset for asset in assets if asset.kind != 'video']
    videos.sort(key=lambda asset: media_basename_sort_key(asset.path or asset.name))
    return tuple(videos + others)

def empty_project_state() -> ProjectState:
    return ProjectState(assets=(), selected_id=None)

def new_project_media_state(preserve_values: dict[str, object]) -> ProjectState:
    state = empty_project_state()
    state.values.update(preserved_template_values(preserve_values))
    return state

def apply_project_media(target: ProjectState, source: ProjectState) -> None:
    target.assets = source.assets
    target.selected_id = source.selected_id
    target.asset_settings = {asset_id: dict(values) for asset_id, values in source.asset_settings.items()}
    target.subtitles = source.subtitles
    target.sfx_events = list(source.sfx_events)

def sample_project_state() -> ProjectState:
    return ProjectState(assets=(Asset('video-main', 'video', 'Video chính', '02:14 · 1080p', duration_ms=134000, width=1080, height=1920, fps=30.0), Asset('audio-bed', 'audio', 'Nhạc nền', '01:48 · MP3', duration_ms=108000), Asset('subtitle-vi', 'subtitle', 'Phụ đề tiếng Việt', '48 câu', duration_ms=124000), Asset('logo-main', 'image', 'Logo.png', 'PNG · 512×512')), selected_id='video-main', values=dict(DEFAULT_EXPORT_VALUES))

def _nearest_aspect_ratio(width: int, height: int) -> str:
    ratio = max(1, int(width)) / max(1, int(height))
    candidates = {'9:16': 0.5625, '16:9': 1.7777777777777777, '1:1': 1.0, '4:5': 0.8, '3:4': 0.75, '2:3': 0.6666666666666666, '21:9': 2.3333333333333335}
    return min(candidates.items(), key=lambda item: abs(item[1] - ratio))[0]