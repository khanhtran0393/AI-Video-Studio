from dataclasses import dataclass

@dataclass(frozen=True)
class ProviderSpec:
    id: str
    display_name: str
    credential_id: str
    base_url: str
    offline: bool = False
    models: tuple[str, '<ANTI-DIS: ellipsis Ellipsis>'] = ()
    translation: bool = True