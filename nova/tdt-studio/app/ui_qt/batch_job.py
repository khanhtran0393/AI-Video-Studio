'Lưu tiến trình batch để resume sau mất điện / crash.'
from __future__ import annotations
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from ui_qt.batch_parallel import MAX_BATCH_PARALLEL_WORKERS
BATCH_JOB_VERSION = 1

@dataclass
class BatchJobRecord:
    version: 'int' = BATCH_JOB_VERSION
    job_type: 'str' = 'produce_export'
    status: 'str' = 'running'
    project_path: 'str' = ''
    export_folder: 'str' = ''
    naming_mode: 'str' = 'stem_edit'
    on_error: 'str' = 'skip'
    auto_apply: 'bool' = True
    dub_before: 'bool' = True
    parallel_workers: 'int' = 2
    total: 'int' = 0
    pending_asset_ids: 'list[str]' = field(default_factory=list)
    completed_asset_ids: 'list[str]' = field(default_factory=list)
    failed: 'list[dict[str, str]]' = field(default_factory=list)
    queue_index: 'int' = 0
    used_output_paths: 'list[str]' = field(default_factory=list)
    current_asset_id: 'str | None' = None
    updated_at: 'str' = ''

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self, asset_id: str) -> None:
        if asset_id and asset_id not in self.completed_asset_ids:
            self.completed_asset_ids.append(asset_id)
        self.current_asset_id = None
        self.pending_asset_ids = [item for item in self.pending_asset_ids if item != asset_id]
        self.touch()

    def mark_failed(self, asset_id: str, reason: str) -> None:
        self.failed.append({'asset_id': asset_id, 'reason': reason})
        self.current_asset_id = None
        self.pending_asset_ids = [item for item in self.pending_asset_ids if item != asset_id]
        self.touch()

    def mark_current(self, asset_id: str) -> None:
        self.current_asset_id = asset_id
        self.touch()

    @property
    def completed_count(self) -> int:
        return len(self.completed_asset_ids)

    @property
    def remaining_count(self) -> int:
        return len(self.pending_asset_ids) + 1 if self.current_asset_id else len(self.pending_asset_ids) + 0

    def resume_pending_ids(self) -> list[str]:
        pending = list(self.pending_asset_ids)
        current = self.current_asset_id
        if current and current not in pending:
            pending.insert(0, current)
        return pending

def batch_job_path(project_path: str | Path) -> Path:
    path = Path(project_path).expanduser().resolve()
    name = path.name
    return path.parent / name.replace('.vtp.json', '.vtp.batch.json') if name.endswith('.vtp.json') else path.parent / f'{path.stem}.batch.json'

def load_batch_job(project_path: str | Path) -> BatchJobRecord | None:
    path = batch_job_path(project_path)
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError, TypeError):
            pass
        if not isinstance(payload, dict):
            return None
        if int(payload.get('version', 0)) != BATCH_JOB_VERSION:
            return None
        if str(payload.get('status', '')) not in frozenset({'running', 'paused'}):
            return None
        record = BatchJobRecord(version=BATCH_JOB_VERSION, job_type=str(payload.get('job_type', 'produce_export')), status='running', project_path=str(payload.get('project_path', '')), export_folder=str(payload.get('export_folder', '')), naming_mode=str(payload.get('naming_mode', 'stem_edit')), on_error=str(payload.get('on_error', 'skip')), auto_apply=bool(payload.get('auto_apply', True)), dub_before=bool(payload.get('dub_before', True)), parallel_workers=max(1, min(MAX_BATCH_PARALLEL_WORKERS, int(payload.get('parallel_workers', 2)))), total=int(payload.get('total', 0)), pending_asset_ids=[str(item) for item in payload.get('pending_asset_ids', [])], completed_asset_ids=[str(item) for item in payload.get('completed_asset_ids', [])], failed=[dict(item) for item in payload.get('failed', []) if isinstance(item, dict)], queue_index=int(payload.get('queue_index', 0)), used_output_paths=[str(item) for item in payload.get('used_output_paths', [])], current_asset_id=str(payload.get('current_asset_id')) if payload.get('current_asset_id') else None, updated_at=str(payload.get('updated_at', '')))
        return record if record.pending_asset_ids or record.current_asset_id else None

def save_batch_job(record: BatchJobRecord) -> str:
    record.touch()
    path = batch_job_path(record.project_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(record), ensure_ascii=False, indent=2), encoding='utf-8')
    return str(path)

def clear_batch_job(project_path: str | Path) -> None:
    path = batch_job_path(project_path)
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass

def summarize_batch_job(record: BatchJobRecord) -> str:
    done = record.completed_count
    failed = len(record.failed)
    remain = record.remaining_count
    parts = [f'{done}/{record.total} đã xong']
    if remain:
        parts.append(f'{remain} clip còn lại')
    if failed:
        parts.append(f'{failed} lỗi (đã bỏ qua)')
    if record.export_folder:
        parts.append(f'→ {record.export_folder}')
    return ' · '.join(parts)