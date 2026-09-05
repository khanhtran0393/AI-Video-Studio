from __future__ import annotations
from core.video_export import aspect_ratio_value, center_crop_norm_for_aspect
from ui_qt.state import ProjectState

def _resolve_source_size(state: ProjectState, *, source_width: int, source_height: int) -> tuple[int, int]:
    width = int(source_width)
    height = int(source_height)
    asset = state.selected_asset
    if (width <= 0 or height <= 0) and asset is not None and (asset.kind == 'video'):
        width = int(asset.width or 0)
        height = int(asset.height or 0)
    if width <= 0 or height <= 0:
        for asset in state.assets:
            if asset.kind == 'video' and asset.width and asset.height:
                width = int(asset.width)
                height = int(asset.height)
    if width <= 0 or height <= 0:
        width, height = ((1920, 1080)[0], (1920, 1080)[1])
    return (width, height)

def apply_capcut_crop_preset(state: ProjectState, *, source_width: int, source_height: int, reset_rect: bool) -> None:
    state.values['crop_enabled'] = True
    state.values['crop_lock_aspect'] = False
    if reset_rect:
        state.values['crop_left_percent'] = 0
        state.values['crop_top_percent'] = 0
        state.values['crop_right_percent'] = 100
        state.values['crop_bottom_percent'] = 100
    else:
        return None

def apply_locked_crop_rect(state: ProjectState, *, source_width: int, source_height: int) -> None:
    width, height = (_resolve_source_size(state, source_width=source_width, source_height=source_height)[0], _resolve_source_size(state, source_width=source_width, source_height=source_height)[1])
    left, top, right, bottom = (center_crop_norm_for_aspect(width, height, aspect_ratio_value(str(state.values.get('aspect_ratio', '9:16'))))[0], center_crop_norm_for_aspect(width, height, aspect_ratio_value(str(state.values.get('aspect_ratio', '9:16'))))[1], center_crop_norm_for_aspect(width, height, aspect_ratio_value(str(state.values.get('aspect_ratio', '9:16'))))[2], center_crop_norm_for_aspect(width, height, aspect_ratio_value(str(state.values.get('aspect_ratio', '9:16'))))[3])
    state.values['crop_left_percent'] = int(round(left * 100))
    state.values['crop_top_percent'] = int(round(top * 100))
    state.values['crop_right_percent'] = int(round(right * 100))
    state.values['crop_bottom_percent'] = int(round(bottom * 100))