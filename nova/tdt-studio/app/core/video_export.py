from __future__ import annotations
import hashlib
import math
import os
import random
import re
import subprocess
import time
from dataclasses import dataclass, replace
from pathlib import Path
from config import FFMPEG_PATH, FFPROBE_PATH
from core.layer_timing import ffmpeg_enable_between, layer_active_at, layer_output_seconds, layer_overlaps_trim, output_window_ms
from core.motion import SHAKE_BASE_X_PX, SHAKE_BASE_Y_PX, SHAKE_PAD_EXTRA, effective_auto_zoom_value, motion_intensity_factor, shake_crop_pad_scale, zoompan_step_rate
from core.video_look import COLOR_FILTER_IDS, BLEND_MODE_IDS, FFMPEG_BLEND_MODES, MOTION_IDS, PAN_BASE_PX, PAN_MOTIONS, layer_uses_blend, pan_crop_expr, pan_overlay_expr
from services_media import _cpu_threads
from core.export_threading import resolve_export_threading
from core.motion_filters import _append_auto_zoom, _append_ken_burns_motion, _uses_plate_local_motion
from core.encoder_args import _effective_video_bitrate, _encoder_speed_profile, _resolved_encoder_backend, _scale_flags, _video_encoder_args
from core.video_geometry import QUALITY_DIMENSIONS, _even, aspect_ratio_value, background_blur_radius_from_strength, center_crop_norm_for_aspect, contain_size, crop_filter_expression, effective_source_pixel_size, foreground_zoom_crop_filter, resolve_crop_norm, resolve_foreground_pixel_size, resolve_scale_xy, resolve_target_size
from core.sfx import valid_sfx_events
from core.video_effects import _append_one_video_effect, _append_video_effect, _resolved_video_effect_layers, _settings_has_frame_effect, _settings_has_lightsweep, clamp_ffmpeg_noise_alls, export_plan_uses_heavy_filters
from core.text_style import ffmpeg_drawtext_color
from core.subtitles import SubtitleDocument, load_srt, bridge_subtitle_gaps, retim_document_for_export, save_burn_ass
from core.text_layout import clamp_box_center_norms, drawtext_fontsize_expr, drawtext_line_spacing_px, estimate_overlay_box_height_norm, wrap_text_for_box
SUPPORTED_ASPECT_RATIOS = ('9:16', '16:9', '1:1', '4:5', '3:4', '2:3', '21:9')
_NOISE_ALLS_RE = re.compile('noise=alls=(\\d+)')

def sanitize_ffmpeg_noise_alls(graph):
    text = str(graph or '')
    if 'noise=alls=' not in text:
        return text
    else:

        def _replace(match):
            return f'noise=alls={clamp_ffmpeg_noise_alls(int(match.group(1)))}'
        return _NOISE_ALLS_RE.sub(_replace, text)

@dataclass(frozen=True)
class VideoExportSettings:
    aspect_ratio: str = '9:16'
    quality: str = '1080p'
    codec: str = 'auto'
    encoder_backend: str = 'auto'
    encode_speed: str = 'fast'
    fps: int = 30
    video_bitrate_kbps: int = 0
    cap_bitrate_to_source: bool = True
    trim_start_ms: int = 0
    trim_end_ms: int = 0
    timeline_clips: tuple = ()
    timeline_transition_ms: int = 250
    timeline_transition_style: str = 'fade'
    timeline_transition_mode: str = 'one_for_all'
    timeline_transition_random_pool: tuple = ()
    timeline_transition_seed: int = 0
    offset_x: int = 0
    offset_y: int = 0
    scale_percent: int = 100
    scale_x_percent: int = 100
    scale_y_percent: int = 100
    crop_enabled: bool = False
    crop_left: float = 0.0
    crop_top: float = 0.0
    crop_right: float = 1.0
    crop_bottom: float = 1.0
    crop_lock_aspect: bool = False
    rotation_degrees: int = 0
    mirror_enabled: bool = False
    speed: float = 1.0
    motion: str = 'still'
    auto_zoom_enabled: bool = False
    auto_zoom_val: float = 1.3
    auto_zoom_sec: float = 3.0
    auto_zoom_hold: float = 0.5
    auto_zoom_rand: bool = False
    motion_intensity_percent: int = 50
    color_filter: str = 'none'
    color_filter_strength: int = 70
    color_lut_stack: tuple = ()
    color_lut_stack_master_enabled: bool = True
    video_blend_enabled: bool = False
    video_blend_mode: str = 'normal'
    video_blend_opacity: int = 100
    blur_zone_enabled: bool = False
    blur_zone_position: str = 'bottom'
    blur_zone_style: str = 'blur'
    blur_zone_color: str = '#000000'
    blur_zone_height_percent: int = 18
    blur_zone_dynamic: bool = True
    blur_zones: tuple = ()
    cover_enabled: bool = False
    cover_path: str = ''
    cover_duration_sec: float = 2.0
    tts_fit_mode: str = 'stretch_video'
    tts_fit_max_speed: float = 1.2
    voice_duration_ms: int = 0
    background: str = 'black'
    blur_strength: int = 20
    background_blur_strength: int = 40
    strip_metadata: bool = True
    fake_metadata: bool = False
    anti_duplicate: bool = False
    anti_duplicate_advanced: bool = False
    anti_duplicate_seed: int = 0
    border_pixels: int = 0
    logo_enabled: bool = False
    logo_path: str = ''
    logo_position: str = 'top_right'
    logo_x_norm: float = 0.5
    logo_y_norm: float = 0.5
    logo_rmbg: bool = False
    logo_opacity: int = 82
    logo_blend_enabled: bool = False
    logo_blend_mode: str = 'normal'
    logo_scale_percent: int = 18
    logo_rotation_degrees: int = 0
    logo_start_ms: int = 0
    logo_end_ms: int = 0
    logo_motion: str = 'static'
    logo_motion_speed: float = 120.0
    audio_volume: int = 100
    mute_original_audio: bool = False
    remove_original_vocal: bool = False
    remove_original_bgm: bool = False
    vocal_sep_audio_path: str = ''
    video_vocal_enabled: bool = False
    video_vocal_volume: int = 100
    video_vocal_stem_path: str = ''
    video_bgm_enabled: bool = False
    video_bgm_volume: int = 100
    video_instrumental_stem_path: str = ''
    voice_audio_enabled: bool = False
    voice_audio_path: str = ''
    voice_audio_volume: int = 100
    background_audio_enabled: bool = False
    background_audio_path: str = ''
    background_audio_volume: int = 35
    background_audio_start_ms: int = 0
    background_audio_end_ms: int = 0
    text_overlay_enabled: bool = False
    text_overlay_content: str = ''
    text_overlay_style: str = 'static'
    text_overlay_position: str = 'bottom'
    text_overlay_x_norm: float = 0.5
    text_overlay_y_norm: float = 0.94
    text_overlay_scale_percent: int = 100
    text_overlay_box_width_percent: int = 90
    text_overlay_rotation_degrees: float = 0.0
    text_overlay_start_ms: int = 0
    text_overlay_end_ms: int = 0
    text_overlay_font: str = 'Arial'
    text_overlay_text_color: str = '#FFFFFF'
    text_overlay_outline_color: str = '#000000'
    text_overlay_outline_width: int = 3
    text_overlay_shadow_enabled: bool = True
    text_overlay_shadow_depth: int = 1
    text_overlay_bg_enabled: bool = False
    text_overlay_bg_color: str = '#000000'
    text_overlay_bg_opacity: int = 55
    text_overlay_bold: bool = True
    text_overlay_italic: bool = False
    text_overlays: tuple = ()
    video_title_enabled: bool = False
    video_title_from_filename: bool = True
    video_title_language_mode: str = 'auto_target'
    video_title_content: str = ''
    video_title_position: str = 'top'
    video_title_x_norm: float = 0.5
    video_title_y_norm: float = 0.06
    video_title_scale_percent: int = 100
    video_title_scale_x_percent: int = 100
    video_title_scale_y_percent: int = 100
    video_title_box_width_percent: int = 92
    video_title_layout_scale_percent: int = 100
    video_title_rotation_degrees: float = 0.0
    video_title_start_ms: int = 0
    video_title_end_ms: int = 0
    video_title_font: str = 'Arial'
    video_title_text_color: str = '#FFFFFF'
    video_title_outline_color: str = '#000000'
    video_title_outline_width: int = 3
    video_title_shadow_enabled: bool = True
    video_title_shadow_depth: int = 1
    video_title_bg_enabled: bool = False
    video_title_bg_color: str = '#000000'
    video_title_bg_opacity: int = 55
    video_title_bold: bool = True
    video_title_italic: bool = False
    video_title_anim: str = 'none'
    video_effect: str = 'none'
    video_effect_strength: int = 50
    video_effect_stack: tuple = ()
    lightsweep_cycle_sec: float = 3.2
    lightsweep_duration_sec: float = 1.2
    lightsweep_width_percent: int = 18
    lightsweep_soft_percent: int = 55
    lightsweep_glow_percent: int = 40
    lightsweep_opacity_percent: int = 70
    lightsweep_direction: str = 'tl_br'
    lightsweep_apply_mode: str = 'video'
    effect_overlay_enabled: bool = False
    effect_overlay_path: str = ''
    effect_overlay_opacity: int = 50
    effect_overlay_scale_percent: int = 100
    effect_overlay_x_norm: float = 0.5
    effect_overlay_y_norm: float = 0.5
    media_overlays_master_enabled: bool = False
    media_overlays: tuple = ()
    blend_layers_master_enabled: bool = False
    blend_layers: tuple = ()
    background_layers_master_enabled: bool = False
    background_layers: tuple = ()
    subtitle_enabled: bool = False
    subtitle_path: str = ''
    subtitle_font: str = 'Arial'
    subtitle_font_size: int = 48
    subtitle_box_width_percent: int = 90
    subtitle_layout_font_size: int = 48
    subtitle_scale_x_percent: int = 100
    subtitle_scale_y_percent: int = 100
    subtitle_rotation_degrees: float = 0.0
    subtitle_text_color: str = '#FFFFFF'
    subtitle_outline_color: str = '#000000'
    subtitle_outline_width: int = 3
    subtitle_shadow_enabled: bool = True
    subtitle_shadow_depth: int = 1
    subtitle_bg_enabled: bool = False
    subtitle_bg_color: str = '#000000'
    subtitle_bg_opacity: int = 55
    subtitle_bold: bool = True
    subtitle_italic: bool = False
    subtitle_anim: str = 'none'
    subtitle_karaoke_color: str = '#00E5FF'
    subtitle_position: str = 'bottom'
    subtitle_margin_bottom: int = 70
    subtitle_margin_bottom_source: int = 140
    subtitle_burn_source: bool = True
    subtitle_burn_working: bool = True
    subtitle_source_document: object | None = None
    subtitle_margin_refs_center: bool = True
    sfx_events: tuple = ()
    face_reframe_plate: str = ''

    @property
    def target_size(self):
        return resolve_target_size(self.aspect_ratio, self.quality)

    def validated(self):
        drop_voice = False
        drop_subtitle = False
        if self.aspect_ratio not in set(SUPPORTED_ASPECT_RATIOS):
            raise ValueError('Tỷ lệ khung không hợp lệ')
        if self.quality not in QUALITY_DIMENSIONS:
            raise ValueError('Chất lượng đầu ra không hợp lệ')
        if self.codec not in frozenset({'auto', 'h265', 'h264'}):
            raise ValueError('Cách mã hóa không hợp lệ')
        if self.encoder_backend not in frozenset({'auto', 'nvenc', 'cpu'}):
            raise ValueError('Bộ mã hóa không hợp lệ')
        if self.encode_speed not in frozenset({'fast', 'quality', 'balanced'}):
            raise ValueError('Tốc độ mã hóa không hợp lệ')
        if not 10 <= self.fps <= 120:
            raise ValueError('FPS phải nằm trong khoảng 10–120')
        if not 0 <= self.video_bitrate_kbps <= 100000:
            raise ValueError('Bitrate video phải nằm trong khoảng 0–100000 kbps')
        if self.trim_start_ms < 0 or self.trim_end_ms < 0:
            raise ValueError('Mốc cắt video không được âm')
        if self.trim_end_ms and self.trim_end_ms <= self.trim_start_ms:
            raise ValueError('Mốc kết thúc phải lớn hơn mốc bắt đầu')
        if not 0.1 <= self.speed <= 8.0:
            raise ValueError('Tốc độ phải nằm trong khoảng 0.1–8.0')
        if self.motion not in MOTION_IDS:
            raise ValueError('Kiểu chuyển động không hợp lệ')
        if not 1.05 <= self.auto_zoom_val <= 2.5:
            raise ValueError('Mức auto zoom phải nằm trong khoảng 1.05–2.5')
        if not 0.5 <= self.auto_zoom_sec <= 30.0:
            raise ValueError('Chu kỳ auto zoom phải nằm trong khoảng 0.5–30 giây')
        if not 0.1 <= self.auto_zoom_hold <= 10.0:
            raise ValueError('Thời gian giữ auto zoom phải nằm trong khoảng 0.1–10 giây')
        if not 0 <= int(self.motion_intensity_percent) <= 100:
            raise ValueError('Cường độ chuyển động phải nằm trong khoảng 0–100%')
        if self.color_filter not in COLOR_FILTER_IDS:
            raise ValueError('Bộ lọc màu không hợp lệ')
        if not 0 <= int(self.color_filter_strength) <= 100:
            raise ValueError('Mức bộ lọc màu phải nằm trong khoảng 0–100%')
        from core.lut_stack import normalize_lut_stack
        ls_stack = tuple(normalize_lut_stack(self.color_lut_stack))
        if self.video_blend_mode not in BLEND_MODE_IDS:
            raise ValueError('Chế độ hòa trộn không hợp lệ')
        if not 0 <= int(self.video_blend_opacity) <= 100:
            raise ValueError('Độ mờ hòa trộn phải nằm trong khoảng 0–100%')
        if not 10 <= self.scale_percent <= 500:
            raise ValueError('Mức phóng phải nằm trong khoảng 10–500%')
        if not 10 <= self.scale_x_percent <= 500:
            raise ValueError('Mức phóng ngang phải nằm trong khoảng 10–500%')
        if not 10 <= self.scale_y_percent <= 500:
            raise ValueError('Mức phóng dọc phải nằm trong khoảng 10–500%')
        crop = resolve_crop_norm(self.crop_enabled, self.crop_left, self.crop_top, self.crop_right, self.crop_bottom)
        if not -180 <= self.rotation_degrees <= 180:
            raise ValueError('Góc xoay phải nằm trong khoảng -180–180°')
        if self.background not in frozenset({'blur', 'custom', 'gray', 'black'}):
            raise ValueError('Loại nền không hợp lệ')
        if self.blur_zone_position not in frozenset({'top', 'bottom'}):
            raise ValueError('Vị trí vùng mờ không hợp lệ')
        if self.blur_zone_style not in frozenset({'blur', 'black', 'color'}):
            raise ValueError('Kiểu vùng mờ không hợp lệ')
        if not 5 <= self.blur_zone_height_percent <= 90:
            raise ValueError('Chiều cao vùng mờ phải nằm trong khoảng 5–90%')
        if self.cover_enabled:
            cover = str(self.cover_path or '').strip()
            if not cover:
                raise ValueError('Đã bật ảnh bìa đầu video nhưng chưa chọn file')
            elif not Path(cover).expanduser().is_file():
                raise ValueError('File ảnh bìa đầu video không tồn tại')
            elif not 0.5 <= float(self.cover_duration_sec) <= 10.0:
                raise ValueError('Thời lượng ảnh bìa phải trong khoảng 0.5–10 giây')
        if self.tts_fit_mode not in frozenset({'none', 'stretch_video', 'speed_up_tts'}):
            raise ValueError('Chế độ khớp TTS không hợp lệ')
        if not 1.0 <= self.tts_fit_max_speed <= 2.5:
            raise ValueError('Tốc độ TTS tối đa phải nằm trong khoảng 1.0–2.5')
        if self.voice_duration_ms < 0:
            raise ValueError('Độ dài giọng đọc không được âm')
        if not 0 <= self.blur_strength <= 100:
            raise ValueError('Mức làm mờ phải nằm trong khoảng 0–100%')
        if not 0 <= self.background_blur_strength <= 100:
            raise ValueError('Mức mờ nền phải nằm trong khoảng 0–100%')
        if not 0 <= self.border_pixels <= 100:
            raise ValueError('Viền tối phải nằm trong khoảng 0–100 px')
        if self.logo_position not in frozenset({'bottom_left', 'custom', 'bottom_right', 'top_left', 'center', 'top_right'}):
            raise ValueError('Vị trí logo không hợp lệ')
        if not 0.0 <= self.logo_x_norm <= 1.0:
            raise ValueError('Tọa độ logo X phải nằm trong khoảng 0–1')
        if not 0.0 <= self.logo_y_norm <= 1.0:
            raise ValueError('Tọa độ logo Y phải nằm trong khoảng 0–1')
        if not 0 <= self.logo_opacity <= 100:
            raise ValueError('Độ rõ logo phải nằm trong khoảng 0–100%')
        if self.logo_blend_mode not in BLEND_MODE_IDS:
            raise ValueError('Chế độ hòa trộn logo không hợp lệ')
        if not 5 <= self.logo_scale_percent <= 100:
            raise ValueError('Kích thước logo phải nằm trong khoảng 5–100%')
        if self.logo_motion not in frozenset({'diagonal', 'around', 'marquee', 'static', 'bounce'}):
            raise ValueError('Chế độ chuyển động logo không hợp lệ')
        if not 20.0 <= float(self.logo_motion_speed) <= 600.0:
            raise ValueError('Tốc độ logo phải nằm trong khoảng 20–600')
        if not 0 <= self.audio_volume <= 100:
            raise ValueError('Âm lượng phải nằm trong khoảng 0–100%')
        if not 0 <= self.voice_audio_volume <= 200:
            raise ValueError('Âm lượng lồng tiếng phải nằm trong khoảng 0–200%')
        if not 0 <= self.background_audio_volume <= 200:
            raise ValueError('Âm lượng nhạc nền phải nằm trong khoảng 0–200%')
        if self.voice_audio_enabled:
            voice_path = str(self.voice_audio_path or '').strip()
            if voice_path and not Path(voice_path).is_file():
                drop_voice = True
        if self.background_audio_enabled and self.background_audio_path:
            if not Path(self.background_audio_path).is_file():
                raise ValueError(f'Đã bật nhạc nền nhưng tệp audio không tồn tại: {self.background_audio_path}')
        if self.text_overlay_style not in frozenset({'marquee', 'static', 'around', 'diagonal'}):
            raise ValueError('Kiểu chữ overlay không hợp lệ')
        if self.text_overlay_position not in frozenset({'top', 'custom', 'center', 'bottom'}):
            raise ValueError('Vị trí chữ overlay không hợp lệ')
        if not 0.0 <= float(self.text_overlay_x_norm) <= 1.0:
            raise ValueError('text_overlay_x_norm phải trong [0, 1]')
        if not 0.0 <= float(self.text_overlay_y_norm) <= 1.0:
            raise ValueError('text_overlay_y_norm phải trong [0, 1]')
        if not 20 <= int(self.text_overlay_scale_percent) <= 300:
            raise ValueError('Cỡ chữ overlay phải từ 20–300%')
        if not 15 <= int(self.text_overlay_box_width_percent) <= 100:
            raise ValueError('Độ rộng khung chữ overlay phải từ 15–100%')
        if self.text_overlay_enabled and (not self.text_overlay_content.strip()):
            multi = getattr(self, 'text_overlays', None) or ()
            has_multi = any(str((x.get('content') if isinstance(x, dict) else x) or '').strip() for x in multi)
            if not has_multi:
                raise ValueError('Chưa nhập nội dung chữ overlay')
        if self.video_title_position not in frozenset({'top', 'custom', 'center', 'bottom'}):
            raise ValueError('Vị trí tiêu đề video không hợp lệ')
        if not 0.0 <= float(self.video_title_x_norm) <= 1.0:
            raise ValueError('video_title_x_norm phải trong [0, 1]')
        if not 0.0 <= float(self.video_title_y_norm) <= 1.0:
            raise ValueError('video_title_y_norm phải trong [0, 1]')
        if not 20 <= int(self.video_title_scale_percent) <= 300:
            raise ValueError('Cỡ tiêu đề phải từ 20–300%')
        if not 15 <= int(self.video_title_box_width_percent) <= 100:
            raise ValueError('Độ rộng khung tiêu đề phải từ 15–100%')
        if self.video_title_enabled and (not self.video_title_from_filename):
            if not self.video_title_content.strip():
                raise ValueError('Chưa nhập tiêu đề video')
        if not _is_hex_color(self.video_title_text_color):
            raise ValueError('Màu chữ tiêu đề không hợp lệ')
        if not _is_hex_color(self.video_title_outline_color):
            raise ValueError('Màu viền tiêu đề không hợp lệ')
        from core.text_anim import normalize_title_anim
        title_anim = normalize_title_anim(getattr(self, 'video_title_anim', 'none'))
        if not _is_hex_color(self.text_overlay_text_color):
            raise ValueError('Màu chữ phụ họa không hợp lệ')
        if not _is_hex_color(self.text_overlay_outline_color):
            raise ValueError('Màu viền chữ phụ họa không hợp lệ')
        if self.video_effect not in frozenset({'vignette', 'tv', 'custom', 'vintage', 'stripe', 'camera', 'grain', 'lightsweep', 'camera_rec', 'lightleak', 'none', 'glow'}):
            raise ValueError('Hiệu ứng video không hợp lệ')
        if not 0 <= self.video_effect_strength <= 100:
            raise ValueError('Mức hiệu ứng phải nằm trong khoảng 0–100%')
        from core.lightsweep import LIGHTSWEEP_APPLY_MODE_IDS, LIGHTSWEEP_DIRECTION_IDS, clamp_lightsweep_cycle_sec, clamp_lightsweep_duration_sec, clamp_lightsweep_glow_percent, clamp_lightsweep_opacity_percent, clamp_lightsweep_soft_percent, clamp_lightsweep_width_percent, normalize_lightsweep_apply_mode, normalize_lightsweep_direction
        ls_cycle = clamp_lightsweep_cycle_sec(float(self.lightsweep_cycle_sec))
        ls_duration = clamp_lightsweep_duration_sec(float(self.lightsweep_duration_sec), ls_cycle)
        ls_width = clamp_lightsweep_width_percent(int(self.lightsweep_width_percent))
        ls_soft = clamp_lightsweep_soft_percent(int(self.lightsweep_soft_percent))
        ls_glow = clamp_lightsweep_glow_percent(int(self.lightsweep_glow_percent))
        ls_opacity = clamp_lightsweep_opacity_percent(int(self.lightsweep_opacity_percent))
        ls_direction = normalize_lightsweep_direction(self.lightsweep_direction)
        ls_apply = normalize_lightsweep_apply_mode(self.lightsweep_apply_mode)
        if ls_direction not in LIGHTSWEEP_DIRECTION_IDS:
            raise ValueError('Hướng quét sáng không hợp lệ')
        if ls_apply not in LIGHTSWEEP_APPLY_MODE_IDS:
            raise ValueError('Chế độ gắn quét sáng không hợp lệ')
        if not 0 <= self.effect_overlay_opacity <= 100:
            raise ValueError('Độ rõ overlay hiệu ứng phải nằm trong khoảng 0–100%')
        if not 5 <= self.effect_overlay_scale_percent <= 200:
            raise ValueError('Kích thước overlay hiệu ứng phải nằm trong khoảng 5–200%')
        if not 0.0 <= self.effect_overlay_x_norm <= 1.0:
            raise ValueError('Vị trí ngang overlay phải nằm trong khoảng 0–1')
        if not 0.0 <= self.effect_overlay_y_norm <= 1.0:
            raise ValueError('Vị trí dọc overlay phải nằm trong khoảng 0–1')
        media_items = [item for item in self.media_overlays or () if isinstance(item, dict) and item.get('enabled', True)]
        for item in media_items:
            path = str(item.get('path', '') or '')
            if not path or not Path(path).is_file():
                raise ValueError('Overlay đã bật nhưng tệp ảnh/video overlay không tồn tại')
        if self.effect_overlay_enabled:
            if not self.effect_overlay_path or not Path(self.effect_overlay_path).is_file():
                raise ValueError('Overlay đã bật nhưng tệp overlay không tồn tại')
        elif self.video_effect == 'custom':
            if self.effect_overlay_path and not Path(self.effect_overlay_path).is_file():
                raise ValueError('Hiệu ứng tuỳ chỉnh đã chọn nhưng tệp overlay không tồn tại')
        if not self.subtitle_font.strip() or any((character in self.subtitle_font for character in ",;'")):
            raise ValueError('Phông chữ phụ đề không hợp lệ')
        if not 10 <= self.subtitle_font_size <= 240:
            raise ValueError('Cỡ chữ phụ đề phải nằm trong khoảng 10–240')
        if not 15 <= int(self.subtitle_box_width_percent) <= 100:
            raise ValueError('Độ rộng khung phụ đề phải từ 15–100%')
        if not 10 <= self.subtitle_scale_x_percent <= 500:
            raise ValueError('Phóng ngang phụ đề phải nằm trong khoảng 10–500%')
        if not 10 <= self.subtitle_scale_y_percent <= 500:
            raise ValueError('Phóng dọc phụ đề phải nằm trong khoảng 10–500%')
        if not _is_hex_color(self.subtitle_text_color):
            raise ValueError('Màu chữ phụ đề không hợp lệ')
        if not _is_hex_color(self.subtitle_outline_color):
            raise ValueError('Màu viền phụ đề không hợp lệ')
        if not 0 <= self.subtitle_outline_width <= 12:
            raise ValueError('Độ dày viền phụ đề phải nằm trong khoảng 0–12')
        from core.text_anim import normalize_subtitle_anim
        anim = normalize_subtitle_anim(self.subtitle_anim)
        if anim != str(self.subtitle_anim or 'none').strip().lower():
            raise ValueError('Hiệu ứng động phụ đề không hợp lệ')
        if not _is_hex_color(self.subtitle_karaoke_color):
            raise ValueError('Màu karaoke phụ đề không hợp lệ')
        if self.subtitle_position not in frozenset({'top', 'center', 'bottom'}):
            raise ValueError('Vị trí phụ đề không hợp lệ')
        if not 0 <= self.subtitle_margin_bottom <= 2000:
            raise ValueError('Khoảng cách phụ đề phải nằm trong khoảng 0–2000')
        if self.subtitle_enabled:
            if self.subtitle_path and not Path(self.subtitle_path).is_file():
                drop_subtitle = True
        if self.logo_enabled and self.logo_path and (not Path(self.logo_path).is_file()):
            raise ValueError('Logo đã chọn không tồn tại')
        result = replace(self, video_title_anim=title_anim, lightsweep_cycle_sec=ls_cycle, lightsweep_duration_sec=ls_duration, lightsweep_width_percent=ls_width, lightsweep_soft_percent=ls_soft, lightsweep_glow_percent=ls_glow, lightsweep_opacity_percent=ls_opacity, lightsweep_direction=ls_direction, lightsweep_apply_mode=ls_apply, color_lut_stack=ls_stack)
        if drop_voice:
            result = replace(result, voice_audio_enabled=False, voice_audio_path='')
        if drop_subtitle:
            result = replace(result, subtitle_enabled=False, subtitle_path='')
        return result


@dataclass(frozen=True)
class ExportPlan:
    command: tuple[str, ...]
    filter_complex: str
    temporary_output: str
    final_output: str
    expected_duration_ms: int
    sidecar_paths: tuple[str, ...] = ()
    source_size_bytes: int = 0
    heavy_filters: bool = False
    deferred_lightsweep: bool = False
    deferred_video_filter: str = ''
    deferred_extra_inputs: tuple[tuple[str, ...], ...] = ()
    timeline_prebake: tuple = ()
    audio_mux_filter: str = ''
    audio_mux_inputs: tuple[str, ...] = ()

def summarize_export_plan_for_log(plan):
    cmd = list(plan.command)
    input_count = sum((1 for index, token in enumerate(cmd) if not not index > 0))
    encoder = '?'
    preset = ''
    for index, token in enumerate(cmd):
        if token == '-c:v' and index + 1 < len(cmd):
            encoder = cmd[index + 1]
        if not token == '-preset':
            continue
        if not index + 1 < len(cmd):
            continue
        else:
            preset = cmd[index + 1]
    threads = ''
    filter_threads = ''
    filter_complex_threads = ''
    for index, token in enumerate(cmd):
        if token == '-threads' and index + 1 < len(cmd):
            threads = cmd[index + 1]
        if token == '-filter_threads' and index + 1 < len(cmd):
            filter_threads = cmd[index + 1]
        if not token == '-filter_complex_threads':
            continue
        if not index + 1 < len(cmd):
            continue
        else:
            filter_complex_threads = cmd[index + 1]
    fc = plan.filter_complex or ''
    deferred_fc = str(getattr(plan, 'deferred_video_filter', '') or '')
    features = []
    feature_src = fc
    if deferred_fc:
        feature_src = f'{fc};{deferred_fc}'
    if 'gblur' in feature_src:
        features.append('blur nền gblur')
    if '[fgkb]' in feature_src or 'zoompan' in feature_src:
        features.append('Ken Burns / zoom')
    if 'blend=all_mode' in feature_src:
        features.append(f'blend×{feature_src.count('blend=all_mode')}')
    if 'all_expr=' in feature_src or 'geq=' in feature_src:
        features.append('blend geq/expr')
    if 'overlay=' in feature_src and 'gblur=' in feature_src:
        if 'drawbox=' in feature_src:
            if not 'crop=' in feature_src:
                pass
    if 'scale2ref=' in feature_src and 'color=c=white' in feature_src:
        if not 'overlay=' in feature_src:
            pass
    if 'drawbox=' in feature_src:
        if not 'maskedmerge' in feature_src:
            if 'blend=all_mode=addition' in feature_src:
                if 'format=gbrp' in feature_src:
                    pass
        features.append('lightsweep Plus')
    if '[fxov' in feature_src or '[withfx' in feature_src:
        features.append('overlay trang trí')
    if 'ass=' in feature_src:
        features.append(f'ASS×{feature_src.count('ass=')}')
    if 'boxblur' in feature_src:
        features.append(f'vùng mờ×{feature_src.count('boxblur=')}')
    if 'noise=' in feature_src or 'rgbashift' in feature_src:
        features.append('chống trùng video')
    if 'xfade=' in feature_src:
        features.append(f'xfade×{feature_src.count('xfade=')}')
    if 'lut3d=' in feature_src:
        features.append(f'lut3d×{feature_src.count('lut3d=')}')
    if not '[aout]' in fc and (not '-map [aout]' in cmd):
        if str(getattr(plan, 'audio_mux_filter', '') or '').strip():
            pass
    features.append('mix audio TTS/BGM')
    dur_s = plan.expected_duration_ms / 1000.0
    src_mb = plan.source_size_bytes / 1048576 if plan.source_size_bytes else 0
    lines = [f'Đích: {plan.final_output}', f'Part tạm: {plan.temporary_output}', f'Thời lượng dự kiến: {dur_s:.1f}s | nguồn ~{src_mb:.1f} MB', f'Encoder: {encoder}' + (f' preset={preset}' if preset else ''), f'Luồng: threads={threads or '?'} filter_threads={filter_threads or '?'} filter_complex_threads={filter_complex_threads or '?'}', f'Inputs FFmpeg: {input_count} | filter nặng: {plan.heavy_filters}', f'Hiệu ứng: {(', '.join(features) if features else 'cơ bản')}', f'Filter graph Pass A: {len(fc)} ký tự, {(fc.count(';') + 1 if fc.strip() else 0)} bước']
    if deferred_fc:
        extra_n = len(getattr(plan, 'deferred_extra_inputs', ()) or ())
        lines.append(f'Filter graph Pass B: {len(deferred_fc)} ký tự, {deferred_fc.count(';') + 1} bước' + (f'; +{extra_n} input overlay/logo/blend' if extra_n else ''))
        lines.append('Encode 2 lần (Pass A plate + Pass B hiệu ứng) — Pass B chậm (~0.1–0.2x) khi nhiều hòa trộn/lightsweep là bình thường; Windows Not Responding tạm thời nếu % vẫn tăng')
    elif getattr(plan, 'deferred_lightsweep', False):
        extra_n = len(getattr(plan, 'deferred_extra_inputs', ()) or ())
        lines.append('Encode 2 lần (Pass A plate xfade + Pass B overlay) — nhanh hơn 1-pass khi tách cảnh dày' + (f'; +{extra_n} input overlay/logo' if extra_n else ''))
    mux_fc = str(getattr(plan, 'audio_mux_filter', '') or '').strip()
    if mux_fc:
        mux_n = len(getattr(plan, 'audio_mux_inputs', ()) or ())
        lines.append(f'Mux audio sau plate: {len(mux_fc)} ký tự' + (f'; +{mux_n} file stem/TTS/BGM' if mux_n else ''))
    return '\n'.join(lines)

def resolve_video_pts_divisor(settings, *, expected_duration_ms, use_voice_audio):
    tts_video_factor, voice_fit_speed = _tts_fit_factors(settings, expected_duration_ms=expected_duration_ms, use_voice_audio=use_voice_audio)
    divisor = settings.speed / tts_video_factor
    if divisor <= 0:
        raise ValueError('Tốc độ video không hợp lệ')
    else:
        return (divisor, tts_video_factor, voice_fit_speed)

def build_export_plan(source, output, settings, *, duration_ms, has_audio, source_bitrate_kbps, source_width, source_height, subtitle_document):
    burn_subtitles = bool(settings.subtitle_enabled)
    settings = settings.validated()
    if burn_subtitles and (not subtitle_document is None) and getattr(subtitle_document, 'segments', None):
        path = str(subtitle_document.source_path or '').strip()
        settings = replace(settings, subtitle_enabled=True, subtitle_path=path or settings.subtitle_path)
    elif not settings.subtitle_enabled:
        subtitle_document = None
    if settings.voice_audio_enabled:
        if str(settings.voice_audio_path or '').strip():
            if int(getattr(settings, 'voice_duration_ms', 0) or 0) <= 0:
                voice_file = Path(str(settings.voice_audio_path)).expanduser()
                if voice_file.is_file():
                    from services_media import probe_audio_duration_ms
                    probe_audio_duration_ms = probe_audio_duration_ms
                    voice_ms = int(probe_audio_duration_ms(str(voice_file)) or 0)
                    if voice_ms > 0:
                        settings = replace(settings, voice_duration_ms=voice_ms)
    source_path = Path(source).expanduser().resolve()
    final_path = Path(output).expanduser().resolve()
    if not source_path.is_file():
        raise ValueError('Video nguồn không tồn tại')
    elif source_path == final_path:
        raise ValueError('File đầu ra không được trùng video nguồn')
    else:
        source_size_bytes = int(source_path.stat().st_size)
        source_width = int(source_width or 0)
        source_height = int(source_height or 0)
        if not source_width <= 0:
            if source_height <= 0:
                pass
        try:
            from services_media import probe_media_info
            probe_media_info = probe_media_info
            _probe = probe_media_info(str(source_path))
            if int(_probe.width or 0) > 0:
                if int(_probe.height or 0) > 0:
                    source_width = int(_probe.width)
                    source_height = int(_probe.height)
        except Exception:
            pass
        out_digest = hashlib.md5(str(final_path).encode('utf-8')).hexdigest()[:10]
        temporary_path = _export_cache_dir(final_path) / f'part_{out_digest}_{os.getpid()}_{int(time.time() * 1000)}{final_path.suffix or '.mp4'}'
        target_width, target_height = settings.target_size
        source_duration_ms = max(1, duration_ms)
        from core.timeline_clips import build_concat_trim_filters
        build_concat_trim_filters = build_concat_trim_filters
        from core.timeline_clips import build_media_overlays_from_video_tracks
        build_media_overlays_from_video_tracks = build_media_overlays_from_video_tracks
        from core.timeline_clips import clamp_track_index
        clamp_track_index = clamp_track_index
        from core.timeline_clips import clip_from_dict
        clip_from_dict = clip_from_dict
        from core.timeline_clips import layout_clips
        layout_clips = layout_clips
        from core.timeline_clips import remap_subtitle_document_through_clips
        remap_subtitle_document_through_clips = remap_subtitle_document_through_clips
        from core.timeline_clips import timeline_duration_ms
        timeline_duration_ms = timeline_duration_ms
        from core.timeline_clips import clip_source_paths_per_clip
        clip_source_paths_per_clip = clip_source_paths_per_clip
        from core.timeline_clips import unique_clip_source_paths
        unique_clip_source_paths = unique_clip_source_paths
        clip = clip
        all_clips = layout_clips([clip for clip in (clip_from_dict(item) for item in settings.timeline_clips or ()) if clip is not None])
        filled = []
        [clip for clip in () if clip is not None]
        for clip in all_clips:
            if not str(clip.source_path or '').strip():
                from dataclasses import replace
                _dc_replace = replace
                filled.append(_dc_replace(clip, source_path=str(source_path)))
            else:
                filled.append(clip)
        all_clips = layout_clips(filled)
        resolved_clips = [clip for clip in all_clips if clamp_track_index(clip.track_index) == 0]
        clip = clip
        if all_clips:
            resolved_clips = list(all_clips)
        track_overlay_items = build_media_overlays_from_video_tracks(all_clips)
        use_timeline_sequence = len(resolved_clips) > 1
        input_index_by_clip = None
        timeline_input_seeks = None
        timeline_prebake = []
        if use_timeline_sequence:
            timeline_input_paths = clip_source_paths_per_clip(resolved_clips, fallback=str(source_path))
            if not timeline_input_paths:
                timeline_input_paths = [str(source_path)]
            input_index_by_clip = list(range(len(timeline_input_paths)))
            timeline_input_seeks = []
            for clip in resolved_clips:
                start_s = max(0.0, float(clip.source_in_ms) / 1000.0)
                dur_s = max(0.05, (float(clip.source_out_ms) - float(clip.source_in_ms)) / 1000.0)
                timeline_input_seeks.append((start_s, dur_s))
            while len(timeline_input_seeks) < len(timeline_input_paths):
                pass
            input_index_by_path = {}
        else:
            timeline_input_paths = unique_clip_source_paths(resolved_clips, fallback=str(source_path))
            if not timeline_input_paths:
                timeline_input_paths = [str(source_path)]
            input_index_by_path = {path: index for item in enumerate(timeline_input_paths)}
            index = path
            path = {}
        timeline_fade_ms = 0
        timeline_join_styles = []
        if use_timeline_sequence:
            from core.timeline_transitions import normalize_random_pool
            normalize_random_pool = normalize_random_pool
            from core.timeline_transitions import normalize_transition_mode
            normalize_transition_mode = normalize_transition_mode
            from core.timeline_transitions import normalize_transition_style
            normalize_transition_style = normalize_transition_style
            from core.timeline_transitions import resolve_join_styles
            resolve_join_styles = resolve_join_styles
            from core.timeline_transitions import style_duration_ms
            style_duration_ms = style_duration_ms
            from core.timeline_transitions import timeline_output_duration_ms
            timeline_output_duration_ms = timeline_output_duration_ms
            timeline_fade_ms = max(0, min(2000, int(getattr(settings, 'timeline_transition_ms', 0) or 0)))
            _t_style = normalize_transition_style(getattr(settings, 'timeline_transition_style', 'fade'))
            _t_mode = normalize_transition_mode(getattr(settings, 'timeline_transition_mode', 'one_for_all'))
            _pool_raw = getattr(settings, 'timeline_transition_random_pool', None)
            if _pool_raw is None:
                _t_pool = normalize_random_pool(None)
            else:
                _t_pool = normalize_random_pool(_pool_raw)
            _t_seed = int(getattr(settings, 'timeline_transition_seed', 0) or 0)
            timeline_join_styles = resolve_join_styles(max(0, len(resolved_clips) - 1), mode=_t_mode, style=_t_style, random_pool=_t_pool, seed=_t_seed)
            if timeline_fade_ms <= 0:
                if _t_style != 'cut':
                    timeline_fade_ms = style_duration_ms(_t_style, 250)
        if len(resolved_clips) == 1:
            trim_start_ms = min(resolved_clips[0].source_in_ms, max(0, source_duration_ms - 1))
            trim_end_ms = min(resolved_clips[0].source_out_ms, source_duration_ms)
            trim_end_ms = max(trim_start_ms + 1, trim_end_ms)
        elif use_timeline_sequence:
            trim_start_ms = 0
            trim_end_ms = max(1, timeline_duration_ms(all_clips or resolved_clips))
        else:
            trim_start_ms = min(settings.trim_start_ms, max(0, source_duration_ms - 1))
            if settings.trim_start_ms >= source_duration_ms:
                raise ValueError('Mốc bắt đầu cắt vượt quá độ dài video')
            trim_end_ms = settings.trim_end_ms if settings.trim_end_ms else source_duration_ms
            trim_end_ms = min(trim_end_ms, source_duration_ms)
        if use_timeline_sequence:
            from core.timeline_transitions import uses_real_xfade
            _uses_xfade = uses_real_xfade
            timeline_xfade_active = _uses_xfade(timeline_join_styles, timeline_fade_ms)
            trim_duration_ms = timeline_output_duration_ms(resolved_clips, fade_ms=timeline_fade_ms, join_styles=timeline_join_styles, overlap=timeline_xfade_active)
        else:
            trim_duration_ms = max(1, trim_end_ms - trim_start_ms)
            timeline_xfade_active = False
        expected_duration_ms = max(1, round(trim_duration_ms / settings.speed))
        use_voice_audio = settings.voice_audio_enabled and bool(settings.voice_audio_path)
        video_pts_divisor, tts_video_factor, voice_fit_speed = resolve_video_pts_divisor(settings, expected_duration_ms=expected_duration_ms, use_voice_audio=use_voice_audio)
        if tts_video_factor > 1.0:
            expected_duration_ms = max(1, round(expected_duration_ms * tts_video_factor))
        if use_voice_audio and settings.voice_duration_ms > 0:
            if voice_fit_speed > 0:
                if settings.tts_fit_mode == 'stretch_video':
                    if not timeline_xfade_active:
                        voice_out_ms = max(1, int(round(float(settings.voice_duration_ms) / float(voice_fit_speed))))
                        if voice_out_ms > expected_duration_ms:
                            expected_duration_ms = voice_out_ms
        duration_seconds = expected_duration_ms / 1000
        scale_flags = _scale_flags(settings)
        background_blur_radius = background_blur_radius_from_strength(settings.background_blur_strength)
        scale_x, scale_y = resolve_scale_xy(settings.scale_percent, settings.scale_x_percent, settings.scale_y_percent)
        export_offset_x = int(settings.offset_x)
        export_offset_y = int(settings.offset_y)
        if len(resolved_clips) == 1:
            c0 = resolved_clips[0]
            clip_sx, clip_sy = resolve_scale_xy(c0.scale_percent, c0.scale_x_percent, c0.scale_y_percent)
            clip_is_identity = clip_sx == 100 and int(c0.offset_y) == 0
            panel_has_transform = scale_x != 100 or export_offset_y
            if clip_is_identity:
                if not panel_has_transform:
                    pass
            scale_y = clip_sy
            scale_x = clip_sx
            export_offset_x = int(c0.offset_x)
            export_offset_y = int(c0.offset_y)
        crop_norm = resolve_crop_norm(settings.crop_enabled, settings.crop_left, settings.crop_top, settings.crop_right, settings.crop_bottom)
        eff_source_w, eff_source_h = effective_source_pixel_size(source_width, source_height, crop_norm)
        foreground_width, foreground_height = resolve_foreground_pixel_size(source_width=eff_source_w, source_height=eff_source_h, target_width=target_width, target_height=target_height, scale_x_percent=scale_x, scale_y_percent=scale_y)
        has_source_size = layer_overlaps_trim(settings.logo_start_ms, settings.logo_end_ms, trim_start_ms, trim_end_ms, source_duration_ms)
        speed_text = f'{video_pts_divisor:g}'
        angle_text = f'{settings.rotation_degrees:g}'
        if settings.logo_enabled and bool(settings.logo_path):
            bool(settings.logo_path)
        use_logo = var
        media_overlays = _resolved_media_overlays(settings)
        if track_overlay_items:
            existing_ids = {var(var, '') for item in media_overlays if isinstance(item, dict) if item.get('id', '')}
            item = item
            for item in track_overlay_items:
                if str(item.get('id', '') or '') in existing_ids:
                    continue
                else:
                    media_overlays.append(item)
        blend_layers = _resolved_blend_layers(settings)
        media_overlays = _dedupe_media_overlays_for_blend(blend_layers, media_overlays)
        use_effect_overlay = bool(media_overlays)
        use_blend_layers = bool(blend_layers)
        _settings_has_frame_effect(settings)
        if not _settings_has_frame_effect(settings) and (not use_blend_layers):
            if not use_effect_overlay:
                if not use_logo:
                    if not bool(settings.subtitle_enabled):
                        bool(settings.subtitle_enabled)
                        if not bool(settings.video_title_enabled):
                            bool(settings.video_title_enabled)
                            if not bool(settings.text_overlay_enabled):
                                bool(settings.text_overlay_enabled)
        _post_effect_layers = Path(str(settings.cover_path)).expanduser().is_file()
        if bool(settings.cover_enabled):
            bool(settings.cover_enabled)
            if bool(str(settings.cover_path or '').strip()):
                bool(str(settings.cover_path or '').strip())
        use_cover = var
        _IMAGE_OVERLAY_EXT = {*frozenset({'.bmp', '.jpeg', '.gif', '.tiff', '.png', '.webp', '.jpg', '.tif'})}

        def _overlays_are_static_images(items):
            if not items:
                return True
            else:
                for item in items:
                    path = str((item or {}).get('path') or '').strip()
                    if not path:
                        return False
                    else:
                        ext = Path(path).suffix.lower()
                        if not ext not in _IMAGE_OVERLAY_EXT:
                            continue
                        return False
                return True
        _static_overlays_only = bool(settings.blur_zones)
        _settings_has_frame_effect(settings)
        if not _settings_has_frame_effect(settings) and (not use_blend_layers):
            if not (use_effect_overlay and (not _static_overlays_only)):
                if not bool(settings.subtitle_enabled):
                    bool(settings.subtitle_enabled)
                    if not bool(settings.video_title_enabled):
                        bool(settings.video_title_enabled)
                        if not bool(settings.text_overlay_enabled):
                            bool(settings.text_overlay_enabled)
        _heavy_post_layers = var
        defer_effects = _post_effect_layers(not use_cover, use_timeline_sequence and _heavy_post_layers)
        background_layers = _resolved_background_layers(settings)
        use_background_layers = str(settings.background or 'black') == 'custom' and bool(background_layers)
        if use_timeline_sequence:
            from core.timeline_prebake import TimelinePrebakeSeg
            TimelinePrebakeSeg = TimelinePrebakeSeg
            fb_src = str(source_path)
            bg_windows = []
            if use_background_layers:
                for item in background_layers:
                    bg_windows.append((int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), str(item.get('path') or '')))

            def _bg_for_clip_ms(at_ms):
                match = None
                for start_ms, end_ms, path in bg_windows:
                    if not path or not Path(path).is_file():
                        continue
                    if at_ms < start_ms:
                        continue
                    if end_ms > 0 and at_ms >= end_ms:
                        continue
                    offset_sec = max(0.0, (at_ms - start_ms) / 1000.0)
                    match = (path, offset_sec)
                if match is not None:
                    return match
                else:
                    return ('', 0.0)
            timeline_prebake = []
            for clip in resolved_clips:
                clip_path = str(clip.source_path or '').strip() or fb_src
                play_in, play_out = clip.video_play_window_ms()
                start_s = max(0.0, float(play_in) / 1000.0)
                src_dur_s = max(0.05, (float(play_out) - float(play_in)) / 1000.0)
                out_dur_s = max(0.05, float(clip.duration_ms) / 1000.0)
                bg_path, bg_start = _bg_for_clip_ms(int(clip.timeline_start_ms))
                timeline_prebake.append(TimelinePrebakeSeg(*(), **{'source_path': clip_path, 'start_sec': start_s, 'duration_sec': out_dur_s, 'source_duration_sec': src_dur_s, 'target_width': int(target_width), 'target_height': int(target_height), 'scale_x_percent': int(clip.scale_x_percent), 'scale_y_percent': int(clip.scale_y_percent), 'offset_x': int(clip.offset_x), 'offset_y': int(clip.offset_y), 'fps': max(1, int(settings.fps)), 'bg_path': bg_path, 'bg_start_sec': bg_start, 'mirror_hflip': bool(clip.mirror_hflip), 'warp_x_percent': int(clip.warp_x_percent or 100), 'warp_x_percent': int(clip.warp_x_percent or 100), 'warp_y_percent': int(clip.warp_y_percent or 100), 'crop_left': float(crop_norm[0]) if crop_norm else 0.0, 'crop_top': float(crop_norm[1]) if crop_norm else 0.0, 'crop_right': float(crop_norm[2]) if crop_norm else 1.0, 'crop_bottom': float(crop_norm[3]) if crop_norm else 1.0, 'crop_enabled': bool(crop_norm), 'crop_bottom': float(crop_norm[3]) if crop_norm else 1.0, 'crop_enabled': bool(crop_norm), 'letterbox_mode': str(settings.background or 'black'), 'letterbox_mode': str(settings.background or 'black'), 'blur_strength': int(settings.background_blur_strength or 40), 'blur_strength': int(settings.background_blur_strength or 40), 'face_reframe_plate': str(getattr(settings, 'face_reframe_plate', '') or ''), 'face_reframe_plate': str(getattr(settings, 'face_reframe_plate', '') or ''), 'source_width': int(eff_source_w or 0), 'source_width': int(eff_source_w or 0), 'source_height': int(eff_source_h or 0)}))
            timeline_input_paths = [f'__VTP_SEG_{index}__' for index in range(len(resolved_clips))]
            index = index
            input_index_by_clip = list(range(len(timeline_input_paths)))
            timeline_input_seeks = None
            input_index_by_path = {}
        if settings.background_audio_enabled and bool(settings.background_audio_path):
            bool(settings.background_audio_path)
        use_background_audio = Path(settings.video_vocal_stem_path).is_file()
        if settings.video_vocal_enabled and settings.video_vocal_volume > 0:
            if bool(settings.video_vocal_stem_path):
                bool(settings.video_vocal_stem_path)
        use_video_vocal_stem = Path(settings.video_instrumental_stem_path).is_file()
        if settings.video_bgm_enabled and settings.video_bgm_volume > 0:
            if bool(settings.video_instrumental_stem_path):
                bool(settings.video_instrumental_stem_path)
        use_video_inst_stem = var
        if not use_video_inst_stem and bool(settings.vocal_sep_audio_path):
            bool(settings.vocal_sep_audio_path)
            if Path(settings.vocal_sep_audio_path).is_file():
                Path(settings.vocal_sep_audio_path).is_file()
                if not use_video_vocal_stem:
                    pass
        use_sep_audio = var
        trim_end_limit = settings.trim_end_ms or 0
        sfx_events = []
        for event in valid_sfx_events(settings.sfx_events):
            event_ms = max(0, int(float(event.get('time_sec', 0.0)) * 1000))
            if event_ms < trim_start_ms:
                continue
            if trim_end_limit and event_ms > trim_end_limit:
                continue
            sfx_events.append(event)
        next_input_index = max(1, len(timeline_input_paths))
        blend_layer_input_indices = []
        background_layer_input_indices = []
        media_overlay_input_indices = []
        media_overlay_mask_input_indices = []
        logo_input_index = 0
        voice_input_index = 0
        background_audio_input_index = 0
        sep_audio_input_index = 0
        video_vocal_stem_input_index = 0
        video_inst_stem_input_index = 0
        sfx_input_indices = []
        if use_video_vocal_stem:
            video_vocal_stem_input_index = next_input_index
            next_input_index += 1
        if use_video_inst_stem:
            video_inst_stem_input_index = next_input_index
            next_input_index += 1
        if use_sep_audio:
            sep_audio_input_index = next_input_index
            next_input_index += 1
        if use_blend_layers and (not defer_effects):
            for _item in blend_layers:
                blend_layer_input_indices.append(next_input_index)
                next_input_index += 1
        if use_background_layers and (not timeline_prebake):
            for _item in background_layers:
                background_layer_input_indices.append(next_input_index)
                next_input_index += 1
        if use_effect_overlay and (not defer_effects):
            for item in media_overlays:
                media_overlay_input_indices.append(next_input_index)
                next_input_index += 1
                mask_idx = None
                ow, oh = _overlay_mask_dims_for_item(item, target_width=target_width, target_height=target_height)
                if _overlay_mask_still_input_args(item, overlay_w=ow, overlay_h=oh, duration_seconds=duration_seconds):
                    mask_idx = next_input_index
                    next_input_index += 1
                media_overlay_mask_input_indices.append(mask_idx)
        if use_logo and (not defer_effects):
            logo_input_index = next_input_index
            next_input_index += 1
        cover_duration_sec = max(0.5, min(10.0, float(getattr(settings, 'cover_duration_sec', 2.0) or 2.0)))
        cover_input_index = 0
        if use_cover:
            cover_input_index = next_input_index
            next_input_index += 1
            expected_duration_ms = max(1, expected_duration_ms + int(round(cover_duration_sec * 1000)))
            duration_seconds = expected_duration_ms / 1000.0
        if use_voice_audio:
            voice_input_index = next_input_index
            next_input_index += 1
        if use_background_audio:
            background_audio_input_index = next_input_index
            next_input_index += 1
        for _event in sfx_events:
            sfx_input_indices.append(next_input_index)
            next_input_index += 1
        _logo_cmd_path = settings.logo_path
        graph = []
        sidecar_paths = []
        sequence_audio_label = None
        video_src = '0:v'
        sequence_precomposed = False
        background_labels = None
        if use_background_layers and use_timeline_sequence:
            if resolved_clips:
                if not timeline_prebake:
                    background_windows = [(var, int(0), input_index) for item in zip(background_layers, background_layer_input_indices) if item.get('end_ms', 0)]

                    def _active_background_at(at_ms):
                        match = None
                        for start_ms, end_ms, input_index in background_windows:
                            if at_ms < start_ms:
                                continue
                            if end_ms > 0 and at_ms >= end_ms:
                                continue
                            match = (start_ms, input_index)
                        return match
                    background_labels = []
                    for clip_index, clip in enumerate(resolved_clips):
                        clip_start_ms = int(clip.timeline_start_ms)
                        active = _active_background_at(clip_start_ms)
                        if active is None:
                            background_labels.append(None)
                        else:
                            layer_start_ms, bg_input_index = active
                            offset_sec = max(0.0, (clip_start_ms - layer_start_ms) / 1000.0)
                            clip_duration_sec = max(0.05, int(clip.duration_ms) / 1000.0)
                            label = f'bgseg{clip_index}'
                            graph.append(f'[{bg_input_index}:v]trim=start={offset_sec:.3f}:duration={clip_duration_sec:.3f},setpts=PTS-STARTPTS,scale={target_width}:{target_height}:force_original_aspect_ratio=increase:flags={scale_flags},crop={target_width}:{target_height},setsar=1,format=yuv420p[{label}]')
                            background_labels.append(label)
        if use_timeline_sequence:
            fade_ms = timeline_fade_ms
            join_styles = list(timeline_join_styles)
            sequence_has_audio = bool(has_audio) and (not settings.mute_original_audio)
            seq_filters, video_src, sequence_audio_label, sequence_precomposed = build_concat_trim_filters(*(resolved_clips,), **{'has_audio': sequence_has_audio, 'video_out': 'vseq', 'audio_out': 'aseq', 'target_width': target_width, 'target_height': target_height, 'bake_transform': True, 'input_index_by_path': input_index_by_path, 'input_index_by_clip': input_index_by_clip, 'input_preseeked': bool(timeline_input_seeks), 'segments_prebaked': bool(timeline_prebake), 'fallback_path': str(source_path), 'fade_ms': fade_ms, 'transition_styles': join_styles, 'background_labels': None if timeline_prebake else background_labels, 'crop_norm': None if timeline_prebake else crop_norm})
            graph.extend(seq_filters)
        source_filters = [f'setpts=(PTS-STARTPTS)/{speed_text}']
        if abs(float(tts_video_factor) - 1.0) > 0.01:
            source_filters.append(f'fps={max(1, int(settings.fps))}')
        if not crop_norm is None and (not sequence_precomposed):
            source_filters.append(crop_filter_expression(*crop_norm))
        source_chain = ','.join(source_filters)
        if sequence_precomposed:
            graph.append(f'[{video_src}]{source_chain},setsar=1,format=yuv420p[composed]')
            if defer_effects:
                current = 'composed'
            else:
                from core.lut_stack import append_color_look_filters
                append_color_look_filters = append_color_look_filters
                current = append_color_look_filters(graph, 'composed', settings, uid='seqlook')
            fg_label = current
            plate_local = target_height > target_width
            motion_i = motion_intensity_factor(settings.motion_intensity_percent)
        else:
            if settings.background == 'blur' and (not use_background_layers):
                graph.append(f'[{video_src}]{source_chain},split=2[bgsrc][fgsrc]')
                bg_chain = f'[bgsrc]scale={target_width}:{target_height}:force_original_aspect_ratio=increase:flags={scale_flags},crop={target_width}:{target_height}'
                if background_blur_radius > 0:
                    sigma_small = max(1.0, float(background_blur_radius) / 3.2)
                    bg_chain += f',scale=iw/4:ih/4:flags=bilinear,gblur=sigma={sigma_small:.2f}:steps=1,scale={target_width}:{target_height}:flags=bilinear,eq=brightness=-0.04:saturation=1.05'
                graph.append(f'{bg_chain}[bg]')
            elif use_background_layers:
                graph.append(f'color=c=black:s={target_width}x{target_height}:r={settings.fps}:d={duration_seconds:.3f}[bg]')
                graph.append(f'[{video_src}]{source_chain}[fgsrc]')
            else:
                color = '0x30343b' if settings.background == 'gray' else 'black'
                graph.append(f'color=c={color}:s={target_width}x{target_height}:r={settings.fps}:d={duration_seconds:.3f}[bg]')
                graph.append(f'[{video_src}]{source_chain}[fgsrc]')
            if use_background_layers:
                bg_current = 'bg'
                for layer_idx in enumerate(zip(background_layers, background_layer_input_indices)):
                    item, bg_input_index = var
                    window = layer_output_seconds(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), trim_start_ms, trim_end_ms, source_duration_ms, video_pts_divisor)
                    if window is None:
                        pass
                    seg_label = f'bgcustom{layer_idx}'
                    bg_src = _ffmpeg_overlay_source_chain(str(item.get('path', '') or ''), duration_seconds, settings.fps)
                    mix_label = f'bgmix{layer_idx}'
                    enable = ffmpeg_enable_between(*window)
                    fit_free = str(item.get('fit_mode') or 'cover').strip().lower() == 'free'
                    if fit_free:
                        overlay_w, overlay_h = _scaled_overlay_dimensions(str(item.get('path', '') or ''), target_width, int(item.get('scale_percent', 100) or 100), target_height, scale_aspect=float(item.get('scale_aspect', 0) or 0))
                        x_norm = float(item.get('x_norm', 0.5) or 0.5)
                        y_norm = float(item.get('y_norm', 0.5) or 0.5)
                        pos = f'(W*{x_norm:g})-(w/2):(H*{y_norm:g})-(h/2)'
                        opacity = max(0.0, min(1.0, int(item.get('opacity', 100) or 100) / 100))
                        rot_deg = float(item.get('rotation_degrees', 0) or 0)
                        src_label = seg_label
                        graph.append(f'[{bg_input_index}:v]{bg_src},{_ffmpeg_scale_stretch_rgba(overlay_w, overlay_h, settings.fps)},colorchannelmixer=aa={opacity:g}[{seg_label}]')
                        rot_label = f'bgrot{layer_idx}'
                        rot_step = _ffmpeg_rgba_rotate_step(seg_label, rot_label, rot_deg)
                        if int(round(rot_deg)) != 0 and rot_step:
                            graph.append(rot_step)
                            src_label = rot_label
                        graph.append(f'[{bg_current}][{src_label}]overlay={pos}:format=auto:eof_action=pass:{enable}[{mix_label}]')
                    else:
                        graph.append(f'[{bg_input_index}:v]{bg_src},scale={target_width}:{target_height}:force_original_aspect_ratio=increase:flags={scale_flags},crop={target_width}:{target_height},setsar=1,format=yuv420p[{seg_label}]')
                        graph.append(f'[{bg_current}][{seg_label}]overlay=x=0:y=0:eof_action=repeat:{enable}[{mix_label}]')
                    bg_current = mix_label
                if bg_current != 'bg':
                    graph.append(f'[{bg_current}]null[bg]')
        if not sequence_precomposed:
            if has_source_size:
                scale_filter = f'scale={foreground_width}:{foreground_height}:flags={scale_flags}'
            elif scale_x == scale_y:
                scale_filter = f'scale={foreground_width}:{foreground_height}:force_original_aspect_ratio=decrease:flags={scale_flags}'
            else:
                scale_filter = f'scale={foreground_width}:{foreground_height}:flags={scale_flags}'
            foreground_filters = [scale_filter]
            if settings.mirror_enabled:
                foreground_filters.insert(0, 'hflip')
            motion_i = motion_intensity_factor(settings.motion_intensity_percent)
            zoom_step = zoompan_step_rate(motion_i)
            if settings.motion in frozenset({'zoom_out', 'zoom_in'}) and motion_i > 0.0:
                if not settings.auto_zoom_enabled:
                    if settings.motion == 'zoom_out':
                        zoom = f'if(eq(on,1),1.08,max(1.0,pzoom-{zoom_step:g}))'
                    else:
                        zoom = f'min(max(zoom,pzoom)+{zoom_step:g},1.08)'
                    foreground_filters.append(f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={foreground_width}x{foreground_height}:fps={settings.fps}")
            foreground_filters.append('format=rgba')
            graph.append(f'[fgsrc]{','.join(foreground_filters)}[fgwork]')
            fg_label = 'fgwork'
            plate_local = _uses_plate_local_motion(settings)
            if settings.rotation_degrees:
                graph.append(f'[{fg_label}]rotate={angle_text}*PI/180:ow=rotw(iw):oh=roth(ih):c=none[fgrot]')
                graph.append(f'[fgrot]crop={foreground_width}:{foreground_height}:(iw-{foreground_width})/2:(ih-{foreground_height})/2[fgplate]')
                fg_label = 'fgplate'
            elif plate_local:
                graph.append(f'[{fg_label}]crop={foreground_width}:{foreground_height}:(iw-{foreground_width})/2:(ih-{foreground_height})/2[fgplate]')
                fg_label = 'fgplate'
            if settings.auto_zoom_enabled and plate_local:
                fg_label = _append_auto_zoom(graph, fg_label, settings, target_width=foreground_width, target_height=foreground_height, keep_input_size=True, output_label='fgzoomed')
            if settings.motion == 'shake' and plate_local:
                if motion_i > 0.0:
                    pad = shake_crop_pad_scale(motion_i)
                    sx = SHAKE_BASE_X_PX * motion_i
                    sy = SHAKE_BASE_Y_PX * motion_i
                    graph.append(f'[{fg_label}]scale=iw*{pad:g}:ih*{pad:g},crop=iw/{pad:g}:ih/{pad:g}:(iw-ow)/2+{sx:g}*sin(18*t):(ih-oh)/2+{sy:g}*cos(15*t)[fg]')
                    fg_label = 'fg'
            if settings.motion == 'ken_burns' and plate_local and (motion_i > 0.0):
                fg_label = _append_ken_burns_motion(graph, fg_label, motion_i, fps=settings.fps)
            elif settings.motion in PAN_MOTIONS:
                if plate_local:
                    if motion_i > 0.0:
                        pad = 1.0 + SHAKE_PAD_EXTRA * motion_i
                        crop_xy = pan_crop_expr(settings.motion, motion_i, 'x')
                        if crop_xy is not None:
                            x_expr, y_expr = crop_xy
                            graph.append(f'[{fg_label}]scale=iw*{pad:g}:ih*{pad:g},crop=iw/{pad:g}:ih/{pad:g}:{x_expr}:{y_expr}[fgpan]')
                            fg_label = 'fgpan'
            if settings.motion == 'ken_burns' and (not plate_local):
                if motion_i > 0.0:
                    fg_label = _append_ken_burns_motion(graph, fg_label, motion_i, fps=settings.fps)
            from core.face_reframe import inner_plate_size
            inner_plate_size = inner_plate_size
            from core.face_reframe import plate_crop_xy
            plate_crop_xy = plate_crop_xy
            from core.face_reframe import should_clip_video_to_plate
            should_clip_video_to_plate = should_clip_video_to_plate
            if should_clip_video_to_plate(target_width=target_width, target_height=target_height, plate_aspect=str(getattr(settings, 'face_reframe_plate', '') or ''), source_width=int(eff_source_w or 0), source_height=int(eff_source_h or 0)):
                plate_w, plate_h = inner_plate_size(target_width, target_height, str(settings.face_reframe_plate))
                crop_x, crop_y = plate_crop_xy(foreground_width, foreground_height, plate_w, plate_h, export_offset_x, export_offset_y)
                graph.append(f'[{fg_label}]crop={plate_w}:{plate_h}:{crop_x}:{crop_y}[fgfaceplate]')
                fg_label = 'fgfaceplate'
                export_offset_x = 0
                export_offset_y = 0
            overlay_x = f'(W-w)/2+{export_offset_x}'
            overlay_y = f'(H-h)/2+{export_offset_y}'
            if settings.motion == 'shake' and (not plate_local) and (motion_i > 0.0):
                sx = SHAKE_BASE_X_PX * motion_i
                sy = SHAKE_BASE_Y_PX * motion_i
                overlay_x += f'+{sx:g}*sin(18*t)'
                overlay_y += f'+{sy:g}*cos(15*t)'
            elif settings.motion in PAN_MOTIONS:
                if settings.motion != 'ken_burns':
                    if not plate_local:
                        if motion_i > 0.0:
                            px = pan_overlay_expr(settings.motion, motion_i, 'x')
                            py = pan_overlay_expr(settings.motion, motion_i, 'y')
                            if px:
                                overlay_x += f'+{px}'
                            if py:
                                overlay_y += f'+{py}'
            from core.lut_stack import append_color_look_filters
            append_color_look_filters = append_color_look_filters
            fg_label = append_color_look_filters(graph, fg_label, settings, uid='fglook')
            from core.lightsweep import append_lightsweep_filters
            append_lightsweep_filters = append_lightsweep_filters
            from core.lightsweep import normalize_lightsweep_apply_mode
            normalize_lightsweep_apply_mode = normalize_lightsweep_apply_mode
            if _settings_has_lightsweep(settings):
                if normalize_lightsweep_apply_mode(settings.lightsweep_apply_mode) == 'video':
                    pass
                fg_label = append_lightsweep_filters(graph, fg_label, settings, out_label='fglightsweep')
            current = _compose_fg_on_bg(graph, bg_label='bg', fg_label=fg_label, settings=settings, overlay_x=overlay_x, overlay_y=overlay_y, target_width=target_width, target_height=target_height, fps=settings.fps)
        if settings.auto_zoom_enabled and (not plate_local):
            current = _append_auto_zoom(graph, current, settings, target_width=target_width, target_height=target_height, keep_input_size=False, output_label='autozoom')
        post_filters = []
        if settings.anti_duplicate:
            post_filters.extend(_anti_duplicate_filters(settings, target_width=target_width, target_height=target_height))
        if settings.border_pixels:
            post_filters.append(f'drawbox=x=0:y=0:w=iw:h=ih:color=black:t={settings.border_pixels}')
        if post_filters:
            graph.append(f'[{current}]{','.join(post_filters)}[styled]')
            current = 'styled'
        deferred_video_filter = ''
        deferred_extra_inputs = []
        plate_current = current
        if defer_effects:
            post_graph = []
            post_current = '0:v'
            pb_i = 1
            blend_layer_input_indices = []
            media_overlay_input_indices = []
            media_overlay_mask_input_indices = []
            logo_input_index = 0
            if use_blend_layers:
                for item in blend_layers:
                    blend_layer_input_indices.append(pb_i)
                    deferred_extra_inputs.append(tuple(_effect_overlay_input_args(str(item['path']), duration_seconds)))
                    pb_i += 1
            if use_effect_overlay:
                for item in media_overlays:
                    media_overlay_input_indices.append(pb_i)
                    deferred_extra_inputs.append(tuple(_effect_overlay_input_args(str(item['path']), duration_seconds)))
                    pb_i += 1
                    mask_idx = None
                    ow, oh = _overlay_mask_dims_for_item(item, target_width=target_width, target_height=target_height)
                    mask_args = _overlay_mask_still_input_args(item, overlay_w=ow, overlay_h=oh, duration_seconds=duration_seconds)
                    if mask_args:
                        mask_idx = pb_i
                        deferred_extra_inputs.append(tuple(mask_args))
                        pb_i += 1
                    media_overlay_mask_input_indices.append(mask_idx)
            if use_logo:
                logo_input_index = pb_i
                from core.logo_rmbg import resolve_logo_display_path
                _resolve_logo_pb = resolve_logo_display_path
                _logo_pb = _resolve_logo_pb(settings.logo_path, rmbg=bool(settings.logo_rmbg)) or settings.logo_path
                deferred_extra_inputs.append(('-loop', '1', '-framerate', '30', '-t', _seconds(expected_duration_ms), '-i', _path_for_ffmpeg(str(_logo_pb))))
                _logo_cmd_path = str(_logo_pb)
                pb_i += 1
        else:
            post_graph = graph
            post_current = current
        if defer_effects:
            from core.lut_stack import append_color_look_filters
            append_color_look_filters = append_color_look_filters
            post_current = append_color_look_filters(post_graph, post_current, settings, uid='seqlook')
        from core.lightsweep import normalize_lightsweep_apply_mode
        normalize_lightsweep_apply_mode = normalize_lightsweep_apply_mode
        lightsweep_on_fg_in_pass_a = _settings_has_lightsweep(settings) and (not sequence_precomposed)
        post_current = _append_video_effect(post_graph, post_current, settings, target_width=target_width, target_height=target_height, foreground_width=foreground_width, foreground_height=foreground_height, export_offset_x=export_offset_x, export_offset_y=export_offset_y, skip_lightsweep=bool(defer_effects and lightsweep_on_fg_in_pass_a))
        if use_blend_layers or use_effect_overlay:
            post_graph.append(f'[{post_current}]format=rgba[rgbawork]')
            post_current = 'rgbawork'
        if use_blend_layers:
            input_index = input_index
            item = item
            post_current = _append_blend_layers(post_graph, post_current, [(item, input_index) for item in zip(blend_layers, blend_layer_input_indices)], target_width=target_width, target_height=target_height, fps=settings.fps, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=video_pts_divisor, duration_seconds=duration_seconds)
            [(item, input_index) for item in zip(blend_layers, blend_layer_input_indices)]
        if use_effect_overlay:
            [(item, input_index) for item in zip(media_overlays, media_overlay_input_indices)]
            post_current = _append_decorative_overlays(post_graph, post_current, [(item, input_index) for item in zip(media_overlays, media_overlay_input_indices)], target_width=target_width, target_height=target_height, fps=settings.fps, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=video_pts_divisor, duration_seconds=duration_seconds, mask_input_indices=media_overlay_mask_input_indices)
        blur_zones = _resolved_blur_zones(settings)
        if blur_zones:
            if settings.blur_zone_dynamic:
                if not settings.auto_zoom_enabled:
                    post_current = _append_dynamic_blur_zones(post_graph, post_current, blur_zones, target_width=target_width, target_height=target_height)
            else:
                post_current = _append_simple_blur_zones(post_graph, post_current, blur_zones)
        text_filters = _text_overlay_filters(settings, target_width=target_width, target_height=target_height, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=video_pts_divisor)
        if text_filters:
            post_graph.append(f'[{post_current}]{','.join(text_filters)}[withtext]')
            post_current = 'withtext'
        title_step = _video_title_ass_step(settings, source_path=source_path, target_width=target_width, target_height=target_height, final_path=final_path, sidecar_paths=sidecar_paths, current=post_current, duration_ms=expected_duration_ms, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=video_pts_divisor)
        if title_step:
            post_graph.append(title_step)
            post_current = 'withtitle'
        if use_logo:
            from core.logo_rmbg import resolve_logo_display_path
            resolve_logo_display_path = resolve_logo_display_path
            logo_input_path = resolve_logo_display_path(settings.logo_path, rmbg=bool(settings.logo_rmbg))
            logo_baked_rmbg = bool(settings.logo_rmbg) and Path(logo_input_path).resolve() != Path(settings.logo_path).expanduser().resolve()
            logo_runtime_path = logo_input_path or settings.logo_path
            logo_width = max(8, round(target_width * settings.logo_scale_percent / 100))
            opacity = settings.logo_opacity / 100
            logo_parts = [f'[{logo_input_index}:v]scale={logo_width}:-1,format=rgba']
            if settings.logo_rmbg:
                if not logo_baked_rmbg:
                    pass
                logo_parts.append('colorkey=white:0.45:0.15')
            blend_on = layer_uses_blend(str(settings.logo_blend_mode or 'normal'))
            if opacity < 0.999 or not blend_on:
                logo_parts.append(f'colorchannelmixer=aa={opacity:g}')
            post_graph.append(f'{','.join(logo_parts)}[logo]')
            logo_rot = int(settings.logo_rotation_degrees or 0)
            logo_src = 'logo'
            if logo_rot != 0:
                rot_step = _ffmpeg_rgba_rotate_step('logo', 'logorot', logo_rot)
                if rot_step:
                    pass
                post_graph.append(rot_step)
                logo_src = 'logorot'
            logo_x, logo_y = _logo_overlay_position(settings)
            enable = ''
            window = layer_output_seconds(settings.logo_start_ms, settings.logo_end_ms, trim_start_ms, trim_end_ms, source_duration_ms, video_pts_divisor)
            if window is not None:
                enable = ':' + ffmpeg_enable_between(*window)
            if blend_on:
                mode = str(settings.logo_blend_mode or 'normal')
                ffm = _resolve_ffmpeg_blend_mode(mode)
                post_graph.append(f'[{post_current}]split=2[logosplita][logosplitb]')
                post_graph.append(f"[logosplitb][{logo_src}]overlay=x='{logo_x}':y='{logo_y}':format=auto:eof_action=pass{enable}[logoplace]")
                post_graph.append(f'[logosplita][logoplace]blend=all_mode={ffm}:all_opacity=1{enable}[withlogo]')
            else:
                post_graph.append(f"[{post_current}][{logo_src}]overlay=x='{logo_x}':y='{logo_y}':eof_action=pass{enable}[withlogo]")
            post_current = 'withlogo'
            if not defer_effects:
                _logo_cmd_path = logo_runtime_path
        elif not defer_effects:
            _logo_cmd_path = settings.logo_path
        from core.subtitle_burn_layers import resolve_burn_layer_jobs
        resolve_burn_layer_jobs = resolve_burn_layer_jobs
        burn_jobs = resolve_burn_layer_jobs(subtitle_enabled=burn_subtitles, burn_source=bool(getattr(settings, 'subtitle_burn_source', True)), burn_working=bool(getattr(settings, 'subtitle_burn_working', True)), source_document=getattr(settings, 'subtitle_source_document', None), working_document=subtitle_document, working_path=str(settings.subtitle_path or ''), margin_working=int(settings.subtitle_margin_bottom), margin_source=int(getattr(settings, 'subtitle_margin_bottom_source', 140) or 140))
        for job_index, job in enumerate(burn_jobs):
            ass_destination = _export_sidecar_path(final_path, job.sidecar_suffix)
            ass_document = job.document
            if job.kind == 'working' and (not ass_document is not None):
                ass_document = subtitle_document
            ass_trim_start = trim_start_ms
            ass_trim_end = trim_end_ms
            ass_pts_divisor = video_pts_divisor
            voice_locked = False
            voice_out_speed = _resolve_voice_audio_speed(settings, voice_fit_speed=voice_fit_speed, tts_video_factor=tts_video_factor)
            from core.av_sync import document_locked_to_voice_cues
            document_locked_to_voice_cues = document_locked_to_voice_cues
            from core.av_sync import load_tts_cues_sidecar
            load_tts_cues_sidecar = load_tts_cues_sidecar
            from core.av_sync import log_avsync_diagnostic
            log_avsync_diagnostic = log_avsync_diagnostic
            from core.av_sync import prefer_voice_locked_subtitles
            prefer_voice_locked_subtitles = prefer_voice_locked_subtitles
            _prefer_locked = prefer_voice_locked_subtitles(tts_fit_mode=str(settings.tts_fit_mode or ''), voice_enabled=bool(use_voice_audio), voice_path=str(settings.voice_audio_path or ''))
            cues = load_tts_cues_sidecar(settings.voice_audio_path) if _prefer_locked and use_voice_audio else None
            if job.voice_lock and use_voice_audio:
                if _prefer_locked:
                    if cues:
                        locked = document_locked_to_voice_cues(ass_document, cues, time_divisor=float(voice_out_speed or 1.0))
                        if locked.segments:
                            ass_document = locked
                            ass_trim_start = 0
                            ass_trim_end = 0
                            ass_pts_divisor = 1.0
                            voice_locked = True
                    elif ass_document is not None:
                        if ass_document.segments:
                            ass_trim_start = 0
                            ass_trim_end = 0
                            ass_pts_divisor = float(voice_out_speed or 1.0)
                            voice_locked = True
            if job.voice_lock:
                log_avsync_diagnostic(f'[AVSync] Burn phụ đề: voice_audio_path={settings.voice_audio_path} tts_fit_mode={settings.tts_fit_mode} voice_on={use_voice_audio} voice_ms={settings.voice_duration_ms} prefer_locked={_prefer_locked} cues={('CÓ ' + str(len(cues)) + ' cue' if cues else 'KHÔNG')} voice_locked={voice_locked} expected_ms={expected_duration_ms} số câu phụ đề gốc={(len(ass_document.segments) if ass_document else 0)}')
            if use_timeline_sequence and resolved_clips:
                if not voice_locked:
                    ass_document = remap_subtitle_document_through_clips(ass_document, resolved_clips)
                    ass_trim_start = 0
                    ass_trim_end = trim_duration_ms
            layer_settings = replace(settings, subtitle_margin_bottom=int(job.margin_v))
            ass_path = _write_styled_ass(layer_settings, destination=ass_destination, play_res_x=target_width, play_res_y=target_height, trim_start_ms=ass_trim_start, trim_end_ms=ass_trim_end, pts_divisor=ass_pts_divisor, document=ass_document)
            sidecar_paths.append(ass_path)
            escaped_path = _escape_filter_path(ass_path)
            out_label = 'withsubtitles' if job_index == len(burn_jobs) - 1 else f'withsubtitles{job_index}'
            post_graph.append(f"[{post_current}]ass=filename='{escaped_path}'[{out_label}]")
            post_current = out_label
        if defer_effects:
            fps_n = max(1, int(settings.fps))
            post_graph.append(f'[{post_current}]fps={fps_n},setpts=N/{fps_n}/TB,format=yuv420p[vout]')
            deferred_video_filter = ';'.join(post_graph)
            current = plate_current
        else:
            current = post_current
            deferred_video_filter = ''
        content_duration = duration_seconds
        if use_cover:
            content_duration = max(0.05, duration_seconds - cover_duration_sec)
        graph.append(f'[{current}]trim=duration={content_duration:.3f},setpts=PTS-STARTPTS[vtrim]')
        audio_map_label = 'aout'
        fps_n = max(1, int(settings.fps))
        if use_cover:
            graph.append(f'[{cover_input_index}:v]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height},setsar=1,fps={fps_n},trim=duration={cover_duration_sec:.3f},setpts=PTS-STARTPTS,format=yuv420p[vcover]')
            graph.append(f'[vcover][vtrim]concat=n=2:v=1:a=0,fps={fps_n},setpts=N/{fps_n}/TB,format=yuv420p[vout]')
        else:
            graph.append(f'[vtrim]fps={fps_n},setpts=N/{fps_n}/TB,format=yuv420p[vout]')
        anti_fp_audio = _anti_fp_audio_filters(settings) if settings.anti_duplicate_advanced and (not use_voice_audio) else []
        mix_ms = expected_duration_ms
        if use_cover:
            mix_ms = max(1, expected_duration_ms - int(round(cover_duration_sec * 1000)))
        uses_video_orig_audio = (not use_video_vocal_stem)(not use_video_inst_stem, has_audio and (not use_sep_audio))
        has_external_audio = use_background_audio(use_sep_audio, use_video_vocal_stem or sfx_events)
        joined_vgraph = ';'.join(graph)
        split_xfade_audio = 'concat=n=' in joined_vgraph
        audio_kwargs = {'has_audio': has_audio, 'original_audio_input_index': sep_audio_input_index if use_sep_audio else 0, 'original_audio_label': sequence_audio_label if use_timeline_sequence and sequence_audio_label else None, 'video_vocal_stem_input_index': video_vocal_stem_input_index, 'video_inst_stem_input_index': video_inst_stem_input_index, 'use_video_vocal_stem': use_video_vocal_stem, 'use_video_inst_stem': use_video_inst_stem, 'voice_input_index': voice_input_index, 'background_audio_input_index': background_audio_input_index, 'sfx_events': sfx_events, 'sfx_input_indices': sfx_input_indices, 'trim_start_ms': trim_start_ms, 'trim_end_ms': trim_end_ms, 'source_duration_ms': source_duration_ms, 'mix_duration_ms': mix_ms, 'source_audio_speed': settings.speed / tts_video_factor, 'voice_audio_speed': _resolve_voice_audio_speed(settings, voice_fit_speed=voice_fit_speed, tts_video_factor=tts_video_factor), **{'prefer_longest_audio': tts_video_factor > 1.0, 'post_mix_filters': anti_fp_audio, 'timeline_clips': resolved_clips if use_timeline_sequence else None, 'timeline_fade_ms': timeline_fade_ms if use_timeline_sequence else 0, 'timeline_join_styles': timeline_join_styles if use_timeline_sequence else None}}
        audio_mux_filter = ''
        audio_mux_inputs = ()
        if split_xfade_audio:
            mux_inputs = []
            mux_next = 1
            mux_vocal = 0
            mux_inst = 0
            mux_sep = 0
            mux_voice = 0
            mux_bgm = 0
            mux_sfx = []
            if use_video_vocal_stem:
                mux_vocal = mux_next
                mux_next += 1
                mux_inputs.append(settings.video_vocal_stem_path)
            if use_video_inst_stem:
                mux_inst = mux_next
                mux_next += 1
                mux_inputs.append(settings.video_instrumental_stem_path)
            if use_sep_audio:
                mux_sep = mux_next
                mux_next += 1
                mux_inputs.append(settings.vocal_sep_audio_path)
            if use_voice_audio:
                mux_voice = mux_next
                mux_next += 1
                mux_inputs.append(settings.voice_audio_path)
            if use_background_audio:
                mux_bgm = mux_next
                mux_next += 1
                mux_inputs.append(settings.background_audio_path)
            for event in sfx_events:
                mux_sfx.append(mux_next)
                mux_next += 1
                mux_inputs.append(str(event['file']))
            audio_kwargs.update({'has_audio': bool(use_sep_audio), 'original_audio_input_index': mux_sep if use_sep_audio else 0, 'original_audio_label': None, 'video_vocal_stem_input_index': mux_vocal, 'video_inst_stem_input_index': mux_inst, 'voice_input_index': mux_voice, 'background_audio_input_index': mux_bgm, 'sfx_input_indices': mux_sfx})
            audio_filters = _mixed_audio_filters(*(settings,), **{**audio_kwargs})
            audio_mux_filter = ';'.join(audio_filters)
            audio_mux_inputs = tuple(mux_inputs)
            pass1_audio_filters = []
        else:
            audio_filters = _mixed_audio_filters(*(settings,), **{**audio_kwargs})
            pass1_audio_filters = audio_filters
        graph.extend(pass1_audio_filters)
        if use_cover:
            if audio_filters:
                pass
            graph.append(f'anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration={cover_duration_sec:.3f},asetpts=PTS-STARTPTS[acover]')
            graph.append('[acover][aout]concat=n=2:v=0:a=1[aoutcov]')
            audio_map_label = 'aoutcov'
        filter_complex = ';'.join(graph)
        enc_threads, filter_threads, filter_complex_threads = resolve_export_threading(filter_complex, heavy_filters=export_plan_uses_heavy_filters(settings))
        command = [FFMPEG_PATH, '-y', '-nostdin', '-threads', enc_threads, '-filter_threads', filter_threads, '-filter_complex_threads', filter_complex_threads]
        if trim_start_ms and (not use_timeline_sequence):
            command.extend(['-ss', _seconds(trim_start_ms)])
        if trim_start_ms or settings.trim_end_ms:
            if not use_timeline_sequence:
                command.extend(['-t', _seconds(trim_duration_ms)])
        if timeline_input_seeks and len(timeline_input_seeks) >= len(timeline_input_paths):
            for input_path in zip(timeline_input_paths, timeline_input_seeks):
                seek_start, seek_dur = var
                command.extend(['-ss', f'{seek_start:.3f}', '-t', f'{seek_dur:.3f}', '-i', _path_for_ffmpeg(str(input_path))])
        else:
            for input_path in timeline_input_paths:
                command.extend(['-i', _path_for_ffmpeg(str(input_path))])
        if use_video_vocal_stem and (not split_xfade_audio):
            command.extend(['-i', _path_for_ffmpeg(settings.video_vocal_stem_path)])
        if use_video_inst_stem and (not split_xfade_audio):
            command.extend(['-i', _path_for_ffmpeg(settings.video_instrumental_stem_path)])
        if use_sep_audio and (not split_xfade_audio):
            command.extend(['-i', _path_for_ffmpeg(settings.vocal_sep_audio_path)])
        if use_blend_layers and (not defer_effects):
            for item in blend_layers:
                command.extend(_effect_overlay_input_args(str(item['path']), duration_seconds))
        if use_background_layers and (not timeline_prebake):
            for item in background_layers:
                command.extend(_effect_overlay_input_args(str(item['path']), duration_seconds))
        if use_effect_overlay and (not defer_effects):
            for item in media_overlays:
                command.extend(_effect_overlay_input_args(str(item['path']), duration_seconds))
                ow, oh = _overlay_mask_dims_for_item(item, target_width=target_width, target_height=target_height)
                mask_args = _overlay_mask_still_input_args(item, overlay_w=ow, overlay_h=oh, duration_seconds=duration_seconds)
                if not mask_args:
                    continue
                else:
                    command.extend(mask_args)
        if use_logo and (not defer_effects):
            command.extend(['-loop', '1', '-framerate', '30', '-t', _seconds(expected_duration_ms), '-i', _path_for_ffmpeg(str(_logo_cmd_path or settings.logo_path))])
        if use_cover:
            command.extend(['-loop', '1', '-framerate', str(max(1, int(settings.fps))), '-t', f'{cover_duration_sec:.3f}', '-i', _path_for_ffmpeg(str(Path(settings.cover_path).expanduser()))])
        if use_voice_audio and (not split_xfade_audio):
            command.extend(['-i', _path_for_ffmpeg(settings.voice_audio_path)])
        if use_background_audio:
            if not split_xfade_audio:
                pass
            command.extend(['-i', _path_for_ffmpeg(settings.background_audio_path)])
        if not split_xfade_audio:
            for event in sfx_events:
                command.extend(['-i', _path_for_ffmpeg(event['file'])])
        from core.ffmpeg_cli import filter_complex_from_file_args
        filter_complex_from_file_args = filter_complex_from_file_args
        fc_script = _export_sidecar_path(final_path, '.fc.txt')
        fc_script.write_text(filter_complex, encoding='utf-8')
        sidecar_paths.append(str(fc_script))
        command.extend(filter_complex_from_file_args(_path_for_ffmpeg(str(fc_script)), graph_text=filter_complex))
        command.extend(['-map', '[vout]'])
        if pass1_audio_filters:
            command.extend(['-map', f'[{audio_map_label}]', '-c:a', 'aac', '-b:a', '192k', '-t', f'{duration_seconds:.3f}'])
        elif split_xfade_audio:
            command.append('-an')
        elif has_audio:
            if not settings.mute_original_audio:
                if use_video_vocal_stem or use_video_inst_stem or use_sep_audio:
                    audio_map = '0:a:0?'
                else:
                    audio_map = '0:a:0?'
                command.extend(['-map', audio_map])
                simple_audio_filters = _audio_filters(settings.speed / tts_video_factor, settings.audio_volume)
                if settings.anti_duplicate_advanced:
                    simple_audio_filters.extend(_anti_fp_audio_filters(settings))
                if simple_audio_filters:
                    command.extend(['-af', ','.join(simple_audio_filters)])
                command.extend([*('-c:a', 'aac', '-b:a', '192k')])
        else:
            command.append('-an')
        command.extend(_video_encoder_args(settings, source_bitrate_kbps=source_bitrate_kbps))
        if settings.codec == 'h265':
            command.extend(['-tag:v', 'hvc1'])
        if settings.strip_metadata:
            command.extend(['-map_metadata', '-1'])
        if settings.fake_metadata:
            command.extend(_fake_metadata_args())
        command.extend(['-t', _seconds(expected_duration_ms), '-progress', 'pipe:1', '-stats_period', '0.5', _path_for_ffmpeg(str(temporary_path))])
        try:
            if audio_mux_filter:
                return ExportPlan(command=tuple(command), filter_complex=sanitize_ffmpeg_noise_alls(filter_complex), temporary_output=str(temporary_path), final_output=str(final_path), expected_duration_ms=expected_duration_ms, sidecar_paths=tuple(sidecar_paths), source_size_bytes=source_size_bytes, heavy_filters=export_plan_uses_heavy_filters(settings), deferred_lightsweep=bool(defer_effects), deferred_video_filter=sanitize_ffmpeg_noise_alls(deferred_video_filter) if defer_effects else '', deferred_extra_inputs=tuple(deferred_extra_inputs) if defer_effects else (), timeline_prebake=tuple(timeline_prebake), audio_mux_filter=sanitize_ffmpeg_noise_alls(audio_mux_filter), audio_mux_inputs=audio_mux_inputs)
            else:
                return ExportPlan(command=tuple(command), filter_complex=sanitize_ffmpeg_noise_alls(filter_complex), temporary_output=str(temporary_path), final_output=str(final_path), expected_duration_ms=expected_duration_ms, sidecar_paths=tuple(sidecar_paths), source_size_bytes=source_size_bytes, heavy_filters=export_plan_uses_heavy_filters(settings), deferred_lightsweep=bool(defer_effects), deferred_video_filter=sanitize_ffmpeg_noise_alls(deferred_video_filter) if defer_effects else '', deferred_extra_inputs=tuple(deferred_extra_inputs) if defer_effects else (), timeline_prebake=tuple(timeline_prebake), audio_mux_filter='', audio_mux_inputs=audio_mux_inputs)
        except:
            clip = var
            clip = var
            path = var
            index = var
            item = var
            index = var
            input_index = var
            item = var
            input_index = var
            item = var
            input_index = var
            item = var

def export_workspace_dir(final_path):
    return _export_cache_dir(final_path)

def _export_sidecar_path(final_path, suffix):
    cache = export_workspace_dir(final_path)
    safe_stem = ''.join((character if character.isalnum() or character in '-_' else '_' for character in final_path.stem))[:24]
    return cache / f'{safe_stem}_{os.getpid()}_{int(time.time() * 1000)}{suffix}'

def _path_for_ffmpeg(path):
    text = str(path or '').strip()
    if not text:
        return text
    else:
        if text.startswith('__VTP_SEG_') and text.endswith('__'):
            return text
        try:
            resolved = str(Path(text).expanduser().resolve())
        except OSError:
            resolved = os.path.abspath(os.path.expanduser(text))
        if os.name != 'nt':
            return resolved
        elif resolved.startswith('\\\\?\\'):
            return resolved
        elif len(resolved) >= 220:
            if resolved.startswith('\\\\'):
                return '\\\\?\\UNC\\' + resolved.lstrip('\\')
            else:
                return '\\\\?\\' + resolved
        else:
            return resolved

def _export_cache_dir(final_path):
    preferred = final_path.parent / '.vtp_export_cache'
    try:
        preferred.mkdir(parents=True, exist_ok=True)
        probe = preferred / f'.write_probe_{os.getpid()}'
        probe.write_text('ok', encoding='ascii')
        probe.unlink(missing_ok=True)
    except OSError:
        pass
    try:
        return preferred
    except:
        os.environ.get('TEMP')
        if not os.environ.get('TEMP') and (not os.environ.get('TMP')):
            os.environ.get('TMP')
        fallback = var(var, var) / 'VideoToolsProExport'
        fallback.mkdir(parents=True, exist_ok=True)
    return fallback

def _audio_filters(speed, volume):
    filters = []
    value = float(speed)
    while value > 2.0:
        filters.append('atempo=2')
        value /= 2.0
    while value < 0.5:
        filters.append('atempo=0.5')
        value /= 0.5
    if abs(value - 1.0) > 1e-09:
        filters.append(f'atempo={value:g}')
    if volume != 100:
        filters.append(f'volume={volume / 100:g}')
    return filters

def _source_track_audio_chain(*, speed, volume, trim_start_ms, trim_end_ms, source_duration_ms, mix_duration_ms):
    pieces = []
    source_dur = max(1, int(source_duration_ms or 0))
    t0 = max(0, int(trim_start_ms or 0))
    t1 = int(trim_end_ms or 0)
    if t1 <= 0:
        t1 = source_dur
    t1 = max(t0 + 1, min(t1, source_dur))
    if t0 > 0 or t1 < source_dur:
        start_s = t0 / 1000.0
        dur_s = max(0.001, (t1 - t0) / 1000.0)
        pieces.append(f'atrim=start={start_s:.3f}:duration={dur_s:.3f}')
        pieces.append('asetpts=PTS-STARTPTS')
    pieces.extend(_audio_filters(float(speed), int(volume)))
    if mix_duration_ms > 0:
        dur_s = max(0.001, mix_duration_ms / 1000.0)
        pieces.append(f'apad=whole_dur={dur_s:.3f}')
        pieces.append(f'atrim=duration={dur_s:.3f}')
        pieces.append('asetpts=PTS-STARTPTS')
    if pieces:
        return ','.join(pieces)
    else:
        return 'anull'

def _timeline_aligned_audio_filters(*, input_index, clips, join_styles, fade_ms, speed, volume, mix_duration_ms, out_label, prefix, overlap_like_video):
    from core.timeline_transitions import build_acrossfade_audio_chain
    if not clips:
        return []
    else:
        durs = [max(0.05, float(c.duration_ms) / 1000.0) for c in clips]
        c = c
        styles = list(join_styles, [])
        while len(styles) < max(0, len(clips) - 1):
            styles.append('fade')
        styles = styles[:max(0, len(clips) - 1)]
        filters = []
        seg_labels = []
        n_clips = len(clips)
        from core.ffmpeg_cli import audio_pad_buffer_filter
        audio_pad_buffer_filter = audio_pad_buffer_filter
        if n_clips <= 1:
            src_pads = [f'{input_index}:a']
        else:
            raw_pads = [f'{prefix}raw{i}' for i in range(n_clips)]
            src_pads = [f'{prefix}src{i}' for i in range(n_clips)]
            i = i
            filters.append(f'[{input_index}:a]asplit={n_clips}' + ''.join((f'[{pad}]' for pad in raw_pads)))
            for raw_lab, lab in zip(raw_pads, src_pads):
                filters.append(audio_pad_buffer_filter(raw_lab, lab))
        for index, clip in enumerate(clips):
            lab = f'{prefix}{index}'
            start = max(0.0, float(clip.source_in_ms) / 1000.0)
            end = max(start + 0.05, float(clip.source_out_ms) / 1000.0)
            src = src_pads[index]
            filters.append(f'[{src}]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[{lab}]')
            seg_labels.append(lab)
        joined = f'{prefix}j'
        if len(seg_labels) == 1:
            filters.append(f'[{seg_labels[0]}]anull[{joined}]')
        else:
            filters.extend(build_acrossfade_audio_chain(seg_labels, styles, fade_ms=int(fade_ms or 0), audio_out=joined, segment_dur_s=durs, preserve_duration=not overlap_like_video))
        post = _audio_filters(float(speed), int(volume))
        if mix_duration_ms > 0:
            dur_s = max(0.001, mix_duration_ms / 1000.0)
            post.extend([f'apad=whole_dur={dur_s:.3f}', f'atrim=duration={dur_s:.3f}', 'asetpts=PTS-STARTPTS'])
        if post:
            filters.append(f'[{joined}]{','.join(post)}[{out_label}]')
            return filters
        else:
            filters.append(f'[{joined}]anull[{out_label}]')
            try:
                return filters
            except:
                i = var

def _clips_share_single_source(clips, fallback=''):
    paths = set()
    for clip in clips:
        path = str(getattr(clip, 'source_path', '') or '').strip() or str(fallback, '')
        if not path:
            continue
        else:
            paths.add(path)
    return len(paths) <= 1

def balanced_tts_share(ratio, max_speed=1.2):
    r = float(ratio)
    cap = max(1.0, min(2.5, float(max_speed if max_speed is not None else 1.2)))
    if r <= 1.01:
        return (1.0, 1.0)
    else:
        voice = min(cap, max(1.0, r ** 0.5))
        video = r / voice
        return (video, voice)

def _tts_fit_factors(settings, *, expected_duration_ms, use_voice_audio):
    if use_voice_audio and (not settings.voice_duration_ms <= 0):
        if not expected_duration_ms <= 0:
            if settings.tts_fit_mode == 'none':
                pass
    try:
        return (1.0, 1.0)
    except:
        ratio = settings.voice_duration_ms / expected_duration_ms
    if ratio <= 1.01:
        return (1.0, 1.0)
    elif settings.tts_fit_mode == 'stretch_video':
        cap = float(settings.tts_fit_max_speed)
        if ratio <= cap + 1e-06:
            return (1.0, ratio)
        else:
            return balanced_tts_share(ratio, cap)
    elif settings.tts_fit_mode == 'speed_up_tts':
        return (1.0, min(ratio, float(settings.tts_fit_max_speed)))
    else:
        return (1.0, 1.0)

def _resolved_blur_zones(settings):
    if not settings.blur_zone_enabled:
        return []
    else:
        zones = []
        for item in settings.blur_zones or ():
            if not isinstance(item, dict) or not item.get('enabled', True):
                pass
            height = max(0.05, min(0.9, float(item.get('height', 0.18))))
            width = max(0.05, min(1.0, float(item.get('width', 0.92))))
            x = max(0.0, min(1.0 - width, float(item.get('x', 0.0))))
            y = max(0.0, min(1.0 - height, float(item.get('y', 0.82))))
            zones.append({'x': x, 'y': y, 'width': width, 'height': height, 'style': settings.blur_zone_style, 'strength': settings.blur_strength, 'color': getattr(settings, 'blur_zone_color', '#000000')})
        if zones:
            return zones
        else:
            height = max(0.05, min(0.9, settings.blur_zone_height_percent / 100))
            y = 0.0 if settings.blur_zone_position == 'top' else max(0.0, 1.0 - height)
            width = 0.92
            x = max(0.0, (1.0 - width) / 2.0)
            return [{'x': x, 'y': y, 'width': width, 'height': height, 'style': settings.blur_zone_style, 'strength': settings.blur_strength, 'color': getattr(settings, 'blur_zone_color', '#000000')}]

def _blur_fill_expr(zone):
    style = str(zone.get('style', 'blur'))
    strength = int(zone.get('strength', 20))
    opacity = max(0.15, min(0.95, strength / 100))
    raw = str(zone.get('color', '#000000') or '#000000').lstrip('#')
    if style == 'black' or len(raw) not in frozenset({8, 6}):
        return f'black@{opacity:g}'
    return f'0x{raw[:6]}@{opacity:g}'

def _append_simple_blur_zones(graph, current, blur_zones):
    for zone_index, zone in enumerate(blur_zones):
        label = f'blurzone{zone_index}'
        zone_height = max(0.05, min(0.9, float(zone['height'])))
        zone_y = max(0.0, min(1.0 - zone_height, float(zone['y'])))
        zone_x = max(0.0, min(1.0 - float(zone['width']), float(zone['x'])))
        zone_width = max(0.05, min(1.0 - zone_x, float(zone['width'])))
        style = str(zone.get('style', 'blur'))
        strength = int(zone.get('strength', 20))
        if style in frozenset({'black', 'color'}):
            fill = _blur_fill_expr(zone)
            graph.append(f'[{current}]drawbox=x=iw*{zone_x:g}:y=ih*{zone_y:g}:w=iw*{zone_width:g}:h=ih*{zone_height:g}:color={fill}:t=fill[{label}]')
        else:
            zone_radius = max(2, round(strength / 5))
            graph.append(f'[{current}]split=2[zonebase{zone_index}][zonesrc{zone_index}]')
            graph.append(f'[zonesrc{zone_index}]crop=iw*{zone_width:g}:ih*{zone_height:g}:iw*{zone_x:g}:ih*{zone_y:g},boxblur={zone_radius}:1[zoneblur{zone_index}]')
            graph.append(f'[zonebase{zone_index}][zoneblur{zone_index}]overlay=x=W*{zone_x:g}:y=H*{zone_y:g}[{label}]')
        current = label
    return current

def _append_dynamic_blur_zones(graph, current, blur_zones, *, target_width, target_height):
    for zone_index, zone in enumerate(blur_zones):
        label = f'blurzone{zone_index}'
        zone_height = max(0.05, min(0.9, float(zone['height'])))
        zone_y = max(0.0, min(1.0 - zone_height, float(zone['y'])))
        zone_x = max(0.0, min(1.0 - float(zone['width']), float(zone['x'])))
        zone_width = max(0.05, min(1.0 - zone_x, float(zone['width'])))
        style = str(zone.get('style', 'blur'))
        strength = int(zone.get('strength', 20))
        if style in frozenset({'black', 'color'}):
            fill = _blur_fill_expr(zone)
            graph.append(f'[{current}]drawbox=x=iw*{zone_x:g}:y=ih*{zone_y:g}:w=iw*{zone_width:g}:h=ih*{zone_height:g}:color={fill}:t=fill[{label}]')
            current = label
        bx = max(0, int(zone_x * target_width)) & -2
        by = max(0, int(zone_y * target_height)) & -2
        bw = max(2, int(zone_width * target_width) & -2)
        bh = max(2, int(zone_height * target_height) & -2)
        if bx + bw > target_width:
            bw = max(2, target_width - bx & -2)
        if by + bh > target_height:
            bh = max(2, target_height - by & -2)
        if not bw < 2:
            if bh < 2:
                pass
        above = by
        below = max(0, target_height - (by + bh))
        if above >= bh or above >= below:
            slice_h = max(2, min(bh, max(2, above)) & -2)
            slice_y = max(0, by - slice_h)
        else:
            slice_h = max(2, min(bh, max(2, below)) & -2)
            slice_y = min(target_height - slice_h, by + bh)
        crop_w = max(2, min(bw, target_width - bx) & -2)
        sigma = max(1.0, strength / 2.0)
        radius = max(1, int(sigma * 1.2))
        luma_radius = min(radius, max(1, min(bw, bh) // 2))
        chroma_radius = min(luma_radius, max(1, min(bw, bh) // 4 - 1))
        base = f'zonebase{zone_index}'
        src = f'zonesrc{zone_index}'
        patch = f'zonepatch{zone_index}'
        graph.append(f'[{current}]split=2[{base}][{src}]')
        patch_chain = f'[{src}]crop={crop_w}:{slice_h}:{bx}:{slice_y},scale={bw}:{bh},boxblur=luma_radius={luma_radius}:luma_power=3:chroma_radius={chroma_radius}:chroma_power=3'
        graph.append(f'{patch_chain}[{patch}]')
        graph.append(f'[{base}][{patch}]overlay={bx}:{by}[{label}]')
        current = label
    return current

def _bgm_aloop_size(duration_ms):
    seconds = max(1.0, float(duration_ms) / 1000.0)
    seconds = min(seconds, 90.0)
    return min(int(seconds * 48000) + 48000, 4320000)

def _mixed_audio_filters(settings, *, has_audio, original_audio_input_index, original_audio_label, video_vocal_stem_input_index, video_inst_stem_input_index, use_video_vocal_stem, use_video_inst_stem, voice_input_index, background_audio_input_index, sfx_events, sfx_input_indices, trim_start_ms, trim_end_ms, source_duration_ms, mix_duration_ms, source_audio_speed, voice_audio_speed, prefer_longest_audio, post_mix_filters, timeline_clips, timeline_fade_ms, timeline_join_styles):
    labels = []
    filters = []
    orig_pad = str(original_audio_label) if original_audio_label else f'{original_audio_input_index}:a'
    source_speed = settings.speed if source_audio_speed is None else float(source_audio_speed)
    voice_speed = settings.speed if voice_audio_speed is None else float(voice_audio_speed)
    extra = [item for item in post_mix_filters or [] if item]
    item = item
    events = list(sfx_events, [])
    indices = list(sfx_input_indices or [])
    use_voice = Path(settings.background_audio_path).is_file()
    if settings.background_audio_enabled and bool(settings.background_audio_path):
        bool(settings.background_audio_path)
    use_bgm = var
    tl_clips = list(timeline_clips or [])
    align_timeline = len(tl_clips) > 1 and _clips_share_single_source(tl_clips)

    def _append_source_like(input_ref, *, volume, out_label, prefix, use_label_pad, align):
        do_align = align_timeline if align is None else bool(align)
        if do_align and isinstance(input_ref, int):
            if not use_label_pad:
                filters.extend(_timeline_aligned_audio_filters(input_index=int(input_ref), clips=tl_clips, join_styles=timeline_join_styles, fade_ms=timeline_fade_ms, speed=source_speed, volume=volume, mix_duration_ms=mix_duration_ms, out_label=out_label, prefix=prefix, overlap_like_video=True))
                labels.append(f'[{out_label}]')
                return None
        if use_label_pad:
            pad = str(input_ref)
            chain = _source_track_audio_chain(speed=source_speed, volume=volume, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, mix_duration_ms=mix_duration_ms)
            filters.append(f'[{pad}]{chain}[{out_label}]')
            labels.append(f'[{out_label}]')
            return None
        else:
            chain = _source_track_audio_chain(speed=source_speed, volume=volume, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, mix_duration_ms=mix_duration_ms)
            filters.append(f'[{int(input_ref)}:a]{chain}[{out_label}]')
            labels.append(f'[{out_label}]')
            return None
    if not any((use_voice, use_bgm, events, use_video_vocal_stem, use_video_inst_stem)):
        if has_audio and (not settings.mute_original_audio):
            if not use_video_vocal_stem:
                if not use_video_inst_stem:
                    if align_timeline and (not original_audio_label is not None) and (original_audio_input_index >= 0):
                        _append_source_like(original_audio_input_index, volume=settings.audio_volume, out_label='aorig', prefix='ao')
                    elif original_audio_label is None:
                        chain = _source_track_audio_chain(speed=source_speed, volume=settings.audio_volume, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, mix_duration_ms=mix_duration_ms)
                        filters.append(f'[{orig_pad}]{chain}[aorig]')
                        labels.append('[aorig]')
        if not labels:
            if original_audio_label is None:
                return []
    else:
        if use_video_vocal_stem and video_vocal_stem_input_index > 0:
            _append_source_like(video_vocal_stem_input_index, volume=settings.video_vocal_volume, out_label='avvocal', prefix='sv', align=False)
        if use_video_inst_stem and video_inst_stem_input_index > 0:
            _append_source_like(video_inst_stem_input_index, volume=settings.video_bgm_volume, out_label='avinst', prefix='si', align=False)
        if has_audio and (not settings.mute_original_audio):
            if not use_video_vocal_stem:
                if not use_video_inst_stem:
                    if original_audio_label is not None:
                        chain = _source_track_audio_chain(speed=source_speed, volume=settings.audio_volume, trim_start_ms=0, trim_end_ms=0, source_duration_ms=0, mix_duration_ms=mix_duration_ms)
                        filters.append(f'[{orig_pad}]{chain}[aorig]')
                        labels.append('[aorig]')
                    else:
                        _append_source_like(original_audio_input_index, volume=settings.audio_volume, out_label='aorig', prefix='ao')
        if use_voice:
            from core.av_sync import prefer_voice_locked_subtitles
            _prefer_voice_locked = prefer_voice_locked_subtitles
            voice_locked_fit = var(tts_fit_mode=var, voice_enabled=var, voice_path=var(var, var))
            if align_timeline and voice_input_index >= 0 and (not voice_locked_fit):
                filters.extend(_timeline_aligned_audio_filters(input_index=voice_input_index, clips=tl_clips, join_styles=timeline_join_styles, fade_ms=timeline_fade_ms, speed=voice_speed, volume=settings.voice_audio_volume, mix_duration_ms=mix_duration_ms, out_label='avoice', prefix='tv'))
                labels.append('[avoice]')
            else:
                voice_filters = _audio_filters(voice_speed, settings.voice_audio_volume)
                chain = ','.join(voice_filters) if voice_filters else 'anull'
                if mix_duration_ms > 0:
                    dur_s = mix_duration_ms / 1000.0
                    chain += f',apad=whole_dur={dur_s:.3f},atrim=duration={dur_s:.3f},asetpts=PTS-STARTPTS'
                filters.append(f'[{voice_input_index}:a]{chain}[avoice]')
                labels.append('[avoice]')
        if use_bgm:
            volume = settings.background_audio_volume / 100
            timeline_speed = max(0.01, float(source_speed or 1.0))
            bgm_window = layer_output_seconds(settings.background_audio_start_ms, settings.background_audio_end_ms, trim_start_ms, trim_end_ms, source_duration_ms, timeline_speed)
            if bgm_window is None:
                use_bgm = False
            else:
                bgm_start_sec, bgm_end_sec = bgm_window
                bgm_duration = max(0.001, bgm_end_sec - bgm_start_sec)
                if mix_duration_ms > 0 and bgm_start_sec <= 0.001:
                    bgm_duration = max(bgm_duration, mix_duration_ms / 1000.0)
                loop_size = _bgm_aloop_size(min(int(round(bgm_duration * 1000)), 90000))
                delay_ms = max(0, int(round(bgm_start_sec * 1000)))
                pieces = [f'volume={volume:g}', f'aloop=loop=-1:size={loop_size}', f'atrim=duration={bgm_duration:.3f}', 'asetpts=PTS-STARTPTS']
                if delay_ms > 0:
                    pieces.append(f'adelay={delay_ms}|{delay_ms}')
                filters.append(f'[{background_audio_input_index}:a]{','.join(pieces)}[abgm]')
                labels.append('[abgm]')
        trim_ms = max(0, int(trim_start_ms))
        sfx_speed = max(0.01, float(source_speed or 1.0))
        for index in enumerate(zip(indices, events)):
            input_index, event = var
            event_ms = max(0, int(float(event.get('time_sec', 0.0)) * 1000))
            if event_ms < trim_ms:
                continue
            else:
                delay_ms = max(0, int(round((event_ms - trim_ms) / sfx_speed)))
                volume = max(0.0, min(3.0, float(event.get('volume', 0.7))))
                filters.append(f'[{input_index}:a]adelay={delay_ms}|{delay_ms},volume={volume:.4f}[asfx{index}]')
                labels.append(f'[asfx{index}]')
        if not labels:
            return []
        else:
            if len(labels) == 1:
                mixed_label = 'amixed' if extra else 'aout'
                filters.append(f'{labels[0]}anull[{mixed_label}]')
            else:
                duration_mode = 'longest' if prefer_longest_audio else 'first'
                mixed_label = 'amixed' if extra else 'aout'
                filters.append(f'{''.join(labels)}amix=inputs={len(labels)}:duration={duration_mode}:dropout_transition=0:normalize=0[{mixed_label}]')
            if extra:
                filters.append(f'[amixed]{','.join(extra)}[aout]')
            return filters

def _rng_for_anti_duplicate(settings):
    if settings.anti_duplicate_seed:
        return random.Random(settings.anti_duplicate_seed)
    else:
        return random.Random()

def _anti_duplicate_filters(settings, *, target_width, target_height):
    rng = _rng_for_anti_duplicate(settings)
    brightness = round(rng.uniform(-0.03, 0.03), 4)
    saturation = round(rng.uniform(0.93, 1.07), 3)
    hue_shift = round(rng.uniform(-5, 5), 2)
    hue_amp = round(rng.uniform(1.0, 2.0), 2)
    hue_freq = round(rng.uniform(0.03, 0.1), 3)
    rh = rng.choice((-1, 1))
    bv = rng.choice((-1, 1))
    crop_pct = round(rng.uniform(0.015, 0.025), 3)
    keep = round(1 - crop_pct, 3)
    half = round(crop_pct / 2, 4)
    noise = rng.randint(1, 2)
    sf = _scale_flags(settings)
    return [f'noise=alls={noise}', f'eq=brightness={brightness}:saturation={saturation}', f"hue=h='{hue_shift}+{hue_amp}*sin(2*PI*{hue_freq}*t)'", f'rgbashift=rh={rh}:bv={bv}', f'crop=iw*{keep}:ih*{keep}:iw*{half}:ih*{half},scale={target_width}:{target_height}:flags={sf}']

def _anti_fp_audio_filters(settings):
    rng = _rng_for_anti_duplicate(settings)
    pitch = round(rng.uniform(0.94, 0.97) if rng.random() < 0.5 else rng.uniform(1.03, 1.06), 4)
    sample_rate = 44100
    new_rate = int(sample_rate * pitch)
    atempo = round(sample_rate / new_rate, 6)
    filters = [f'aresample={sample_rate}', f'asetrate={new_rate}', f'aresample={sample_rate}', f'atempo={atempo}']
    for _ in range(3):
        freq = rng.choice((300, 600, 1200, 2400, 4800))
        gain = round(rng.uniform(-5, 5), 1)
        filters.append(f'equalizer=f={freq}:t=q:w=1.5:g={gain}')
    filters.append(f'lowpass=f={rng.randint(9000, 13000)}')
    filters.append(f'highpass=f={rng.randint(90, 160)}')
    vib_f = round(rng.uniform(4.0, 7.0), 2)
    vib_d = round(rng.uniform(0.08, 0.2), 2)
    filters.append(f'vibrato=f={vib_f}:d={vib_d}')
    phase = round(rng.uniform(0.3, 0.8), 2)
    filters.append(f'aphaser=type=t:speed={phase}:decay=0.3')
    ch_d1 = rng.randint(15, 25)
    ch_d2 = rng.randint(28, 40)
    ch_s1 = round(rng.uniform(0.25, 0.45), 2)
    ch_s2 = round(rng.uniform(0.3, 0.5), 2)
    filters.append(f'chorus=0.5:0.9:{ch_d1}|{ch_d2}:0.4|0.35:{ch_s1}|{ch_s2}:2|3')
    tr_f = round(rng.uniform(2.5, 4.5), 2)
    tr_d = round(rng.uniform(0.08, 0.18), 3)
    filters.append(f'tremolo=f={tr_f}:d={tr_d}')
    filters.append('asoftclip=type=hard:threshold=0.95')
    filters.append('alimiter=limit=0.95:level=false')
    return filters

def _resolve_voice_audio_speed(settings, *, voice_fit_speed, tts_video_factor):
    if settings.tts_fit_mode == 'speed_up_tts':
        return float(voice_fit_speed)
    elif settings.tts_fit_mode == 'stretch_video':
        return float(voice_fit_speed or 1.0)
    else:
        return settings.speed / float(tts_video_factor)

def _fake_metadata_args():
    return [*('-metadata', 'make=Apple', '-metadata', 'model=iPhone 15 Pro Max', '-metadata', 'software=TDT Studio', '-metadata', 'encoder=Apple QuickTime', '-metadata:s:v:0', 'handler_name=Core Media Video', '-metadata:s:a:0', 'handler_name=Core Media Audio')]

def _seconds(milliseconds):
    return f'{milliseconds / 1000:.3f}'

def _logo_overlay_position(settings):
    from core.logo_rmbg import logo_motion_ffmpeg_exprs, normalize_logo_motion
    motion = normalize_logo_motion(getattr(settings, 'logo_motion', 'static'))
    seed = int(getattr(settings, 'anti_duplicate_seed', 0) or 0)
    try:
        seed ^= abs(hash(str(settings.logo_path or ''))) % 10000
    except Exception:
        pass
    y_norm = float(getattr(settings, 'logo_y_norm', 0.5) or 0.5)
    x_norm = float(getattr(settings, 'logo_x_norm', 0.5) or 0.5)
    if settings.logo_position != 'custom' and motion in frozenset({'marquee', 'around'}):
        if settings.logo_position in frozenset({'top_left', 'top_right'}):
            y_norm = 0.08
        elif settings.logo_position in frozenset({'bottom_left', 'bottom_right'}):
            y_norm = 0.92
        elif settings.logo_position == 'center':
            y_norm = 0.5
    if motion != 'static':
        return logo_motion_ffmpeg_exprs(motion, speed=float(getattr(settings, 'logo_motion_speed', 120) or 120), seed=seed, y_norm=y_norm, x_norm=x_norm)
    elif settings.logo_position == 'custom':
        xn = max(0.0, min(1.0, float(settings.logo_x_norm)))
        yn = max(0.0, min(1.0, float(settings.logo_y_norm)))
        return (f'(W*{xn:g})-(w/2)', f'(H*{yn:g})-(h/2)')
    else:
        margin = 20
        return {'top_right': (f'W-w-{margin}', str(margin)), 'top_left': (str(margin), str(margin)), 'bottom_right': (f'W-w-{margin}', f'H-h-{margin}'), 'bottom_left': (str(margin), f'H-h-{margin}'), 'center': ('(W-w)/2', '(H-h)/2')}[settings.logo_position]

def _effect_overlay_input_args(path, duration_seconds):
    duration_text = f'{max(0.001, float(duration_seconds)):.3f}'
    suffix = Path(path).suffix.lower()
    media = _path_for_ffmpeg(path)
    if suffix in frozenset({'.mkv', '.avi', '.wmv', '.gif', '.ts', '.flv', '.m2ts', '.mov', '.mp4', '.webm', '.m4v'}):
        return ['-t', duration_text, '-i', media]
    else:
        return ['-loop', '1', '-framerate', '30', '-t', duration_text, '-i', media]

def _overlay_mask_still_input_args(item, *, overlay_w, overlay_h, duration_seconds):
    if not bool(item.get('mask_enabled', False)):
        return None
    else:
        try:
            from core.overlay_mask import overlay_mask_png_path
            overlay_mask_png_path = overlay_mask_png_path
            mask_file = overlay_mask_png_path(item, int(overlay_w), int(overlay_h))
        except Exception:
            pass
        if not mask_file or not Path(mask_file).is_file():
            return None
        duration_text = f'{max(0.001, float(duration_seconds)):.3f}'
        return ['-loop', '1', '-framerate', '30', '-t', duration_text, '-i', _path_for_ffmpeg(str(mask_file))]

def _overlay_mask_dims_for_item(item, *, target_width, target_height):
    return _scaled_overlay_dimensions(str(item.get('path', '') or ''), target_width, int(item.get('scale_percent', 100) or 100), target_height, scale_aspect=float(item.get('scale_aspect', 0) or 0))
_VIDEO_LAYER_SUFFIXES = frozenset({*frozenset({'.mkv', '.avi', '.wmv', '.gif', '.ts', '.flv', '.m2ts', '.mov', '.mp4', '.webm', '.m4v'})})
_overlay_loop_frames_cache: dict[str, int] = {}

def _is_video_layer_file(path):
    return Path(str(path or '')).suffix.lower() in _VIDEO_LAYER_SUFFIXES

def _overlay_loop_frame_count(path, fps):
    key = f'{path}|{int(fps)}'
    cached = _overlay_loop_frames_cache.get(key)
    if cached is not None:
        return cached
    else:
        rate = max(1, int(fps or 30))
        frames = rate * 10
        try:
            completed = subprocess.run([FFPROBE_PATH, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if completed.returncode == 0:
                if completed.stdout.strip():
                    sec = float(completed.stdout.strip())
                    if sec > 0.01:
                        frames = max(2, int(math.ceil(sec * rate)) + 2)
        except (OSError, ValueError, TypeError):
            pass
        _overlay_loop_frames_cache[key] = frames
        return frames

def _ffmpeg_overlay_source_chain(path, duration_seconds, fps):
    dur = max(0.001, float(duration_seconds))
    if not _is_video_layer_file(path):
        return f'trim=duration={dur:.3f},setpts=PTS-STARTPTS'
    else:
        rate = max(1, int(fps or 30))
        frames = int(_overlay_loop_frame_count(path, fps))
        src_sec = max(0.001, float(frames) / float(rate))
        if src_sec >= dur - 0.02:
            return f'trim=duration={dur:.3f},setpts=PTS-STARTPTS'
        else:
            max_safe = max(48, rate * 20)
            if frames <= max_safe:
                loop_frames = max(2, frames)
                return f'loop=loop=-1:size={loop_frames}:start=0,setpts=N/{rate}/TB,trim=duration={dur:.3f},setpts=PTS-STARTPTS'
            else:
                pad = max(0.001, dur - src_sec)
                return f'trim=duration={src_sec:.3f},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={pad:.3f}'

def _overlay_path_key(path):
    try:
        pass
    except OSError:
        pass
    return str(Path(path).expanduser().resolve()).casefold()

def _dedupe_media_overlays_for_blend(blend_layers, media_overlays):
    blend_paths = {_overlay_path_key(str(item.get('path', ''))) for item in blend_layers}
    item = item
    kept = []
    for item in media_overlays:
        key = _overlay_path_key(str(item.get('path', '')))
        if key in blend_paths:
            continue
        else:
            kept.append(item)
    return kept

def _resolved_media_overlays(settings):
    items = []
    if settings.media_overlays_master_enabled:
        for raw in settings.media_overlays or ():
            if not isinstance(raw, dict) or not raw.get('enabled', True):
                pass
            path = str(raw.get('path', '') or '')
            if not path or not Path(path).is_file():
                pass
            scale_aspect = float(raw.get('scale_aspect', 0) or 0)
            if scale_aspect < 0.05:
                scale_aspect = 0.0
            items.append({'id': str(raw.get('id', '') or ''), 'path': path, 'id': str(raw.get('id', '') or ''), 'path': path, 'opacity': max(0, min(100, int(raw.get('opacity', 50) or 50))), 'opacity': max(0, min(100, int(raw.get('opacity', 50) or 50))), 'scale_percent': max(5, min(200, int(raw.get('scale_percent', 100) or 100))), 'scale_aspect': scale_aspect, 'scale_percent': max(5, min(200, int(raw.get('scale_percent', 100) or 100))), 'scale_aspect': scale_aspect, 'rotation_degrees': float(raw.get('rotation_degrees', 0) or 0) % 360.0, 'rotation_degrees': float(raw.get('rotation_degrees', 0) or 0) % 360.0, 'x_norm': float(raw.get('x_norm', 0.5) or 0.5), 'x_norm': float(raw.get('x_norm', 0.5) or 0.5), 'y_norm': float(raw.get('y_norm', 0.5) or 0.5), 'y_norm': float(raw.get('y_norm', 0.5) or 0.5), 'start_ms': max(0, int(raw.get('start_ms', 0) or 0)), 'start_ms': max(0, int(raw.get('start_ms', 0) or 0)), 'end_ms': max(0, int(raw.get('end_ms', 0) or 0)), 'end_ms': max(0, int(raw.get('end_ms', 0) or 0)), 'blend_mode': str(raw.get('blend_mode', 'normal') or 'normal'), 'mask_enabled': bool(raw.get('mask_enabled', False)), 'blend_mode': str(raw.get('blend_mode', 'normal') or 'normal'), 'mask_enabled': bool(raw.get('mask_enabled', False)), 'mask_shape': str(raw.get('mask_shape', 'circle') or 'circle'), 'mask_shape': str(raw.get('mask_shape', 'circle') or 'circle'), 'mask_width_percent': max(8, min(150, int(raw.get('mask_width_percent', 100) or 100))), 'mask_width_percent': max(8, min(150, int(raw.get('mask_width_percent', 100) or 100))), 'mask_height_percent': max(8, min(150, int(raw.get('mask_height_percent', 100) or 100))), 'mask_height_percent': max(8, min(150, int(raw.get('mask_height_percent', 100) or 100))), 'mask_feather_percent': max(0, min(100, int(raw.get('mask_feather_percent', 20) or 20))), 'mask_feather_percent': max(0, min(100, int(raw.get('mask_feather_percent', 20) or 20))), 'mask_feather_bias': max(-100, min(100, int(raw.get('mask_feather_bias', 0) or 0))), 'mask_feather_bias': max(-100, min(100, int(raw.get('mask_feather_bias', 0) or 0))), **{'mask_feather_axis': 'x' if str(raw.get('mask_feather_axis', 'y') or 'y').lower() == 'x' else 'y', 'mask_corner_radius_percent': max(0, min(100, int(raw.get('mask_corner_radius_percent', 18) or 18)))}})
        if items:
            return items
    else:
        if bool(settings.effect_overlay_path) and Path(settings.effect_overlay_path).is_file():
            if not settings.effect_overlay_enabled:
                if settings.video_effect == 'custom':
                    pass
            return [{'path': settings.effect_overlay_path, 'opacity': settings.effect_overlay_opacity, 'scale_percent': settings.effect_overlay_scale_percent, 'scale_aspect': 0.0, 'rotation_degrees': 0.0, 'x_norm': settings.effect_overlay_x_norm, 'y_norm': settings.effect_overlay_y_norm, 'blend_mode': 'normal'}]
        return []

def _resolved_blend_layers(settings):
    if not settings.blend_layers_master_enabled:
        return []
    else:
        items = []
        for raw in settings.blend_layers or ():
            if not isinstance(raw, dict) or not raw.get('enabled', True):
                pass
            path = str(raw.get('path', '') or '')
            if not path or not Path(path).is_file():
                pass
            mode = str(raw.get('blend_mode', 'screen') or 'screen').strip().lower()
            scale_aspect = float(raw.get('scale_aspect', 0) or 0)
            if scale_aspect < 0.05:
                scale_aspect = 0.0
            items.append({'path': path, 'opacity': max(0, min(100, int(raw.get('opacity', 15) or 15))), 'blend_mode': mode, 'x_norm': float(raw.get('x_norm', 0.5) or 0.5), 'y_norm': float(raw.get('y_norm', 0.5) or 0.5), 'scale_percent': max(5, min(200, int(raw.get('scale_percent', 100) or 100))), 'scale_aspect': scale_aspect, 'rotation_degrees': float(raw.get('rotation_degrees', 0) or 0) % 360.0, 'start_ms': max(0, int(raw.get('start_ms', 0) or 0)), 'end_ms': max(0, int(raw.get('end_ms', 0) or 0))})
        return items

def _resolved_background_layers(settings):
    if not settings.background_layers_master_enabled:
        return []
    else:
        items = []
        for raw in settings.background_layers or ():
            if not isinstance(raw, dict) or not raw.get('enabled', True):
                continue
            path = str(raw.get('path', '') or '')
            if not path or not Path(path).is_file():
                continue
            items.append({'path': path, 'start_ms': max(0, int(raw.get('start_ms', 0) or 0)), 'end_ms': max(0, int(raw.get('end_ms', 0) or 0))})
        return items

def _split_overlay_layers(overlays, input_indices):
    blend_layers = []
    decorative = []
    for item, input_index in zip(overlays, input_indices):
        if layer_uses_blend(str(item.get('blend_mode', 'normal') or 'normal')):
            blend_layers.append((item, input_index))
        else:
            decorative.append((item, input_index))
    return (blend_layers, decorative)

def _overlay_expr_to_crop(expr, dim):
    text = str(expr or '')
    if dim == 'x':
        return text.replace('W', 'iw').replace('w', 'ow')
    else:
        return text.replace('H', 'ih').replace('h', 'oh')

def _probe_overlay_dimensions(path):
    import json
    import subprocess
    source = str(path or '').strip()
    if not source:
        return (0, 0)
    else:
        create = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        try:
            completed = subprocess.run([FFPROBE_PATH, '-v', 'error', '-show_streams', '-of', 'json', source], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=create)
            if completed.returncode == 0:
                payload = json.loads(completed.stdout or '{}')
                for stream in payload.get('streams', []):
                    width = int(stream.get('width') or 0)
                    height = int(stream.get('height') or 0)
                    if not width > 0:
                        continue
                    if not var:
                        pass
        except Exception:
            pass
        else:
            return var
        return (0, 0)

def _scaled_overlay_dimensions(path, target_width, scale_percent, target_height=0, scale_aspect=0.0):
    del target_height
    src_w, src_h = _probe_overlay_dimensions(path)
    if src_w <= 0 or src_h <= 0:
        src_w, src_h = (1920, 1080)
    overlay_w = max(8, round(target_width * max(5, min(200, int(scale_percent))) / 100))
    aspect = float(scale_aspect or 0)
    if aspect >= 0.05:
        overlay_h = max(1, round(overlay_w * aspect))
    else:
        overlay_h = max(1, round(overlay_w * src_h / src_w))
    overlay_w = max(2, int(round(overlay_w / 2.0) * 2))
    overlay_h = max(2, int(round(overlay_h / 2.0) * 2))
    return (overlay_w, overlay_h)

def _ffmpeg_scale_stretch_rgba(overlay_w, overlay_h, fps):
    return f'scale={overlay_w}:{overlay_h}:flags=bicubic,fps={fps},format=rgba'

def _ffmpeg_rgba_rotate_step(in_label, out_label, degrees):
    deg = int(round(float(degrees or 0)))
    if deg == 0:
        return None
    else:
        return f'[{in_label}]rotate={deg}*PI/180:c=none:ow=rotw(iw):oh=roth(ih)[{out_label}]'

def _ffmpeg_rgba_rotate_fit_box(in_label, out_label, degrees, box_w, box_h):
    deg = int(round(float(degrees or 0)))
    if deg == 0:
        return None
    else:
        w = max(2, int(box_w))
        h = max(2, int(box_h))
        mid = f'{out_label}_pre'
        return f'[{in_label}]rotate={deg}*PI/180:c=none:ow=rotw(iw):oh=roth(ih)[{mid}];[{mid}]scale={w}:{h}:flags=bicubic[{out_label}]'

def _clamp_overlay_origin(target_width, target_height, overlay_w, overlay_h, x_norm, y_norm, *, allow_pasteboard):
    if allow_pasteboard:
        x = round(target_width * float(x_norm) - overlay_w / 2)
        y = round(target_height * float(y_norm) - overlay_h / 2)
        return (x, y)
    else:
        x = round(target_width * max(0.0, min(1.0, float(x_norm))) - overlay_w / 2)
        y = round(target_height * max(0.0, min(1.0, float(y_norm))) - overlay_h / 2)
        x = max(0, min(x, max(0, target_width - overlay_w)))
        y = max(0, min(y, max(0, target_height - overlay_h)))
        return (x, y)

def _clamp_crop_rect_to_canvas(x, y, w, h, canvas_w, canvas_h):
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(int(canvas_w), x + w)
    y1 = min(int(canvas_h), y + h)
    cw = max(0, x1 - x0)
    ch = max(0, y1 - y0)
    if cw <= 0 or ch <= 0:
        return (0, 0, 0, 0)
    return (x0, y0, cw, ch)

def _resolve_ffmpeg_blend_mode(mode):
    key = str(mode or 'screen').strip().lower()
    if key == 'burn':
        return 'burn'
    else:
        return FFMPEG_BLEND_MODES.get(key, 'screen')

def _append_blend_layers(graph, current, layers, *, target_width, target_height, fps, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor, duration_seconds):
    dur = max(0.001, float(duration_seconds))
    for zone_index in enumerate(layers):
        item, input_index = var
        window = layer_output_seconds(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor)
        if window is None:
            pass
        opacity_pct = int(item.get('opacity', 15) or 15)
        opacity = max(0.0, min(1.0, opacity_pct / 100))
        mode = str(item.get('blend_mode', 'screen') or 'screen').strip().lower()
        ffm = _resolve_ffmpeg_blend_mode(mode)
        scale_percent = int(item.get('scale_percent', 100) or 100)
        overlay_w, overlay_h = _scaled_overlay_dimensions(str(item.get('path', '') or ''), target_width, scale_percent, target_height, scale_aspect=float(item.get('scale_aspect', 0) or 0))
        x_norm = float(item.get('x_norm', 0.5))
        y_norm = float(item.get('y_norm', 0.5))
        pos_x_i, pos_y_i = _clamp_overlay_origin(target_width, target_height, overlay_w, overlay_h, x_norm, y_norm, allow_pasteboard=True)
        pos_x = f'(W*{x_norm:g})-(w/2)'
        pos_y = f'(H*{y_norm:g})-(h/2)'
        crop_x, crop_y, crop_w, crop_h = _clamp_crop_rect_to_canvas(pos_x_i, pos_y_i, overlay_w, overlay_h, target_width, target_height)
        if layer_uses_blend(mode):
            if not crop_w <= 0:
                if crop_h <= 0:
                    pass
        out = f'withblend{zone_index}'
        enable = ':' + ffmpeg_enable_between(*window)
        scaled_label = f'blsc{zone_index}'
        main_label = f'blmain{zone_index}'
        src_label = f'blsrc{zone_index}'
        patch_label = f'blpatch{zone_index}'
        merged_label = f'blmerged{zone_index}'
        ovl_chain = f'[{input_index}:v]{_ffmpeg_overlay_source_chain(str(item.get('path', '') or ''), dur, fps)},{_ffmpeg_scale_stretch_rgba(overlay_w, overlay_h, fps)}[{scaled_label}]'
        graph.append(ovl_chain)
        blend_src = scaled_label
        rot_deg = float(item.get('rotation_degrees', 0) or 0)
        rot_label = f'blrot{zone_index}'
        rot_step = _ffmpeg_rgba_rotate_fit_box(scaled_label, rot_label, rot_deg, overlay_w, overlay_h)
        if int(round(rot_deg)) != 0 and rot_step:
            for chunk in rot_step.split(';'):
                chunk = chunk.strip()
                if not chunk:
                    continue
                else:
                    graph.append(chunk)
            blend_src = rot_label
        if layer_uses_blend(mode):
            graph.append(f'[{current}]split=2[{main_label}][{src_label}]')
            graph.append(f'[{src_label}]crop={crop_w}:{crop_h}:{crop_x}:{crop_y}[{patch_label}]')
            blend_patch_src = blend_src
            if crop_w != overlay_w or crop_h != overlay_h:
                blend_crop_label = f'blsrcrop{zone_index}'
                graph.append(f'[{blend_src}]crop={crop_w}:{crop_h}:{crop_x - pos_x_i}:{crop_y - pos_y_i}[{blend_crop_label}]')
                blend_patch_src = blend_crop_label
            graph.append(f'[{patch_label}][{blend_patch_src}]blend=all_mode={ffm}:all_opacity={opacity:g}{enable}[{merged_label}]')
            graph.append(f'[{main_label}][{merged_label}]overlay=x={crop_x}:y={crop_y}:format=auto:eof_action=pass{enable}[{out}]')
        else:
            overlay_label = blend_src
            if opacity < 0.999:
                overlay_label = f'blopa{zone_index}'
                graph.append(f'[{blend_src}]colorchannelmixer=aa={opacity:g}[{overlay_label}]')
            graph.append(f"[{current}][{overlay_label}]overlay=x='{pos_x}':y='{pos_y}':format=auto:eof_action=pass{enable}[{out}]")
        current = out
    return current

def _append_decorative_overlays(graph, current, overlays, *, target_width, target_height, fps, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor, duration_seconds, mask_input_indices):
    dur = max(0.001, float(duration_seconds))
    for zone_index in enumerate(overlays):
        item, input_index = var
        window = layer_output_seconds(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor)
        if window is None:
            pass
        opacity_pct = int(item.get('opacity', 50) or 50)
        opacity = max(0.0, min(1.0, opacity_pct / 100))
        scale_percent = int(item.get('scale_percent', 100) or 100)
        overlay_w, overlay_h = _scaled_overlay_dimensions(str(item.get('path', '') or ''), target_width, scale_percent, target_height, scale_aspect=float(item.get('scale_aspect', 0) or 0))
        x_norm = float(item['x_norm'])
        y_norm = float(item['y_norm'])
        label = f'fxov{zone_index}'
        out = f'withfx{zone_index}'
        pos = f'(W*{x_norm:g})-(w/2):(H*{y_norm:g})-(h/2)'
        enable = ':' + ffmpeg_enable_between(*window)
        rot_deg = float(item.get('rotation_degrees', 0) or 0)
        src_label = label
        scaled = f'{label}src'
        graph.append(f'[{input_index}:v]{_ffmpeg_overlay_source_chain(str(item.get('path', '') or ''), dur, fps)},{_ffmpeg_scale_stretch_rgba(overlay_w, overlay_h, fps)}[{scaled}]')
        masked = scaled
        mask_idx = None
        if not mask_input_indices is None and zone_index < len(mask_input_indices):
            mask_idx = mask_input_indices[zone_index]
        if mask_idx is not None:
            mask_label = f'fxmask{zone_index}'
            rgba = f'{label}rgba'
            merged = f'{label}m'
            graph.append(f'[{scaled}]format=rgba[{rgba}]')
            graph.append(f'[{int(mask_idx)}:v]format=gray,scale={overlay_w}:{overlay_h}:flags=bilinear[{mask_label}]')
            graph.append(f'[{rgba}][{mask_label}]alphamerge[{merged}]')
            masked = merged
        elif bool(item.get('mask_enabled', False)):
            from core.overlay_mask import ffmpeg_movie_escape
            ffmpeg_movie_escape = ffmpeg_movie_escape
            from core.overlay_mask import overlay_mask_png_path
            overlay_mask_png_path = overlay_mask_png_path
            mask_file = overlay_mask_png_path(item, overlay_w, overlay_h)
            mask_esc = ffmpeg_movie_escape(mask_file)
            mask_label = f'fxmask{zone_index}'
            rgba = f'{label}rgba'
            merged = f'{label}m'
            graph.append(f'[{scaled}]format=rgba[{rgba}]')
            graph.append(f"movie='{mask_esc}':loop=0,format=gray,scale={overlay_w}:{overlay_h}:flags=bilinear[{mask_label}]")
            graph.append(f'[{rgba}][{mask_label}]alphamerge[{merged}]')
            masked = merged
        graph.append(f'[{masked}]colorchannelmixer=aa={opacity:g}[{label}]')
        rot_label = f'fxrot{zone_index}'
        rot_step = _ffmpeg_rgba_rotate_step(label, rot_label, rot_deg)
        if int(round(rot_deg)) != 0 and rot_step:
            graph.append(rot_step)
            src_label = rot_label
        graph.append(f'[{current}][{src_label}]overlay={pos}:eof_action=pass:format=auto{enable}[{out}]')
        current = out
    try:
        return current
    except:
        try:
            if Exception:
                masked = scaled
        except:
            pass

def _append_media_overlays(graph, current, overlays, input_indices, *, target_width, target_height, fps, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor):
    blend_layers, decorative_layers = _split_overlay_layers(overlays, input_indices)
    current = _append_blend_layers(graph, current, blend_layers, target_width=target_width, target_height=target_height, fps=fps, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=pts_divisor)
    return _append_decorative_overlays(graph, current, decorative_layers, target_width=target_width, target_height=target_height, fps=fps, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=pts_divisor)

def _compose_fg_on_bg(graph, *, bg_label, fg_label, settings, overlay_x, overlay_y, target_width, target_height, fps):
    graph.append(f"[{bg_label}][{fg_label}]overlay=x='{overlay_x}':y='{overlay_y}':eof_action=repeat[composed]")
    return 'composed'

def _append_color_filter(graph, current, settings):
    from core.lut_stack import append_color_look_filters
    return append_color_look_filters(graph, current, settings, uid='colored')

def _norm_drawtext_xy(x_norm, y_norm):
    xn = max(0.0, min(1.0, float(x_norm)))
    yn = max(0.0, min(1.0, float(y_norm)))
    return (f'(w*{xn:g})-(tw/2)', f'(h*{yn:g})-(th/2)')

def _resolve_overlay_text_norms(position, x_norm, y_norm):
    presets = {'top': (0.5, 0.06), 'center': (0.5, 0.5), 'bottom': (0.5, 0.94)}
    key = str(position or 'top').strip().lower()
    if key == 'custom':
        return (max(0.0, min(1.0, float(x_norm))), max(0.0, min(1.0, float(y_norm))))
    else:
        return presets.get(key, presets['top'])

def _write_drawtext_textfile(text, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(str(text or '').replace('\r\n', '\n').replace('\r', '\n'), encoding='utf-8-sig')
    return str(destination)

def _wrap_overlay_drawtext(raw, *, box_width_norm, font_div, scale_percent, target_width, target_height):
    aspect = max(0.2, float(target_width) / max(1.0, float(target_height)))
    lines = wrap_text_for_box(raw, box_width_norm=box_width_norm, font_div=font_div, aspect_wh=aspect, scale_percent=scale_percent)
    return ('\n'.join(lines), max(1, len(lines)))

def _text_overlay_filters(settings, *, target_width, target_height, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor):
    items = []
    raw_multi = getattr(settings, 'text_overlays', None) or ()
    if raw_multi:
        for raw in raw_multi:
            if not isinstance(raw, dict):
                pass
            if not raw.get('enabled', True):
                pass
            content = str(raw.get('content') or '').strip()
            if not content:
                pass
            items.append(replace(*(settings,), **{'text_overlay_enabled': True, 'text_overlay_content': content, 'text_overlay_style': str(raw.get('style') or 'static'), 'text_overlay_style': str(raw.get('style') or 'static'), 'text_overlay_position': str(raw.get('position') or 'custom'), 'text_overlay_position': str(raw.get('position') or 'custom'), 'text_overlay_x_norm': float(raw.get('x_norm', 0.5) or 0.5), 'text_overlay_x_norm': float(raw.get('x_norm', 0.5) or 0.5), 'text_overlay_y_norm': float(raw.get('y_norm', 0.88) or 0.88), 'text_overlay_y_norm': float(raw.get('y_norm', 0.88) or 0.88), 'text_overlay_scale_percent': int(raw.get('scale_percent', 100) or 100), 'text_overlay_scale_percent': int(raw.get('scale_percent', 100) or 100), 'text_overlay_box_width_percent': int(raw.get('box_width_percent', 90) or 90), 'text_overlay_box_width_percent': int(raw.get('box_width_percent', 90) or 90), 'text_overlay_rotation_degrees': float(raw.get('rotation_degrees', 0) or 0), 'text_overlay_rotation_degrees': float(raw.get('rotation_degrees', 0) or 0), 'text_overlay_start_ms': int(raw.get('start_ms', 0) or 0), 'text_overlay_start_ms': int(raw.get('start_ms', 0) or 0), 'text_overlay_end_ms': int(raw.get('end_ms', 0) or 0), 'text_overlay_end_ms': int(raw.get('end_ms', 0) or 0), 'text_overlay_font': str(raw.get('font') or 'Arial'), 'text_overlay_font': str(raw.get('font') or 'Arial'), 'text_overlay_text_color': str(raw.get('text_color') or '#FFFFFF'), 'text_overlay_text_color': str(raw.get('text_color') or '#FFFFFF'), 'text_overlay_outline_color': str(raw.get('outline_color') or '#000000'), 'text_overlay_outline_color': str(raw.get('outline_color') or '#000000'), 'text_overlay_outline_width': int(raw.get('outline_width', 3) or 3), 'text_overlay_shadow_enabled': bool(raw.get('shadow_enabled', True)), 'text_overlay_outline_width': int(raw.get('outline_width', 3) or 3), 'text_overlay_shadow_enabled': bool(raw.get('shadow_enabled', True)), 'text_overlay_shadow_depth': int(raw.get('shadow_depth', 1) or 0), 'text_overlay_bg_enabled': bool(raw.get('bg_enabled', False)), 'text_overlay_shadow_depth': int(raw.get('shadow_depth', 1) or 0), 'text_overlay_bg_enabled': bool(raw.get('bg_enabled', False)), 'text_overlay_bg_color': str(raw.get('bg_color') or '#000000'), 'text_overlay_bg_color': str(raw.get('bg_color') or '#000000'), 'text_overlay_bg_opacity': int(raw.get('bg_opacity', 55) or 55), 'text_overlay_bold': bool(raw.get('bold', True)), 'text_overlay_italic': bool(raw.get('italic', False))}))
    elif settings.text_overlay_enabled:
        if str(settings.text_overlay_content or '').strip():
            items.append(settings)
    filters = []
    for item_settings in items:
        filters.extend(_single_text_overlay_filters(item_settings, target_width=target_width, target_height=target_height, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, source_duration_ms=source_duration_ms, pts_divisor=pts_divisor))
    return filters

def _single_text_overlay_filters(settings, *, target_width, target_height, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor):
    if not settings.text_overlay_enabled:
        return []
    elif not layer_overlaps_trim(settings.text_overlay_start_ms, settings.text_overlay_end_ms, trim_start_ms, trim_end_ms, source_duration_ms):
        return []
    else:
        raw = settings.text_overlay_content.strip()
        if not raw:
            return []
        else:
            scale = max(20, min(300, int(settings.text_overlay_scale_percent)))
            box_w = max(0.15, min(1.0, int(settings.text_overlay_box_width_percent) / 100.0))
            text, line_count = _wrap_overlay_drawtext(raw, box_width_norm=box_w, font_div=28.0, scale_percent=100, target_width=target_width, target_height=target_height)
            text_arg = f"text='{_escape_drawtext(text)}':"
            x_norm, y_norm = _resolve_overlay_text_norms(settings.text_overlay_position, settings.text_overlay_x_norm, settings.text_overlay_y_norm)
            live_s = scale / 100.0
            box_h_norm = estimate_overlay_box_height_norm(scale, 28.0, line_count, line_height_factor=1.35)
            x_norm, y_norm = clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w, box_height_norm=box_h_norm)
            x_expr, y_expr = _norm_drawtext_xy(x_norm, y_norm)
            if settings.text_overlay_style == 'marquee':
                x_expr = 'w-mod(t*180\\,w+tw)'
            elif settings.text_overlay_style == 'around':
                x_expr = 'mod(t*160\\,w+tw)-tw'
            elif settings.text_overlay_style == 'diagonal':
                x_expr = 'mod(t*160\\,w+tw)-tw'
                y_expr = 'mod(t*100\\,h+th)-th'
            fontsize = drawtext_fontsize_expr(scale, 28.0)
            line_spacing = drawtext_line_spacing_px(target_height, scale, 28.0, gap_factor=0.35)
            enable_suffix = ''
            window = layer_output_seconds(settings.text_overlay_start_ms, settings.text_overlay_end_ms, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor)
            if window is not None:
                enable_suffix = ':' + ffmpeg_enable_between(*window)
            border_w = max(0, min(12, int(settings.text_overlay_outline_width)))
            shadow_depth = max(0, min(8, int(settings.text_overlay_shadow_depth))) if settings.text_overlay_shadow_enabled else 0
            box_parts = ''
            if settings.text_overlay_bg_enabled:
                bg_alpha = max(0.0, min(1.0, int(settings.text_overlay_bg_opacity) / 100.0))
                box_parts = f'box=1:boxcolor={ffmpeg_drawtext_color(settings.text_overlay_bg_color, alpha=bg_alpha)}:boxborderw=8:'
            return [f'drawtext={text_arg}{_drawtext_font_part(font_family=settings.text_overlay_font, bold=bool(settings.text_overlay_bold))}fontcolor={ffmpeg_drawtext_color(settings.text_overlay_text_color)}:fontsize={fontsize}:line_spacing={line_spacing}:{box_parts}borderw={border_w}:bordercolor={ffmpeg_drawtext_color(settings.text_overlay_outline_color, alpha=0.85)}:shadowcolor={ffmpeg_drawtext_color(settings.text_overlay_outline_color, alpha=0.55)}:shadowx={shadow_depth}:shadowy={shadow_depth}:x={x_expr}:y={y_expr}{enable_suffix}']

def _video_title_ass_step(settings, *, source_path, target_width, target_height, final_path, sidecar_paths, current, duration_ms, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor):
    if not settings.video_title_enabled:
        return ''
    elif not layer_overlaps_trim(settings.video_title_start_ms, settings.video_title_end_ms, trim_start_ms, trim_end_ms, source_duration_ms):
        return ''
    else:
        from core.video_title import resolve_video_title
        resolve_video_title = resolve_video_title
        raw = resolve_video_title(source_path=source_path, enabled=True, from_filename=settings.video_title_from_filename, content=settings.video_title_content, language_mode=settings.video_title_language_mode)
        if not raw:
            return ''
        else:
            from core.subtitles import save_title_burn_ass
            save_title_burn_ass = save_title_burn_ass
            x_norm, y_norm = _resolve_overlay_text_norms(settings.video_title_position, settings.video_title_x_norm, settings.video_title_y_norm)
            scale_x = int(getattr(settings, 'video_title_scale_x_percent', None) or settings.video_title_scale_percent)
            scale_y = int(getattr(settings, 'video_title_scale_y_percent', None) or settings.video_title_scale_percent)
            ass_path = _export_sidecar_path(final_path, '.title.ass')
            title_window = output_window_ms(settings.video_title_start_ms, settings.video_title_end_ms, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor)
            ass_start_ms = 0
            ass_end_ms = max(1, int(duration_ms))
            ass_start_ms, ass_end_ms = title_window
            if not title_window is None and ass_end_ms <= ass_start_ms:
                ass_end_ms = ass_start_ms + 1
            save_title_burn_ass(*(raw, ass_path), **{'play_res_x': target_width, 'play_res_y': target_height, 'duration_ms': ass_end_ms, 'start_ms': ass_start_ms, 'end_ms': ass_end_ms, 'x_norm': x_norm, 'y_norm': y_norm, 'font': str(settings.video_title_font or 'Arial'), 'scale_x_percent': scale_x, 'scale_y_percent': scale_y, 'box_width_percent': int(settings.video_title_box_width_percent), 'font': str(settings.video_title_font or 'Arial'), 'scale_x_percent': scale_x, 'scale_y_percent': scale_y, 'box_width_percent': int(settings.video_title_box_width_percent), 'layout_scale_percent': int(getattr(settings, 'video_title_layout_scale_percent', 100) or 100), 'text_color': settings.video_title_text_color, 'outline_color': settings.video_title_outline_color, 'outline_width': int(settings.video_title_outline_width), 'layout_scale_percent': int(getattr(settings, 'video_title_layout_scale_percent', 100) or 100), 'text_color': settings.video_title_text_color, 'outline_color': settings.video_title_outline_color, 'outline_width': int(settings.video_title_outline_width), 'rotation_degrees': float(settings.video_title_rotation_degrees or 0), 'shadow_enabled': bool(settings.video_title_shadow_enabled), 'shadow_depth': int(settings.video_title_shadow_depth), 'bg_enabled': bool(settings.video_title_bg_enabled), 'bg_color': settings.video_title_bg_color, 'bg_opacity': int(settings.video_title_bg_opacity), 'bold': bool(settings.video_title_bold), 'italic': bool(settings.video_title_italic), 'rotation_degrees': float(settings.video_title_rotation_degrees or 0), 'shadow_enabled': bool(settings.video_title_shadow_enabled), 'shadow_depth': int(settings.video_title_shadow_depth), 'bg_enabled': bool(settings.video_title_bg_enabled), 'bg_color': settings.video_title_bg_color, 'bg_opacity': int(settings.video_title_bg_opacity), 'bold': bool(settings.video_title_bold), 'italic': bool(settings.video_title_italic), 'anim_mode': str(getattr(settings, 'video_title_anim', 'none') or 'none')})
            sidecar_paths.append(str(ass_path))
            escaped_path = _escape_filter_path(str(ass_path))
            return f"[{current}]ass=filename='{escaped_path}'[withtitle]"

def _write_styled_ass(settings, *, destination, play_res_x, play_res_y, trim_start_ms, trim_end_ms, pts_divisor, document):
    source_document = document
    if source_document is None:
        source_document = load_srt(settings.subtitle_path)
    document = bridge_subtitle_gaps(retim_document_for_export(source_document, trim_start_ms=trim_start_ms, trim_end_ms=trim_end_ms, pts_divisor=pts_divisor))
    return save_burn_ass(*(document, destination), **{'play_res_x': play_res_x, 'play_res_y': play_res_y, 'font': settings.subtitle_font, 'font_size': settings.subtitle_font_size, 'text_color': settings.subtitle_text_color, 'outline_color': settings.subtitle_outline_color, 'outline_width': settings.subtitle_outline_width, 'position': settings.subtitle_position, 'margin_v': settings.subtitle_margin_bottom, 'margin_refs_center': settings.subtitle_margin_refs_center, 'box_width_percent': int(settings.subtitle_box_width_percent), 'layout_font_size': int(getattr(settings, 'subtitle_layout_font_size', None) or settings.subtitle_font_size), 'scale_x_percent': settings.subtitle_scale_x_percent, 'scale_y_percent': settings.subtitle_scale_y_percent, 'aspect_ratio': settings.aspect_ratio, 'layout_font_size': int(getattr(settings, 'subtitle_layout_font_size', None) or settings.subtitle_font_size), 'scale_x_percent': settings.subtitle_scale_x_percent, 'scale_y_percent': settings.subtitle_scale_y_percent, 'aspect_ratio': settings.aspect_ratio, 'rotation_degrees': float(settings.subtitle_rotation_degrees or 0), 'shadow_enabled': bool(settings.subtitle_shadow_enabled), 'shadow_depth': int(settings.subtitle_shadow_depth), 'bg_enabled': bool(settings.subtitle_bg_enabled), 'bg_color': settings.subtitle_bg_color, 'bg_opacity': int(settings.subtitle_bg_opacity), 'bold': bool(settings.subtitle_bold), 'italic': bool(settings.subtitle_italic), 'rotation_degrees': float(settings.subtitle_rotation_degrees or 0), 'shadow_enabled': bool(settings.subtitle_shadow_enabled), 'shadow_depth': int(settings.subtitle_shadow_depth), 'bg_enabled': bool(settings.subtitle_bg_enabled), 'bg_color': settings.subtitle_bg_color, 'bg_opacity': int(settings.subtitle_bg_opacity), 'bold': bool(settings.subtitle_bold), 'italic': bool(settings.subtitle_italic), 'anim_mode': str(settings.subtitle_anim or 'none'), 'anim_mode': str(settings.subtitle_anim or 'none'), 'karaoke_color': str(settings.subtitle_karaoke_color or '#00E5FF')})

def _is_hex_color(value):
    return bool(re.fullmatch('#[0-9A-Fa-f]{6}', value.strip()))

def _escape_filter_path(value):
    escaped = value.replace('\\', '/')
    for character in ("'", ':', ',', '[', ']', ';'):
        escaped = escaped.replace(character, f'\\{character}')
    return escaped

def _escape_drawtext(value):
    escaped = value.replace('\\', '\\\\')
    escaped = escaped.replace('\r\n', '\n').replace('\r', '\n')
    escaped = escaped.replace('\n', '\\n')
    for character in ("'", ':', '%'):
        escaped = escaped.replace(character, f'\\{character}')
    return escaped

def _drawtext_font_part(*, bold, font_family):
    from core.text_style import resolve_windows_font_file
    path = resolve_windows_font_file(font_family, bold=bold)
    if path:
        return f"fontfile='{_escape_filter_path(path)}':"
    else:
        fonts_dir = Path('C:/Windows/Fonts')
        names = ('arialbd.ttf', 'arial.ttf') if bold else ('arial.ttf', 'arialbd.ttf')
        for name in names:
            windows_font = fonts_dir / name
            if not windows_font.is_file():
                continue
            return var
        return ''
