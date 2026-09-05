'Logo xóa nền (rmbg) + vị trí bounce — dùng chung preview & export.'
from __future__ import annotations
import hashlib
import os
import tempfile
from pathlib import Path

def remove_logo_bg_rgba_array(arr):
    import numpy as np
    work = np.array(arr, dtype=np.float32)
    r, g, b, a = ((work[:, :, 0], work[:, :, 1], work[:, :, 2], work[:, :, 3])[0], (work[:, :, 0], work[:, :, 1], work[:, :, 2], work[:, :, 3])[1], (work[:, :, 0], work[:, :, 1], work[:, :, 2], work[:, :, 3])[2], (work[:, :, 0], work[:, :, 1], work[:, :, 2], work[:, :, 3])[3])
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 0, (mx - mn) / mx, 0.0)
    hard_bg = (lum > 200) & (sat < 0.15)
    lum_fade = np.clip((lum - 160) / 40.0, 0, 1)
    sat_fade = np.clip((0.3 - sat) / 0.15, 0, 1)
    soft_factor = 1.0 - lum_fade * sat_fade
    soft_factor = np.where(hard_bg, 0.0, soft_factor)
    work[:, :, 3] = np.clip(a * soft_factor, 0, 255)
    return work.astype('uint8')

def remove_logo_bg(img):
    from PIL import Image
    import numpy as np
    rgba = img.convert('RGBA')
    arr = remove_logo_bg_rgba_array(np.array(rgba))
    return Image.fromarray(arr)

def _cache_dir() -> Path:
    base = Path(os.environ.get('LOCALAPPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Local')))
    dest = base / 'TDT' / 'logo_rmbg'
    dest.mkdir(parents=True, exist_ok=True)
    return dest

def logo_cache_key(path: str, *, rmbg: bool) -> str:
    p = Path(path).expanduser()
    try:
        st = p.stat()
        stamp = f'{st.st_mtime_ns}:{st.st_size}'
    except OSError:
        stamp = '0'
    raw = f'{p.resolve()}|{stamp}|rmbg={int(bool(rmbg))}'
    return hashlib.sha1(raw.encode('utf-8', 'ignore')).hexdigest()[:16]

def bake_logo_rmbg_png(logo_path: str) -> str:
    src = Path(str(logo_path or '')).expanduser()
    if src.is_file():
        key = logo_cache_key(str(src), rmbg=True)
        out = _cache_dir() / f'logo_rmbg_{key}.png'
        if out.is_file() and out.stat().st_size > 32:
            return str(out)
        try:
            from PIL import Image
            img = Image.open(src).convert('RGBA')
            cleaned = remove_logo_bg(img)
            tmp = out.with_suffix('.part.png')
            cleaned.save(tmp, format='PNG')
            tmp.replace(out)
        except Exception:
            try:
                tmp = out.with_suffix('.part.png')
                if tmp.is_file():
                    tmp.unlink()
            except OSError:
                pass
            return ''
    else:
        return ''

def resolve_logo_display_path(logo_path: str, *, rmbg: bool) -> str:
    path = str(logo_path or '').strip()
    if not path or not Path(path).expanduser().is_file():
        return path
    if rmbg:
        baked = bake_logo_rmbg_png(path)
        return baked if baked else str(Path(path).expanduser())
    return str(Path(path).expanduser())
LOGO_MOTION_STYLES = frozenset({'around', 'diagonal', 'marquee', 'static', 'bounce'})

def normalize_logo_motion(style: str | None) -> str:
    key = str(style or 'static').strip().lower()
    return key if key in LOGO_MOTION_STYLES else 'static'

def logo_motion_speed_px(speed: float, frame_w: float) -> float:
    base = max(20.0, float(speed or 120.0))
    return base * max(0.5, float(frame_w) / 1080.0)

def logo_motion_position_px(t_sec: float, style: str, *, logo_w: float, logo_h: float, frame_w: float, frame_h: float, speed: float, y_norm: float, x_norm: float, seed: int) -> tuple[float, float]:
    motion = normalize_logo_motion(style)
    t = max(0.0, float(t_sec))
    w = max(1.0, float(logo_w))
    h = max(1.0, float(logo_h))
    W = max(w + 1.0, float(frame_w))
    H = max(h + 1.0, float(frame_h))
    yn = max(0.0, min(1.0, float(y_norm)))
    xn = max(0.0, min(1.0, float(x_norm)))
    if motion == 'static':
        return (xn * W - w / 2, yn * H - h / 2)
    if motion == 'bounce':
        return logo_bounce_position_px(t, logo_w=w, logo_h=h, frame_w=W, frame_h=H, speed=speed, seed=seed)
    spd = logo_motion_speed_px(speed, W) * 1.5
    spd_y = logo_motion_speed_px(speed, W) * 0.8333333333333334
    span_x = max(1.0, W + w)
    span_y = max(1.0, H + h)
    if motion == 'marquee':
        shift = t * spd % span_x
        x = W - shift
        y = yn * H - h / 2
        return (float(x), float(y))
    if motion == 'around':
        shift = t * spd * 160 / 180 % span_x
        x = shift - w
        y = yn * H - h / 2
        return (float(x), float(y))
    shift_x = t * spd * 160 / 180 % span_x
    shift_y = t * spd_y % span_y
    return (float(shift_x - w), float(shift_y - h))

def logo_motion_ffmpeg_exprs(style: str, *, speed: float, seed: int, y_norm: float, x_norm: float) -> tuple[str, str]:
    motion = normalize_logo_motion(style)
    if motion == 'static':
        return ('(', f'{float(y_norm)}g*H-h/2)')
    if motion == 'bounce':
        return logo_bounce_ffmpeg_exprs(speed=speed, seed=seed)
    base = max(20.0, float(speed or 120.0))
    k = base / 120.0
    vx = 180.0 * k
    vx2 = 160.0 * k
    vy = 100.0 * k
    yn = max(0.0, min(1.0, float(y_norm)))
    y_static = f'{yn}g*H-h/2)'
    return (f'{vx}.4f\\,W+w)', y_static) if motion == 'marquee' else (f'{vx2}.4f\\,W+w)-w', y_static) if motion == 'around' else ('mod(t*', f'{vy}.4f\\,H+h)-h')

def logo_bounce_speed_xy(speed: float, frame_w: float, *, seed: int) -> tuple[float, float]:
    base = max(20.0, float(speed or 120.0))
    scale = max(0.5, float(frame_w) / 1080.0)
    vx = base * scale
    vy = base * 0.72 * scale
    s = abs(int(seed)) % 97
    vx *= 0.85 + s % 17 / 50.0
    vy *= 0.85 + s * 3 % 19 / 55.0
    return (vx, vy)

def logo_bounce_position_px(t_sec: float, *, logo_w: float, logo_h: float, frame_w: float, frame_h: float, speed: float, seed: int) -> tuple[float, float]:
    import math
    t = max(0.0, float(t_sec))
    w = max(1.0, float(logo_w))
    h = max(1.0, float(logo_h))
    W = max(w + 1.0, float(frame_w))
    H = max(h + 1.0, float(frame_h))
    range_x = max(1.0, W - w)
    range_y = max(1.0, H - h)
    vx, vy = (logo_bounce_speed_xy(speed, W, seed=seed)[0], logo_bounce_speed_xy(speed, W, seed=seed)[1])
    phase_x = abs(int(seed)) % 50 / 50.0 * range_x
    phase_y = abs(int(seed)) * 7 % 50 / 50.0 * range_y
    mx = abs((t * vx + phase_x) % (2 * range_x) - range_x)
    my = abs((t * vy + phase_y) % (2 * range_y) - range_y)
    return (0.0, 0.0) if math.isnan(mx) or math.isnan(my) else (float(mx), float(my))

def logo_bounce_ffmpeg_exprs(*, speed: float, seed: int, ref_width: int) -> tuple[str, str]:
    base = max(20.0, float(speed or 120.0))
    s = abs(int(seed)) % 97
    vx = base * (0.85 + s % 17 / 50.0)
    vy = base * 0.72 * (0.85 + s * 3 % 19 / 55.0)
    px = s % 50
    py = s * 7 % 50
    x = f'{vx}.4f+{px}\\,2*max(1\\,W-w))-(max(1\\,W-w)))'
    y = f'{vy}.4f+{py}\\,2*max(1\\,H-h))-(max(1\\,H-h)))'
    return (x, y)