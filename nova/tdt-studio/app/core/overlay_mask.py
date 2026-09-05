'Mặt nạ lớp phủ — tròn/chữ nhật/cuộn phim + feather. Tắt = lớp phủ bình thường.'
from __future__ import annotations
import hashlib
import os
import tempfile
from pathlib import Path
MASK_SHAPES = ('rect', 'circle', 'film')
MASK_FEATHER_AXES = ('y', 'x')
DEFAULT_MASK = {'mask_enabled': False, 'mask_shape': 'circle', 'mask_width_percent': 100, 'mask_height_percent': 100, 'mask_feather_percent': 20, 'mask_feather_bias': 0, 'mask_feather_axis': 'y', 'mask_corner_radius_percent': 18}

def overlay_mask_enabled(item: dict | None) -> bool:
    return bool(item.get('mask_enabled', False)) if isinstance(item, dict) else False

def normalize_overlay_mask_fields(item: dict) -> dict:
    shape = str(item.get('mask_shape', 'circle') or 'circle').strip().lower()
    if shape not in MASK_SHAPES:
        shape = 'circle'
    try:
        width_pct = int(item.get('mask_width_percent', 100) or 100)
    except (TypeError, ValueError):
        width_pct = 100
    try:
        height_pct = int(item.get('mask_height_percent', 100) or 100)
    except (TypeError, ValueError):
        height_pct = 100
    try:
        feather = int(item.get('mask_feather_percent', 20) or 20)
    except (TypeError, ValueError):
        feather = 20
    try:
        corner = int(item.get('mask_corner_radius_percent', 18) or 18)
    except (TypeError, ValueError):
        corner = 18
    try:
        bias = int(item.get('mask_feather_bias', 0) or 0)
    except (TypeError, ValueError):
        bias = 0
    axis = str(item.get('mask_feather_axis', 'y') or 'y').strip().lower()
    if axis not in MASK_FEATHER_AXES:
        axis = 'y'
    return {'mask_enabled': bool(item.get('mask_enabled', False)), 'mask_shape': shape, 'mask_width_percent': max(8, min(150, width_pct)), 'mask_height_percent': max(8, min(150, height_pct)), 'mask_feather_percent': max(0, min(100, feather)), 'mask_feather_bias': max(-100, min(100, bias)), 'mask_feather_axis': axis, 'mask_corner_radius_percent': max(0, min(100, corner))}

def overlay_mask_is_film(item: dict | None) -> bool:
    return normalize_overlay_mask_fields(item)['mask_shape'] == 'film' if overlay_mask_enabled(item) else False

def _mask_cache_dir() -> Path:
    path = Path(tempfile.gettempdir()) / 'VideoToolsPro' / 'overlay_mask'
    path.mkdir(parents=True, exist_ok=True)
    return path

def render_overlay_mask_luma(width: int, height: int, item: dict):
    from PIL import Image, ImageDraw, ImageFilter
    w = max(2, int(width))
    h = max(2, int(height))
    fields = normalize_overlay_mask_fields(item)
    if fields['mask_shape'] == 'film':
        return _render_film_luma(w, h, fields)
    img = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(img)
    mw = max(2.0, w * fields['mask_width_percent'] / 100.0)
    mh = max(2.0, h * fields['mask_height_percent'] / 100.0)
    cy, cx = (h / 2.0, w / 2.0)
    y0, x0 = (cy - mh / 2.0, cx - mw / 2.0)
    y1, x1 = (cy + mh / 2.0, cx + mw / 2.0)
    box = [x0, y0, x1, y1]
    if fields['mask_shape'] == 'circle':
        draw.ellipse(box, fill=255)
    else:
        radius = min(mw, mh) * 0.5 * (fields['mask_corner_radius_percent'] / 100.0)
        try:
            draw.rounded_rectangle(box, radius=max(0.0, radius), fill=255)
        except Exception:
            draw.rectangle(box, fill=255)
    feather = fields['mask_feather_percent']
    sigma = feather / 100.0 * (min(w, h) * 0.22)
    if feather > 0 and sigma >= 0.45:
        img = img.filter(ImageFilter.GaussianBlur(radius=sigma))
    return img

def _render_film_luma(width: int, height: int, fields: dict):
    import numpy as np
    from PIL import Image
    h, w = (max(2, int(height)), max(2, int(width)))
    mw = max(2.0, w * fields['mask_width_percent'] / 100.0)
    mh = max(2.0, h * fields['mask_height_percent'] / 100.0)
    cy, cx = (h / 2.0, w / 2.0)
    x1, x0 = (cx + mw / 2.0, cx - mw / 2.0)
    y1, y0 = (cy + mh / 2.0, cy - mh / 2.0)
    ys = np.arange(h, dtype=np.float32)[:, None]
    xs = np.arange(w, dtype=np.float32)[None, :]
    inside = (xs >= x0) & (xs <= x1) & (ys >= y0) & (ys <= y1)
    alpha = np.where(inside, 255.0, 0.0)
    axis = str(fields.get('mask_feather_axis', 'y') or 'y')
    span = mw if axis == 'x' else mh
    coord = xs if axis == 'x' else ys
    near, far = (((x0, x1) if axis == 'x' else (y0, y1))[0], ((x0, x1) if axis == 'x' else (y0, y1))[1])
    feather_px = max(0.0, fields['mask_feather_percent'] / 100.0 * span)
    bias = int(fields.get('mask_feather_bias', 0) or 0)
    if feather_px >= 1.0:
        if abs(bias) < 8:
            a = np.clip((coord - near) / feather_px, 0.0, 1.0)
            b = np.clip((far - coord) / feather_px, 0.0, 1.0)
            fade = np.minimum(a, b)
            alpha = np.where(inside, 255.0 * fade, 0.0)
        else:
            if bias >= 0:
                t = np.clip((far - coord) / feather_px, 0.0, 1.0)
                zone = inside & (coord >= far - feather_px)
            else:
                t = np.clip((coord - near) / feather_px, 0.0, 1.0)
                zone = inside & (coord <= near + feather_px)
            alpha = np.where(zone, 255.0 * t, alpha)
    return Image.fromarray(np.clip(alpha, 0, 255).astype('uint8'), mode='L')

def overlay_mask_png_path(item: dict, width: int, height: int) -> str:
    fields = normalize_overlay_mask_fields(item)
    w = max(2, int(width))
    h = max(2, int(height))
    key = hashlib.sha1(f"{w}x{h}|{fields['mask_shape']}|{fields['mask_width_percent']}|{fields['mask_height_percent']}|{fields['mask_feather_percent']}|{fields['mask_feather_bias']}|{fields['mask_feather_axis']}|{fields['mask_corner_radius_percent']}".encode('utf-8')).hexdigest()[:16]
    dest = _mask_cache_dir() / f'm_{key}.png'
    if dest.is_file() and dest.stat().st_size > 32:
        pass
    else:
        luma = render_overlay_mask_luma(w, h, fields)
        tmp = dest.with_suffix('.tmp.png')
        luma.save(tmp, format='PNG')
        os.replace(tmp, dest)
    return str(dest)

def ffmpeg_movie_escape(path: str) -> str:
    return str(path or '').replace('\\', '/').replace(':', '\\:')

def apply_overlay_mask_qimage(image, item: dict):
    if image is None or getattr(image, 'isNull', lambda: True)():
        pass
    elif overlay_mask_enabled(item):
        try:
            import numpy as np
            from PySide6.QtGui import QImage
        except Exception:
            return image
        src = image.convertToFormat(QImage.Format.Format_RGBA8888)
        h, w = (int(src.height()), int(src.width()))
        if w < 2 or h < 2:
            return image
        try:
            luma = render_overlay_mask_luma(w, h, item)
        except Exception:
            return image
        ptr = src.bits()
        arr = np.frombuffer(ptr, dtype=np.uint8, count=h * src.bytesPerLine()).copy()
        row = src.bytesPerLine()
        pixels = arr.reshape(h, row)[:, :w * 4].reshape(h, w, 4)
        mask = np.asarray(luma, dtype=np.float32) / 255.0
        pixels[:, :, 3] = np.clip(pixels[:, :, 3].astype(np.float32) * mask, 0, 255).astype(np.uint8)
        out = QImage(pixels.tobytes(), w, h, w * 4, QImage.Format.Format_RGBA8888)
        return out.copy()
    return image