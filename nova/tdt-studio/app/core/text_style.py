from __future__ import annotations
import re
from pathlib import Path
_HEX_RE = re.compile('^#?[0-9A-Fa-f]{6}$')
TEXT_EFFECT_PRESETS: 'tuple[tuple[str, dict[str, object]], ...]' = (('Sạch', {'outline_width': 3, 'shadow_enabled': True, 'shadow_depth': 1, 'bg_enabled': False, 'bg_opacity': 55, 'bold': True, 'italic': False}), ('Shorts nổi', {'outline_width': 5, 'shadow_enabled': True, 'shadow_depth': 4, 'bg_enabled': False, 'bg_opacity': 55, 'bold': True, 'italic': False}), ('Nền hộp', {'outline_width': 2, 'shadow_enabled': False, 'shadow_depth': 0, 'bg_enabled': True, 'bg_color': '#000000', 'bg_opacity': 62, 'bold': True, 'italic': False}), ('Neon viền', {'outline_width': 6, 'shadow_enabled': True, 'shadow_depth': 3, 'bg_enabled': False, 'bg_opacity': 55, 'bold': True, 'italic': False, 'text_color': '#FFFFFF', 'outline_color': '#00E5FF'}), ('Karaoke vàng', {'outline_width': 5, 'shadow_enabled': True, 'shadow_depth': 3, 'bg_enabled': False, 'bg_opacity': 55, 'bold': True, 'italic': False, 'text_color': '#FFE066', 'outline_color': '#2D1B00'}))
BEAUTIFUL_TEXT_STYLE_PRESETS: 'tuple[tuple[str, dict[str, object]], ...]' = (('Classic Vàng', {'font': 'Be Vietnam Pro', 'color': '#FFFF00', 'outline': '#000000', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Trắng sạch', {'font': 'Be Vietnam Pro', 'color': '#FFFFFF', 'outline': '#000000', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Tin tức', {'font': 'Roboto', 'color': '#FFFFFF', 'outline': '#000000', 'effect': 'outline', 'bg': True, 'bg_opacity': 65}), ('Phim điện ảnh', {'font': 'Merriweather', 'color': '#FFFFFF', 'outline': '#111111', 'effect': 'shadow', 'bg': False, 'bg_opacity': 40}), ('Karaoke', {'font': 'Montserrat', 'color': '#FFFFFF', 'outline': '#000000', 'effect': 'outline_thick', 'bg': True, 'bg_opacity': 80}), ('Trắng nền đen', {'font': 'Roboto', 'color': '#FFFFFF', 'outline': '#000000', 'effect': 'outline', 'bg': True, 'bg_opacity': 90}), ('Cổ điển', {'font': 'Merriweather', 'color': '#F5DEB3', 'outline': '#3B2200', 'effect': 'shadow', 'bg': False, 'bg_opacity': 40}), ('Bóng mờ sang', {'font': 'Be Vietnam Pro', 'color': '#E0E0E0', 'outline': '#333333', 'effect': 'shadow', 'bg': False, 'bg_opacity': 40}), ('Neon Xanh', {'font': 'Roboto', 'color': '#00FFFF', 'outline': '#004444', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Hồng', {'font': 'Montserrat', 'color': '#FF69B4', 'outline': '#4B0032', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Vàng', {'font': 'Oswald', 'color': '#FFFF00', 'outline': '#4B4B00', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Tím', {'font': 'Be Vietnam Pro', 'color': '#BF5FFF', 'outline': '#2A0845', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Đỏ', {'font': 'Oswald', 'color': '#FF3333', 'outline': '#4B0000', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Xanh lá', {'font': 'Open Sans', 'color': '#39FF14', 'outline': '#0A3300', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Cam', {'font': 'Oswald', 'color': '#FF6F00', 'outline': '#3D1A00', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Neon Trắng', {'font': 'Be Vietnam Pro', 'color': '#FFFFFF', 'outline': '#333355', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Đỏ mạnh mẽ', {'font': 'Oswald', 'color': '#FF0000', 'outline': '#FFFFFF', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Cam TikTok', {'font': 'Oswald', 'color': '#FF6600', 'outline': '#000000', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Vàng đen', {'font': 'Oswald', 'color': '#FFD700', 'outline': '#000000', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Trắng viền đỏ', {'font': 'Bangers', 'color': '#FFFFFF', 'outline': '#CC0000', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Trắng viền xanh', {'font': 'Bangers', 'color': '#FFFFFF', 'outline': '#0055AA', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Đỏ viền vàng', {'font': 'Oswald', 'color': '#FF0000', 'outline': '#FFD700', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Xanh viền trắng', {'font': 'Oswald', 'color': '#00AAFF', 'outline': '#FFFFFF', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Gaming', {'font': 'Bangers', 'color': '#00FF41', 'outline': '#000000', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Gradient Cam', {'font': 'Montserrat', 'color': '#FFA500', 'outline': '#000000', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Vàng sang trọng', {'font': 'Merriweather', 'color': '#FFD700', 'outline': '#2D1B00', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Bạc ánh kim', {'font': 'Merriweather', 'color': '#C0C0C0', 'outline': '#222222', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Vàng hồng', {'font': 'Pacifico', 'color': '#F4A460', 'outline': '#3B1E00', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Ngọc trai', {'font': 'Merriweather', 'color': '#FFF5EE', 'outline': '#2F2F2F', 'effect': 'shadow', 'bg': False, 'bg_opacity': 40}), ('Tím ma thuật', {'font': 'Lobster', 'color': '#A855F7', 'outline': '#1A0533', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('Xanh lá', {'font': 'Open Sans', 'color': '#00FF00', 'outline': '#003300', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Xanh dương', {'font': 'Open Sans', 'color': '#3B82F6', 'outline': '#000000', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Hồng dễ thương', {'font': 'Dancing Script', 'color': '#FF91A4', 'outline': '#5C0029', 'effect': 'glow', 'bg': False, 'bg_opacity': 40}), ('San hô', {'font': 'Roboto', 'color': '#FF7F7F', 'outline': '#4A0000', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Xanh mint', {'font': 'Be Vietnam Pro', 'color': '#98FFB3', 'outline': '#003318', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Tím pastel', {'font': 'Be Vietnam Pro', 'color': '#D8B4FE', 'outline': '#2D0A4E', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Hồng pastel', {'font': 'Be Vietnam Pro', 'color': '#FFB3D9', 'outline': '#4A0028', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Xanh pastel', {'font': 'Be Vietnam Pro', 'color': '#A3D5FF', 'outline': '#002244', 'effect': 'outline', 'bg': False, 'bg_opacity': 40}), ('Cam cháy', {'font': 'Oswald', 'color': '#FF4500', 'outline': '#000000', 'effect': 'shadow', 'bg': False, 'bg_opacity': 40}), ('Xanh navy', {'font': 'Montserrat', 'color': '#4169E1', 'outline': '#FFFFFF', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Nền đỏ chữ trắng', {'font': 'Roboto', 'color': '#FFFFFF', 'outline': '#CC0000', 'effect': 'outline', 'bg': True, 'bg_opacity': 75}), ('Nền xanh chữ trắng', {'font': 'Open Sans', 'color': '#FFFFFF', 'outline': '#0066CC', 'effect': 'outline', 'bg': True, 'bg_opacity': 75}), ('Nền vàng chữ đen', {'font': 'Montserrat', 'color': '#000000', 'outline': '#FFD700', 'effect': 'outline', 'bg': True, 'bg_opacity': 70}), ('Nền tím chữ trắng', {'font': 'Roboto', 'color': '#FFFFFF', 'outline': '#6B21A8', 'effect': 'outline', 'bg': True, 'bg_opacity': 75}), ('Hacker', {'font': 'Source Code Pro', 'color': '#00FF00', 'outline': '#001100', 'effect': 'glow', 'bg': True, 'bg_opacity': 85}), ('Retro', {'font': 'Bangers', 'color': '#FFD700', 'outline': '#FF4500', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Đen trắng', {'font': 'Merriweather', 'color': '#000000', 'outline': '#FFFFFF', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}), ('Trắng mờ', {'font': 'Be Vietnam Pro', 'color': '#FFFFFF', 'outline': '#555555', 'effect': 'shadow', 'bg': False, 'bg_opacity': 40}), ('Subtitle Pro', {'font': 'Montserrat', 'color': '#EEEEEE', 'outline': '#111111', 'effect': 'outline_thick', 'bg': False, 'bg_opacity': 40}))
_BEAUTIFUL_EFFECT_LOOK: 'dict[str, dict[str, object]]' = {'outline': {'outline_width': 3, 'shadow_enabled': False, 'shadow_depth': 0}, 'outline_thick': {'outline_width': 6, 'shadow_enabled': False, 'shadow_depth': 0}, 'glow': {'outline_width': 5, 'shadow_enabled': True, 'shadow_depth': 3}, 'shadow': {'outline_width': 2, 'shadow_enabled': True, 'shadow_depth': 4}}

def normalize_hex_color(value: str, *, default: str) -> str:
    text = str(value or '').strip()
    if text:
        if not text.startswith('#'):
            text = f'#{text}'
        return f'#{text[1:].upper()}' if _HEX_RE.match(text) else default.upper()
    return default.upper()

def ffmpeg_drawtext_color(hex_color: str, *, alpha: float) -> str:
    normalized = normalize_hex_color(hex_color)
    rgb = normalized[1:]
    alpha = max(0.0, min(1.0, float(alpha)))
    return f'0x{rgb}' if alpha >= 0.999 else f'{rgb}@{alpha}g'

def ass_colour(hex_color: str, *, alpha_percent: int) -> str:
    normalized = normalize_hex_color(hex_color, default='#FFFFFF')
    red = normalized[1:3]
    green = normalized[3:5]
    blue = normalized[5:7]
    alpha = max(0, min(100, int(alpha_percent)))
    aa = '02X'
    return f'&H{aa}{blue}{green}{red}'.upper()

def resolve_windows_font_file(family: str, *, bold: bool) -> str:
    name = str(family or 'Arial').strip() or 'Arial'
    fonts_dir = Path('C:/Windows/Fonts')
    if fonts_dir.is_dir():
        lowered = name.lower().replace(' ', '')
        candidates = []
        for path in fonts_dir.iterdir():
            stem = path.stem.lower().replace(' ', '')
            if path.suffix.lower() in frozenset({'.otf', '.ttc', '.ttf'}) and (lowered in stem or stem.startswith(lowered)):
                candidates.append(path)
        if candidates:
            bold_markers = ('bd', 'bold', 'heavy', 'black')
            if bold:
                for path in candidates:
                    stem = path.stem.lower()
                    if any((marker in stem for marker in bold_markers)):
                        return str(path)
                for path in candidates:
                    stem = path.stem.lower()
                    if any((marker in stem for marker in bold_markers)):
                        continue
                    return str(path)
                return str(candidates[0])
        else:
            fallback = fonts_dir / ('arialbd.ttf' if bold else 'arial.ttf')
            return str(fallback) if fallback.is_file() else ''
    else:
        return ''

def apply_text_effect_preset(values: dict[str, object], prefix: str, preset_label: str) -> None:
    matched = None
    for label, payload in TEXT_EFFECT_PRESETS:
        if label == preset_label:
            matched = dict(payload)
    if matched is None:
        return None
    key_map = {'outline_width': f'{prefix}_outline_width', 'shadow_enabled': f'{prefix}_shadow_enabled', 'shadow_depth': f'{prefix}_shadow_depth', 'bg_enabled': f'{prefix}_bg_enabled', 'bg_color': f'{prefix}_bg_color', 'bg_opacity': f'{prefix}_bg_opacity', 'bold': f'{prefix}_bold', 'italic': f'{prefix}_italic', 'text_color': f'{prefix}_text_color', 'outline_color': f'{prefix}_outline_color'}
    for src, dest in key_map.items():
        if src in matched:
            values[dest] = matched[src]

def beautiful_text_style_labels() -> tuple[str, ...]:
    return tuple((label for label, _payload in BEAUTIFUL_TEXT_STYLE_PRESETS))

def apply_beautiful_text_style_preset(values: dict[str, object], prefix: str, preset_label: str) -> bool:
    matched = None
    for label, payload in BEAUTIFUL_TEXT_STYLE_PRESETS:
        if label == preset_label:
            matched = dict(payload)
    if matched is None:
        return False
    effect = str(matched.get('effect') or 'outline')
    look = dict(_BEAUTIFUL_EFFECT_LOOK.get(effect, _BEAUTIFUL_EFFECT_LOOK['outline']))
    values[f'{prefix}_font'] = str(matched.get('font') or 'Arial')
    values[f'{prefix}_text_color'] = normalize_hex_color(str(matched.get('color') or '#FFFFFF'))
    values[f'{prefix}_outline_color'] = normalize_hex_color(str(matched.get('outline') or '#000000'), default='#000000')
    values[f'{prefix}_outline_width'] = int(look['outline_width'])
    values[f'{prefix}_shadow_enabled'] = bool(look['shadow_enabled'])
    values[f'{prefix}_shadow_depth'] = int(look['shadow_depth'])
    bg_on = bool(matched.get('bg'))
    values[f'{prefix}_bg_enabled'] = bg_on
    values[f'{prefix}_bg_opacity'] = int(matched.get('bg_opacity', 40) or 40)
    if bg_on and (not values.get(f'{prefix}_bg_color')):
        values[f'{prefix}_bg_color'] = '#000000'
    values[f'{prefix}_bold'] = True
    return True
_BEAUTIFUL_FONT_FILES: 'dict[str, str]' = {'Be Vietnam Pro': 'BeVietnamPro-Regular.ttf', 'Roboto': 'Roboto-Regular.ttf', 'Montserrat': 'Montserrat-Regular.ttf', 'Open Sans': 'OpenSans-Regular.ttf', 'Oswald': 'Oswald-Regular.ttf', 'Merriweather': 'Merriweather-Regular.ttf', 'Source Code Pro': 'SourceCodePro-Regular.ttf', 'Dancing Script': 'DancingScript-Regular.otf', 'Pacifico': 'Pacifico-Regular.ttf', 'Bangers': 'Bangers-Regular.ttf', 'Lobster': 'Lobster-Regular.ttf'}
_PREVIEW_CACHE: 'dict[tuple[str, int, int], bytes]' = {}

def _hex_rgb(value: str, *, default: tuple[int, int, int]) -> tuple[int, int, int]:
    text = str(value or '').strip().lstrip('#')
    if len(text) == 6:
        try:
            return (int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))
        except ValueError:
            return default
    return default

def _resolve_preview_font(font_name: str, size: int):
    from PIL import ImageFont
    from core.paths import PATHS
    file_name = _BEAUTIFUL_FONT_FILES.get(str(font_name or '').strip(), 'BeVietnamPro-Regular.ttf')
    candidates = [PATHS.fonts / file_name, Path('C:/Windows/Fonts') / 'segoeui.ttf', Path('C:/Windows/Fonts') / 'arial.ttf']
    for path in candidates:
        if path.is_file():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                pass
    return ImageFont.load_default()

def render_beautiful_text_preview_png(preset_label: str, *, width: int, height: int, sample_text: str) -> bytes:
    cache_key = (preset_label, int(width), int(height))
    cached = _PREVIEW_CACHE.get(cache_key)
    if cached:
        return cached
    matched = None
    for label, payload in BEAUTIFUL_TEXT_STYLE_PRESETS:
        if label == preset_label:
            matched = dict(payload)
    if matched is None:
        return b''
    try:
        from io import BytesIO
        from PIL import Image, ImageDraw
    except ImportError:
        return b''
    color = _hex_rgb(str(matched.get('color') or '#FFFFFF'))
    outline = _hex_rgb(str(matched.get('outline') or '#000000'), default=(0, 0, 0))
    bg_on = bool(matched.get('bg'))
    bg_op = max(10, min(100, int(matched.get('bg_opacity', 40) or 40)))
    effect = str(matched.get('effect') or 'outline')
    font = _resolve_preview_font(str(matched.get('font') or 'Be Vietnam Pro'), 22)
    img = Image.new('RGB', (max(80, int(width)), max(36, int(height))), (40, 40, 48))
    draw = ImageDraw.Draw(img)
    text = str(sample_text or 'Phụ đề mẫu')
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
    except Exception:
        tw, th = ((120, 24)[0], (120, 24)[1])
    tx = max(4, (img.width - tw) // 2)
    ty = max(2, (img.height - th) // 2 - 2)
    if bg_on:
        pad = 8
        alpha = bg_op / 100.0
        blended = tuple((int(round(channel * (1.0 - alpha) + 40 * alpha)) for channel in color))
        draw.rectangle([tx - pad, ty - pad // 2, tx + tw + pad, ty + th + pad // 2], fill=blended)

    def _stroke(ow: int, *, full: bool) -> None:
        offs = ((-ow, -ow), (-ow, 0), (-ow, ow), (0, -ow), (0, ow), (ow, -ow), (ow, 0), (ow, ow)) if full else ((-ow, 0), (ow, 0), (0, -ow), (0, ow))
        for dx, dy in offs:
            draw.text((tx + dx, ty + dy), text, font=font, fill=outline)
    if effect == 'outline':
        _stroke(2, full=False)
        draw.text((tx, ty), text, font=font, fill=color)
        buf = BytesIO()
        img.save(buf, format='PNG')
        data = buf.getvalue()
        _PREVIEW_CACHE[cache_key] = data
        return data
    if effect in frozenset({'double_border', 'outline_thick'}):
        _stroke(3, full=True)
    elif effect == 'glow':
        _stroke(2, full=True)
        _stroke(3, full=False)
    elif effect in frozenset({'emboss', 'shadow', 'long_shadow', 'soft_shadow'}):
        offs = 3 if effect == 'long_shadow' else 2
        draw.text((tx + offs, ty + offs), text, font=font, fill=outline)
    elif effect == 'hollow':
        _stroke(2, full=True)
        buf = BytesIO()
        img.save(buf, format='PNG')
        data = buf.getvalue()
        _PREVIEW_CACHE[cache_key] = data
        return data

def text_effect_defaults(prefix: str) -> dict[str, object]:
    return {f'{prefix}_outline_width': 3, f'{prefix}_shadow_enabled': True, f'{prefix}_shadow_depth': 1, f'{prefix}_bg_enabled': False, f'{prefix}_bg_color': '#000000', f'{prefix}_bg_opacity': 55, f'{prefix}_bold': True, f'{prefix}_italic': False}