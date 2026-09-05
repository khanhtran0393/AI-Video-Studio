'Hiệu ứng khung (grain / glow / stripe / …) — tách khỏi video_export.'
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from core.video_export import VideoExportSettings
_FFMPEG_NOISE_ALLS_MAX = 100

def clamp_ffmpeg_noise_alls(value: int) -> int:
    return max(0, min(_FFMPEG_NOISE_ALLS_MAX, int(value)))

def _resolved_video_effect_layers(settings: VideoExportSettings) -> list[dict]:
    from core.video_effect_stack import active_effect_layers, normalize_effect_stack
    stack = normalize_effect_stack(getattr(settings, 'video_effect_stack', ()) or ())
    if stack:
        return active_effect_layers(stack, master=True)
    effect = str(settings.video_effect or 'none').strip().lower()
    if effect in frozenset({'', 'none', 'custom'}):
        return []
    strength = max(0, min(100, int(settings.video_effect_strength or 0)))
    return [] if strength <= 0 else [{'id': effect, 'enabled': True, 'strength': strength, 'title': effect}]

def export_plan_uses_heavy_filters(settings: VideoExportSettings) -> bool:
    heavy_ids = {'camera', 'glow', 'camera_rec', 'tv', 'lightsweep', 'stripe'}
    return True if any((str(item.get('id') or '') in heavy_ids for item in _resolved_video_effect_layers(settings))) else True if settings.background == 'blur' else True if settings.background == 'custom' and settings.background_layers_master_enabled and settings.background_layers else True if len(settings.blur_zones or ()) > 0 else True if settings.anti_duplicate_advanced else False

def _settings_has_frame_effect(settings: VideoExportSettings) -> bool:
    return bool(_resolved_video_effect_layers(settings))

def _settings_has_lightsweep(settings: VideoExportSettings) -> bool:
    return any((str(item.get('id') or '') == 'lightsweep' for item in _resolved_video_effect_layers(settings)))

def _append_one_video_effect(graph: list[str], current: str, settings: VideoExportSettings, *, effect: str, intensity: int, target_width: int, target_height: int, foreground_width: int, foreground_height: int, export_offset_x: int, export_offset_y: int, skip_lightsweep: bool, out_label: str) -> str:
    if effect in frozenset({'', 'none', 'custom'}):
        pass
    else:
        intensity = max(0, min(100, int(intensity)))
        if intensity <= 0:
            pass
        else:
            strength = intensity / 100
            label = out_label
            if effect == 'vignette':
                ang = 3.5 + strength * 8.5
                graph.append(f'[{current}]vignette=angle=PI/{ang:.2f}[{label}]')
                return label
            if effect == 'vintage':
                rs = strength * 0.2
                bs = strength * 0.15
                graph.append(f'[{current}]curves=preset=vintage,colorbalance=rs={rs:.2f}:bs=-{bs:.2f}[{label}]')
                return label
            if effect == 'grain':
                amount = clamp_ffmpeg_noise_alls(max(3, int(intensity * 0.4)))
                graph.append(f'[{current}]noise=alls={amount}:allf=t+u[{label}]')
                return label
            if effect == 'lightleak':
                rs = strength * 0.25
                graph.append(f'[{current}]colorbalance=rs={rs:.2f}:gs=-0.05:bs=-0.12,eq=brightness=0.03[{label}]')
                return label
            if effect == 'glow':
                sigma = max(2, int(intensity / 8))
                opacity = min(0.45, intensity / 220.0)
                g3, g2, g1 = (f'{label}_g3', f'{label}_g2', f'{label}_g1')
                graph.append(f'[{current}]split=2[{g1}][{g2}]')
                graph.append(f'[{g2}]gblur=sigma={sigma}[{g3}]')
                graph.append(f'[{g1}][{g3}]blend=all_mode=screen:all_opacity={opacity:.2f}[{label}]')
                return label
            if effect == 'tv':
                sat = 0.85 - strength * 0.5
                ang = 3.5 + strength * 6.5
                rs = strength * 0.18
                bs = strength * 0.1
                noise = clamp_ffmpeg_noise_alls(max(2, int(2 + strength * 4)))
                grid_h = max(4, int(round(12 - 6 * strength)))
                grid_alpha = 0.12 + 0.38 * strength
                graph.append(f'[{current}]eq=saturation={sat:.2f}:gamma=0.92,colorbalance=rs={rs:.2f}:bs=-{bs:.2f},noise=alls={noise}:allf=t+u,vignette=angle=PI/{ang:.2f},drawgrid=w=iw:h={grid_h}:t=1:c=black@{grid_alpha:.2f}[{label}]')
                return label
            if effect == 'stripe':
                bw_pct = 0.025 + strength * 0.065
                noise = clamp_ffmpeg_noise_alls(max(50, int(40 + intensity * 0.8)))
                cond = f'if(eq(floor(mod(T\\,15)/5)\\,1),lt(abs(X-mod(T\\,5)/5*W)\\,{bw_pct:.4f}*min(W\\,H)/2),lt(abs(X+Y-mod(T\\,5)/5*(W+H))/1.41421\\,{bw_pct:.4f}*min(W\\,H)/2))'
                c, b, a = (f'{label}_c', f'{label}_b', f'{label}_a')
                graph.append(f'[{current}]split=2[{a}][{b}]')
                graph.append(f'[{b}]noise=alls={noise}:allf=t+u[{c}]')
                graph.append(f"[{a}][{c}]blend=all_expr='if({cond}\\,B\\,A)'[{label}]")
                return label
            if effect == 'lightsweep':
                from dataclasses import replace
                from core.lightsweep import append_lightsweep_filters, append_lightsweep_on_video_rect, normalize_lightsweep_apply_mode
                if skip_lightsweep:
                    return current
                ls_settings = replace(settings, video_effect='lightsweep', video_effect_strength=intensity)
                if normalize_lightsweep_apply_mode(ls_settings.lightsweep_apply_mode) == 'video':
                    joined = '\n'.join(graph)
                    if '[fglightsweep]' in joined or 'fglightsweep]' in joined:
                        return current
                    fw = max(2, int(foreground_width))
                    fh = max(2, int(foreground_height))
                    return current if fw < 4 or fh < 4 else append_lightsweep_on_video_rect(graph, current, ls_settings, video_width=fw, video_height=fh, offset_x=int(export_offset_x), offset_y=int(export_offset_y), out_label=label)
                return append_lightsweep_filters(graph, current, ls_settings, out_label=label)
            if effect in frozenset({'camera', 'camera_rec'}):
                sat = 0.7 - strength * 0.65
                opacity = 0.6 + strength * 0.35
                arm = f'{0.05 + strength * 0.03:.3f}'
                thk = f'{0.004 + strength * 0.003:.4f}'
                margin = 'min(iw\\,ih)*0.03'
                dot = f'{0.015 + strength * 0.01:.4f}'
                corner_arm = f'({arm}*min(iw\\,ih))'
                corner_thk = f'max(1\\,({thk}*min(iw\\,ih)))'
                rec_dot = f'({dot}*min(iw\\,ih))'
                rec_tail = f',drawbox=x=iw-{margin}-{rec_dot}-{corner_thk}:y={margin}+{corner_thk}:w={rec_dot}:h={rec_dot}:color=red@{opacity:.2f}:t=fill' if effect == 'camera_rec' else ''
                graph.append(f'[{current}]eq=saturation={sat:.2f},drawbox=x={margin}:y={margin}:w={corner_arm}:h={corner_thk}:color=black@{opacity:.2f}:t=fill,drawbox=x={margin}:y={margin}:w={corner_thk}:h={corner_arm}:color=black@{opacity:.2f}:t=fill,drawbox=x=iw-{margin}-{corner_arm}:y={margin}:w={corner_arm}:h={corner_thk}:color=black@{opacity:.2f}:t=fill,drawbox=x=iw-{margin}-{corner_thk}:y={margin}:w={corner_thk}:h={corner_arm}:color=black@{opacity:.2f}:t=fill,drawbox=x={margin}:y=ih-{margin}-{corner_thk}:w={corner_arm}:h={corner_thk}:color=black@{opacity:.2f}:t=fill,drawbox=x={margin}:y=ih-{margin}-{corner_arm}:w={corner_thk}:h={corner_arm}:color=black@{opacity:.2f}:t=fill,drawbox=x=iw-{margin}-{corner_arm}:y=ih-{margin}-{corner_thk}:w={corner_arm}:h={corner_thk}:color=black@{opacity:.2f}:t=fill,drawbox=x=iw-{margin}-{corner_thk}:y=ih-{margin}-{corner_arm}:w={corner_thk}:h={corner_arm}:color=black@{opacity:.2f}:t=fill{rec_tail}[{label}]')
                return label
    return current

def _append_video_effect(graph: list[str], current: str, settings: VideoExportSettings, *, target_width: int, target_height: int, foreground_width: int, foreground_height: int, export_offset_x: int, export_offset_y: int, skip_lightsweep: bool) -> str:
    layers = _resolved_video_effect_layers(settings)
    if layers:
        label = current
        for index, layer in enumerate(layers):
            label = _append_one_video_effect(graph, label, settings, effect=str(layer.get('id') or 'none'), intensity=int(layer.get('strength') or 0), target_width=target_width, target_height=target_height, foreground_width=foreground_width, foreground_height=foreground_height, export_offset_x=export_offset_x, export_offset_y=export_offset_y, skip_lightsweep=skip_lightsweep, out_label=f'vfx{index}')
        return label
    return current