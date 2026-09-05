'Kích thước / crop / scale — tách khỏi video_export, không import video_export.'
QUALITY_DIMENSIONS = {'720p': (720, 1280), '1080p': (1080, 1920), '1440p': (1440, 2560), '2160p': (2160, 3840)}

def _even(value: int) -> int:
    return max(2, int(value) - int(value) % 2)

def resolve_target_size(aspect_ratio: str, quality: str) -> tuple[int, int]:
    short, long = (QUALITY_DIMENSIONS[quality][0], QUALITY_DIMENSIONS[quality][1])
    if aspect_ratio == '9:16':
        return (_even(short), _even(long))
    if aspect_ratio == '16:9':
        return (_even(long), _even(short))
    if aspect_ratio == '1:1':
        return (_even(short), _even(short))
    if aspect_ratio == '4:5':
        return (_even(short), _even(round(short * 5 / 4)))
    if aspect_ratio == '3:4':
        return (_even(short), _even(round(short * 4 / 3)))
    if aspect_ratio == '2:3':
        return (_even(short), _even(round(short * 3 / 2)))
    if aspect_ratio == '21:9':
        return (_even(round(short * 21 / 9)), _even(short))
    raise ValueError('Tỷ lệ khung không hợp lệ')

def resolve_scale_xy(scale_percent: int, scale_x_percent: int | None=None, scale_y_percent: int | None=None) -> tuple[int, int]:
    base = max(10, min(500, int(scale_percent)))
    if scale_x_percent is None and scale_y_percent is None:
        return (base, base)
    sx = base if scale_x_percent is None else int(scale_x_percent)
    sy = base if scale_y_percent is None else int(scale_y_percent)
    sx = max(10, min(500, sx))
    sy = max(10, min(500, sy))
    return (base, base) if sx == 100 and sy == 100 and (base != 100) else (sx, sy)

def resolve_crop_norm(enabled: bool, left: float=0.0, top: float=0.0, right: float=1.0, bottom: float=1.0, *, min_size: float=0.05) -> tuple[float, float, float, float] | None:
    if enabled:
        left_v = max(0.0, min(1.0 - min_size, float(left)))
        top_v = max(0.0, min(1.0 - min_size, float(top)))
        right_v = max(min_size, min(1.0, float(right)))
        bottom_v = max(min_size, min(1.0, float(bottom)))
        if right_v - left_v < min_size:
            right_v = min(1.0, left_v + min_size)
            left_v = max(0.0, right_v - min_size)
        if bottom_v - top_v < min_size:
            bottom_v = min(1.0, top_v + min_size)
            top_v = max(0.0, bottom_v - min_size)
        return None if left_v <= 0.0001 and top_v <= 0.0001 and (right_v >= 0.9999) and (bottom_v >= 0.9999) else (round(left_v, 6), round(top_v, 6), round(right_v, 6), round(bottom_v, 6))

def crop_filter_expression(left: float, top: float, right: float, bottom: float) -> str:
    width = max(1e-06, right - left)
    height = max(1e-06, bottom - top)
    return f'{height:g}:iw*{left:g}:ih*{top:g}'

def effective_source_pixel_size(source_width: int, source_height: int, crop_norm: tuple[float, float, float, float] | None) -> tuple[int, int]:
    sw = int(source_width or 0)
    sh = int(source_height or 0)
    if sw <= 0 or sh <= 0:
        return (sw, sh)
    if crop_norm is None:
        return (sw, sh)
    left, top, right, bottom = (crop_norm[0], crop_norm[1], crop_norm[2], crop_norm[3])
    return (max(1, int(round(sw * (right - left)))), max(1, int(round(sh * (bottom - top)))))

def center_crop_norm_for_aspect(source_width: int, source_height: int, output_ratio: float, *, cover: float) -> tuple[float, float, float, float]:
    src_w = max(1, int(source_width))
    src_h = max(1, int(source_height))
    out_ratio = max(0.05, float(output_ratio))
    norm_aspect = out_ratio * src_h / src_w
    cover = max(0.05, min(1.0, float(cover)))
    if norm_aspect >= 1.0:
        width = 1.0 * cover
        height = width / norm_aspect
        if height > 1.0:
            height = 1.0
            width = height * norm_aspect
    else:
        height = 1.0 * cover
        width = height * norm_aspect
        if width > 1.0:
            width = 1.0
            height = width / norm_aspect
    left = max(0.0, (1.0 - width) / 2.0)
    top = max(0.0, (1.0 - height) / 2.0)
    right = min(1.0, left + width)
    bottom = min(1.0, top + height)
    return (round(left, 6), round(top, 6), round(right, 6), round(bottom, 6))

def aspect_ratio_value(aspect_ratio: str) -> float:
    mapping = {'9:16': 0.5625, '16:9': 1.7777777777777777, '1:1': 1.0, '4:5': 0.8, '3:4': 0.75, '2:3': 0.6666666666666666, '21:9': 2.3333333333333335}
    value = str(aspect_ratio or '9:16').strip()
    if value in mapping:
        return mapping[value]
    if ':' in value:
        left, right = (value.split(':', 1)[0], value.split(':', 1)[1])
        try:
            width = float(left)
            height = float(right)
            if width <= 0 or height <= 0:
                return 0.5625
        except ValueError:
            return 0.5625
    else:
        return 0.5625

def background_blur_radius_from_strength(strength_percent: int) -> int:
    strength = max(0, min(100, int(strength_percent)))
    return 0 if strength <= 0 else max(1, round(strength * 40 / 100))

def contain_size(source_width: int, source_height: int, box_width: int, box_height: int) -> tuple[int, int]:
    src_w = max(1, int(source_width))
    src_h = max(1, int(source_height))
    box_w = max(2, int(box_width))
    box_h = max(2, int(box_height))
    scale = min(box_w / src_w, box_h / src_h)
    width = max(2, int(round(src_w * scale / 2.0) * 2))
    height = max(2, int(round(src_h * scale / 2.0) * 2))
    return (width, height)

def resolve_foreground_pixel_size(*, source_width: int, source_height: int, target_width: int, target_height: int, scale_x_percent: int, scale_y_percent: int) -> tuple[int, int]:
    sx = max(10, min(500, int(scale_x_percent))) / 100.0
    sy = max(10, min(500, int(scale_y_percent))) / 100.0
    if source_width > 0 and source_height > 0:
        base_w, base_h = (contain_size(source_width, source_height, target_width, target_height)[0], contain_size(source_width, source_height, target_width, target_height)[1])
        full_w = base_w * sx
        full_h = base_h * sy
    else:
        full_w = target_width * sx
        full_h = target_height * sy
    return (max(2, int(round(full_w / 2.0) * 2)), max(2, int(round(full_h / 2.0) * 2)))

def foreground_zoom_crop_filter(scale_x_percent: int, scale_y_percent: int) -> str | None:
    sx = max(10, min(500, int(scale_x_percent))) / 100.0
    sy = max(10, min(500, int(scale_y_percent))) / 100.0
    if sx <= 1.001 and sy <= 1.001:
        return None
    cw = f'{sx}g' if sx > 1.001 else 'iw'
    ch = f'{sy}g' if sy > 1.001 else 'ih'
    return f'crop={cw}:{ch}:(iw-ow)/2:(ih-oh)/2'