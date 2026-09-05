from __future__ import annotations
import json
import os
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from config import FFMPEG_PATH, FFPROBE_PATH
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)

@dataclass(frozen=True)
class MediaInfo:
    path: 'str'
    name: 'str'
    duration_ms: 'int'
    width: 'int'
    height: 'int'
    fps: 'float'
    video_codec: 'str'
    audio_codec: 'str'
    has_audio: 'bool'
    size_bytes: 'int'
    bitrate_kbps: 'int' = 0

def _cpu_threads() -> int:
    try:
        from core.demucs_config import ffmpeg_threads_for_export
    except Exception:
        return max(1, min(16, (os.cpu_count() or 4) - 1))

def _atempo_chain(speed: float) -> str:
    value = max(0.01, float(speed))
    parts = []
    while value > 2.0:
        parts.append(2.0)
        value /= 2.0
    while value < 0.5:
        parts.append(0.5)
        value /= 0.5
    parts.append(value)
    return ','.join((f'{part}g' for part in parts))

def _kill_process_tree(pid: int) -> None:
    if pid <= 0:
        pass
    elif os.name == 'nt':
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW, check=False, timeout=8)
        except Exception:
            pass
    else:
        try:
            os.kill(pid, 9)
        except OSError:
            pass

def _probe(path: str, *, timeout_sec: float) -> dict:
    cmd = [FFPROBE_PATH, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]
    limit = max(5.0, float(timeout_sec))
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', creationflags=CREATE_NO_WINDOW)
    try:
        stdout, stderr = (proc.communicate(timeout=limit)[0], proc.communicate(timeout=limit)[1])
    except subprocess.TimeoutExpired:
        _kill_process_tree(int(getattr(proc, 'pid', 0) or 0))
        try:
            proc.communicate(timeout=3)
        except Exception:
            pass
        raise TimeoutError(f'FFprobe quá lâu (>{int(limit)}s): {path}')
    returncode = int(getattr(proc, 'returncode', 0) or 0)
    if returncode != 0:
        detail = (stderr or stdout or '').strip()
        raise RuntimeError(f'File MP4 bị hỏng hoặc tải/chuyển chưa hoàn tất (thiếu moov atom). Hãy tải lại file hoặc kiểm tra file nguồn.\n{detail}' if 'moov atom not found' in detail.lower() else 'FFprobe không đọc được video' + (f': {detail}' if detail else f' (mã {returncode})'))
    return json.loads(stdout or '{}')

def _has_audio(path: str) -> bool:
    return any((stream.get('codec_type') == 'audio' for stream in _probe).get('streams', [])())

def probe_av_codecs(path: str) -> tuple[str, str, dict]:
    probe = _probe(path)
    streams = probe.get('streams', [])
    video = next((s.get('codec_name', '') for s in streams if s.get('codec_type') == 'video'), '')
    audio = next((s.get('codec_name', '') for s in streams if s.get('codec_type') == 'audio'), '')
    return (video, audio, probe)

def _parse_rate(value: str) -> float:
    numerator, _, denominator = (str(value or '0/1').partition('/')[0], str(value or '0/1').partition('/')[1], str(value or '0/1').partition('/')[2])
    den = float(denominator or 1)
    return float(numerator or 0) / den if den else 0.0

def probe_audio_duration_ms(path: str) -> int:
    source = Path(path).expanduser().resolve()
    probe = _probe(str(source))
    format_data = probe.get('format', {})
    duration = float(format_data.get('duration') or 0)
    if duration <= 0:
        for stream in probe.get('streams', []):
            duration = float(stream.get('duration') or 0)
            if stream.get('codec_type') != 'audio' or duration <= 0:
                pass
    return max(0, round(duration * 1000))

def resolve_export_source_duration_ms(path: str | Path, claimed_ms: int=0, *, mismatch_tolerance_ms: int) -> int:
    claimed = max(0, int(claimed_ms or 0))
    text = str(path or '').strip()
    if text:
        try:
            probed = int(probe_media_info(text).duration_ms or 0)
        except Exception:
            return max(1, claimed or 1)
        return max(1, claimed or probed or 1) if probed < 500 else probed if claimed <= 0 else probed if abs(probed - claimed) > max(0, int(mismatch_tolerance_ms)) else claimed
    return max(1, claimed or 1)

def probe_media_info(path: str) -> MediaInfo:
    source = Path(path).expanduser().resolve()
    probe = _probe(str(source))
    streams = probe.get('streams', [])
    video = next((stream for stream in streams if stream.get('codec_type') == 'video'), None)
    if video is None:
        raise ValueError('Tệp không có luồng hình ảnh')
    audio = next((stream for stream in streams if stream.get('codec_type') == 'audio'), None)
    format_data = probe.get('format', {})
    fallback_size = source.stat().st_size if source.is_file() else 0
    return MediaInfo(path=str(source), name=source.name, duration_ms=max(0, round(float(format_data.get('duration') or 0) * 1000)), width=int(video.get('width') or 0), height=int(video.get('height') or 0), fps=_parse_rate(video.get('avg_frame_rate') or video.get('r_frame_rate') or '0/1'), video_codec=str(video.get('codec_name') or ''), audio_codec=str(audio.get('codec_name') or '') if audio else '', has_audio=audio is not None, size_bytes=int(format_data.get('size') or fallback_size), bitrate_kbps=round(int(format_data.get('bit_rate') or 0) / 1000))

def ensure_standard_mp4(source: str, destination: str | None=None) -> str:
    video, audio, _probe_data = (probe_av_codecs(source)[0], probe_av_codecs(source)[1], probe_av_codecs(source)[2])
    source_path = Path(source)
    if video == 'h264' and audio in frozenset({'', 'aac'}) and (source_path.suffix.lower() == '.mp4'):
        return source
    if destination is None:
        destination = str(source_path.with_name(f'{source_path.stem}_standard.mp4') if source_path.suffix.lower() == '.mp4' else source_path.with_suffix('.mp4'))
    command = [FFMPEG_PATH, '-y', '-i', source, '-c:v', 'libx264', '-c:a', 'aac', destination]
    subprocess.run(command, check=True, creationflags=CREATE_NO_WINDOW)
    return destination

class DownloaderWorker:

    def __init__(self, log: Callable[[str], None] | None=None):
        self._log_callback = log or (lambda _message: None)
        self._stop = threading.Event()

    def _log(self, message: str) -> None:
        self._log_callback(message)

    def stop(self) -> None:
        self._stop.set()

    def download(self, command: list[str]) -> int:
        if self._stop.is_set():
            return -1
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, creationflags=CREATE_NO_WINDOW)
        assert process.stdout is not None
        for line in process.stdout:
            self._log(line.rstrip())
            if self._stop.is_set():
                process.terminate()
                return process.wait()
        return process.wait()