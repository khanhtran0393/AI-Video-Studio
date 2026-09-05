from __future__ import annotations
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.video_export import ExportPlan
from services_video_export import ExportResult, export_video
from ui_qt.batch_parallel import MAX_BATCH_PARALLEL_WORKERS
from ui_qt.workers.export_job_spec import ExportJobSpec
from ui_qt.workers.video_export import _call_export_runner

class BatchExportSignals(QObject):
    progressChanged = Signal(int, str)
    completed = Signal(object)
    failed = Signal(str)
    finished = Signal()

class BatchVideoExportTask(QRunnable):

    def __init__(self, plans: tuple[ExportPlan | ExportJobSpec, ...] | list[ExportPlan | ExportJobSpec], runner: Callable[..., ExportResult]=export_video, *, on_error: str, max_workers: int):
        super().__init__()
        self.plans = tuple(plans)
        self.runner = runner
        self.on_error = on_error if on_error in frozenset({'stop', 'skip', 'retry'}) else 'stop'
        self.max_workers = max(1, min(MAX_BATCH_PARALLEL_WORKERS, int(max_workers)))
        self.stop_event = threading.Event()
        self.signals = BatchExportSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            if self.plans:
                results, errors = (self._run_sequential()[0], self._run_sequential()[1]) if self.max_workers <= 1 else (self._run_parallel()[0], self._run_parallel()[1])
                total = len(self.plans)
                if not results and errors:
                    raise RuntimeError('Batch thất bại:\n' + '\n'.join(errors[:5]))
                summary = 'Đã xuất xong hàng loạt'
                if errors:
                    summary = f'Đã xuất {len(results)}/{total}, bỏ qua {len(errors)} lỗi'
                self.signals.progressChanged.emit(100, summary)
                self.signals.completed.emit(tuple(results))
            else:
                raise ValueError('Chưa có video nào trong hàng chờ xuất')
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()

    def _run_sequential(self) -> tuple[list[ExportResult], list[str]]:
        results = []
        errors = []
        total = len(self.plans)
        for index, plan in enumerate(self.plans):
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng xuất hàng loạt')
            base_progress = round(index * 100 / total)
            label = f'Đang xuất {index + 1}/{total}'

            def emit_item_progress(value: int, text: str=label) -> None:
                percent = base_progress + round(max(0, min(100, value)) / total)
                self.signals.progressChanged.emit(min(100, percent), text)
            self.signals.progressChanged.emit(base_progress, label)
            try:
                result = self._run_one(plan, emit_item_progress)
                results.append(result)
            except Exception as exc:
                if self.stop_event.is_set():
                    raise RuntimeError('Đã dừng xuất hàng loạt') from exc
                message = str(exc) or exc.__class__.__name__
                item_name = plan.output if isinstance(plan, ExportJobSpec) else getattr(plan, 'final_output', '')
                if self.on_error == 'retry':
                    self.signals.progressChanged.emit(base_progress, f'Thử lại {index + 1}/{total}')
                    try:
                        result = self._run_one(plan, emit_item_progress)
                        results.append(result)
                    except Exception as retry_exc:
                        if self.stop_event.is_set():
                            raise RuntimeError('Đã dừng xuất hàng loạt') from retry_exc
                        message = str(retry_exc) or retry_exc.__class__.__name__
                    else:
                        continue
                    if self.on_error in frozenset({'skip', 'retry'}):
                        errors.append(f'{item_name}: {message}')
                        self.signals.progressChanged.emit(min(100, round((index + 1) * 100 / total)), f'Bỏ qua lỗi {index + 1}/{total}')
                        continue
                    raise
        return (results, errors)

    def _run_parallel(self) -> tuple[list[ExportResult], list[str]]:
        total = len(self.plans)
        results = []
        errors = []
        completed = 0
        lock = threading.Lock()

        def emit_overall(message: str) -> None:
            with lock:
                percent = min(100, round(completed * 100 / total))
            self.signals.progressChanged.emit(percent, message)

        def run_index(index: int, plan: ExportPlan) -> ExportResult:
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng xuất hàng loạt')
            label = f'Đang xuất {index + 1}/{total}'

            def emit_item_progress(value: int, text: str=label) -> None:
                sub = max(0, min(100, int(value)))
                with lock:
                    active = completed + sub / 100.0
                    percent = min(100, round(active * 100 / total))
                self.signals.progressChanged.emit(percent, text or label)
            emit_overall(label)
            return self._run_one(plan, emit_item_progress)
        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            futures = {pool.submit(run_index, index, plan): (index, plan) for index, plan in enumerate(self.plans)}
            for future in as_completed(futures):
                if self.stop_event.is_set():
                    raise RuntimeError('Đã dừng xuất hàng loạt')
                index, plan = (futures[future][0], futures[future][1])
                try:
                    result = future.result()
                    with lock:
                        results.append(result)
                        completed += 1
                    emit_overall(f'Đã xuất {completed}/{total}')
                except Exception as exc:
                    if self.stop_event.is_set():
                        raise RuntimeError('Đã dừng xuất hàng loạt') from exc
                    message = str(exc) or exc.__class__.__name__
                    item_name = plan.output if isinstance(plan, ExportJobSpec) else getattr(plan, 'final_output', '')
                    if self.on_error == 'retry':
                        try:
                            result = run_index(index, plan)
                            with lock:
                                results.append(result)
                                completed += 1
                            emit_overall(f'Đã xuất {completed}/{total}')
                        except Exception as retry_exc:
                            if self.stop_event.is_set():
                                raise RuntimeError('Đã dừng xuất hàng loạt') from retry_exc
                            message = str(retry_exc) or retry_exc.__class__.__name__
                        else:
                            continue
                        if self.on_error in frozenset({'skip', 'retry'}):
                            errors.append(f'{item_name}: {message}')
                            with lock:
                                completed += 1
                            emit_overall(f'Bỏ qua lỗi — {completed}/{total}')
                            continue
                        raise
            return (results, errors)
        return (results, errors)

    def _materialize(self, item: ExportPlan | ExportJobSpec, progress) -> ExportPlan:
        if isinstance(item, ExportJobSpec):

            def _job_progress(value: int, text: str='') -> None:
                if callable(progress):
                    try:
                        progress(int(value), text)
                    except TypeError:
                        progress(int(value))
            return item.materialize(progress=_job_progress, stop_event=self.stop_event)
        return item

    def _run_one(self, plan: ExportPlan | ExportJobSpec, progress, activity: Callable[[str], None] | None=None) -> ExportResult:
        deferred = isinstance(plan, ExportJobSpec)
        ready = self._materialize(plan, progress) if deferred else plan

        def emit_encode_progress(value: int) -> None:
            mapped = 12 + max(0, min(100, int(value))) * 88 // 100 if deferred else max(0, min(100, int(value)))
            if callable(progress):
                try:
                    progress(mapped)
                except TypeError:
                    progress(mapped, '')
        return _call_export_runner(self.runner, ready, progress=emit_encode_progress, activity=activity, stop_event=self.stop_event)