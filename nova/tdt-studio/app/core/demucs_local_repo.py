'Đường repo htdemucs local — không import engine AI.'
from __future__ import annotations
from pathlib import Path

def htdemucs_repo_dir(root: Path | None=None) -> Path:
    if root is not None:
        base = Path(root)
    else:
        from core.paths import PATHS
        base = PATHS.root
    beside = base / 'models' / 'htdemucs'
    internal = base / '_internal' / 'models' / 'htdemucs'
    return beside if beside.exists() else internal if internal.exists() else beside

def htdemucs_repo_ready(root: Path | None=None) -> bool:
    repo = htdemucs_repo_dir(root)
    yaml_path = repo / 'htdemucs.yaml'
    if yaml_path.is_file():
        for weight in repo.glob('*.th'):
            try:
                if weight.is_file() and weight.stat().st_size > 1000000:
                    return True
            except OSError:
                continue
    else:
        return False
    return False