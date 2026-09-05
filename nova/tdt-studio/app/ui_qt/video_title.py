from __future__ import annotations
from core.text_layout import clamp_box_center_norms, wrap_text_lines
from core.video_title import export_output_stem, normalize_title_language_mode, resolve_video_title, sanitize_title_stem, title_from_media_path, translate_video_title
TEXT_POSITION_NORMS: 'dict[str, tuple[float, float]]' = {'top': (0.5, 0.06), 'center': (0.5, 0.5), 'bottom': (0.5, 0.94)}

def clamp_norm(value: float, *, low: float, high: float) -> float:
    return max(low, min(high, float(value)))

def resolve_text_position_norms(position: str, x_norm: float, y_norm: float) -> tuple[float, float]:
    key = str(position or 'top').strip().lower()
    return (clamp_norm(x_norm), clamp_norm(y_norm)) if key == 'custom' else TEXT_POSITION_NORMS.get(key, TEXT_POSITION_NORMS['top'])
__all__ = ['TEXT_POSITION_NORMS', 'clamp_box_center_norms', 'clamp_norm', 'export_output_stem', 'normalize_title_language_mode', 'resolve_text_position_norms', 'resolve_video_title', 'sanitize_title_stem', 'title_from_media_path', 'translate_video_title', 'wrap_text_lines']