'Scrub CapCut: atlas progressive trong RAM → kéo nhanh vẫn kịp hình.\n\n- request_frame: lấy frame atlas gần nhất NGAY (O(1)), không chờ decode.\n- Nền: ffmpeg xuất jpg dần → nạp atlas (vài giây đầu đã lia được).\n- Worker chỉ tinh chỉnh khi rảnh / khi thả tay (seek).\n- Không dùng OpenCV CAP_FFMPEG (tránh crash với Qt).\n'
from __future__ import annotations
import hashlib
import subprocess
import tempfile
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any
from PySide6.QtCore import QObject, QTimer, Signal
from PySide6.QtGui import QImage
from config import FFMPEG_PATH
try:
    from core.ml_runtime import is_demucs_busy
except Exception:

    def is_demucs_busy() -> bool:
        return False
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
SCRUB_MAX_WIDTH = 720
STILL_MAX_WIDTH = 1440
ATLAS_WIDTH = 480
ATLAS_FPS = 2
ATLAS_INTERVAL_MS = 500
SCRUB_PROXY_FPS = 8
SCRUB_PROXY_CRF = 26
SCRUB_CACHE_TAG = 'v5'
SCRUB_UPGRADE_MIN_S = 0.045
_PROXY_ROOT = Path(tempfile.gettempdir()) / 'VideoToolsPro' / 'scrub_proxy'
_MSMF_OPEN_LOCK = threading.RLock()

def _open_capture_msmf_only(path: str) -> Any | None:
    import cv2
    backend = getattr(cv2, 'CAP_MSMF', None)
    if backend is None:
        return None
    file_path = str(path or '').strip()
    if file_path and Path(file_path).is_file():
        with _MSMF_OPEN_LOCK:
            cap = None
            try:
                cap = cv2.VideoCapture(file_path, int(backend))
                if cap is None or not cap.isOpened():
                    if cap is not None:
                        try:
                            cap.release()
                        except Exception:
                            pass
                    return None
            except Exception:
                cap = None
            return cap
    else:
        return None

def _release_capture_msmf(cap: Any) -> None:
    if cap is None:
        return None
    with _MSMF_OPEN_LOCK:
        try:
            cap.release()
        except Exception:
            pass

class ScrubPreviewDecoder(QObject):
    frameReady = Signal(object)
    proxyReady = Signal(str)

    def __init__(self, parent: QObject | None=None):
        super().__init__(parent)
        self._lock = threading.RLock()
        self._cap = None
        self._path = ''
        self._decode_path = ''
        self._still_cap = None
        self._still_path = ''
        self._still_gen = 0
        self._want_path = ''
        self._pending_ms = None
        self._precise = False
        self._proxy_path = ''
        self._proxy_source = ''
        self._proxy_building_for = ''
        self._reopen_needed = False
        self._ffmpeg_busy = False
        self._ffmpeg_last_at = 0.0
        self._last_scrub_decode_at = 0.0
        self._cap_gen = 0
        self._atlas = {}
        self._atlas_keys = []
        self._atlas_source = ''
        self._atlas_building_for = ''
        self._out_frames = deque(maxlen=2)
        self._wake = threading.Condition(self._lock)
        self._stop = False
        self._resource_save = False
        self._decode_fail_streak = 0
        self._decode_fail_until = 0.0
        self._pump = QTimer(self)
        self._pump.setInterval(80)
        self._pump.timeout.connect(self._pump_ui_frames)
        self._pump.start()
        self._worker = threading.Thread(target=self._worker_loop, name='vtp-scrub-preview', daemon=True)
        self._worker.start()

    def set_resource_save_mode(self, active: bool) -> None:
        active = bool(active)
        with self._lock:
            if self._resource_save == active:
                return None
            self._resource_save = active
            if active:
                self._pending_ms = None
                self._out_frames.clear()
                self._wake.notify_all()
        if active:
            self._pump.stop()
        elif self._pump.isActive():
            pass
        else:
            self._pump.start()

    def release_captures_for_qt_play(self) -> None:
        with self._lock:
            self._pending_ms = None
            self._out_frames.clear()
            cap = self._cap
            still = self._still_cap
            self._cap = None
            self._still_cap = None
            self._path = ''
            self._decode_path = ''
            self._still_path = ''
            self._reopen_needed = True
            self._cap_gen += 1
            self._still_gen += 1
            self._wake.notify_all()
        _release_capture_msmf(cap)
        _release_capture_msmf(still)

    def close(self) -> None:
        with self._lock:
            self._pending_ms = None
            self._want_path = ''
            self._proxy_path = ''
            self._proxy_source = ''
            self._proxy_building_for = ''
            self._atlas_building_for = ''
            self._reopen_needed = False
            self._out_frames.clear()
            self._atlas.clear()
            self._atlas_keys.clear()
            self._atlas_source = ''
            cap = self._cap
            still = self._still_cap
            self._cap = None
            self._still_cap = None
            self._path = ''
            self._decode_path = ''
            self._still_path = ''
            self._wake.notify_all()
        _release_capture_msmf(cap)
        _release_capture_msmf(still)

    def shutdown(self) -> None:
        self.close()
        try:
            self._pump.stop()
        except Exception:
            pass
        with self._lock:
            self._stop = True
            self._wake.notify_all()
        worker = getattr(self, '_worker', None)
        if worker is not None:
            if worker is not threading.current_thread():
                worker.join(timeout=2.0)

    def prepare_source(self, path: str) -> None:
        path = str(path or '').strip()
        if path:
            with self._lock:
                same_atlas = self._atlas_source == path and bool(self._atlas)
                same_proxy = self._proxy_source == path and self._proxy_path and Path(self._proxy_path).is_file()
                if same_atlas and same_proxy:
                    return None
                if not same_atlas and self._atlas_building_for != path:
                    self._atlas.clear()
                    self._atlas_keys.clear()
                    self._atlas_source = ''
                    self._atlas_building_for = path
                    start_atlas = True
                else:
                    start_atlas = False
                cached = self._proxy_file_for(path)
                if cached.is_file() and cached.stat().st_size > 1024:
                    self._proxy_path = str(cached)
                    self._proxy_source = path
                    self._reopen_needed = True
                    start_proxy = False
                elif self._proxy_building_for == path:
                    start_proxy = False
                else:
                    self._proxy_building_for = path
                    start_proxy = True
            if start_atlas:
                threading.Thread(target=self._build_atlas, args=(path,), name='vtp-scrub-atlas', daemon=True).start()
            if start_proxy:
                threading.Thread(target=self._build_proxy, args=(path,), name='vtp-scrub-proxy', daemon=True).start()

    def request_frame(self, path: str, position_ms: int, *, precise: bool = True, show_atlas: bool = False) -> None:
        with self._lock:
            if self._resource_save:
                return None
        path = str(path or '').strip()
        if path:
            ms = max(0, int(position_ms))
            instant = self._atlas_nearest(path, ms)
            if show_atlas and instant is not None and (not instant.isNull()):
                with self._lock:
                    self._out_frames.append(instant)
            with self._lock:
                self._want_path = path
                self._pending_ms = ms
                if precise:
                    self._precise = True
                self._wake.notify()
        else:
            return None

    def _atlas_nearest(self, path: str, position_ms: int) -> QImage | None:
        with self._lock:
            if self._atlas_source == path and self._atlas_keys:
                keys = self._atlas_keys
                hi, lo = (len(keys) - 1, 0)
                target = max(0, int(position_ms))
                while lo <= hi:
                    mid = (lo + hi) // 2
                    if keys[mid] < target:
                        lo = mid + 1
                    else:
                        hi = mid - 1
                candidates = []
                if 0 <= hi < len(keys):
                    candidates.append(keys[hi])
                if 0 <= lo < len(keys):
                    candidates.append(keys[lo])
                if candidates:
                    best = min(candidates, key=lambda k: abs(k - target))
                    return self._atlas.get(best)
            return None

    def _proxy_file_for(self, path: str) -> Path:
        _PROXY_ROOT.mkdir(parents=True, exist_ok=True)
        try:
            mtime = int(Path(path).stat().st_mtime)
        except OSError:
            mtime = 0
        key = hashlib.sha1(f'{path}|{mtime}|proxy|{SCRUB_CACHE_TAG}|{SCRUB_MAX_WIDTH}|{SCRUB_PROXY_FPS}|{SCRUB_PROXY_CRF}'.encode('utf-8')).hexdigest()[:20]
        return _PROXY_ROOT / f'{key}.mp4'

    def _atlas_dir_for(self, path: str) -> Path:
        _PROXY_ROOT.mkdir(parents=True, exist_ok=True)
        try:
            mtime = int(Path(path).stat().st_mtime)
        except OSError:
            mtime = 0
        key = hashlib.sha1(f'{path}|{mtime}|atlas|{SCRUB_CACHE_TAG}|{ATLAS_WIDTH}|{ATLAS_FPS}'.encode('utf-8')).hexdigest()[:20]
        return _PROXY_ROOT / f'atlas_{key}'

    def _ingest_atlas_file(self, path: str, jpg: Path, index: int) -> None:
        try:
            image = QImage(str(jpg))
            if not image.isNull():
                if image.width() > ATLAS_WIDTH:
                    image = image.scaledToWidth(ATLAS_WIDTH)
                ms = int(index * ATLAS_INTERVAL_MS)
                with self._lock:
                    if self._atlas_building_for not in {'', path} and self._atlas_source not in {'', path}:
                        pass
                    else:
                        self._atlas[ms] = image
                        self._atlas_source = path
                        if not self._atlas_keys or ms > self._atlas_keys[-1]:
                            self._atlas_keys.append(ms)
                        else:
                            self._atlas_keys = sorted(self._atlas.keys())
                    return None
        except Exception:
            pass

    def _build_atlas(self, path: str) -> None:
        out_dir = self._atlas_dir_for(path)
        try:
            try:
                out_dir.mkdir(parents=True, exist_ok=True)
                existing = sorted(out_dir.glob('f_*.jpg'))
                if len(existing) >= 4:
                    for i, jpg in enumerate(existing):
                        self._ingest_atlas_file(path, jpg, i)
                    with self._lock:
                        if self._atlas_building_for == path:
                            self._atlas_building_for = ''
                else:
                    for stale in existing:
                        try:
                            stale.unlink()
                        except OSError:
                            continue
            except Exception:
                pass
            with self._lock:
                if self._atlas_building_for == path:
                    self._atlas_building_for = ''
        except:
            with self._lock:
                if self._atlas_building_for == path:
                    self._atlas_building_for = ''
                raise
        if self._stop:
            return None
        cmd = [FFMPEG_PATH, '-y', '-nostdin', '-threads', '2', '-i', path, '-an', '-vf', f'fps={ATLAS_FPS},scale={ATLAS_WIDTH}:-2', '-q:v', '6', str(out_dir / 'f_%05d.jpg')]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
        seen = 0
        while proc.poll() is None:
            files = sorted(out_dir.glob('f_*.jpg'))
            while seen < len(files):
                self._ingest_atlas_file(path, files[seen], seen)
                seen += 1
            time.sleep(0.05)
        files = sorted(out_dir.glob('f_*.jpg'))
        while seen < len(files):
            self._ingest_atlas_file(path, files[seen], seen)
            seen += 1
        with self._lock:
            if self._atlas_building_for == path:
                self._atlas_building_for = ''

    def _build_proxy(self, path: str) -> None:
        out = self._proxy_file_for(path)
        try:
            if out.is_file() and out.stat().st_size > 1024:
                with self._lock:
                    self._proxy_path = str(out)
                    self._proxy_source = path
                    self._proxy_building_for = ''
                    self._reopen_needed = True
            else:
                tmp = out.with_suffix('.building.mp4')
                if tmp.exists():
                    try:
                        tmp.unlink()
                    except OSError:
                        pass
                cmd = [FFMPEG_PATH, '-y', '-nostdin', '-threads', '1', '-i', path, '-an', '-vf', f'scale={SCRUB_MAX_WIDTH}:-2,fps={SCRUB_PROXY_FPS}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', str(SCRUB_PROXY_CRF), '-threads', '1', '-movflags', '+faststart', str(tmp)]
                completed = subprocess.run(cmd, capture_output=True, check=False, creationflags=CREATE_NO_WINDOW)
                if completed.returncode != 0 or not tmp.is_file() or tmp.stat().st_size < 1024:
                    try:
                        tmp.unlink(missing_ok=True)
                    except OSError:
                        pass
                    with self._lock:
                        if self._proxy_building_for == path:
                            self._proxy_building_for = ''
                else:
                    try:
                        tmp.replace(out)
                    except OSError:
                        try:
                            tmp.unlink(missing_ok=True)
                        except OSError:
                            pass
                        with self._lock:
                            if self._proxy_building_for == path:
                                self._proxy_building_for = ''
                        return None
                    with self._lock:
                        self._proxy_path = str(out)
                        self._proxy_source = path
                        self._proxy_building_for = ''
                        self._reopen_needed = True
        except Exception:
            with self._lock:
                if self._proxy_building_for == path:
                    self._proxy_building_for = ''

    def _pump_ui_frames(self) -> None:
        with self._lock:
            if self._out_frames:
                image = self._out_frames.pop()
                self._out_frames.clear()
            else:
                return None
        if image is not None:
            if image.isNull():
                pass
            else:
                self.frameReady.emit(image)

    def _worker_loop(self) -> None:
        while True:
            ms = None
            path = ''
            precise = False
            image = None
            while True:
                while ms is None:
                    with self._lock:
                        while (self._pending_ms is None or self._resource_save) and (not self._stop):
                            self._wake.wait(timeout=0.5)
                        if self._stop:
                            return None
                        if self._resource_save:
                            self._pending_ms = None
                            continue
                        path = self._want_path
                        ms = self._pending_ms
                        precise = bool(self._precise)
                        self._pending_ms = None
                        self._precise = False
                now = time.monotonic()
                if now < float(getattr(self, '_decode_fail_until', 0.0) or 0.0):
                    time.sleep(0.05)
                    continue
                if precise:
                    if is_demucs_busy():
                        time.sleep(0.4)
                        continue
                    image = self._decode_still(path, ms)
                    break
                if is_demucs_busy():
                    time.sleep(0.4)
                    continue
                has_atlas = self._atlas_nearest(path, ms) is not None
                now = time.monotonic()
                if has_atlas and now - float(self._last_scrub_decode_at) < SCRUB_UPGRADE_MIN_S:
                    continue
                with self._lock:
                    proxy_ready = bool(self._resolve_proxy_path(path))
                if not has_atlas or proxy_ready:
                    self._last_scrub_decode_at = now
                    image = self._decode_at(path, ms)
                break
            if image is None or image.isNull():
                with self._lock:
                    streak = int(getattr(self, '_decode_fail_streak', 0) or 0) + 1
                    self._decode_fail_streak = streak
                    if streak <= 2 and self._pending_ms is None:
                        self._pending_ms = ms
                        if precise:
                            self._precise = True
                    elif streak >= 3:
                        self._decode_fail_until = time.monotonic() + min(6.0, 0.8 * float(streak))
                        self._decode_fail_streak = 0
                time.sleep(0.03)
            else:
                with self._lock:
                    self._decode_fail_streak = 0
                    if self._pending_ms is None or precise:
                        self._out_frames.append(image)

    def _resolve_proxy_path(self, path: str) -> str:
        if self._proxy_source == path and self._proxy_path and Path(self._proxy_path).is_file():
            return self._proxy_path
        cached = self._proxy_file_for(path)
        if cached.is_file() and cached.stat().st_size > 1024:
            self._proxy_path = str(cached)
            self._proxy_source = path
            return str(cached)
        return ''

    def _release_cap_locked(self) -> None:
        cap = self._cap
        self._cap = None
        self._path = ''
        self._decode_path = ''
        self._reopen_needed = False
        self._cap_gen = int(getattr(self, '_cap_gen', 0)) + 1
        if cap is not None:
            _release_capture_msmf(cap)
            return None

    def _release_still_locked(self) -> None:
        cap = self._still_cap
        self._still_cap = None
        self._still_path = ''
        self._still_gen = int(getattr(self, '_still_gen', 0)) + 1
        if cap is not None:
            _release_capture_msmf(cap)
            return None

    def _ensure_proxy_capture_locked(self, source_path: str) -> tuple[Any, int] | tuple[None, int]:
        proxy = self._resolve_proxy_path(source_path)
        if not proxy:
            return (None, int(getattr(self, '_cap_gen', 0)))
        if self._cap is None or self._path != source_path or self._decode_path != proxy or self._reopen_needed:
            self._release_cap_locked()
            cap = _open_capture_msmf_only(proxy)
            if cap is None:
                return (None, int(getattr(self, '_cap_gen', 0)))
            self._cap = cap
            self._path = source_path
            self._decode_path = proxy
            self._reopen_needed = False
            self._cap_gen = int(getattr(self, '_cap_gen', 0)) + 1
            return (cap, self._cap_gen)
        return (self._cap, int(getattr(self, '_cap_gen', 0)))

    def _ensure_still_capture_locked(self, source_path: str) -> tuple[Any, int] | tuple[None, int]:
        if self._still_cap is not None and self._still_path == source_path:
            return (self._still_cap, int(getattr(self, '_still_gen', 0)))
        self._release_still_locked()
        cap = _open_capture_msmf_only(source_path)
        if cap is None:
            return (None, int(getattr(self, '_still_gen', 0)))
        self._still_cap = cap
        self._still_path = source_path
        self._still_gen = int(getattr(self, '_still_gen', 0)) + 1
        return (cap, self._still_gen)

    @staticmethod
    def _frame_to_qimage(frame_bgr: Any, max_width: int) -> QImage | None:
        import cv2
        try:
            frame_copy = frame_bgr
            h, w = frame_copy.shape[:2]
            if w > max_width:
                nh = max(1, int(round(h * (max_width / float(w)))))
                frame_copy = cv2.resize(frame_copy, (max_width, nh), interpolation=cv2.INTER_AREA)
            rgb = cv2.cvtColor(frame_copy, cv2.COLOR_BGR2RGB)
            height, width, _channels = rgb.shape
            return QImage(rgb.data, width, height, int(rgb.strides[0]), QImage.Format.Format_RGB888).copy()
        except Exception:
            return None

    def _decode_at(self, path: str, position_ms: int) -> QImage | None:
        try:
            import cv2
        except Exception:
            return self._ffmpeg_one_frame_throttled(path, position_ms, max_width=SCRUB_MAX_WIDTH, use_source=False)
        with self._lock:
            cap, gen = self._ensure_proxy_capture_locked(path)
        if cap is None:
            return self._ffmpeg_one_frame_throttled(path, position_ms, max_width=SCRUB_MAX_WIDTH, use_source=False)
        frame_copy = None
        try:
            target = float(max(0, int(position_ms)))
            cap.set(cv2.CAP_PROP_POS_MSEC, target)
            ok, frame = cap.read()
            if ok and frame is not None:
                frame_copy = frame.copy()
        except Exception:
            frame_copy = None
            with self._lock:
                if gen == int(getattr(self, '_cap_gen', 0)):
                    self._release_cap_locked()
        with self._lock:
            if gen != int(getattr(self, '_cap_gen', 0)):
                return None
        return self._ffmpeg_one_frame_throttled(path, position_ms, max_width=SCRUB_MAX_WIDTH, use_source=False) if frame_copy is None else self._frame_to_qimage(frame_copy, SCRUB_MAX_WIDTH)

    def _decode_still(self, path: str, position_ms: int) -> QImage | None:
        try:
            import cv2
        except Exception:
            return self._ffmpeg_one_frame(path, position_ms, max_width=STILL_MAX_WIDTH, use_source=True)
        with self._lock:
            cap, gen = self._ensure_still_capture_locked(path)
        if cap is None:
            return self._ffmpeg_one_frame(path, position_ms, max_width=STILL_MAX_WIDTH, use_source=True)
        frame_copy = None
        try:
            target = float(max(0, int(position_ms)))
            cap.set(cv2.CAP_PROP_POS_MSEC, target)
            ok, frame = cap.read()
            if ok and frame is not None:
                frame_copy = frame.copy()
        except Exception:
            frame_copy = None
            with self._lock:
                if gen == int(getattr(self, '_still_gen', 0)):
                    self._release_still_locked()
        with self._lock:
            if gen != int(getattr(self, '_still_gen', 0)):
                return None
        return self._ffmpeg_one_frame(path, position_ms, max_width=STILL_MAX_WIDTH, use_source=True) if frame_copy is None else self._frame_to_qimage(frame_copy, STILL_MAX_WIDTH)

    def _ffmpeg_one_frame_throttled(self, path: str, position_ms: int, *, max_width: int, use_source: bool) -> QImage | None:
        now = time.monotonic()
        with self._lock:
            if self._ffmpeg_busy:
                return None
            if now - self._ffmpeg_last_at < 0.08:
                return None
            self._ffmpeg_busy = True
            self._ffmpeg_last_at = now
        try:
            image = self._ffmpeg_one_frame(path, position_ms, max_width=max_width, use_source=use_source)
        except:
            with self._lock:
                self._ffmpeg_busy = False
                raise
        with self._lock:
            self._ffmpeg_busy = False
        return image

    def _ffmpeg_one_frame(self, path: str, position_ms: int, *, max_width: int, use_source: bool) -> QImage | None:
        try:
            if use_source:
                src = path
                quality = '3'
            else:
                with self._lock:
                    proxy = self._resolve_proxy_path(path)
                src = proxy or path
                quality = '8'
            with tempfile.TemporaryDirectory(prefix='vtp-scrub-') as temp_name:
                image_path = Path(temp_name) / 'f.jpg'
                completed = FFMPEG_PATH(['-y', '-nostdin', '-threads', '1', '-ss', max(0, int(position_ms)) / 1000, '.3f', '-i', src, '-frames:v', '1', '-vf', f'scale={int(max_width)}:-2', '-q:v', quality, str(image_path)], capture_output=True, check=False, creationflags=CREATE_NO_WINDOW, timeout=8 if use_source else 6)
                if completed.returncode == 0 and image_path.exists():
                    image = QImage(str(image_path))
                    return None if image.isNull() else subprocess.run
        except Exception:
            pass