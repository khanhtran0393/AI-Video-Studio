'Kế hoạch xuất có thể dựng lại trên worker (tách stem Demucs ngoài UI thread).'
from __future__ import annotations
import threading
from dataclasses import dataclass
from typing import Any, Callable
from core.video_export import ExportPlan, build_export_plan
from core.video_stem_audio import attach_stems_to_export_settings
ProgressFn = Callable[[int, str], None]

@dataclass
class ExportJobSpec:
    __doc__ = 'Payload nhẹ — materialize → ExportPlan trên thread pool (không kẹt UI).'
    source: 'str'
    output: 'str'
    settings: 'Any'
    duration_ms: 'int'
    has_audio: 'bool'
    source_bitrate_kbps: 'int' = 0
    source_width: 'int' = 0
    source_height: 'int' = 0
    subtitle_document: 'Any' = None
    allow_stem_separate: 'bool' = True
    label: 'str' = ''

    def materialize(self, *, progress: ProgressFn | None, stop_event: threading.Event | None) -> ExportPlan:

        def _stem_progress(msg: str, pct: int | None=None) -> None:
            if progress is None:
                return None
            text = str(msg or '').strip() or 'Tách stem…'
            if pct is not None:
                text = f'{text} ({int(pct)}%)'
            mapped = 0
            if pct is not None:
                mapped = max(0, min(12, int(int(pct) * 12 / 100)))
            progress(mapped, text)
        settings = self.settings
        if self.allow_stem_separate:
            from core.audio_mix_state import video_mix_needs_stems
            from core.demucs_separate import video_instrumental_stem_cache_path, video_vocal_stem_cache_path
            from pathlib import Path as _Path
            mix = {'video_vocal_enabled': bool(getattr(settings, 'video_vocal_enabled', False)), 'video_bgm_enabled': bool(getattr(settings, 'video_bgm_enabled', False)), 'video_vocal_volume': int(getattr(settings, 'video_vocal_volume', 0) or 0), 'video_bgm_volume': int(getattr(settings, 'video_bgm_volume', 0) or 0)}
            if video_mix_needs_stems(mix):
                vocal_cache = video_vocal_stem_cache_path(self.source)
                inst_cache = video_instrumental_stem_cache_path(self.source)
                cached = _Path(vocal_cache).is_file() and _Path(inst_cache).is_file()
                if progress is not None:
                    if cached:
                        progress(10, f'Stem cache sẵn: {self.label or PathName(self.source)}')
                    else:
                        progress(1, f'Tách stem AI: {self.label or PathName(self.source)}')
                settings = attach_stems_to_export_settings(settings, self.source, allow_separate=True, progress=_stem_progress, stop_event=stop_event, raise_on_failure=True)
            elif progress is not None:
                progress(8, 'Bỏ tách stem — dùng audio gốc (cả nhạc+giọng hoặc đã tắt)')
        if stop_event is not None and stop_event.is_set():
            raise RuntimeError('Đã dừng xuất')
        from core.export_source_duration import clamp_export_settings_to_source_duration
        from services_media import resolve_export_source_duration_ms
        claimed_ms = int(self.duration_ms or 0)
        duration_ms = resolve_export_source_duration_ms(self.source, claimed_ms)
        if abs(duration_ms - max(1, claimed_ms or 1)) > 800:
            if progress is not None:
                progress(12, f'Sửa duration nguồn: {claimed_ms}ms → {duration_ms}ms ({self.label or PathName(self.source)})')
            settings = clamp_export_settings_to_source_duration(settings, source_path=self.source, source_duration_ms=duration_ms)
        if progress is not None:
            progress(12, f'Lập filtergraph: {self.label or PathName(self.source)}')
        plan = build_export_plan(self.source, self.output, settings, duration_ms=int(duration_ms), has_audio=bool(self.has_audio), source_bitrate_kbps=int(self.source_bitrate_kbps or 0), source_width=int(self.source_width or 0), source_height=int(self.source_height or 0), subtitle_document=self.subtitle_document)
        try:
            from core.av_sync import log_avsync_diagnostic
            from core.video_export import summarize_export_plan_for_log
            voice_on = bool(getattr(settings, 'voice_audio_enabled', False))
            voice_ms = int(getattr(settings, 'voice_duration_ms', 0) or 0)
            effect = str(getattr(settings, 'video_effect', 'none') or 'none')
            strength = int(getattr(settings, 'video_effect_strength', 0) or 0)
            log_avsync_diagnostic(f"[AVSync] Kế hoạch xuất: expected_ms={plan.expected_duration_ms} voice_on={voice_on} voice_ms={voice_ms} tts_fit={getattr(settings, 'tts_fit_mode', '')} sub_on={bool(getattr(settings, 'subtitle_enabled', False))} source_ms={int(duration_ms)} claimed_ms={int(claimed_ms)} video_effect={effect} strength={strength}")
            summary = summarize_export_plan_for_log(plan)
            if progress is not None:
                progress(12, summary.split('\n')[0])
            for line in summary.split('\n'):
                if line.strip():
                    log_avsync_diagnostic(f'[Xuất] {line}')
        except Exception:
            return plan
        return plan

class PathName:

    def __init__(self, path: str):
        self._path = path

    def __str__(self) -> str:
        from pathlib import Path
        return Path(self._path).name