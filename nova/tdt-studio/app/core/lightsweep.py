'Hiệu ứng Quét sáng (lightsweep) — gần CapCut light sweep.\n\nTham số dùng chung preview + xuất FFmpeg.\n'
from __future__ import annotations
from typing import Any
LIGHTSWEEP_DIRECTIONS: 'tuple[tuple[str, str], ...]' = (('Chéo ↘ (trái-trên → phải-dưới)', 'tl_br'), ('Chéo ↙ (phải-trên → trái-dưới)', 'tr_bl'), ('Ngang → (trái → phải)', 'left_right'), ('Ngang ← (phải → trái)', 'right_left'), ('Dọc ↓ (trên → dưới)', 'top_bottom'), ('Dọc ↑ (dưới → trên)', 'bottom_top'))
LIGHTSWEEP_DIRECTION_IDS = frozenset((value for _, value in LIGHTSWEEP_DIRECTIONS))
LIGHTSWEEP_APPLY_MODES: 'tuple[tuple[str, str], ...]' = (('Chỉ video chính', 'video'), ('Cả khung (kể cả nền)', 'canvas'))
LIGHTSWEEP_APPLY_MODE_IDS = frozenset((value for _, value in LIGHTSWEEP_APPLY_MODES))
DEFAULT_LIGHTSWEEP_CYCLE_SEC = 3.2
DEFAULT_LIGHTSWEEP_DURATION_SEC = 1.2
DEFAULT_LIGHTSWEEP_WIDTH_PERCENT = 18
DEFAULT_LIGHTSWEEP_SOFT_PERCENT = 55
DEFAULT_LIGHTSWEEP_GLOW_PERCENT = 40
DEFAULT_LIGHTSWEEP_OPACITY_PERCENT = 70
DEFAULT_LIGHTSWEEP_DIRECTION = 'tl_br'
DEFAULT_LIGHTSWEEP_APPLY_MODE = 'video'

def clamp_lightsweep_cycle_sec(value: float) -> float:
    return max(0.4, min(30.0, float(value)))

def clamp_lightsweep_duration_sec(value: float, cycle_sec: float) -> float:
    cycle = clamp_lightsweep_cycle_sec(cycle_sec)
    return max(0.15, min(cycle, float(value)))

def clamp_lightsweep_width_percent(value: int) -> int:
    return max(1, min(60, int(value)))

def clamp_lightsweep_soft_percent(value: int) -> int:
    return max(0, min(100, int(value)))

def clamp_lightsweep_glow_percent(value: int) -> int:
    return max(0, min(100, int(value)))

def clamp_lightsweep_opacity_percent(value: int) -> int:
    return max(0, min(100, int(value)))

def normalize_lightsweep_direction(value: object) -> str:
    text = str(value or '').strip().lower()
    return text if text in LIGHTSWEEP_DIRECTION_IDS else DEFAULT_LIGHTSWEEP_DIRECTION

def normalize_lightsweep_apply_mode(value: object) -> str:
    text = str(value or '').strip().lower()
    return text if text in LIGHTSWEEP_APPLY_MODE_IDS else DEFAULT_LIGHTSWEEP_APPLY_MODE

def resolve_lightsweep_params(values: dict[str, Any] | Any) -> dict[str, float | int | str]:
    get = values.get if isinstance(values, dict) else lambda k, d=None: getattr(values, k, d)
    cycle = clamp_lightsweep_cycle_sec(float(get('lightsweep_cycle_sec', DEFAULT_LIGHTSWEEP_CYCLE_SEC) or DEFAULT_LIGHTSWEEP_CYCLE_SEC))
    duration = clamp_lightsweep_duration_sec(float(get('lightsweep_duration_sec', DEFAULT_LIGHTSWEEP_DURATION_SEC) or DEFAULT_LIGHTSWEEP_DURATION_SEC), cycle)
    width = clamp_lightsweep_width_percent(int(get('lightsweep_width_percent', DEFAULT_LIGHTSWEEP_WIDTH_PERCENT) or DEFAULT_LIGHTSWEEP_WIDTH_PERCENT))
    soft = clamp_lightsweep_soft_percent(int(get('lightsweep_soft_percent', DEFAULT_LIGHTSWEEP_SOFT_PERCENT) or DEFAULT_LIGHTSWEEP_SOFT_PERCENT))
    glow = clamp_lightsweep_glow_percent(int(get('lightsweep_glow_percent', DEFAULT_LIGHTSWEEP_GLOW_PERCENT) or DEFAULT_LIGHTSWEEP_GLOW_PERCENT))
    opacity = clamp_lightsweep_opacity_percent(int(get('lightsweep_opacity_percent', DEFAULT_LIGHTSWEEP_OPACITY_PERCENT) or DEFAULT_LIGHTSWEEP_OPACITY_PERCENT))
    direction = normalize_lightsweep_direction(get('lightsweep_direction', DEFAULT_LIGHTSWEEP_DIRECTION))
    apply_mode = normalize_lightsweep_apply_mode(get('lightsweep_apply_mode', DEFAULT_LIGHTSWEEP_APPLY_MODE))
    return {'cycle_sec': cycle, 'duration_sec': duration, 'width_percent': width, 'soft_percent': soft, 'glow_percent': glow, 'opacity_percent': opacity, 'direction': direction, 'apply_mode': apply_mode}

def lightsweep_progress(seconds: float, cycle_sec: float, duration_sec: float) -> float | None:
    cycle = clamp_lightsweep_cycle_sec(cycle_sec)
    duration = clamp_lightsweep_duration_sec(duration_sec, cycle)
    t = float(seconds) % cycle
    return None if t > duration else t / duration

def lightsweep_peak_u8(strength: float, glow_percent: int=DEFAULT_LIGHTSWEEP_GLOW_PERCENT, opacity_percent: int=DEFAULT_LIGHTSWEEP_OPACITY_PERCENT) -> int:
    s = max(0.0, min(1.0, float(strength)))
    glow = clamp_lightsweep_glow_percent(glow_percent) / 100.0
    opacity = clamp_lightsweep_opacity_percent(opacity_percent) / 100.0
    return max(0, min(255, int(round((70.0 + 90.0 * s + 70.0 * glow) * opacity))))

def lightsweep_band_px(min_side: float, width_percent: int, soft_percent: int) -> float:
    soft = clamp_lightsweep_soft_percent(soft_percent) / 100.0
    core = max(1.0, float(min_side)) * (clamp_lightsweep_width_percent(width_percent) / 100.0)
    return max(3.0, core * (1.0 + soft * 2.6))

def lightsweep_preview_geometry(*, width: float, height: float, progress: float, direction: str, width_percent: int, soft_percent: int) -> tuple[float, float, float, float]:
    import math
    w = max(1.0, float(width))
    h = max(1.0, float(height))
    diag = math.hypot(w, h)
    band = lightsweep_band_px(min(w, h), width_percent, soft_percent)
    direction = normalize_lightsweep_direction(direction)
    p = max(0.0, min(1.0, float(progress)))
    margin = 0.2
    if direction == 'left_right':
        travel = w * (1.0 + 2 * margin)
        return (-w * margin + p * travel - w / 2, 0.0, band / 2, 0.0)
    if direction == 'right_left':
        travel = w * (1.0 + 2 * margin)
        return (w * (1.0 + margin) - p * travel - w / 2, 0.0, band / 2, 0.0)
    if direction == 'top_bottom':
        travel = h * (1.0 + 2 * margin)
        return (-h * margin + p * travel - h / 2, 0.0, band / 2, 90.0)
    if direction == 'bottom_top':
        travel = h * (1.0 + 2 * margin)
        return (h * (1.0 + margin) - p * travel - h / 2, 0.0, band / 2, 90.0)
    if direction == 'tr_bl':
        travel = diag * 1.5
        return (travel / 2 - p * travel, 0.0, band / 2, 24.0)
    travel = diag * 1.5
    return (-travel / 2 + p * travel, 0.0, band / 2, -24.0)

def lightsweep_ffmpeg_dist_expr(*, progress: str, direction: str) -> str:
    direction = normalize_lightsweep_direction(direction)
    p = f'({progress})'
    if direction == 'left_right':
        pos = f'{p}*W*1.4-W*0.2'
        return f'abs(X-({pos}))'
    if direction == 'right_left':
        pos = f'W*1.2-{p}*W*1.4'
        return f'abs(X-({pos}))'
    if direction == 'top_bottom':
        pos = f'{p}*H*1.4-H*0.2'
        return f'abs(Y-({pos}))'
    if direction == 'bottom_top':
        pos = f'H*1.2-{p}*H*1.4'
        return f'abs(Y-({pos}))'
    import math
    rot = 24.0 if direction == 'tr_bl' else -24.0
    rad = rot * math.pi / 180.0
    s, c = (math.sin(rad), math.cos(rad))
    lx = f'.6f)*(X-W/2)+({s}.6f)*(Y-H/2))'
    travel = 'sqrt(W*W+H*H)*1.5'
    xc = f'(({travel})/2-{p}*({travel}))' if direction == 'tr_bl' else f'(-({travel})/2+{p}*({travel}))'
    return f'abs(({lx})-({xc}))'

def lightsweep_ffmpeg_blend_parts(*, strength: float, cycle_sec: float, duration_sec: float, width_percent: int, direction: str, soft_percent: int, glow_percent: int, opacity_percent: int) -> tuple[str, str, str]:
    s = max(0.0, min(1.0, float(strength)))
    soft = clamp_lightsweep_soft_percent(soft_percent) / 100.0
    glow = clamp_lightsweep_glow_percent(glow_percent) / 100.0
    opacity = clamp_lightsweep_opacity_percent(opacity_percent) / 100.0
    cycle = clamp_lightsweep_cycle_sec(cycle_sec)
    duration = clamp_lightsweep_duration_sec(duration_sec, cycle)
    peak = lightsweep_peak_u8(s, glow_percent, opacity_percent) / 255.0
    band_frac = clamp_lightsweep_width_percent(width_percent) / 100.0
    t_cycle = f'{cycle}.2f)'
    active = f'{t_cycle}\\,{duration}.2f)\\,1\\,0)'
    progress = f'{t_cycle})/{duration}.2f'
    dist = lightsweep_ffmpeg_dist_expr(progress=progress, direction=direction)
    band_half = f'.4f*(1.0+{soft}.4f*2.6)/2.0)'
    sigma = f'(({band_half})*0.40)'
    core = f'.6f*exp(-(({dist})*({dist}))/(2*({sigma})*({sigma})))'
    if glow > 0.05 and opacity > 0.05:
        halo_mul = 1.35 + glow * 0.8
        halo_a = (28.0 + 55.0 * glow * s) * opacity / 255.0
        halo = f'*max(0\\,1-({dist})/(({band_half})*{halo_mul}.4f))'
        body = f'clip(({core})+({halo})\\,0\\,1)'
    else:
        body = f'clip(({core})\\,0\\,1)'
    alpha = f'({active})*({body})'
    return ('', alpha, 'vfx')

def lightsweep_ffmpeg_strip_alpha(*, strength: float, cycle_sec: float, duration_sec: float, axis: str, glow_percent: int, opacity_percent: int, halo_mul: float) -> str:
    del cycle_sec, duration_sec, halo_mul
    s = max(0.0, min(1.0, float(strength)))
    peak = lightsweep_peak_u8(s, glow_percent, opacity_percent) / 255.0
    dist = 'abs(Y-H/2)' if axis == 'y' else 'abs(X-W/2)'
    span = 'H' if axis == 'y' else 'W'
    sigma = f'(({span})*0.20)'
    return f'{peak}.6f*exp(-(({dist})*({dist}))/(2*({sigma})*({sigma})))\\,0\\,1)'

def lightsweep_ffmpeg_fast_chain(*, strength: float, cycle_sec: float, duration_sec: float, width_percent: int, direction: str, soft_percent: int, glow_percent: int, opacity_percent: int) -> dict[str, str | float | int]:
    import math
    s = max(0.0, min(1.0, float(strength)))
    soft = clamp_lightsweep_soft_percent(soft_percent) / 100.0
    glow = clamp_lightsweep_glow_percent(glow_percent) / 100.0
    cycle = clamp_lightsweep_cycle_sec(cycle_sec)
    duration = clamp_lightsweep_duration_sec(duration_sec, cycle)
    band_frac = clamp_lightsweep_width_percent(width_percent) / 100.0
    direction = normalize_lightsweep_direction(direction)
    halo_mul = 1.0
    sw = f'.4f*(1.0+{soft}.4f*2.6))'
    t_mod = f'{cycle}.2f)'
    progress = f'{t_mod}/{duration}.2f)'
    enable = f'{t_mod}\\,{duration}.2f)'
    axis = 'x'
    rotate = ''
    pad = ''
    scale = ''
    if direction == 'left_right':
        crop = f"crop=w='{sw}':h=ih:x='(iw-ow)/2':y=0"
        x = f'({progress})*main_w*1.4-main_w*0.2-overlay_w/2'
        y = '(main_h-overlay_h)/2'
    elif direction == 'right_left':
        crop = f"crop=w='{sw}':h=ih:x='(iw-ow)/2':y=0"
        x = f'main_w*1.2-({progress})*main_w*1.4-overlay_w/2'
        y = '(main_h-overlay_h)/2'
    elif direction == 'top_bottom':
        axis = 'y'
        crop = f"crop=w=iw:h='{sw}':x=0:y='(ih-oh)/2'"
        x = '(main_w-overlay_w)/2'
        y = f'({progress})*main_h*1.4-main_h*0.2-overlay_h/2'
    elif direction == 'bottom_top':
        axis = 'y'
        crop = f"crop=w=iw:h='{sw}':x=0:y='(ih-oh)/2'"
        x = '(main_w-overlay_w)/2'
        y = f'main_h*1.2-({progress})*main_h*1.4-overlay_h/2'
    else:
        rot = 24.0 if direction == 'tr_bl' else -24.0
        rad = rot * math.pi / 180.0
        sn, c = (math.sin(rad), math.cos(rad))
        crop = f"crop=w='{sw}':h=ih:x='(iw-ow)/2':y=0"
        pad = ''
        rotate = f'{rad}.5f:ow=rotw(iw):oh=roth(ih):c=none'
        travel = 'sqrt(main_w*main_w+main_h*main_h)*1.5'
        xc = f'(({travel})/2-({progress})*({travel}))' if direction == 'tr_bl' else f'(-({travel})/2+({progress})*({travel}))'
        x = f'{xc})*{c}.6f'
        y = f'{xc})*{sn}.6f'
    alpha = lightsweep_ffmpeg_strip_alpha(strength=s, cycle_sec=cycle, duration_sec=duration, axis=axis, glow_percent=glow_percent, opacity_percent=opacity_percent, halo_mul=halo_mul)
    return {'enable': enable, 'x': x, 'y': y, 'crop': crop, 'scale': scale, 'pad': pad, 'rotate': rotate, 'alpha': alpha, 'axis': axis, 'halo_mul': halo_mul, 'direction': direction}

def append_lightsweep_filters(graph: list[str], current: str, settings: Any, *, out_label: str) -> str:
    intensity = max(0, min(100, int(getattr(settings, 'video_effect_strength', 50) or 50)))
    if intensity <= 0:
        return current
    params = resolve_lightsweep_params(settings)
    spec = lightsweep_ffmpeg_fast_chain(strength=intensity / 100.0, cycle_sec=float(params['cycle_sec']), duration_sec=float(params['duration_sec']), width_percent=int(params['width_percent']), direction=str(params['direction']), soft_percent=int(params['soft_percent']), glow_percent=int(params['glow_percent']), opacity_percent=int(params['opacity_percent']))
    uid = out_label
    alpha = str(spec['alpha'])
    enable = str(spec['enable'])
    parts = [str(spec['crop']), 'format=rgba', f"geq=r='255':g='252':b='248':a='clip(255*({alpha})\\,0\\,255)'"]
    scale = str(spec.get('scale') or '')
    if scale:
        parts.append(scale)
    rotate = str(spec.get('rotate') or '')
    if rotate:
        parts.append(rotate)
    glow = ','.join(parts)
    graph.append(f'[{current}]split=2[{uid}_base][{uid}_ref]')
    graph.append(f'[{uid}_ref]{glow}[{uid}_glow]')
    graph.append(f"[{uid}_base][{uid}_glow]overlay=x='{spec['x']}':y='{spec['y']}':enable='{enable}':format=rgb,format=yuv420p[{out_label}]")
    return out_label

def append_lightsweep_on_video_rect(graph: list[str], current: str, settings: Any, *, video_width: int, video_height: int, offset_x: int, offset_y: int, out_label: str) -> str:
    intensity = max(0, min(100, int(getattr(settings, 'video_effect_strength', 50) or 50)))
    if intensity <= 0:
        return current
    fw = max(2, int(video_width))
    fh = max(2, int(video_height))
    ox = int(offset_x)
    oy = int(offset_y)
    params = resolve_lightsweep_params(settings)
    spec = lightsweep_ffmpeg_fast_chain(strength=intensity / 100.0, cycle_sec=float(params['cycle_sec']), duration_sec=float(params['duration_sec']), width_percent=int(params['width_percent']), direction=str(params['direction']), soft_percent=int(params['soft_percent']), glow_percent=int(params['glow_percent']), opacity_percent=int(params['opacity_percent']))
    overlay_x = f'(W-{fw})/2+{ox}'
    overlay_y = f'(H-{fh})/2+{oy}'
    uid = out_label
    alpha = str(spec['alpha'])
    enable = str(spec['enable'])
    parts = [str(spec['crop']), 'format=rgba', f"geq=r='255':g='252':b='248':a='clip(255*({alpha})\\,0\\,255)'"]
    rotate = str(spec.get('rotate') or '')
    if rotate:
        parts.append(rotate)
    glow = ','.join(parts)
    graph.append(f'color=c=black@0.0:s={fw}x{fh},format=rgba[{uid}_blank]')
    graph.append(f'[{uid}_blank]split=2[{uid}_base][{uid}_ref]')
    graph.append(f'[{uid}_ref]{glow}[{uid}_glow]')
    graph.append(f"[{uid}_base][{uid}_glow]overlay=x='{spec['x']}':y='{spec['y']}':enable='{enable}':format=auto[{uid}_fg_sw]")
    graph.append(f"[{current}][{uid}_fg_sw]overlay=x='{overlay_x}':y='{overlay_y}':format=rgb,format=yuv420p[{out_label}]")
    return out_label