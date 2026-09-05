from __future__ import annotations
from collections.abc import Callable
from PySide6.QtWidgets import QWidget

def build_download_panel(parent: QWidget | None=None) -> QWidget:
    from ui_qt.panels.download_panel import DownloadPanel
    return DownloadPanel(parent)

def wire_download_panel(panel: QWidget, *, on_import_paths: Callable[[list[str]], None] | None) -> None:
    if on_import_paths is None:
        return None
    signal = getattr(panel, 'importPathsRequested', None)
    if signal is None:
        return None
    signal.connect(on_import_paths)

def attach_download_workbench(workbench: QWidget, *, on_import_paths: Callable[[list[str]], None] | None) -> QWidget | None:
    controls = getattr(workbench, 'controls', None)
    if isinstance(controls, dict):
        panel = controls.get('download_panel')
        if panel is None:
            return None
        wire_download_panel(panel, on_import_paths=on_import_paths)
        return panel