from __future__ import annotations
from copy import deepcopy
from typing import Callable

def recenter_blur_zones_for_video(video_path: str, zones: list[dict], *, target_width: int, target_height: int, log: Callable[[str], None] | None) -> tuple[list[dict], dict | None]:
    if not video_path or not zones:
        pass
    elif target_width <= 0 or target_height <= 0:
        pass
    else:

        def _log(message: str) -> None:
            if log is None:
                pass
            else:
                try:
                    log(message)
                except Exception:
                    pass
        try:
            from exporter.ocr_extractor import detect_sub_zone, zone_center
        except Exception as exc:
            _log(f'⚠️ Auto che không dùng được OCR: {exc}')
            return (zones, None)
        _log('🔍 Đang tìm phụ đề gốc trên video…')
        try:
            detected = detect_sub_zone(video_path)
        except Exception as exc:
            _log(f'⚠️ Tìm phụ đề gốc lỗi: {exc}')
            return (zones, None)
        if detected:
            center = zone_center(detected, target_width, target_height)
            if center:
                cx, cy = (center[0], center[1])
                moved = []
                for zone in zones:
                    item = deepcopy(zone)
                    width = max(0.1, min(1.0, float(item.get('width', 1.0))))
                    height = max(0.05, min(0.5, float(item.get('height', 0.18))))
                    px = max(0.0, min(1.0 - width, cx / target_width - width / 2))
                    py = max(0.0, min(1.0 - height, cy / target_height - height / 2))
                    item['x'] = px
                    item['y'] = py
                    item['width'] = width
                    item['height'] = height
                    item['enabled'] = True
                    moved.append(item)
                where = 'TRÊN' if cy < target_height * 0.5 else 'DƯỚI'
                _log(f'🩹 Auto che: thấy phụ đề gốc ở {where} — đã căn vùng che.')
                hint = {'subtitle_position': 'top' if cy < target_height * 0.5 else 'bottom', 'subtitle_margin_bottom': max(20, min(600, round((cy if cy < target_height * 0.5 else target_height - cy) * 0.35)))}
                return (moved, hint)
        else:
            _log('⏱️ Không định vị được phụ đề gốc — giữ vùng che hiện tại.')
    return (zones, None)