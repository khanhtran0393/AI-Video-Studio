'Bộ lọc màu, hòa trộn và kiểu chuyển động máy ảnh — khớp UI CapCut / TikTok tool.'
from __future__ import annotations
import math
COLOR_FILTER_CHOICES: 'tuple[tuple[str, str], ...]' = (('Không dùng', 'none'), ('Rực rỡ (Vivid)', 'vivid'), ('Ấm (Warm)', 'warm'), ('Lạnh (Cool)', 'cool'), ('Điện ảnh (Cinematic)', 'cinematic'), ('Pastel nhẹ', 'pastel'), ('Đen trắng', 'bw'), ('Nâu cổ (Sepia)', 'sepia'), ('Tăng tương phản', 'contrast'), ('Màu nhạt (Fade)', 'fade'), ('Neon / Pop', 'neon'), ('Xanh lá tươi', 'fresh'))
COLOR_FILTER_IDS = frozenset((value for _, value in COLOR_FILTER_CHOICES))
VIDEO_EFFECT_CHOICES: 'tuple[tuple[str, str], ...]' = (('Không dùng', 'none'), ('Film grain', 'grain'), ('Vignette', 'vignette'), ('Vintage', 'vintage'), ('Light leak', 'lightleak'), ('Glow', 'glow'), ('Quét sáng', 'lightsweep'), ('Sọc nhiễu anti-reup', 'stripe'), ('TV cũ CRT', 'tv'), ('Camera REC', 'camera_rec'), ('Tuỳ chỉnh từ file', 'custom'))
VIDEO_EFFECT_IDS = frozenset((value for _, value in VIDEO_EFFECT_CHOICES))
VIDEO_EFFECT_LIBRARY_TILES: 'tuple[tuple[str, str, str], ...]' = (('Không', 'none', '⊘'), ('Grain', 'grain', '░'), ('Vignette', 'vignette', '◯'), ('Vintage', 'vintage', '♨'), ('Light leak', 'lightleak', '✦'), ('Glow', 'glow', '✺'), ('Quét sáng', 'lightsweep', '↝'), ('Sọc nhiễu', 'stripe', '≡'), ('TV cũ', 'tv', '▥'), ('REC', 'camera_rec', '●'), ('File', 'custom', '▤'))
VIDEO_EFFECT_LIBRARY_GROUPS: 'tuple[tuple[str, str, frozenset[str]], ...]' = (('Tất cả', 'all', VIDEO_EFFECT_IDS), ('Nổi bật', 'featured', frozenset({'grain', 'glow', 'lightsweep', 'vignette', 'none'})), ('Film', 'film', frozenset({'grain', 'tv', 'vignette', 'vintage', 'none'})), ('Ánh sáng', 'light', frozenset({'none', 'lightleak', 'lightsweep', 'glow'})), ('Anti-reup', 'antireup', frozenset({'tv', 'stripe', 'none', 'custom', 'camera_rec'})))
COLOR_FILTER_LIBRARY_GROUPS: 'tuple[tuple[str, str, frozenset[str]], ...]' = (('Tất cả', 'all', COLOR_FILTER_IDS), ('Nổi bật', 'featured', frozenset({'vivid', 'cool', 'cinematic', 'fresh', 'warm'})), ('Ấm / Lạnh', 'temp', frozenset({'neon', 'cool', 'fresh', 'warm'})), ('Điện ảnh', 'cinema', frozenset({'fade', 'contrast', 'cinematic', 'pastel'})), ('Mono', 'mono', frozenset({'bw', 'sepia', 'none'})))
TRANSITION_LIBRARY_CHOICES: 'tuple[tuple[str, str, int, str], ...]' = (('Không dùng', 'cut', 0, ''), ('Fade ngắn', 'fade_soft', 150, 'fade'), ('Fade chuẩn', 'fade', 250, 'fade'), ('Fade dài', 'fade_long', 500, 'fade'), ('Fade đen', 'fade_black', 400, 'fadeblack'), ('Fade trắng', 'fade_white', 400, 'fadewhite'), ('Dissolve', 'dissolve', 400, 'dissolve'), ('Mờ ngang', 'hblur', 450, 'hblur'), ('Trượt trái', 'slide_left', 400, 'slideleft'), ('Trượt phải', 'slide_right', 400, 'slideright'), ('Trượt lên', 'slide_up', 400, 'slideup'), ('Trượt xuống', 'slide_down', 400, 'slidedown'), ('Quét trái', 'wipe_left', 350, 'wipeleft'), ('Quét phải', 'wipe_right', 350, 'wiperight'), ('Quét lên', 'wipe_up', 350, 'wipeup'), ('Quét xuống', 'wipe_down', 350, 'wipedown'), ('Mượt trái', 'smooth_left', 450, 'smoothleft'), ('Mượt phải', 'smooth_right', 450, 'smoothright'), ('Mượt lên', 'smooth_up', 450, 'smoothup'), ('Mượt xuống', 'smooth_down', 450, 'smoothdown'), ('Tròn mở', 'circle_open', 500, 'circleopen'), ('Tròn đóng', 'circle_close', 500, 'circleclose'), ('Chữ nhật mở', 'rect_open', 450, 'horzopen'), ('Chữ nhật đóng', 'rect_close', 450, 'horzclose'), ('Dọc mở', 'vert_open', 450, 'vertopen'), ('Dọc đóng', 'vert_close', 450, 'vertclose'), ('Xuyên tâm', 'radial', 500, 'radial'), ('Khoảng cách', 'distance', 450, 'distance'), ('Pixel', 'pixelize', 400, 'pixelize'), ('Zoom vào', 'zoom_in', 500, 'zoomin'), ('Chéo TL', 'diag_tl', 400, 'diagtl'), ('Chéo TR', 'diag_tr', 400, 'diagtr'), ('Chéo BL', 'diag_bl', 400, 'diagbl'), ('Chéo BR', 'diag_br', 400, 'diagbr'), ('Nén ngang', 'squeeze_h', 400, 'squeezeh'), ('Nén dọc', 'squeeze_v', 400, 'squeezev'), ('Lát ngang', 'hl_slice', 400, 'hlslice'), ('Lát dọc', 'vu_slice', 400, 'vuslice'))

def transition_choice_triples() -> tuple[tuple[str, str, int], ...]:
    return tuple(((label, sid, ms) for label, sid, ms, _xf in TRANSITION_LIBRARY_CHOICES))
TRANSITION_STYLE_IDS = frozenset((style for _, style, _, _ in TRANSITION_LIBRARY_CHOICES))
TRANSITION_XFADE_BY_STYLE = {style: xfade for _label, style, _ms, xfade in TRANSITION_LIBRARY_CHOICES}
TRANSITION_XFADE_BY_STYLE: 'dict[str, str]'
TRANSITION_MS_BY_STYLE = {style: ms for _label, style, ms, _xf in TRANSITION_LIBRARY_CHOICES}
TRANSITION_MS_BY_STYLE: 'dict[str, int]'
TRANSITION_LABEL_BY_STYLE = {style: label for label, style, _ms, _xf in TRANSITION_LIBRARY_CHOICES}
TRANSITION_LABEL_BY_STYLE: 'dict[str, str]'
TRANSITION_LIBRARY_GROUPS: 'tuple[tuple[str, str, frozenset[str]], ...]' = (('Tất cả', 'all', TRANSITION_STYLE_IDS), ('Cơ bản', 'basic', frozenset({'cut', 'fade_long', 'dissolve', 'fade_black', 'fade_white', 'fade_soft', 'fade'})), ('Trượt', 'slide', frozenset({'smooth_up', 'slide_right', 'smooth_left', 'smooth_right', 'smooth_down', 'slide_left', 'slide_up', 'slide_down'})), ('Quét', 'wipe', frozenset({'wipe_right', 'diag_tl', 'diag_tr', 'wipe_left', 'diag_bl', 'wipe_down', 'wipe_up', 'diag_br'})), ('Hình học', 'geo', frozenset({'distance', 'vert_open', 'vert_close', 'radial', 'rect_close', 'rect_open', 'circle_open', 'circle_close'})), ('Đặc biệt', 'fx', frozenset({'squeeze_v', 'pixelize', 'squeeze_h', 'hl_slice', 'vu_slice', 'hblur', 'zoom_in'})))
TRANSITION_APPLY_MODES: 'tuple[tuple[str, str], ...]' = (('1 cho tất cả', 'one_for_all'), ('Random (chọn pool)', 'random'))
TRANSITION_APPLY_MODE_IDS = frozenset((v for _, v in TRANSITION_APPLY_MODES))
TRANSITION_DEFAULT_RANDOM_POOL: 'tuple[str, ...]' = ('fade', 'dissolve', 'slide_left', 'slide_right', 'wipe_left', 'circle_open', 'smooth_left', 'zoom_in')
BLEND_MODE_CHOICES: 'tuple[tuple[str, str], ...]' = (('Mặc định', 'normal'), ('Làm sáng', 'lighten'), ('Màn hình', 'screen'), ('Làm tối', 'darken'), ('Lớp phủ', 'overlay'), ('Ánh sáng mạnh', 'hardlight'), ('Ánh sáng tán xạ', 'softlight'), ('Làm tối màu', 'colorburn'), ('Làm sáng màu', 'colordodge'), ('Giảm độ sáng', 'linearburn'), ('Cộng sáng', 'addition'), ('Nhân', 'multiply'))
BLEND_MODE_IDS = frozenset((value for _, value in BLEND_MODE_CHOICES))
FFMPEG_BLEND_MODES: 'dict[str, str]' = {'normal': 'normal', 'lighten': 'lighten', 'screen': 'screen', 'darken': 'darken', 'overlay': 'overlay', 'hardlight': 'hardlight', 'softlight': 'softlight', 'colorburn': 'burn', 'colordodge': 'dodge', 'linearburn': 'linearburn', 'addition': 'addition', 'multiply': 'multiply'}
MOTION_CHOICES: 'tuple[tuple[str, str], ...]' = (('Giữ yên', 'still'), ('Phóng vào từ từ', 'zoom_in'), ('Thu ra từ từ', 'zoom_out'), ('Lắc nhẹ', 'shake'), ('Lia nhẹ (CapCut)', 'pan_soft'), ('Lia trái', 'pan_left'), ('Lia phải', 'pan_right'), ('Lia lên', 'pan_up'), ('Lia xuống', 'pan_down'), ('Vòng cung', 'arc'), ('Ken Burns (zoom + lia)', 'ken_burns'))
MOTION_IDS = frozenset((value for _, value in MOTION_CHOICES))
PAN_MOTIONS = frozenset({'pan_up', 'pan_down', 'pan_left', 'pan_soft', 'arc', 'pan_right', 'ken_burns'})
PAN_BASE_PX = 28.0

def motion_intensity_factor(percent: int | float) -> float:
    return max(0.0, min(1.0, float(percent) / 100.0))

def pan_offsets_px(seconds: float, motion: str, intensity: float, *, unit_x: float, unit_y: float) -> tuple[float, float]:
    factor = max(0.0, min(1.0, float(intensity)))
    if factor <= 0.0 or motion not in PAN_MOTIONS:
        return (0.0, 0.0)
    amp = PAN_BASE_PX * factor
    ux = float(unit_x)
    uy = float(unit_y)
    t = float(seconds)
    return (amp * 0.55 * ux * math.sin(0.45 * t), amp * 0.25 * uy * math.cos(0.38 * t)) if motion == 'pan_soft' else (-amp * ux * math.sin(0.55 * t), 0.0) if motion == 'pan_left' else (amp * ux * math.sin(0.55 * t), 0.0) if motion == 'pan_right' else (0.0, -amp * uy * math.sin(0.55 * t)) if motion == 'pan_up' else (0.0, amp * uy * math.sin(0.55 * t)) if motion == 'pan_down' else (amp * 0.85 * ux * math.sin(0.5 * t), amp * 0.85 * uy * math.cos(0.5 * t)) if motion == 'arc' else (amp * 0.4 * ux * t * 0.08, -amp * 0.25 * uy * t * 0.06) if motion == 'ken_burns' else (0.0, 0.0)

def pan_overlay_expr(motion: str, intensity: float, axis: str) -> str | None:
    factor = max(0.0, min(1.0, float(intensity)))
    if factor <= 0.0 or motion not in PAN_MOTIONS:
        return None
    amp = PAN_BASE_PX * factor
    if motion == 'pan_soft':
        return f'g*sin(0.45*t)' if axis == 'x' else f'g*cos(0.38*t)'
    if motion == 'pan_left':
        return f'{amp}g*sin(0.55*t)' if axis == 'x' else None
    if motion == 'pan_right':
        return f'g*sin(0.55*t)' if axis == 'x' else None
    if motion == 'pan_up':
        return f'{amp}g*sin(0.55*t)' if axis == 'y' else None
    if motion == 'pan_down':
        return f'g*sin(0.55*t)' if axis == 'y' else None
    if motion == 'arc':
        return f'g*sin(0.5*t)' if axis == 'x' else f'g*cos(0.5*t)'
    if motion == 'ken_burns':
        return f'g*t*0.08' if axis == 'x' else f'{amp * 0.25}g*t*0.06'

def pan_crop_expr(motion: str, intensity: float, axis: str) -> tuple[str, str] | None:
    factor = max(0.0, min(1.0, float(intensity)))
    if factor <= 0.0 or motion not in PAN_MOTIONS:
        return None
    amp = PAN_BASE_PX * factor
    cx = '(iw-ow)/2'
    cy = '(ih-oh)/2'
    if motion == 'pan_soft':
        x = f'+{amp * 0.55}g*sin(0.45*t)'
        y = f'+{amp * 0.25}g*cos(0.38*t)'
        return (x, y) if axis == 'x' else (x, y)
    if motion == 'pan_left':
        x = f'-{amp}g*sin(0.55*t)'
        y = cy
    elif motion == 'pan_right':
        x = f'+{amp}g*sin(0.55*t)'
        y = cy
    elif motion == 'pan_up':
        x = cx
        y = f'-{amp}g*sin(0.55*t)'
    elif motion == 'pan_down':
        x = cx
        y = f'+{amp}g*sin(0.55*t)'
    elif motion == 'arc':
        x = f'+{amp * 0.85}g*sin(0.5*t)'
        y = f'+{amp * 0.85}g*cos(0.5*t)'
    elif motion == 'ken_burns':
        x = f'+{amp * 0.4}g*t*0.08'
        y = f'-{amp * 0.25}g*t*0.06'
    else:
        return None

def color_filter_ffmpeg(filter_id: str, strength_percent: int) -> str | None:
    fid = str(filter_id or 'none').strip().lower()
    if fid in frozenset({'', 'none'}):
        return None
    s = max(0, min(100, int(strength_percent)))
    if s <= 0:
        return None
    k = s / 100.0
    if fid == 'vivid':
        sat = 1.0 + 0.45 * k
        con = 1.0 + 0.12 * k
        return f'g:contrast={con}g'
    if fid == 'warm':
        return f':gs={0.04 * k}g:bs=-{0.14 * k}g'
    if fid == 'cool':
        return f':gs={0.02 * k}g:bs={0.16 * k}g'
    if fid == 'cinematic':
        sat = 1.0 - 0.18 * k
        con = 1.0 + 0.08 * k
        return f'g:brightness=-{0.03 * k}g,colorbalance=rs={0.06 * k}g:bs=-{0.04 * k}g'
    if fid == 'pastel':
        sat = 1.0 - 0.35 * k
        bri = 0.04 * k
        return f'g:brightness={bri}g'
    if fid == 'bw':
        return f'{1.0 + 0.1 * k}g'
    if fid == 'sepia':
        return f'{0.6 + 0.4 * (1 - k)}g'
    if fid == 'contrast':
        return f'g:saturation={1.0 + 0.08 * k}g'
    if fid == 'fade':
        sat = 1.0 - 0.25 * k
        bri = 0.06 * k
        return f':brightness={bri}g:contrast={1.0 - 0.08 * k}g'
    if fid == 'neon':
        sat = 1.0 + 0.55 * k
        con = 1.0 + 0.15 * k
        return f':contrast={con}g:gamma={1.0 - 0.05 * k}g'
    if fid == 'fresh':
        sat = 1.0 + 0.35 * k
        return f',colorbalance=gs={0.08 * k}g:bs=-{0.05 * k}g'

def layer_uses_blend(blend_mode: str) -> bool:
    return str(blend_mode or 'normal').strip().lower() != 'normal'

def scale_cover_qimage(image, width: int, height: int):
    from PySide6.QtCore import Qt
    from PySide6.QtGui import QImage
    if image.isNull():
        return image
    tw = max(1, int(width))
    th = max(1, int(height))
    iw = max(1, image.width())
    ih = max(1, image.height())
    scale = max(tw / iw, th / ih)
    sw = max(tw, int(round(iw * scale)))
    sh = max(th, int(round(ih * scale)))
    scaled = image.scaled(sw, sh, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
    x = max(0, (sw - tw) // 2)
    y = max(0, (sh - th) // 2)
    return scaled.copy(x, y, tw, th).convertToFormat(QImage.Format.Format_ARGB32)

def build_positioned_layer_canvas_qimage(overlay, canvas_w: int, canvas_h: int, x_norm: float, y_norm: float, scale_percent: int):
    from PySide6.QtGui import QImage, QPainter
    if overlay.isNull():
        return QImage()
    tw = max(8, round(canvas_w * max(5, min(200, int(scale_percent))) / 100))
    th = max(1, round(tw * overlay.height() / max(1, overlay.width())))
    scaled = overlay.scaled(tw, th, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation).convertToFormat(QImage.Format.Format_ARGB32)
    canvas = QImage(max(1, canvas_w), max(1, canvas_h), QImage.Format.Format_ARGB32)
    canvas.fill(0)
    cx = canvas_w * max(0.0, min(1.0, float(x_norm)))
    cy = canvas_h * max(0.0, min(1.0, float(y_norm)))
    x = int(round(cx - tw / 2))
    y = int(round(cy - th / 2))
    painter = QPainter(canvas)
    painter.drawImage(x, y, scaled)
    painter.end()
    return canvas

def apply_blend_layer_qimage(base, overlay, blend_mode: str, opacity_percent: int, *, x_norm: float, y_norm: float, scale_percent: int):
    if base.isNull() or overlay.isNull():
        return base
    layer = build_positioned_layer_canvas_qimage(overlay, max(1, base.width()), max(1, base.height()), x_norm, y_norm, scale_percent)
    if layer.isNull():
        return base
    blended = blend_qimages_ffmpeg(base, layer, blend_mode, opacity_percent)
    return blended if blended is not None else base

def blend_qimages_ffmpeg(base, top, blend_mode: str, opacity_percent: int):
    from PySide6.QtGui import QImage
    if base.isNull() or top.isNull():
        return None
    base_img = base.convertToFormat(QImage.Format.Format_ARGB32)
    top_img = top.convertToFormat(QImage.Format.Format_ARGB32)
    if base_img.width() != top_img.width() or base_img.height() != top_img.height():
        top_img = top_img.scaled(base_img.width(), base_img.height(), aspectRatioMode=1)
    opacity = max(0.0, min(1.0, int(opacity_percent) / 100.0))
    mode = str(blend_mode or 'screen').strip().lower()
    try:
        import numpy as np
        w, h, bd = (_qimage_rgba_bytes(base_img)[0], _qimage_rgba_bytes(base_img)[1], _qimage_rgba_bytes(base_img)[2])
        _, td = (_qimage_rgba_bytes(top_img)[1], _qimage_rgba_bytes(top_img)[2])
        b = np.frombuffer(bd, dtype=np.uint8).reshape((h, w, 4)).copy()
        t = np.frombuffer(td, dtype=np.uint8).reshape((h, w, 4))
        bb, bg, br = (b[:, :, 2], b[:, :, 1], b[:, :, 0])
        tb, tg, tr = (t[:, :, 2], t[:, :, 1], t[:, :, 0])
        blended = _blend_channels_numpy(br, bg, bb, tr, tg, tb, mode)
        out = b.copy()
        out[:, :, 0] = np.clip(br * (1.0 - opacity) + blended[0] * opacity, 0, 255).astype(np.uint8)
        out[:, :, 1] = np.clip(bg * (1.0 - opacity) + blended[1] * opacity, 0, 255).astype(np.uint8)
        out[:, :, 2] = np.clip(bb * (1.0 - opacity) + blended[2] * opacity, 0, 255).astype(np.uint8)
    except Exception:
        return apply_overlay_blend_qimage(base_img, 0, 0, base_img.width(), base_img.height(), top_img, mode, opacity_percent)

def _blend_channels_numpy(br, bg, bb, tr, tg, tb, mode: str):
    import numpy as np
    mode = str(mode or 'screen').strip().lower()
    if mode == 'multiply':
        r = br.astype(np.uint16) * tr.astype(np.uint16) // 255
        g = bg.astype(np.uint16) * tg.astype(np.uint16) // 255
        b = bb.astype(np.uint16) * tb.astype(np.uint16) // 255
    elif mode == 'screen':
        r = 255 - (255 - br.astype(np.uint16)) * (255 - tr.astype(np.uint16)) // 255
        g = 255 - (255 - bg.astype(np.uint16)) * (255 - tg.astype(np.uint16)) // 255
        b = 255 - (255 - bb.astype(np.uint16)) * (255 - tb.astype(np.uint16)) // 255
    elif mode == 'lighten':
        r = np.maximum(br, tr)
        g = np.maximum(bg, tg)
        b = np.maximum(bb, tb)
    elif mode == 'darken':
        r = np.minimum(br, tr)
        g = np.minimum(bg, tg)
        b = np.minimum(bb, tb)
    elif mode == 'overlay':
        r = np.where(br < 128, 2 * br.astype(np.uint16) * tr.astype(np.uint16) // 255, 255 - 2 * (255 - br.astype(np.uint16)) * (255 - tr.astype(np.uint16)) // 255)
        g = np.where(bg < 128, 2 * bg.astype(np.uint16) * tg.astype(np.uint16) // 255, 255 - 2 * (255 - bg.astype(np.uint16)) * (255 - tg.astype(np.uint16)) // 255)
        b = np.where(bb < 128, 2 * bb.astype(np.uint16) * tb.astype(np.uint16) // 255, 255 - 2 * (255 - bb.astype(np.uint16)) * (255 - tb.astype(np.uint16)) // 255)
    elif mode == 'hardlight':
        r = np.where(tr < 128, 2 * br.astype(np.uint16) * tr.astype(np.uint16) // 255, 255 - 2 * (255 - br.astype(np.uint16)) * (255 - tr.astype(np.uint16)) // 255)
        g = np.where(tg < 128, 2 * bg.astype(np.uint16) * tg.astype(np.uint16) // 255, 255 - 2 * (255 - bg.astype(np.uint16)) * (255 - tg.astype(np.uint16)) // 255)
        b = np.where(tb < 128, 2 * bb.astype(np.uint16) * tb.astype(np.uint16) // 255, 255 - 2 * (255 - bb.astype(np.uint16)) * (255 - tb.astype(np.uint16)) // 255)
    elif mode == 'softlight':
        r = br.astype(np.float32) + (2 * tr.astype(np.float32) / 255.0 - 1.0) * (np.sqrt(br.astype(np.float32) / 255.0) * 255.0 - br.astype(np.float32))
        g = bg.astype(np.float32) + (2 * tg.astype(np.float32) / 255.0 - 1.0) * (np.sqrt(bg.astype(np.float32) / 255.0) * 255.0 - bg.astype(np.float32))
        b = bb.astype(np.float32) + (2 * tb.astype(np.float32) / 255.0 - 1.0) * (np.sqrt(bb.astype(np.float32) / 255.0) * 255.0 - bb.astype(np.float32))
        r = np.clip(r, 0, 255)
        g = np.clip(g, 0, 255)
        b = np.clip(b, 0, 255)
    elif mode == 'colorburn':
        r = np.where(tr == 0, 0, 255 - np.minimum(255, (255 - br.astype(np.uint16)) * 255 // np.maximum(1, tr.astype(np.uint16))))
        g = np.where(tg == 0, 0, 255 - np.minimum(255, (255 - bg.astype(np.uint16)) * 255 // np.maximum(1, tg.astype(np.uint16))))
        b = np.where(tb == 0, 0, 255 - np.minimum(255, (255 - bb.astype(np.uint16)) * 255 // np.maximum(1, tb.astype(np.uint16))))
    elif mode == 'colordodge':
        r = np.where(tr == 255, 255, np.minimum(255, br.astype(np.uint16) * 255 // np.maximum(1, 255 - tr.astype(np.uint16))))
        g = np.where(tg == 255, 255, np.minimum(255, bg.astype(np.uint16) * 255 // np.maximum(1, 255 - tg.astype(np.uint16))))
        b = np.where(tb == 255, 255, np.minimum(255, bb.astype(np.uint16) * 255 // np.maximum(1, 255 - tb.astype(np.uint16))))
    elif mode == 'linearburn':
        r = np.maximum(0, br.astype(np.int16) + tr.astype(np.int16) - 255)
        g = np.maximum(0, bg.astype(np.int16) + tg.astype(np.int16) - 255)
        b = np.maximum(0, bb.astype(np.int16) + tb.astype(np.int16) - 255)
    elif mode == 'addition':
        r = np.minimum(255, br.astype(np.uint16) + tr.astype(np.uint16))
        g = np.minimum(255, bg.astype(np.uint16) + tg.astype(np.uint16))
        b = np.minimum(255, bb.astype(np.uint16) + tb.astype(np.uint16))
    else:
        b, g, r = (tb, tg, tr)
    return (r.astype(np.uint8), g.astype(np.uint8), b.astype(np.uint8))

def apply_overlay_blend_qimage(base, x: int, y: int, width: int, height: int, overlay, blend_mode: str, opacity_percent: int):
    from PySide6.QtCore import Qt
    from PySide6.QtGui import QImage, QPainter
    if base.isNull() or overlay.isNull():
        return base
    ow = max(1, int(width))
    oh = max(1, int(height))
    ox = int(x)
    oy = int(y)
    out = base.copy()
    scaled = overlay.scaled(ow, oh, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
    scaled = scaled.convertToFormat(QImage.Format.Format_ARGB32)
    opacity = max(0.0, min(1.0, int(opacity_percent) / 100.0))
    painter = QPainter(out)
    painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
    if layer_uses_blend(blend_mode):
        comp_name = qt_composition_mode(blend_mode)
        comp = getattr(QPainter.CompositionMode, f'CompositionMode_{comp_name}', QPainter.CompositionMode.CompositionMode_SourceOver)
        painter.setCompositionMode(comp)
    painter.setOpacity(opacity)
    painter.drawImage(ox, oy, scaled)
    painter.end()
    return out

def qt_composition_mode(blend_mode: str) -> str:
    mapping = {'normal': 'SourceOver', 'multiply': 'Multiply', 'screen': 'Screen', 'overlay': 'Overlay', 'darken': 'DarkenOnly', 'lighten': 'LightenOnly', 'hardlight': 'HardLight', 'softlight': 'SoftLight', 'colorburn': 'ColorBurn', 'colordodge': 'ColorDodge', 'linearburn': 'LinearBurn', 'addition': 'Plus'}
    return mapping.get(str(blend_mode or 'normal'), 'SourceOver')

def _qimage_rgba_bytes(image) -> tuple[int, int, bytes]:
    from PySide6.QtGui import QImage
    fmt = QImage.Format.Format_RGBA8888
    src = image.convertToFormat(fmt).copy()
    h, w = (src.height(), src.width())
    nbytes = src.sizeInBytes()
    view = src.constBits()
    data = bytes(view[:nbytes])
    return (w, h, data)

def _qimage_from_rgba_bytes(width: int, height: int, data: bytes):
    from PySide6.QtGui import QImage
    out = QImage(data, width, height, QImage.Format.Format_RGBA8888)
    return out.copy()

def apply_color_filter_qimage(image, filter_id: str, strength_percent: int):
    fid = str(filter_id or 'none').strip().lower()
    strength = max(0, min(100, int(strength_percent)))
    if fid in frozenset({'', 'none'}) or strength <= 0:
        return image
    try:
        from PIL import Image, ImageEnhance
    except ImportError:
        return image
    try:
        w, h, data = (_qimage_rgba_bytes(image)[0], _qimage_rgba_bytes(image)[1], _qimage_rgba_bytes(image)[2])
        pil = Image.frombytes('RGBA', (w, h), data)
    except Exception:
        return image
    k = strength / 100.0
    try:
        if fid == 'vivid':
            pil = ImageEnhance.Color(pil).enhance(1.0 + 0.45 * k)
            pil = ImageEnhance.Contrast(pil).enhance(1.0 + 0.12 * k)
        elif fid == 'warm':
            r, g, b, a = (pil.split()[0], pil.split()[1], pil.split()[2], pil.split()[3])
            r = r.point(lambda v: min(255, int(v * (1.0 + 0.12 * k))))
            b = b.point(lambda v: max(0, int(v * (1.0 - 0.14 * k))))
            pil = Image.merge('RGBA', (r, g, b, a))
        elif fid == 'cool':
            r, g, b, a = (pil.split()[0], pil.split()[1], pil.split()[2], pil.split()[3])
            r = r.point(lambda v: max(0, int(v * (1.0 - 0.1 * k))))
            b = b.point(lambda v: min(255, int(v * (1.0 + 0.16 * k))))
            pil = Image.merge('RGBA', (r, g, b, a))
        elif fid == 'cinematic':
            pil = ImageEnhance.Color(pil).enhance(1.0 - 0.18 * k)
            pil = ImageEnhance.Contrast(pil).enhance(1.0 + 0.08 * k)
            pil = ImageEnhance.Brightness(pil).enhance(1.0 - 0.03 * k)
        elif fid == 'pastel':
            pil = ImageEnhance.Color(pil).enhance(1.0 - 0.35 * k)
            pil = ImageEnhance.Brightness(pil).enhance(1.0 + 0.04 * k)
        elif fid == 'bw':
            pil = ImageEnhance.Color(pil).enhance(0.0)
            pil = ImageEnhance.Contrast(pil).enhance(1.0 + 0.1 * k)
        elif fid == 'sepia':
            alpha = pil.getchannel('A')
            gray = ImageEnhance.Color(pil).enhance(0.0).convert('RGB')
            sepia = Image.new('RGB', gray.size)
            px = gray.load()
            spx = sepia.load()
            for y in range(gray.height):
                for x in range(gray.width):
                    r, g, b = (px[x, y][0], px[x, y][1], px[x, y][2])
                    spx[x, y] = (min(255, int(r * 0.393 + g * 0.769 + b * 0.189)), min(255, int(r * 0.349 + g * 0.686 + b * 0.168)), min(255, int(r * 0.272 + g * 0.534 + b * 0.131)))
            pil = sepia.convert('RGBA')
            pil.putalpha(alpha)
        elif fid == 'contrast':
            pil = ImageEnhance.Contrast(pil).enhance(1.0 + 0.35 * k)
            pil = ImageEnhance.Color(pil).enhance(1.0 + 0.08 * k)
        elif fid == 'fade':
            pil = ImageEnhance.Color(pil).enhance(1.0 - 0.25 * k)
            pil = ImageEnhance.Brightness(pil).enhance(1.0 + 0.06 * k)
            pil = ImageEnhance.Contrast(pil).enhance(1.0 - 0.08 * k)
        elif fid == 'neon':
            pil = ImageEnhance.Color(pil).enhance(1.0 + 0.55 * k)
            pil = ImageEnhance.Contrast(pil).enhance(1.0 + 0.15 * k)
        elif fid == 'fresh':
            pil = ImageEnhance.Color(pil).enhance(1.0 + 0.35 * k)
        else:
            return image
    except Exception:
        return image