from __future__ import annotations
import json
from pathlib import Path
from core.paths import PATHS

class CredentialStore:

    def __init__(self, path: Path | None=None):
        self.path = path or PATHS.user_data / 'credentials.json'

    def _load(self) -> dict[str, str]:
        if self.path.is_file():
            data = json.loads(self.path.read_text(encoding='utf-8'))
            return {str(k): str(v) for k, v in data.items() if isinstance(v, str)}
        return {}

    def get(self, provider: str) -> str:
        return self._load().get(provider, '')

    def set(self, provider: str, key: str) -> None:
        data = self._load()
        data[provider] = key.strip()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2), encoding='utf-8')

    def delete(self, provider: str) -> None:
        data = self._load()
        data.pop(provider, None)
        if data:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(data, indent=2), encoding='utf-8')
        else:
            self.path.unlink(missing_ok=True)
            return None

    def masked(self, provider: str) -> str:
        key = self.get(provider)
        return f'••••{key[-4:]}' if key else ''