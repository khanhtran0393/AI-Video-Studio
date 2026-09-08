'Chồng nhiều hiệu ứng khung (grain + vignette + REC…) — giống LUT stack.'
from __future__ import annotations
from copy import deepcopy
from typing import Any
from core.video_look import VIDEO_EFFECT_CHOICES, VIDEO_EFFECT_IDS
EFFECT_STACK_MAX = 6
DEFAULT_EFFECT_STRENGTH = 55
_STACKABLE_EFFECT_IDS = frozenset((eid for eid in VIDEO_EFFECT_IDS if eid not in frozenset({'', 'none', 'custom'})))
_TITLE_BY_ID = {value: label for label, value in VIDEO_EFFECT_CHOICES}

def effect_title(effect_id: str) -> str:
    eid = str(effect_id or 'none').strip().lower()
    return _TITLE_BY_ID.get(eid, eid or 'Hiệu ứng')

def clamp_effect_strength(value: Any) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return DEFAULT_EFFECT_STRENGTH

def is_stackable_effect_id(effect_id: str) -> bool:
    return str(effect_id or '').strip().lower() in _STACKABLE_EFFECT_IDS

def normalize_effect_stack(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, (list, tuple)):
        out = []
        seen = set()
        for item in raw:
            eid = str(item.get('id') or item.get('effect') or '').strip().lower()
            if not isinstance(item, dict) or not is_stackable_effect_id(eid) or eid in seen:
                pass
            else:
                seen.add(eid)
                out.append({'id': eid, 'enabled': bool(item.get('enabled', True)), 'strength': clamp_effect_strength(item.get('strength', DEFAULT_EFFECT_STRENGTH)), 'title': effect_title(eid)})
                if len(out) >= EFFECT_STACK_MAX:
                    return out
        return out
    return []

def migrate_legacy_video_effect(values: dict[str, Any]) -> list[dict[str, Any]]:
    stack = normalize_effect_stack(values.get('video_effect_stack'))
    if stack:
        return stack
    eid = str(values.get('video_effect', 'none') or 'none').strip().lower()
    if is_stackable_effect_id(eid):
        strength = clamp_effect_strength(values.get('video_effect_strength', DEFAULT_EFFECT_STRENGTH))
        stack = [{'id': eid, 'enabled': True, 'strength': max(strength, 1), 'title': effect_title(eid)}]
        values['video_effect_stack'] = stack
        values['selected_video_effect_id'] = eid
        return stack
    values['video_effect_stack'] = []
    return []

def ensure_effect_stack(values: dict[str, Any]) -> list[dict[str, Any]]:
    stack = migrate_legacy_video_effect(values)
    values['video_effect_stack'] = stack
    return stack

def add_effect_to_stack(raw: Any, effect_id: str) -> list[dict[str, Any]]:
    stack = normalize_effect_stack(raw)
    eid = str(effect_id or '').strip().lower()
    if is_stackable_effect_id(eid):
        for item in stack:
            if item['id'] == eid:
                item['enabled'] = True
                if int(item['strength']) <= 0:
                    item['strength'] = DEFAULT_EFFECT_STRENGTH
                return stack
        if len(stack) >= EFFECT_STACK_MAX:
            stack.pop(0)
        stack.append({'id': eid, 'enabled': True, 'strength': DEFAULT_EFFECT_STRENGTH, 'title': effect_title(eid)})
    return stack

def active_effect_layers(raw: Any, *, master: bool) -> list[dict[str, Any]]:
    return [item for item in normalize_effect_stack(raw) if item['enabled'] and int(item['strength']) > 0] if master else []

def effect_stack_master_enabled(values: Any) -> bool:
    return bool(values.get('video_effect_master_enabled', True)) if isinstance(values, dict) else bool(getattr(values, 'video_effect_master_enabled', True))

def sync_flat_video_effect_from_stack(values: dict[str, Any]) -> None:
    stack = ensure_effect_stack(values)
    selected = str(values.get('selected_video_effect_id') or '').strip().lower()
    pick = next((item for item in stack if str(item.get('id', '')).strip().lower() == selected), None)
    if pick is None:
        pick = next((item for item in reversed(stack) if item.get('enabled', True)), None)
    if pick is None and stack:
        pick = stack[-1]
    if pick is None:
        values['video_effect'] = 'none'
        return None
    values['selected_video_effect_id'] = pick['id']
    values['video_effect'] = pick['id']
    values['video_effect_strength'] = int(pick['strength'])

def clear_effect_stack(values: dict[str, Any]) -> None:
    values['video_effect_stack'] = []
    values['selected_video_effect_id'] = ''
    values['video_effect'] = 'none'

def patch_effect_stack_item(stack: list[dict[str, Any]], index: int, *, enabled: bool | None, strength: int | None) -> list[dict[str, Any]]:
    items = normalize_effect_stack(stack)
    if index < 0 or index >= len(items):
        pass
    else:
        item = dict(items[index])
        if enabled is not None:
            item['enabled'] = bool(enabled)
        if strength is not None:
            item['strength'] = clamp_effect_strength(strength)
        items[index] = item
    return items

def move_effect_stack_item(stack: list[dict[str, Any]], index: int, delta: int) -> list[dict[str, Any]]:
    items = normalize_effect_stack(stack)
    dest = index + int(delta)
    if index < 0 or index >= len(items) or dest < 0 or (dest >= len(items)):
        pass
    else:
        items[index] = items[dest]
        items[dest] = items[index]
    return items

def remove_effect_stack_item(stack: list[dict[str, Any]], index: int) -> list[dict[str, Any]]:
    items = normalize_effect_stack(stack)
    if index < 0 or index >= len(items):
        pass
    else:
        items.pop(index)
    return items

def effect_stack_fingerprint(raw: Any, *, master: bool) -> tuple:
    return tuple(((str(item['id']), bool(item['enabled']), int(item['strength'])) for item in normalize_effect_stack)) if master else (('off',),)

def exportable_effect_stack(values: dict[str, Any]) -> tuple[dict[str, Any], ...]:
    ensure_effect_stack(values)
    return tuple((deepcopy(item) for item in active_effect_layers))