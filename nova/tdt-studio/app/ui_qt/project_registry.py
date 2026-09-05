from __future__ import annotations
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from core.paths import PATHS
from ui_qt.project_io import load_project, save_project
from ui_qt.state import ProjectState
from ui_qt.user_prefs import load_prefs, save_prefs
RECENT_PROJECT_LIMIT = 16
PROJECTS_DIRNAME = 'projects'

@dataclass(frozen=True, slots=True)
class ProjectSummary:
    path: 'str'
    name: 'str'
    video_count: 'int'
    updated_at: 'float'
    first_video_path: 'str' = ''

    @property
    def updated_label(self) -> str:
        return datetime.fromtimestamp(self.updated_at).strftime('%d/%m/%Y %H:%M')

def projects_dir() -> Path:
    path = PATHS.user_data / PROJECTS_DIRNAME
    path.mkdir(parents=True, exist_ok=True)
    return path

def _slugify(name: str) -> str:
    cleaned = re.sub('[^\\w\\s-]+', '', name.strip(), flags=re.UNICODE)
    cleaned = re.sub('[\\s_-]+', '_', cleaned).strip('_')
    return cleaned[:80] or 'du_an'

def default_new_project_name() -> str:
    stamp = datetime.now().strftime('%d-%m-%Y %H:%M')
    return f'Dự án {stamp}'

def allocate_project_path(name: str) -> Path:
    base = _slugify(name)
    destination = projects_dir() / f'{base}.vtp.json'
    if destination.exists():
        index = 2
        while True:
            candidate = projects_dir() / f'{base}_{index}.vtp.json'
            if not candidate.exists():
                return candidate
            index += 1
    return destination

def read_project_name(path: str | Path) -> str:
    source = Path(path).expanduser().resolve()
    if source.is_file():
        try:
            payload = json.loads(source.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            return source.stem
        name = str(payload.get('project_name', '') or '').strip()
        return name or source.stem
    return source.stem

def _project_stem_name(source: Path) -> str:
    name = source.name
    lowered = name.lower()
    if lowered.endswith('.vtp.json'):
        return name[: -len('.vtp.json')] or source.stem
    return source.stem

def project_output_dir(project_path: str | Path) -> Path:
    'Thư mục đầu ra riêng của dự án: nằm cạnh file .vtp.json, trùng tên stem của file dự án.'
    source = Path(project_path).expanduser().resolve()
    folder = source.parent / _project_stem_name(source)
    folder.mkdir(parents=True, exist_ok=True)
    return folder

def summarize_project(path: str | Path) -> ProjectSummary | None:
    source = Path(path).expanduser().resolve()
    if source.is_file():
        try:
            state = load_project(source)
        except (OSError, ValueError, TypeError, KeyError):
            return None
        video_count = 0
        first_video = ''
        for asset in state.assets:
            video_count += 1
            if asset.kind != 'video' or not asset.path or first_video:
                pass
            else:
                first_video = str(asset.path)
        return ProjectSummary(path=str(source), name=read_project_name(source), video_count=video_count, updated_at=source.stat().st_mtime, first_video_path=first_video)
    return None

def list_recent_projects(*, limit: int=12) -> list[ProjectSummary]:
    summaries = []
    seen = set()
    for raw in get_recent_project_paths():
        summary = summarize_project(raw)
        if summary is None or summary.path in seen:
            pass
        else:
            seen.add(summary.path)
            summaries.append(summary)
    for path in sorted(projects_dir().glob('*.vtp.json'), key=lambda item: item.stat().st_mtime, reverse=True):
        resolved = str(path.resolve())
        summary = summarize_project(resolved)
        if resolved in seen or summary is None:
            pass
        else:
            seen.add(resolved)
            summaries.append(summary)
    summaries.sort(key=lambda item: item.updated_at, reverse=True)
    return summaries[:limit]

def get_recent_project_paths() -> list[str]:
    raw = load_prefs().get('recent_project_paths', [])
    if isinstance(raw, list):
        paths = []
        for item in raw:
            text = str(item or '').strip()
            if text and Path(text).is_file():
                paths.append(str(Path(text).resolve()))
        return paths
    return []

def remember_project_path(path: str | Path | None) -> None:
    if path:
        target = Path(path).expanduser().resolve()
        if target.is_file():
            resolved = str(target)
            recent = [resolved] + [item for item in get_recent_project_paths() if item != resolved]
            save_prefs({'last_project_path': resolved, 'recent_project_paths': recent[:RECENT_PROJECT_LIMIT]})
        else:
            return None
    else:
        return None

def save_named_project(state: ProjectState, path: str | Path, *, project_name: str) -> str:
    saved_path = save_project(state, path, project_name=project_name)
    remember_project_path(saved_path)
    return saved_path

def _with_project_name(content: str, project_name: str) -> str:
    payload = json.loads(content)
    payload['project_name'] = project_name.strip() or payload.get('project_name', '')
    return json.dumps(payload, ensure_ascii=False, indent=2)

def forget_project_path(path: str | Path | None) -> None:
    if path:
        resolved = str(Path(path).expanduser().resolve())
        recent = [item for item in get_recent_project_paths() if item != resolved]
        last = str(load_prefs().get('last_project_path', '') or '').strip()
        payload = {'recent_project_paths': recent[:RECENT_PROJECT_LIMIT]}
        if last == resolved:
            payload['last_project_path'] = recent[0] if recent else ''
        save_prefs(payload)
    else:
        return None

def delete_project_file(path: str | Path) -> None:
    source = Path(path).expanduser().resolve()
    if source.is_file():
        source.unlink()
        forget_project_path(source)
    else:
        raise ValueError('Dự án không tồn tại')

def rename_project_file(path: str | Path, new_name: str) -> str:
    source = Path(path).expanduser().resolve()
    cleaned = new_name.strip()
    if source.is_file() and cleaned:
        slug = _slugify(cleaned)
        destination = source.with_name(f'{slug}.vtp.json')
        if destination != source:
            index = 2
            while destination.exists():
                destination = source.with_name(f'{slug}_{index}.vtp.json')
                index += 1
            source.rename(destination)
        destination.write_text(_with_project_name(destination.read_text(encoding='utf-8'), cleaned), encoding='utf-8')
        try:
            old_output = source.parent / _project_stem_name(source)
            new_output = destination.parent / _project_stem_name(destination)
            if old_output.is_dir() and not new_output.exists():
                old_output.rename(new_output)
        except OSError:
            pass
        remember_project_path(destination)
        return str(destination)
    raise ValueError('Không thể đổi tên dự án')