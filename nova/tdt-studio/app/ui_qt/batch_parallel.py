'Gợi ý số luồng ffmpeg xuất song song — theo CPU, RAM và GPU encode.'
from __future__ import annotations
import os
MAX_BATCH_PARALLEL_WORKERS = 16
AUTO_PARALLEL = 0

def _memory_stats() -> tuple[float, float]:
    try:
        import psutil
        vm = psutil.virtual_memory()
    except Exception:
        return (16.0, 50.0)

def recommend_export_parallel_workers(*, encoder_backend: str, heavy_filter: bool, hard_cap: int) -> int:
    cap = max(1, min(MAX_BATCH_PARALLEL_WORKERS, int(hard_cap)))
    cpu = max(1, int(os.cpu_count() or 4))
    avail_gb, ram_pct = (_memory_stats()[0], _memory_stats()[1])
    cpu_cap = max(1, cpu // 2) if heavy_filter else max(1, cpu - 1)
    try:
        from longtieng.longtieng_merge import pick_render_parallelism
        ram_cap = pick_render_parallelism(99, avail_gb, ram_pct, hard_cap=cap, heavy_filter=heavy_filter)
        workers = min(cpu_cap, ram_cap, cap)
        try:
            from core.demucs_config import get_batch_parallel_auto_max
            workers = min(workers, get_batch_parallel_auto_max())
        except Exception:
            workers = min(workers, 4)
        _ = encoder_backend
        if cpu >= 4 and workers < 2:
            workers = 2
    except Exception:
        return max(1, min(cap, max(2, cpu_cap) if cpu >= 4 else cpu_cap))

def resolve_batch_parallel_workers(requested: int, *, encoder_backend: str, heavy_filter: bool) -> int:
    return recommend_export_parallel_workers(encoder_backend=encoder_backend, heavy_filter=heavy_filter) if int(requested) == AUTO_PARALLEL else max(1, min(MAX_BATCH_PARALLEL_WORKERS, int(requested)))