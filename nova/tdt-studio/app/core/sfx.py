from __future__ import annotations
import json
from pathlib import Path

def sfx_json_path(video_path: str | Path) -> Path:
    path = Path(video_path)
    return Path(str(path.with_suffix('')) + '.sfx.json')

def normalize_sfx_events(events: object) -> list[dict]:
    if isinstance(events, (list, tuple)):
        normalized = []
        for item in events:
            file_path = str(item.get('file', '')).strip()
            if not isinstance(item, dict) or not file_path or file_path == '(chưa chọn)':
                continue
            try:
                time_sec = float(item.get('time_sec', 0.0))
                try:
                    volume = float(item.get('volume', 0.7))
                except (TypeError, ValueError):
                    volume = 0.7
                label = str(item.get('label') or Path(file_path).stem)
                normalized.append({'time_sec': max(0.0, time_sec), 'file': file_path, 'label': label, 'volume': max(0.0, min(3.0, volume))})
            except (TypeError, ValueError):
                pass
        normalized.sort(key=lambda event: event['time_sec'])
        return normalized
    return []

def valid_sfx_events(events: object) -> list[dict]:
    return [event for event in normalize_sfx_events(events) if Path(event['file']).is_file()]

def load_sfx_events(video_path: str | Path | None) -> list[dict]:
    if video_path:
        path = Path(video_path)
        if path.is_file():
            json_path = sfx_json_path(path)
            if json_path.is_file():
                try:
                    data = json.loads(json_path.read_text(encoding='utf-8'))
                except (OSError, json.JSONDecodeError, TypeError, ValueError):
                    return []
                return normalize_sfx_events(data.get('events', []))
    return []

def save_sfx_events(video_path: str | Path | None, events: object) -> str:
    if video_path:
        path = Path(video_path)
        if path.is_file():
            json_path = sfx_json_path(path)
            payload = {'events': normalize_sfx_events(events)}
            json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
            return str(json_path)
        raise ValueError('Video không tồn tại để lưu SFX')
    raise ValueError('Chưa có video để lưu SFX')

def scan_sfx_presets(root: str | Path | None=None) -> dict[str, str]:
    base = Path(root) if root else Path(__file__).resolve().parents[1] / 'assets' / 'sfx'
    if base.is_dir():
        result = {}
        for path in sorted(base.iterdir()):
            if path.suffix.lower() in frozenset({'.ogg', '.wav', '.m4a', '.aac', '.mp3', '.flac'}):
                result[path.stem] = str(path)
        return result
    return {}