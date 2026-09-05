from __future__ import annotations
import math
AUTO_ZOOM_EASE_SEC = 0.35
SHAKE_BASE_X_PX = 4.0
SHAKE_BASE_Y_PX = 3.0
SHAKE_PAD_EXTRA = 0.06

def motion_intensity_factor(percent: int | float) -> float:
    return max(0.0, min(1.0, float(percent) / 100.0))

def effective_auto_zoom_value(az_val: float, intensity: float) -> float:
    peak = max(1.05, float(az_val))
    factor = max(0.0, min(1.0, float(intensity)))
    return 1.0 + (peak - 1.0) * factor

def smoothstep(value: float) -> float:
    t = max(0.0, min(1.0, float(value)))
    return t * t * (3.0 - 2.0 * t)

def auto_zoom_boost_at(seconds: float, *, az_val: float, az_sec: float, az_hold: float, az_rand: bool, intensity: float, ease_sec: float) -> float:
    factor = max(0.0, min(1.0, float(intensity)))
    if factor <= 0.0:
        return 1.0
    peak = effective_auto_zoom_value(az_val, factor)
    hold_sec = max(0.1, float(az_hold))
    normal_sec = max(0.5, float(az_sec))
    cycle = normal_sec + hold_sec
    ease = max(0.05, min(hold_sec / 2.0, float(ease_sec)))
    phase = float(seconds) % cycle
    if az_rand:
        step = int(float(seconds) // normal_sec)
        zoomed = step * 0.618033988749895 % 1.0 > 0.5
        if zoomed:
            sub_phase = float(seconds) % normal_sec
            return 1.0 + (peak - 1.0) * smoothstep(sub_phase / ease) if sub_phase < ease else peak
        return 1.0
    if phase < normal_sec:
        return 1.0
    hold_t = phase - normal_sec
    return 1.0 + (peak - 1.0) * smoothstep(hold_t / ease) if hold_t < ease else 1.0 + (peak - 1.0) * smoothstep((hold_sec - hold_t) / ease) if hold_t > hold_sec - ease else peak

def shake_offsets_px(seconds: float, *, intensity: float, unit_x: float, unit_y: float) -> tuple[float, float]:
    factor = max(0.0, min(1.0, float(intensity)))
    if factor <= 0.0:
        return (0.0, 0.0)
    amp_x = SHAKE_BASE_X_PX * factor * float(unit_x)
    amp_y = SHAKE_BASE_Y_PX * factor * float(unit_y)
    t = float(seconds)
    return (amp_x * math.sin(18.0 * t), amp_y * math.cos(15.0 * t))

def shake_crop_pad_scale(intensity: float) -> float:
    factor = max(0.0, min(1.0, float(intensity)))
    return 1.0 + SHAKE_PAD_EXTRA * factor

def gradual_zoom_boost(seconds: float, motion: str, intensity: float) -> float:
    factor = max(0.0, min(1.0, float(intensity)))
    if factor <= 0.0 or motion not in frozenset({'zoom_out', 'zoom_in'}):
        return 1.0
    cap = 0.08 * factor
    return 1.0 + min(cap, float(seconds) * 0.008 * factor) if motion == 'zoom_in' else max(1.0, 1.0 + cap - min(cap, float(seconds) * 0.008 * factor))

def zoompan_step_rate(intensity: float) -> float:
    factor = max(0.0, min(1.0, float(intensity)))
    return 0.0008 * factor