'Chồng LUT .cube từ thư mục Lut_mau — look video chính, không phải hiệu ứng.'
from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from typing import Any
from core.paths import PATHS
LUT_STACK_MAX = 8
DEFAULT_LUT_STRENGTH = 80
LUT_EXTENSIONS = {'.cube'}
_GROUP_LABELS: 'tuple[tuple[str, str], ...]' = (('cube_lut', '.cube LUT'), ('buttery', 'Buttery'), ('halcyon', 'Halcyon'), ('iwl_std', 'IWLTBAP'), ('iwl_log', 'LOG'), ('iwl_util', 'Util'), ('iwl_bonus', 'Bonus'), ('pack', 'Pack'), ('luts', 'luts'), ('neumann', 'Neumann'), ('other', 'Khác'))

def lut_root() -> Path:
    return PATHS.root / 'Lut_mau'

def _group_for_rel(rel: str) -> str:
    posix = rel.replace('\\', '/')
    low = posix.lower()
    return 'cube_lut' if low.startswith('.cube lut/') or low.startswith('.cube lut\\') else 'buttery' if low.startswith('buttery') else 'halcyon' if low.startswith('halcyon') else 'neumann' if low.startswith('neumann') else 'iwl_util' if '/07 - utility/' in low or '/07 - utility\\' in low else 'iwl_bonus' if '/08 - bonus/' in low else 'iwl_log' if '/02 - generic log/' in low else 'iwl_std' if low.startswith('iwltbap') else 'pack' if low.startswith('lut_mau/') else 'luts' if low.startswith('luts/') or low == 'luts' else 'other'

def _display_title(path: Path) -> str:
    return path.stem.replace('_', ' ').strip() or path.name

@lru_cache(maxsize=1)
def list_lut_catalog() -> tuple[dict[str, str], ...]:
    root = lut_root()
    if root.is_dir():
        items = []
        for path in sorted(root.rglob('*'), key=lambda p: str(p).lower()):
            rel = path.relative_to(root).as_posix()
            if not path.is_file() or path.suffix.lower() not in LUT_EXTENSIONS or '/2 - luts by iwltbap (3dl)/' in f'/{rel.lower()}/':
                pass
            else:
                items.append({'rel': rel, 'path': str(path), 'title': _display_title(path), 'group': _group_for_rel(rel)})
        return tuple(items)
    return ()

def lut_group_nav() -> list[tuple[str, str]]:
    present = {str(item.get('group') or '') for item in list_lut_catalog()}
    nav = [('Có sẵn', 'builtin'), ('Tất cả', 'all')]
    for key, label in _GROUP_LABELS:
        if key in present:
            nav.append((label, key))
    return nav

def add_lut_to_stack(raw: Any, rel: str) -> list[dict[str, Any]]:
    stack = normalize_lut_stack(raw)
    rel_n = str(rel or '').replace('\\', '/').strip()
    entry = lut_entry_by_rel(rel_n)
    if entry is None:
        pass
    else:
        for item in stack:
            if item['rel'] == rel_n:
                item['enabled'] = True
                if int(item['strength']) <= 0:
                    item['strength'] = DEFAULT_LUT_STRENGTH
                return stack
        if len(stack) >= LUT_STACK_MAX:
            stack.pop(0)
        stack.append({'rel': rel_n, 'enabled': True, 'strength': DEFAULT_LUT_STRENGTH, 'title': entry['title']})
    return stack

def lut_entry_by_rel(rel: str) -> dict[str, str] | None:
    wanted = str(rel or '').replace('\\', '/').strip()
    if wanted:
        for item in list_lut_catalog():
            if item['rel'] == wanted:
                return item
    else:
        return None

def clamp_lut_strength(value: Any) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return DEFAULT_LUT_STRENGTH

def normalize_lut_stack(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, (list, tuple)):
        out = []
        seen = set()
        for item in raw:
            rel = str(item.get('rel') or item.get('id') or '').replace('\\', '/').strip()
            entry = lut_entry_by_rel(rel)
            if not isinstance(item, dict) or not rel or rel in seen or (entry is None):
                pass
            else:
                seen.add(rel)
                out.append({'rel': rel, 'enabled': bool(item.get('enabled', True)), 'strength': clamp_lut_strength(item.get('strength', DEFAULT_LUT_STRENGTH)), 'title': entry['title']})
                if len(out) >= LUT_STACK_MAX:
                    return out
        return out
    return []

def lut_stack_master_enabled(values: Any) -> bool:
    return bool(values.get('color_lut_stack_master_enabled', True)) if isinstance(values, dict) else bool(getattr(values, 'color_lut_stack_master_enabled', True))

def active_lut_layers(raw: Any, *, master: bool) -> list[dict[str, Any]]:
    return [item for item in normalize_lut_stack(raw) if item['enabled'] and int(item['strength']) > 0] if master else []

def lut_stack_fingerprint(raw: Any, *, master: bool) -> tuple:
    return tuple(((str(item['rel']), bool(item['enabled']), int(item['strength'])) for item in normalize_lut_stack(raw))) if master else (('off',),)

def ffmpeg_lut_file_arg(path: Path) -> str:
    text = path.resolve().as_posix().replace('\\', '/')
    return text.replace('\\', '/').replace(':', '\\:').replace("'", "\\'")

def lut3d_filter(path: Path) -> str:
    return f"lut3d=file='{ffmpeg_lut_file_arg(path)}':interp=trilinear"

def _default_merged_lut_path(stack: Any) -> Path:
    import hashlib
    key = hashlib.sha1(repr(lut_stack_fingerprint(stack, master=True)).encode('utf-8')).hexdigest()[:16]
    folder = PATHS.user_data / 'cache' / 'lut_merge'
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f'{key}.cube'

def write_merged_lut_cube(stack: Any, dest: Path) -> bool:
    layers = active_lut_layers(stack, master=True)
    if layers:
        root = lut_root()
        loaded = []
        for layer in layers:
            table = load_lut_table(root / str(layer['rel']))
            if table is None:
                pass
            else:
                loaded.append((table, int(layer['strength']) / 100.0))
        if loaded:
            try:
                import numpy as np
            except Exception:
                return False
            size = max((int(table.shape[0]) for table, _k in loaded))
            size = max(2, min(64, size))
            idx = np.linspace(0.0, 1.0, size, dtype=np.float32)
            rgb = np.empty((size, size, size, 3), dtype=np.float32)
            rgb[..., 0] = idx[np.newaxis, np.newaxis, :]
            rgb[..., 1] = idx[np.newaxis, :, np.newaxis]
            rgb[..., 2] = idx[:, np.newaxis, np.newaxis]
            for table, strength in loaded:
                mapped = _trilinear_lut(rgb * 255.0, table).reshape(rgb.shape) / 255.0
                rgb = rgb * (1.0 - strength) + mapped * strength if strength < 0.999 else mapped
            dest.parent.mkdir(parents=True, exist_ok=True)
            lines = [f'LUT_3D_SIZE {size}']
            for blue in range(size):
                for green in range(size):
                    for red in range(size):
                        rr, gg, bb = rgb[blue, green, red]
                        lines.append(f'{float(rr):.6f} {float(gg):.6f} {float(bb):.6f}')
            dest.write_text('\n'.join(lines) + '\n', encoding='ascii')
            return dest.is_file() and dest.stat().st_size > 0
    return False

def resolve_export_lut_cube(stack: Any, *, merged_cube_path: Path | None) -> Path | None:
    layers = active_lut_layers(stack, master=True)
    if layers:
        root = lut_root()
        if len(layers) == 1 and int(layers[0]['strength']) >= 100:
            path = root / str(layers[0]['rel'])
            return path if path.is_file() else None
        dest = merged_cube_path or _default_merged_lut_path(stack)
        if dest.is_file() and dest.stat().st_size > 32:
            return dest
        if write_merged_lut_cube(stack, dest):
            return dest
        first = root / str(layers[0]['rel'])
        if first.is_file():
            return first
    else:
        return None

def append_lut_stack_filters(graph: list[str], current: str, stack: Any, *, uid: str, merged_cube_path: Path | None = None) -> str:
    cube = resolve_export_lut_cube(stack, merged_cube_path=merged_cube_path)
    if cube is None:
        return current
    out = f'{uid}0'
    graph.append(f'[{current}]{lut3d_filter(cube)}[{out}]')
    return out

def append_color_look_filters(graph: list[str], current: str, settings: Any, *, uid: str, merged_cube_path: Path | None = None) -> str:
    from core.video_look import color_filter_ffmpeg
    label = current
    builtin = color_filter_ffmpeg(str(getattr(settings, 'color_filter', 'none') or 'none'), int(getattr(settings, 'color_filter_strength', 70) or 70))
    if builtin:
        graph.append(f'[{label}]{builtin}[{uid}cf]')
        label = f'{uid}cf'
    stack = getattr(settings, 'color_lut_stack', None)
    if stack is None and isinstance(settings, dict):
        stack = settings.get('color_lut_stack')
    return append_lut_stack_filters(graph, label, stack, uid=f'{uid}lut', merged_cube_path=merged_cube_path) if lut_stack_master_enabled(settings) else label
_LUT_TABLE_CACHE: 'dict[str, Any]' = {}

def _parse_cube_table(path: Path):
    import numpy as np
    size = 0
    rows = []
    text = path.read_text(encoding='utf-8', errors='ignore')
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        key = parts[0].upper()
        if key == 'LUT_3D_SIZE' and len(parts) >= 2:
            size = int(float(parts[1]))
            continue
        if key in frozenset({'LUT_1D_SIZE', 'DOMAIN_MAX', 'TITLE', 'DOMAIN_MIN'}) or len(parts) < 3:
            continue
        try:
            rows.append([float(parts[0]), float(parts[1]), float(parts[2])])
        except ValueError:
            pass
    if size <= 1 or len(rows) < size * size * size:
        return None
    table = np.asarray(rows[:size * size * size], dtype=np.float32).reshape(size, size, size, 3)
    return np.clip(table, 0.0, 1.0)

def load_lut_table(path: Path):
    key = str(path.resolve())
    if key in _LUT_TABLE_CACHE:
        return _LUT_TABLE_CACHE[key]
    try:
        table = _parse_cube_table(path)
    except Exception:
        table = None
    _LUT_TABLE_CACHE[key] = table
    return table

def apply_lut_stack_qimage(image, stack: Any):
    layers = active_lut_layers(stack, master=True)
    if not layers or image is None or image.isNull():
        return image
    try:
        import numpy as np
        from PySide6.QtCore import Qt
        from PySide6.QtGui import QImage
    except Exception:
        return image
    src = image.convertToFormat(QImage.Format.Format_RGBA8888)
    orig_h, orig_w = (src.height(), src.width())
    max_edge = 360
    if max(orig_w, orig_h) > max_edge:
        src = src.scaled(max_edge, max_edge, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.FastTransformation)
    src = src.copy()
    h, w = (src.height(), src.width())
    buf = src.bits()
    arr = np.frombuffer(buf, dtype=np.uint8).reshape(h, src.bytesPerLine())
    rgba = np.ascontiguousarray(arr[:, :w * 4]).reshape(h, w, 4)
    rgb = rgba[:, :, :3].astype(np.float32)
    root = lut_root()
    for layer in layers:
        path = root / str(layer['rel'])
        table = load_lut_table(path)
        if table is None:
            pass
        else:
            mapped = _trilinear_lut(rgb, table)
            k = int(layer['strength']) / 100.0
            rgb = rgb * (1.0 - k) + mapped * k if k < 0.999 else mapped
    out = rgba.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    qimg = QImage(out.tobytes(), w, h, w * 4, QImage.Format.Format_RGBA8888).copy()
    if qimg.width() != orig_w or qimg.height() != orig_h:
        qimg = qimg.scaled(orig_w, orig_h, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
    return qimg

def _trilinear_lut(rgb: Any, table: Any):
    import numpy as np
    n = int(table.shape[0]) - 1
    pos = np.clip(rgb * (n / 255.0), 0.0, float(n))
    i0 = np.floor(pos).astype(np.int32)
    i1 = np.clip(i0 + 1, 0, n)
    f = pos - i0
    b0, g0, r0 = (i0['<ANTI-DIS: ellipsis Ellipsis>', 2], i0['<ANTI-DIS: ellipsis Ellipsis>', 1], i0['<ANTI-DIS: ellipsis Ellipsis>', 0])
    b1, g1, r1 = (i1['<ANTI-DIS: ellipsis Ellipsis>', 2], i1['<ANTI-DIS: ellipsis Ellipsis>', 1], i1['<ANTI-DIS: ellipsis Ellipsis>', 0])
    fb, fg, fr = (f['<ANTI-DIS: ellipsis Ellipsis>', 2:3], f['<ANTI-DIS: ellipsis Ellipsis>', 1:2], f['<ANTI-DIS: ellipsis Ellipsis>', 0:1])
    c000 = table[b0, g0, r0]
    c100 = table[b0, g0, r1]
    c010 = table[b0, g1, r0]
    c110 = table[b0, g1, r1]
    c001 = table[b1, g0, r0]
    c101 = table[b1, g0, r1]
    c011 = table[b1, g1, r0]
    c111 = table[b1, g1, r1]
    c00 = c000 * (1.0 - fr) + c100 * fr
    c01 = c001 * (1.0 - fr) + c101 * fr
    c10 = c010 * (1.0 - fr) + c110 * fr
    c11 = c011 * (1.0 - fr) + c111 * fr
    c0 = c00 * (1.0 - fg) + c10 * fg
    c1 = c01 * (1.0 - fg) + c11 * fg
    return (c0 * (1.0 - fb) + c1 * fb) * 255.0