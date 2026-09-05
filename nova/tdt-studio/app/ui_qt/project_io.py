from __future__ import annotations
import json
from dataclasses import asdict
from pathlib import Path
from core.subtitles import SubtitleDocument, SubtitleSegment
from ui_qt.state import Asset, ProjectState, empty_project_state, migrate_export_encode_defaults, sort_project_assets
PROJECT_FORMAT_VERSION = 1

def save_project(state: ProjectState, path: str | Path, *, project_name: str | None=None) -> str:
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    display_name = str(project_name or '').strip() or destination.stem
    payload = {'version': PROJECT_FORMAT_VERSION, 'project_name': display_name, 'assets': [asdict(asset) for asset in state.assets], 'selected_id': state.selected_id, 'values': dict(state.values), 'asset_settings': {asset_id: dict(values) for asset_id, values in state.asset_settings.items()}, 'subtitles': {'source_path': state.subtitles.source_path, 'segments': [asdict(segment) for segment in state.subtitles.segments]}, 'sfx_events': list(state.sfx_events)}
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return str(destination)

def load_project(path: str | Path) -> ProjectState:
    source = Path(path).expanduser().resolve()
    if source.is_file():
        payload = json.loads(source.read_text(encoding='utf-8'))
        if not isinstance(payload, dict):
            raise ValueError('Tệp dự án không đúng định dạng')
        if int(payload.get('version', 0)) != PROJECT_FORMAT_VERSION:
            raise ValueError('Phiên bản tệp dự án chưa được hỗ trợ')
        state = empty_project_state()
        try:
            state.assets = sort_project_assets(tuple((Asset(**item) for item in payload.get('assets', []))))
        except TypeError as exc:
            raise ValueError(f'Tệp dự án có mục media hỏng: {exc}') from exc
        state.selected_id = payload.get('selected_id')
        state.values.update(payload.get('values', {}) if isinstance(payload.get('values'), dict) else {})
        migrate_export_encode_defaults(state.values)
        raw_settings = payload.get('asset_settings', {})
        if isinstance(raw_settings, dict):
            state.asset_settings = {str(asset_id): dict(values) for asset_id, values in raw_settings.items() if isinstance(values, dict)}
        subtitle_payload = payload.get('subtitles', {})
        if not isinstance(subtitle_payload, dict):
            subtitle_payload = {}
        try:
            state.subtitles = SubtitleDocument(tuple((SubtitleSegment(**item) for item in subtitle_payload.get('segments', []))), str(subtitle_payload.get('source_path', '')))
        except TypeError as exc:
            raise ValueError(f'Tệp dự án có mục phụ đề hỏng: {exc}') from exc
        raw_sfx = payload.get('sfx_events', [])
        if isinstance(raw_sfx, list):
            state.sfx_events = [dict(item) for item in raw_sfx if isinstance(item, dict)]
        return state
    raise ValueError('Tệp dự án không tồn tại')