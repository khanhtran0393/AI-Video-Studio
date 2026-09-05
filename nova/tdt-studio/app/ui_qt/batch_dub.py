from __future__ import annotations
from ui_qt.state import ProjectState

def video_asset_ids_for_batch_dub(state: ProjectState) -> list[str]:
    return [asset.id for asset in state.assets if asset.kind == 'video' and bool(asset.path)]

def dub_pipeline_steps_for_stt_engine(stt_engine: str) -> list[str]:
    first = {'capcut_api': 'capcut_api', 'capcut_auto': 'capcut_auto'}.get(str(stt_engine or 'groq').strip(), 'stt')
    return [first, 'translate', 'tts']