'Ken Burns / auto-zoom FFmpeg — tách khỏi video_export, không import video_export lúc chạy.'
from __future__ import annotations
from typing import TYPE_CHECKING
from core.motion import effective_auto_zoom_value, motion_intensity_factor
from core.encoder_args import _scale_flags
from core.video_look import PAN_BASE_PX
if TYPE_CHECKING:
    from core.video_export import VideoExportSettings

def _uses_plate_local_motion(settings: VideoExportSettings) -> bool:
    width, height = (settings.target_size[0], settings.target_size[1])
    return height > width

def _append_ken_burns_motion(graph: list[str], fg_label: str, motion_i: float, *, fps: int, out_label: str) -> str:
    fps_val = max(1, int(fps))
    boost_cap = 0.08 * motion_i
    pad_max = 1.0 + boost_cap
    amp = PAN_BASE_PX * motion_i
    cx = '(iw-ow)/2'
    cy = '(ih-oh)/2'
    zoom_per_n = 0.008 * motion_i / fps_val
    zoom_boost = f'{boost_cap:g})\\,{boost_cap:g}\\,n*{zoom_per_n:g})'
    crop_w = f'{pad_max:g}/(1+{zoom_boost})'
    crop_h = f'{pad_max:g}/(1+{zoom_boost})'
    pan_x = f'+{amp * 0.4:g}*n/{fps_val}*0.08'
    pan_y = f'-{amp * 0.25:g}*n/{fps_val}*0.06'
    graph.append(f'[fg_label]scale=iw*{pad_max:g}:ih*{pad_max:g},crop={crop_w}:{crop_h}:{pan_x}:{pan_y}[{out_label}]')
    return out_label

def _append_auto_zoom(graph: list[str], current: str, settings: VideoExportSettings, *, target_width: int, target_height: int, keep_input_size: bool, output_label: str) -> str:
    intensity = motion_intensity_factor(settings.motion_intensity_percent)
    az_val = effective_auto_zoom_value(float(settings.auto_zoom_val), intensity)
    az_sec = float(settings.auto_zoom_sec)
    az_hold = float(settings.auto_zoom_hold)
    normal_frames = max(1, round(settings.fps * az_sec))
    hold_frames = max(1, round(settings.fps * az_hold))
    full_cycle = normal_frames + hold_frames
    if settings.auto_zoom_rand:
        step_expr = f'floor(n/{normal_frames})'
        enable_expr = f'gt(mod({step_expr}*0.618033988749895\\,1)\\,0.5)'
    else:
        enable_expr = f'gte(mod(n\\,{full_cycle})\\,{normal_frames})'
    orig = f'{output_label}_orig'
    src = f'{output_label}_src'
    zoomed = f'{output_label}_zoomed'
    orig_fit = f'{output_label}_orig_fit'
    graph.append(f'[{current}]split=2[{orig}][{src}]')
    if keep_input_size:
        pw = max(2, int(target_width))
        ph = max(2, int(target_height))
        sf = _scale_flags(settings)
        graph.append(f'[{orig}]scale={pw}:{ph}:flags={sf}[{orig_fit}]')
        graph.append(f'[src]scale={pw}*{az_val:g}:{ph}*{az_val:g}:flags={sf},crop={pw}:{ph}:(iw-{pw})/2:(ih-{ph})/2[{zoomed}]')
        graph.append(f"[{orig_fit}][{zoomed}]overlay=0:0:enable='{enable_expr}'[{output_label}]")
    else:
        zw = int(target_width * az_val) // 2 * 2
        zh = int(target_height * az_val) // 2 * 2
        graph.append(f'[{src}]scale={zw}:{zh},crop={target_width}:{target_height}:(iw-{target_width})/2:(ih-{target_height})/2[{zoomed}]')
        graph.append(f"[{orig}][{zoomed}]overlay=0:0:enable='{enable_expr}'[{output_label}]")
    return output_label