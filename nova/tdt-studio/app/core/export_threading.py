'Luồng FFmpeg khi xuất — tách khỏi video_export.'
from services_media import _cpu_threads

def resolve_export_threading(filter_complex: str, *, heavy_filters: bool) -> tuple[str, str, str]:
    import os
    base = max(1, int(_cpu_threads()))
    fc = filter_complex or ''
    xfade_n = fc.count('xfade=')
    overlay_n = fc.count('overlay=')
    step_n = fc.count(';') + (1 if fc.strip() else 0)
    has_geq = 'all_expr=' in fc or 'geq=' in fc
    legacy = str(os.environ.get('VTP_EXPORT_LEGACY_SPEED', '') or '').strip() in frozenset({'yes', '1', 'true', 'on'})
    danger_graph = has_geq or overlay_n >= 6 or (xfade_n >= 4 and overlay_n >= 2)
    if legacy:
        danger_graph = danger_graph or bool(heavy_filters) or step_n >= 80
    elif bool(heavy_filters) and has_geq:
        danger_graph = True
    if danger_graph:
        enc = max(1, min(8, base))
        simple = max(1, min(4, base))
        return (str(enc), str(simple), '1')
    enc = max(1, min(8, base))
    simple = max(1, min(4, base))
    if xfade_n >= 2 and (not has_geq) and (overlay_n < 2):
        return (str(enc), str(simple), '1')
    if step_n >= 40 and (not has_geq) and (overlay_n < 2):
        complex_n = max(2, min(4, base // 2 or 2))
        return (str(enc), str(simple), str(complex_n))
    complex_n = max(1, min(8, base))
    return ('0', str(base), str(complex_n))