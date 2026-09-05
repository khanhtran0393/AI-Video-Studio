from __future__ import annotations
from copy import deepcopy
DEFAULT_BLUR_ZONE = {'enabled': True, 'y': 0.82, 'height': 0.18, 'x': 0.04, 'width': 0.92, 'rotation_degrees': 0.0}

def default_blur_zones(position: str='bottom', height_percent: int=18) -> list[dict]:
    height = max(0.05, min(0.9, height_percent / 100))
    y = 0.0 if position == 'top' else max(0.0, 1.0 - height)
    width = 0.92
    x = max(0.0, (1.0 - width) / 2.0)
    return [dict(DEFAULT_BLUR_ZONE, y=y, height=height, x=x, width=width)]

def ensure_blur_zones(values: dict[str, object]) -> list[dict]:
    raw = values.get('blur_zones')
    zones = []
    if isinstance(raw, (list, tuple)):
        for item in raw:
            if isinstance(item, dict):
                zones.append(_normalize_zone(item))
    if not zones:
        zones = default_blur_zones(str(values.get('blur_zone_position', 'bottom')), int(values.get('blur_zone_height_percent', 18)))
    values['blur_zones'] = zones
    index = int(values.get('blur_zone_index', 0))
    values['blur_zone_index'] = max(0, min(index, len(zones) - 1))
    return zones

def selected_blur_zone(values: dict[str, object]) -> dict:
    zones = ensure_blur_zones(values)
    return zones[int(values.get('blur_zone_index', 0))]

def sync_selected_blur_from_controls(values: dict[str, object]) -> None:
    zones = ensure_blur_zones(values)
    index = int(values.get('blur_zone_index', 0))
    zone = zones[index]
    height = max(0.05, min(0.9, int(values.get('blur_zone_height_percent', 18)) / 100))
    position = str(values.get('blur_zone_position', 'bottom'))
    zone['enabled'] = True
    zone['height'] = height
    zone['y'] = 0.0 if position == 'top' else max(0.0, 1.0 - height)
    zone['width'] = max(0.05, min(1.0, float(zone.get('width', 0.92))))
    zone['x'] = max(0.0, min(1.0 - zone['width'], float(zone.get('x', 0.0))))
    zone['rotation_degrees'] = float(values.get('blur_zone_rotation_degrees', zone.get('rotation_degrees', 0)) or 0) % 360.0
    zones[index] = zone
    values['blur_zones'] = zones

def sync_controls_from_selected_blur(values: dict[str, object]) -> None:
    zone = selected_blur_zone(values)
    height = max(5, min(90, round(float(zone.get('height', 0.18)) * 100)))
    values['blur_zone_height_percent'] = height
    values['blur_zone_position'] = 'top' if float(zone.get('y', 0.82)) <= 0.2 else 'bottom'
    values['blur_zone_enabled'] = True
    values['blur_zone_rotation_degrees'] = float(zone.get('rotation_degrees', 0) or 0)

def add_blur_zone(values: dict[str, object]) -> None:
    zones = ensure_blur_zones(values)
    zones.append(dict(DEFAULT_BLUR_ZONE, y=0.35, height=0.12, x=0.1, width=0.8))
    values['blur_zones'] = zones
    values['blur_zone_index'] = len(zones) - 1
    sync_controls_from_selected_blur(values)

def remove_selected_blur_zone(values: dict[str, object]) -> bool:
    zones = ensure_blur_zones(values)
    if len(zones) <= 1:
        return False
    index = int(values.get('blur_zone_index', 0))
    zones.pop(index)
    values['blur_zones'] = zones
    values['blur_zone_index'] = max(0, min(index, len(zones) - 1))
    sync_controls_from_selected_blur(values)
    return True

def exportable_blur_zones(values: dict[str, object]) -> list[dict]:
    if values.get('blur_zone_enabled'):
        zones = ensure_blur_zones(values)
        style = str(values.get('blur_zone_style', 'blur') or 'blur').strip().lower()
        if style not in frozenset({'blur', 'black', 'color'}):
            style = 'blur'
        strength = int(values.get('blur_strength', 20))
        color = str(values.get('blur_zone_color', '#000000') or '#000000').strip()
        if not color.startswith('#'):
            color = f'#{color}'
        result = []
        for zone in zones:
            if zone.get('enabled', True):
                item = deepcopy(zone)
                item['style'] = style
                item['strength'] = strength
                item['color'] = color
                result.append(item)
        return result
    return []

def _normalize_zone(item: dict) -> dict:
    height = max(0.05, min(0.9, float(item.get('height', 0.18))))
    width = max(0.05, min(1.0, float(item.get('width', 0.92))))
    x = max(0.0, min(1.0 - width, float(item.get('x', 0.0))))
    y = max(0.0, min(1.0 - height, float(item.get('y', 0.82))))
    rot = float(item.get('rotation_degrees', 0) or 0) % 360.0
    return {'enabled': bool(item.get('enabled', True)), 'y': y, 'height': height, 'x': x, 'width': width, 'rotation_degrees': rot}