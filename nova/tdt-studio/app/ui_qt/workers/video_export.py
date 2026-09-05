from __future__ import annotations
import threading
from collections.abc import Callable
from inspect import signature
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.video_export import ExportPlan
from services_video_export import ExportResult, export_video
from ui_qt.workers.export_job_spec import ExportJobSpec

class VideoExportSignals(QObject):
    progressChanged = Signal(int)
    activityLogged = Signal(str)
    completed = Signal(object)
    failed = Signal(str)
    finished = Signal()

def _call_export_runner(runner: Callable[..., ExportResult], plan: ExportPlan, *, progress, activity, stop_event) -> ExportResult:
    kwargs = {'progress': progress, 'stop_event': stop_event}
    try:
        params = signature(runner).parameters
    except (TypeError, ValueError):
        params = {}
    if not params or 'activity' in params or any((p.kind == p.VAR_KEYWORD for p in params.values)):
        kwargs['activity'] = activity
    return runner(plan, **kwargs)

class VideoExportTask(QRunnable):

    def __init__(self, plan: ExportPlan | ExportJobSpec, runner: Callable[..., ExportResult]=export_video):
        super().__init__()
        self.plan = plan
        self.runner = runner
        self.stop_event = threading.Event()
        self.signals = VideoExportSignals()
        self._deferred_stem = isinstance(plan, ExportJobSpec)

    @property
    def final_output(self) -> str:
        item = self.plan
        return str(item.output or '') if isinstance(item, ExportJobSpec) else str(getattr(item, 'final_output', '') or '')

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            plan = self.plan
            deferred = isinstance(plan, ExportJobSpec)
            if deferred:

                def _prep(value: int, text: str='') -> None:
                    self.signals.progressChanged.emit(max(0, min(12, int(value))))
                    if text:
                        self.signals.activityLogged.emit(text)
                        return None
                plan = plan.materialize(progress=_prep, stop_event=self.stop_event)
                self.plan = plan

            def _encode_progress(value: int) -> None:
                if deferred:
                    mapped = 12 + max(0, min(100, int(value))) * 88 // 100
                    self.signals.progressChanged.emit(mapped)
                    return None
                self.signals.progressChanged.emit(int(value))
            result = _call_export_runner(self.runner, plan, progress=_encode_progress, activity=self.signals.activityLogged.emit, stop_event=self.stop_event)
            self.signals.completed.emit(result)
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()