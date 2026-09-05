from __future__ import annotations
import subprocess
import sys
import time
from pathlib import Path
from PySide6.QtCore import QEvent, QObject, QRunnable, QThreadPool, QUrl, Qt, Signal, QTimer
from PySide6.QtGui import QImage, QTransform
from PySide6.QtMultimedia import QVideoFrame
from config import PATHS
from ui_qt.workers.compatibility_preview import CompatibilityPreviewTask
from ui_qt.workers.scrub_preview import STILL_MAX_WIDTH, ScrubPreviewDecoder
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
PREVIEW_DECODE_MAX_WIDTH = int(STILL_MAX_WIDTH)
PREVIEW_DECODE_MIN_WIDTH = int(STILL_MAX_WIDTH)

def apply_display_rotation(image: QImage, degrees: int, mirrored: bool=False) -> QImage:
    if image is None or image.isNull():
        return image
    out = image
    if mirrored:
        out = out.mirrored(True, False)
    deg = int(degrees) % 360
    return out if deg == 0 else out.transformed(QTransform().rotate(deg))

def video_frame_display_transform(frame: QVideoFrame) -> tuple[int, bool]:
    degrees = 0
    mirrored = False
    try:
        rot = frame.rotation()
        degrees = int(getattr(rot, 'value', rot) or 0)
    except Exception:
        try:
            degrees = int(frame.rotationAngle() or 0)
        except Exception:
            degrees = 0
    try:
        mirrored = bool(frame.mirrored())
    except Exception:
        mirrored = False
    return (degrees % 360, mirrored)

def qimage_from_video_frame(frame: QVideoFrame) -> QImage:
    image = frame.toImage()
    if image.isNull():
        return image
    degrees, mirrored = video_frame_display_transform(frame)
    return apply_display_rotation(image, degrees, mirrored)

def clamp_preview_decode_width(width: int) -> int:
    try:
        value = int(width)
    except (TypeError, ValueError):
        value = PREVIEW_DECODE_MAX_WIDTH
    return max(PREVIEW_DECODE_MIN_WIDTH, min(PREVIEW_DECODE_MAX_WIDTH, value))

class _PreviewFrameConvertEmitter(QObject):
    converted = Signal(object)

class _PreviewFrameConvertRunnable(QRunnable):
    __doc__ = 'toImage() full-HD+ trên UI thread gây giật — decode + scale ở worker.'

    def __init__(self, video_frame: QVideoFrame, emitter: _PreviewFrameConvertEmitter, *, max_width: int):
        super().__init__()
        self._video_frame = video_frame
        self._emitter = emitter
        self._max_width = clamp_preview_decode_width(max_width)

    def run(self) -> None:
        try:
            frame = self._video_frame
            if frame is not None and frame.isValid():
                image = qimage_from_video_frame(frame)
                if image.isNull():
                    self._emitter.converted.emit(QImage())
                    return None
                if image.width() > self._max_width:
                    image = image.scaledToWidth(self._max_width, Qt.TransformationMode.SmoothTransformation)
                self._emitter.converted.emit(image)
            else:
                self._emitter.converted.emit(QImage())
                return None
        except Exception:
            try:
                self._emitter.converted.emit(QImage())
            except Exception:
                pass
            return None

class QtPlaybackController(QObject):
    positionChanged = Signal(int)
    durationChanged = Signal(int)
    playingChanged = Signal(bool)
    errorOccurred = Signal(str)
    frameReady = Signal(object)
    modeChanged = Signal(str)

    def __init__(self, parent: QObject | None=None, *, thread_pool=None, compatibility_task_factory=CompatibilityPreviewTask):
        super().__init__(parent)
        self.thread_pool = thread_pool or QThreadPool.globalInstance()
        self.compatibility_task_factory = compatibility_task_factory
        self.compatibility_task = None
        self.retired_compatibility_tasks = set()
        self.compatibility_mode = False
        self.video_output = None
        self._source_path = ''
        self._player_source_path = ''
        self._pending_position_ms = 0
        self._player = None
        self._audio = None
        self._video_sink = None
        self._volume_percent = 100
        self._playback_rate = 1.0
        self._clip_stretch_rate = 1.0
        self._join_settle_until = 0.0
        self._join_settle_target_ms = -1
        self._pending_clip_stretch = None
        self._mute_original = False
        self._voice_enabled = False
        self._voice_path = ''
        self._voice_volume = 100
        self._tts_fit_mode = 'stretch_video'
        self._voice_duration_ms = 0
        self._source_duration_ms = 0
        self._bgm_enabled = False
        self._bgm_path = ''
        self._bgm_volume = 35
        self._video_vocal_enabled = False
        self._video_vocal_path = ''
        self._video_vocal_volume = 0
        self._video_bgm_enabled = False
        self._video_inst_path = ''
        self._video_bgm_volume = 0
        self._legacy_sep_path = ''
        self._voice_proc = None
        self._bgm_proc = None
        self._orig_vocal_proc = None
        self._orig_inst_proc = None
        self._sfx_events = []
        self._sfx_timers = []
        self._sfx_procs = []
        self._mix_armed = False
        self._mix_watchdog = QTimer(self)
        self._mix_watchdog.setSingleShot(True)
        self._mix_watchdog.setInterval(450)
        self._mix_watchdog.timeout.connect(self._verify_mix_armed)
        self._scrub_target_ms = 0
        self._scrub_seek_timer = QTimer(self)
        self._scrub_seek_timer.setSingleShot(True)
        self._scrub_seek_timer.setInterval(16)
        self._scrub_seek_timer.timeout.connect(self._flush_scrub_seek)
        self._frame_convert_emitter = _PreviewFrameConvertEmitter(self)
        self._frame_convert_emitter.converted.connect(self._on_preview_frame_converted)
        self._frame_convert_pending = False
        self._frame_convert_started_at = 0.0
        self._preview_decode_width = PREVIEW_DECODE_MAX_WIDTH
        self._ignore_qt_frames = False
        self._playback_shutdown_done = False
        self._scrub_decoder = ScrubPreviewDecoder(self)
        self._scrub_decoder.frameReady.connect(self._on_scrub_frame_ready, Qt.ConnectionType.QueuedConnection)
        self._ignore_zero_until = 0.0
        self._at_end_of_media = False
        self.destroyed.connect(self.shutdown)
        if parent is not None:
            parent.installEventFilter(self)
            return None

    def eventFilter(self, watched, event):
        parent = self.parent()
        if parent is not None and watched is parent and (event.type() == QEvent.Type.DeferredDelete):
            self.shutdown()
        return super().eventFilter(watched, event)

    @property
    def player(self):
        return self._ensure_player()

    @property
    def video_sink(self):
        self._ensure_player()
        return self._video_sink

    def _ensure_player(self):
        if self._player is not None:
            pass
        else:
            from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer, QVideoSink
            self._player = QMediaPlayer(self)
            self._audio = QAudioOutput(self)
            self._video_sink = QVideoSink(self)
            self._player.setAudioOutput(self._audio)
            self._player.setVideoSink(self._video_sink)
            self._video_sink.videoFrameChanged.connect(self._on_qt_frame)
            self._player.positionChanged.connect(self._forward_player_position)
            self._player.durationChanged.connect(lambda value: self.durationChanged.emit(int(value)))
            self._player.playbackStateChanged.connect(self._emit_playing_state)
            self._player.mediaStatusChanged.connect(self._on_media_status_changed)
            self._player.errorOccurred.connect(lambda _error, message: self.errorOccurred.emit(message or 'Không thể phát video này'))
            self._apply_original_volume()
            self._apply_effective_playback_rate()
        return self._player

    def _on_media_status_changed(self, status) -> None:
        if self._player is None:
            pass
        else:
            end = type(self._player).MediaStatus.EndOfMedia
            if status != end:
                if status == type(self._player).MediaStatus.LoadedMedia:
                    self._at_end_of_media = False
            else:
                self._at_end_of_media = True
                self._ignore_qt_frames = True
                try:
                    duration = max(0, int(self._player.duration() or 0))
                except Exception:
                    duration = 0
                if duration > 0:
                    self._pending_position_ms = duration
                    self.positionChanged.emit(duration)
                try:
                    self._player.pause()
                except Exception:
                    pass
                self._disarm_mix_audio()
                self.stop_mix_audio()
                try:
                    self._scrub_decoder.set_resource_save_mode(False)
                except Exception:
                    pass
                self.playingChanged.emit(False)

    def _disarm_mix_audio(self) -> None:
        self._mix_armed = False
        try:
            self._mix_watchdog.stop()
        except Exception:
            pass

    def _verify_mix_armed(self) -> None:
        if self._mix_armed:
            if self.is_playing:
                pass
            else:
                self._disarm_mix_audio()
                self.stop_mix_audio()
            return None

    def _forward_player_position(self, value: int) -> None:
        if self.is_playing:
            pos = max(0, int(value))
            if pos < 500 and int(self._pending_position_ms) > 1500 and (time.monotonic() < float(self._ignore_zero_until or 0.0)):
                return None
            self._pending_position_ms = pos
            self.positionChanged.emit(pos)
        else:
            return None

    @property
    def is_playing(self) -> bool:
        return False if self._player is None else self._player.playbackState() == type(self._player).PlaybackState.PlayingState

    def attach(self, widget) -> None:
        self.video_output = widget

    def load(self, path: str, video_codec: str='', start_ms: int=0) -> None:
        self._cancel_compatibility_task()
        path = str(path or '').strip()
        same_source = bool(path) and path == str(self._source_path or '')
        if same_source:
            self._scrub_decoder.release_captures_for_qt_play()
        else:
            self._scrub_decoder.close()
        self._disarm_mix_audio()
        self.stop_mix_audio()
        if self._player is not None:
            self._player.stop()
        self._source_path = path
        self._player_source_path = ''
        start = max(0, int(start_ms))
        self._pending_position_ms = start
        self._scrub_target_ms = start
        self.compatibility_mode = video_codec.strip().lower() == 'av1'
        mode = 'compatibility' if self.compatibility_mode else 'qt'
        self.modeChanged.emit(mode)
        self._ignore_qt_frames = True
        self._scrub_decoder.prepare_source(path)
        self._scrub_decoder.request_frame(path, start, precise=True)

    def play(self) -> None:
        if self._source_path:
            self._ignore_qt_frames = False
            self._at_end_of_media = False
            self._scrub_seek_timer.stop()
            try:
                self._scrub_decoder.release_captures_for_qt_play()
                self._scrub_decoder.set_resource_save_mode(True)
            except Exception:
                pass
            try:
                player = self._prepare_player_source()
                want = max(0, int(self._pending_position_ms))
                try:
                    duration = max(0, int(player.duration() or 0))
                except Exception:
                    duration = 0
                if duration > 0 and want >= max(0, duration - 150):
                    want = 0
                    self._pending_position_ms = 0
                if want > 0:
                    player.setPosition(want)
                    self._ignore_zero_until = time.monotonic() + 2.5
                else:
                    player.setPosition(0)
                player.play()
                if self.compatibility_mode:
                    self._start_compatibility_task(want or int(player.position()), one_frame=False)
            except Exception as exc:
                from core.av_sync import log_avsync_diagnostic
                log_avsync_diagnostic(f"[PreviewAudio] LỖI trong play() trước khi phát âm thanh: {f'{exc!r}'}")
                try:
                    self._scrub_decoder.set_resource_save_mode(False)
                except Exception:
                    pass
                self._disarm_mix_audio()
                self.stop_mix_audio()
                self.errorOccurred.emit(f'Không phát được video: {exc}')
            self._mix_armed = True
            self.sync_mix_audio(position_ms=want or int(player.position()))
            self._mix_watchdog.start()

    def pause(self) -> None:
        self._disarm_mix_audio()
        if self._player is not None:
            self._player.pause()
        self._cancel_compatibility_task()
        self.stop_mix_audio()
        try:
            self._scrub_decoder.set_resource_save_mode(False)
        except Exception:
            pass

    def set_export_resource_mode(self, active: bool) -> None:
        active = bool(active)
        if active:
            self.pause()
            self._scrub_seek_timer.stop()
        decoder = getattr(self, '_scrub_decoder', None)
        if decoder is not None:
            if hasattr(decoder, 'set_resource_save_mode'):
                decoder.set_resource_save_mode(active)
            return None

    def stop(self) -> None:
        self._disarm_mix_audio()
        if self._player is not None:
            self._player.stop()
        self._cancel_compatibility_task()
        self.stop_mix_audio()
        self._ignore_qt_frames = False
        self._at_end_of_media = False
        try:
            self._scrub_decoder.set_resource_save_mode(False)
        except Exception:
            pass

    def shutdown(self) -> None:
        if getattr(self, '_playback_shutdown_done', False):
            pass
        else:
            self._playback_shutdown_done = True
            try:
                self.destroyed.disconnect(self.shutdown)
            except Exception:
                pass
            try:
                self._scrub_seek_timer.stop()
            except Exception:
                pass
            decoder = getattr(self, '_scrub_decoder', None)
            if decoder is not None:
                decoder.shutdown()

    def seek(self, position_ms: int, *, sync_mix: bool) -> None:
        self._scrub_seek_timer.stop()
        position = max(0, int(position_ms))
        self._pending_position_ms = position
        self._scrub_target_ms = position
        if self.is_playing:
            if self._player is not None:
                self._player.setPosition(position)
                self._ignore_zero_until = time.monotonic() + 2.5
            self._join_settle_target_ms = position
            self._join_settle_until = time.monotonic() + 0.55
            self._ignore_qt_frames = False
            if self.compatibility_mode:
                self._start_compatibility_task(position, one_frame=False)
            if sync_mix:
                if self._mix_armed or self.is_playing:
                    self.sync_mix_audio(position_ms=position)
                return None
        else:
            self._ignore_qt_frames = True
            if self._source_path:
                self._scrub_decoder.request_frame(self._source_path, position, precise=True, show_atlas=False)
            return None

    def seek_scrub(self, position_ms: int) -> None:
        position = max(0, int(position_ms))
        self._pending_position_ms = position
        self._scrub_target_ms = position
        if self.is_playing:
            self.pause()
        self._ignore_qt_frames = True
        if self._source_path:
            self._scrub_decoder.request_frame(self._source_path, position, precise=False)
            return None

    def _flush_scrub_seek(self) -> None:
        if not self.is_playing and self._source_path:
            self._ignore_qt_frames = True
            self._scrub_decoder.request_frame(self._source_path, self._scrub_target_ms)
        else:
            return None

    def _on_scrub_frame_ready(self, image: QImage) -> None:
        if image is None or image.isNull():
            return None
        if self.is_playing:
            return None
        self.frameReady.emit(image)

    def set_volume(self, percent: int) -> None:
        self._volume_percent = int(percent)
        self._apply_original_volume()

    def _apply_effective_playback_rate(self) -> None:
        rate = max(0.1, min(8.0, float(self._playback_rate) * float(self._clip_stretch_rate)))
        if self._player is not None:
            self._player.setPlaybackRate(rate)
            return None

    def set_speed(self, rate: float) -> None:
        self._playback_rate = max(0.1, min(8.0, float(rate)))
        self._apply_effective_playback_rate()
        if self.is_playing:
            self.sync_mix_audio()
            return None

    def set_clip_stretch_rate(self, rate: float) -> None:
        stretch = max(0.25, min(4.0, float(rate) if rate else 1.0))
        if self.is_join_settling():
            self._pending_clip_stretch = stretch
            return None
        if abs(stretch - float(self._clip_stretch_rate)) < 0.008:
            return None
        self._clip_stretch_rate = stretch
        self._apply_effective_playback_rate()

    def is_join_settling(self) -> bool:
        until = float(getattr(self, '_join_settle_until', 0.0) or 0.0)
        if until <= 0.0:
            return False
        now = time.monotonic()
        if now > until:
            self._join_settle_until = 0.0
            pending = getattr(self, '_pending_clip_stretch', None)
            if pending is not None:
                self._pending_clip_stretch = None
                self.set_clip_stretch_rate(float(pending))
            return False
        target = int(getattr(self, '_join_settle_target_ms', -1) or -1)
        if target < 0 or self._player is None:
            pass
        else:
            try:
                pos = int(self._player.position() or 0)
            except Exception:
                return True
            if abs(pos - target) <= 280:
                self._join_settle_until = 0.0
                pending = getattr(self, '_pending_clip_stretch', None)
                if pending is not None:
                    self._pending_clip_stretch = None
                    self.set_clip_stretch_rate(float(pending))
                return False
        return True

    def configure_mix_audio(self, *, mute_original: bool, original_volume: int, original_sep_path: str, video_vocal_enabled: bool, video_vocal_path: str, video_vocal_volume: int, video_bgm_enabled: bool, video_instrumental_path: str, video_bgm_volume: int, voice_enabled: bool, voice_path: str, voice_volume: int, background_enabled: bool, background_path: str, background_volume: int, sfx_events: list | tuple | None, tts_fit_mode: str, voice_duration_ms: int, source_duration_ms: int) -> None:
        self._mute_original = bool(mute_original)
        self._volume_percent = int(original_volume)
        self._legacy_sep_path = str(original_sep_path or '').strip()
        self._video_vocal_enabled = bool(video_vocal_enabled)
        self._video_vocal_path = str(video_vocal_path or '').strip()
        self._video_vocal_volume = max(0, min(100, int(video_vocal_volume)))
        self._video_bgm_enabled = bool(video_bgm_enabled)
        self._video_inst_path = str(video_instrumental_path or '').strip()
        self._video_bgm_volume = max(0, min(100, int(video_bgm_volume)))
        self._voice_enabled = bool(voice_enabled)
        self._voice_path = str(voice_path or '').strip()
        self._voice_volume = max(0, min(200, int(voice_volume)))
        self._tts_fit_mode = str(tts_fit_mode or 'stretch_video')
        self._voice_duration_ms = max(0, int(voice_duration_ms or 0))
        self._source_duration_ms = max(0, int(source_duration_ms or 0))
        self._bgm_enabled = bool(background_enabled)
        self._bgm_path = str(background_path or '').strip()
        self._bgm_volume = max(0, min(200, int(background_volume)))
        if sfx_events is not None:
            self._sfx_events = [dict(item) for item in sfx_events if isinstance(item, dict)]
        self._apply_original_volume()
        if self.is_playing:
            self.sync_mix_audio()
            return None

    def _preview_source_duration_ms(self) -> int:
        source_dur = int(self._source_duration_ms or 0)
        if source_dur <= 0 and self._player is not None:
            try:
                source_dur = max(0, int(self._player.duration()))
            except Exception:
                source_dur = 0
                return source_dur
        return source_dur

    def _mapped_voice_seek_ms(self, source_position_ms: int) -> int:
        from core.av_sync import preview_voice_seek_ms
        return preview_voice_seek_ms(source_position_ms, source_duration_ms=self._preview_source_duration_ms(), voice_duration_ms=int(self._voice_duration_ms or 0), tts_fit_mode=str(self._tts_fit_mode or 'stretch_video'))

    def _stretch_tempo_rate(self) -> float:
        from core.av_sync import preview_voice_tempo_rate
        return preview_voice_tempo_rate(source_duration_ms=self._preview_source_duration_ms(), voice_duration_ms=int(self._voice_duration_ms or 0), tts_fit_mode=str(self._tts_fit_mode or 'stretch_video'))

    def sync_mix_audio(self, position_ms: int | None=None) -> None:
        if self._mix_armed or self.is_playing:
            pos = max(0, int(position_ms)) if position_ms is not None else self.current_position_ms()
            voice_pos = self._mapped_voice_seek_ms(pos)
            stretch_tempo = self._stretch_tempo_rate()
            self._start_voice_audio(voice_pos, tempo_rate=stretch_tempo)
            self._start_bgm_audio(voice_pos, tempo_rate=stretch_tempo)
            self._start_video_stem_audio(pos)
            self._schedule_sfx_audio(pos)
        else:
            self.stop_mix_audio()
            return None

    def stop_mix_audio(self) -> None:
        self._stop_proc('_voice_proc')
        self._stop_proc('_bgm_proc')
        self._stop_proc('_orig_vocal_proc')
        self._stop_proc('_orig_inst_proc')
        self._stop_sfx_audio()

    def _stop_sfx_audio(self) -> None:
        for timer in self._sfx_timers:
            try:
                timer.stop()
                timer.deleteLater()
            except Exception:
                continue
        self._sfx_timers = []
        for proc in self._sfx_procs:
            if proc is None:
                pass
            else:
                self._kill_ffplay_proc(proc)
        self._sfx_procs = []

    def _schedule_sfx_audio(self, position_ms: int) -> None:
        self._stop_sfx_audio()
        if self.is_playing:
            start_sec = max(0.0, float(position_ms) / 1000.0)
            for event in self._sfx_events:
                path = str(event.get('file', '') or '').strip()
                if path and Path(path).is_file():
                    try:
                        time_sec = float(event.get('time_sec', 0.0) or 0.0)
                        if time_sec + 0.001 < start_sec:
                            pass
                        else:
                            try:
                                volume = float(event.get('volume', 0.7) or 0.7)
                            except (TypeError, ValueError):
                                volume = 0.7
                            delay_ms = max(0, int(round((time_sec - start_sec) * 1000.0)))
                            timer = QTimer(self)
                            timer.setSingleShot(True)
                            timer.timeout.connect(lambda p=path, v=volume: self._spawn_sfx_proc(p, v))
                            self._sfx_timers.append(timer)
                            timer.start(delay_ms)
                    except (TypeError, ValueError):
                        pass

    def _spawn_sfx_proc(self, path: str, volume: float) -> None:
        if self.is_playing:
            audio_path = Path(path)
            if audio_path.is_file():
                gain = max(0.0, min(3.0, float(volume)))
                if gain <= 0.001:
                    pass
                else:
                    try:
                        proc = subprocess.Popen([self._ffplay_bin(), '-nodisp', '-autoexit', '-loglevel', 'quiet', '-af', f'volume={gain:.4f}', str(audio_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
                        self._sfx_procs.append(proc)
                        try:
                            from core.ffplay_guard import register_ffplay_pid
                            register_ffplay_pid(proc.pid)
                        except Exception:
                            return None
                    except OSError:
                        pass

    def _start_video_stem_audio(self, position_ms: int) -> None:
        vocal_on = self._video_vocal_enabled and self._video_vocal_volume > 0 and self._video_vocal_path
        inst_on = self._video_bgm_enabled and self._video_bgm_volume > 0 and self._video_inst_path
        if vocal_on:
            gain = max(0.0, min(2.0, self._video_vocal_volume / 100.0))
            self._start_overlay_proc('_orig_vocal_proc', self._video_vocal_path, position_ms=position_ms, gain=gain, loop=False)
        else:
            self._stop_proc('_orig_vocal_proc')
        if inst_on:
            gain = max(0.0, min(2.0, self._video_bgm_volume / 100.0))
            self._start_overlay_proc('_orig_inst_proc', self._video_inst_path, position_ms=position_ms, gain=gain, loop=False)
        else:
            self._stop_proc('_orig_inst_proc')
        if vocal_on:
            pass
        else:
            if inst_on:
                pass
            elif self._legacy_sep_path:
                gain = max(0.0, min(2.0, self._volume_percent / 100.0))
                if self._mute_original:
                    pass
                elif gain > 0:
                    self._start_overlay_proc('_orig_vocal_proc', self._legacy_sep_path, position_ms=position_ms, gain=gain, loop=False)
            return None

    def _start_original_sep_audio(self, position_ms: int) -> None:
        self._start_video_stem_audio(position_ms)

    def current_position_ms(self) -> int:
        return (max(0, int(self._player.position())) if self._player is not None else max(0, int(self._pending_position_ms))) if self.is_playing else max(0, int(self._pending_position_ms))

    def _apply_original_volume(self) -> None:
        if self._audio is None:
            return None
        use_stems = self._video_vocal_enabled and self._video_vocal_volume > 0 and self._video_vocal_path or (self._video_bgm_enabled and self._video_bgm_volume > 0 and self._video_inst_path) or (self._legacy_sep_path and (not self._mute_original) and (self._volume_percent > 0))
        if use_stems:
            self._audio.setVolume(0.0)
            return None
        if self._mute_original:
            self._audio.setVolume(0.0)
            return None
        want = 0
        if self._video_vocal_enabled and self._video_vocal_volume > 0:
            want = max(want, self._video_vocal_volume)
        if self._video_bgm_enabled and self._video_bgm_volume > 0:
            want = max(want, self._video_bgm_volume)
        if want <= 0:
            want = self._volume_percent
        self._audio.setVolume(max(0.0, min(1.0, want / 100.0)))

    def _emit_playing_state(self, state) -> None:
        if self._player is None:
            self._disarm_mix_audio()
            self.playingChanged.emit(False)
            return None
        playing = state == type(self._player).PlaybackState.PlayingState
        self.playingChanged.emit(playing)
        if playing:
            self._mix_armed = True
            return None
        self._disarm_mix_audio()
        self.stop_mix_audio()

    def _prepare_player_source(self):
        player = self._ensure_player()
        if self.compatibility_mode:
            player.setVideoOutput(None)
            player.setVideoSink(None)
        else:
            player.setVideoOutput(None)
            player.setVideoSink(self._video_sink)
        if self._player_source_path != self._source_path:
            player.setSource(QUrl.fromLocalFile(self._source_path))
            self._player_source_path = self._source_path
        if self._pending_position_ms:
            player.setPosition(self._pending_position_ms)
        return player

    def _on_qt_frame(self, frame) -> None:
        if self.compatibility_mode:
            pass
        elif getattr(self, '_at_end_of_media', False):
            pass
        else:
            try:
                if frame is not None and frame.isValid():
                    if self._ignore_qt_frames and (not self.is_playing):
                        pass
                    elif not self.is_playing:
                        pass
                    elif self.is_join_settling():
                        pass
                    else:
                        import time as _time
                        now = _time.monotonic()
                        started = float(getattr(self, '_frame_convert_started_at', 0.0) or 0.0)
                        if self._frame_convert_pending and now - started < 0.12:
                            pass
                        else:
                            try:
                                cloned = QVideoFrame(frame)
                            except Exception:
                                pass
                            self._frame_convert_pending = True
                            self._frame_convert_started_at = now
                            self.thread_pool.start(_PreviewFrameConvertRunnable(cloned, self._frame_convert_emitter, max_width=self._preview_decode_width))
                    return None
            except Exception:
                return None

    def set_preview_decode_width(self, width: int) -> None:
        self._preview_decode_width = clamp_preview_decode_width(max(int(width or 0), PREVIEW_DECODE_MAX_WIDTH))

    def _on_preview_frame_converted(self, image: QImage) -> None:
        self._frame_convert_pending = False
        if self.is_join_settling():
            return None
        if not image.isNull():
            self.frameReady.emit(image)
            return None

    def _start_compatibility_task(self, start_ms: int, *, one_frame: bool) -> None:
        if self._source_path:
            self._cancel_compatibility_task()
            try:
                task = self.compatibility_task_factory(self._source_path, start_ms=max(0, int(start_ms)), one_frame=one_frame, max_width=self._preview_decode_width)
            except TypeError:
                task = self.compatibility_task_factory(self._source_path, start_ms=max(0, int(start_ms)), one_frame=one_frame)
            self.compatibility_task = task

            def forward_frame(image) -> None:
                if self.compatibility_task is task:
                    self.frameReady.emit(image)
                    return None

            def forward_error(message: str) -> None:
                if self.compatibility_task is task:
                    self.errorOccurred.emit(message)
                    return None

            def clear_task() -> None:
                self.retired_compatibility_tasks.discard(task)
                if self.compatibility_task is task:
                    self.compatibility_task = None
                    return None
            task.signals.frameReady.connect(forward_frame)
            task.signals.failed.connect(forward_error)
            task.signals.finished.connect(clear_task)
            self.thread_pool.start(task)

    def _cancel_compatibility_task(self) -> None:
        task = self.compatibility_task
        self.compatibility_task = None
        if task is not None:
            self.retired_compatibility_tasks.add(task)
            task.cancel()
            return None

    def _ffplay_bin(self) -> str:
        ffplay = PATHS.ffplay
        return str(ffplay) if ffplay.is_file() else 'ffplay'

    def _audio_filter(self, gain: float, *, tempo_rate: float) -> str:
        parts = []
        rate = float(self._playback_rate) * max(0.05, float(tempo_rate or 1.0))
        while rate > 2.000001:
            parts.append('atempo=2.0')
            rate /= 2.0
        while rate < 0.499999:
            parts.append('atempo=0.5')
            rate /= 0.5
        if abs(rate - 1.0) > 0.01:
            parts.append(f'atempo={rate:.4g}')
        parts.append(f'volume={max(0.0, gain):.3f}')
        return ','.join(parts)

    def _start_overlay_proc(self, attr: str, path: str, *, position_ms: int, gain: float, loop: bool, tempo_rate: float) -> None:
        if self._mix_armed or self.is_playing:
            self._stop_proc(attr)
            audio_path = Path(path)
            if not audio_path.is_file():
                pass
            elif gain <= 0.001:
                pass
            else:
                tempo = max(0.05, float(tempo_rate or 1.0))
                meta_key = f'{attr}_overlay_meta'
                prev = getattr(self, meta_key, None)
                proc = getattr(self, attr, None)
                if isinstance(prev, dict) and prev.get('path') == str(audio_path) and (abs(float(prev.get('gain', 0)) - float(gain)) < 0.004) and (abs(float(prev.get('tempo_rate', 1.0)) - tempo) < 0.004) and (int(prev.get('position_ms', -1)) == int(position_ms)) and (proc is not None) and (proc.poll() is None):
                    pass
                else:
                    pos_sec = max(0.0, int(position_ms) / 1000.0)
                    cmd = [self._ffplay_bin(), '-nodisp', '-autoexit', '-vn', '-infbuf', '-fflags', 'nobuffer', '-probesize', '32', '-analyzeduration', '0', '-loglevel', 'quiet', '-volume', '100']
                    af = self._audio_filter(gain, tempo_rate=tempo)
                    if pos_sec > 0.05:
                        pre = max(0.0, pos_sec - 0.35)
                        cmd += ['-ss', f'{pre:.3f}', '-af', f'atrim=start={pos_sec:.3f},asetpts=PTS-STARTPTS,{af}']
                    else:
                        cmd += ['-af', af]
                    if loop:
                        cmd += ['-loop', '0']
                    cmd.append(str(audio_path))
                    try:
                        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
                    except Exception as exc:
                        from core.av_sync import log_avsync_diagnostic
                        log_avsync_diagnostic(f"[PreviewAudio] LỖI khởi chạy ffplay cho {attr}: {f'{exc!r}'} — bin={f'{self._ffplay_bin()!r}'} file={audio_path}")
                        self.errorOccurred.emit(f'Không phát được lớp âm thanh: {exc}')
                        return None
                    if self._mix_armed or self.is_playing:
                        try:
                            from core.ffplay_guard import register_ffplay_pid
                            register_ffplay_pid(proc.pid)
                        except Exception:
                            pass
                        from core.av_sync import log_avsync_diagnostic
                        log_avsync_diagnostic(f"[PreviewAudio] {attr}: PID={getattr(proc, 'pid', '?')} gain={gain:.3f} tempo={tempo:.4f} pos_ms={position_ms} file={audio_path}")
                        setattr(self, attr, proc)
                        setattr(self, meta_key, {'path': str(audio_path), 'gain': float(gain), 'tempo_rate': tempo, 'position_ms': int(position_ms)})
                    else:
                        self._kill_ffplay_proc(proc)
        else:
            self._stop_proc(attr)

    def _start_voice_audio(self, position_ms: int, *, tempo_rate: float) -> None:
        if self._voice_enabled and self._voice_path:
            gain = max(0.0, min(2.0, self._voice_volume / 100.0))
            self._start_overlay_proc('_voice_proc', self._voice_path, position_ms=position_ms, gain=gain, tempo_rate=tempo_rate)
        else:
            self._stop_proc('_voice_proc')
            return None

    def _start_bgm_audio(self, position_ms: int, *, tempo_rate: float) -> None:
        if self._bgm_enabled and self._bgm_path:
            gain = max(0.0, min(2.0, self._bgm_volume / 100.0))
            self._start_overlay_proc('_bgm_proc', self._bgm_path, position_ms=position_ms, gain=gain, loop=True, tempo_rate=tempo_rate)
        else:
            self._stop_proc('_bgm_proc')
            return None

    def _kill_ffplay_proc(self, proc: subprocess.Popen) -> None:
        pid = int(getattr(proc, 'pid', 0) or 0)
        try:
            from core.ffplay_guard import unregister_ffplay_pid
            unregister_ffplay_pid(pid)
        except Exception:
            pass
        if proc.poll() is not None:
            pass
        else:
            if sys.platform == 'win32' and pid > 0:
                try:
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW, check=False)
                except Exception:
                    pass
            try:
                if proc.poll() is None:
                    proc.kill()
            except OSError:
                pass
            try:
                proc.wait(timeout=0.8)
            except Exception:
                pass

    def _stop_proc(self, attr: str) -> None:
        proc = getattr(self, attr, None)
        setattr(self, attr, None)
        setattr(self, f'{attr}_overlay_meta', None)
        if proc is None:
            return None
        self._kill_ffplay_proc(proc)