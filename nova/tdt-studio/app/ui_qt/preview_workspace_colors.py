'Màu pasteboard / khung canvas preview — preset theme + chỉnh tay hex.'
from __future__ import annotations
import re
_HEX_RE = re.compile('^#[0-9A-Fa-f]{6}$')
WORKSPACE_THEME_PRESETS: 'dict[str, tuple[str, str]]' = {'dark': ('#121820', '#05070C'), 'medium': ('#2A3545', '#0B1018'), 'light': ('#4A5568', '#0E141C')}
DEFAULT_WORKSPACE_COLOR = WORKSPACE_THEME_PRESETS['dark'][0]
DEFAULT_CANVAS_COLOR = WORKSPACE_THEME_PRESETS['dark'][1]

def normalize_theme_id(value: object) -> str:
    text = str(value or 'dark').strip().lower()
    return 'light' if text in frozenset({'sang', 'sáng'}) else 'medium' if text in frozenset({'mid', 'trung'}) else text if text in WORKSPACE_THEME_PRESETS else 'dark'

def normalize_hex_color(value: object, *, default: str) -> str:
    text = str(value or '').strip()
    if text:
        if not text.startswith('#'):
            text = f'#{text}'
        return text.upper() if _HEX_RE.match(text) else default.upper()
    return default.upper()

def theme_preset_colors(theme: object) -> tuple[str, str]:
    key = normalize_theme_id(theme)
    return WORKSPACE_THEME_PRESETS[key]

def apply_workspace_theme_preset(values: dict[str, object], theme: object) -> None:
    workspace, canvas = (theme_preset_colors(theme)[0], theme_preset_colors(theme)[1])
    values['preview_workspace_theme'] = normalize_theme_id(theme)
    values['preview_workspace_color'] = workspace
    values['preview_canvas_color'] = canvas

def resolve_workspace_color(values: dict[str, object] | None) -> str:
    data = values or {}
    theme = normalize_theme_id(data.get('preview_workspace_theme', 'dark'))
    fallback = WORKSPACE_THEME_PRESETS[theme][0]
    return normalize_hex_color(data.get('preview_workspace_color'), default=fallback)

def resolve_canvas_color(values: dict[str, object] | None) -> str:
    data = values or {}
    theme = normalize_theme_id(data.get('preview_workspace_theme', 'dark'))
    fallback = WORKSPACE_THEME_PRESETS[theme][1]
    return normalize_hex_color(data.get('preview_canvas_color'), default=fallback)