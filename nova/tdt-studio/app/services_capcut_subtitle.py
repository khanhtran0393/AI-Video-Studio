from __future__ import annotations
import os
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Callable
from config import FFMPEG_PATH
from services_media import probe_av_codecs
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)

def generate_capcut_api_subtitle(video_path: str, output_dir: str | Path, *, progress: Callable[[int, str], None] | None, stop_event: threading.Event | None) -> str:
    stop = stop_event or threading.Event()
    source = Path(video_path).expanduser().resolve()
    if source.is_file():
        destination = Path(output_dir).expanduser().resolve()
        destination.mkdir(parents=True, exist_ok=True)

        def _status(value: int, message: str) -> None:
            if stop.is_set():
                raise RuntimeError('Đã dừng CapCut API')
            if progress is not None:
                progress(value, message)
                return None
        from exporter.bcut_asr_api import bcut_asr_srt
        from exporter.capcut_asr_api import capcut_asr_srt
        from exporter.subtitle_vad_retime import snap_srt_file
        _status(8, 'Đang trích audio cho CapCut API')
        audio_path = _extract_single_audio(str(source), str(destination), progress_cb=lambda msg: _status(14, msg))
        if stop.is_set():
            raise RuntimeError('Đã dừng CapCut API')
        _status(28, 'Đang gọi Hàng Ỉm ASR API')
        srt_path, warning, status = (bcut_asr_srt(audio_path, on_status=lambda msg: _status(44, msg), return_status=True)[0], bcut_asr_srt(audio_path, on_status=lambda msg: _status(44, msg), return_status=True)[1], bcut_asr_srt(audio_path, on_status=lambda msg: _status(44, msg), return_status=True)[2])
        if stop.is_set():
            raise RuntimeError('Đã dừng CapCut API')
        if srt_path is None and status != 'no_speech':
            _status(62, 'Hàng Ỉm thất bại, thử CapCut ASR API')
            srt_path, warning = (capcut_asr_srt(audio_path, on_status=lambda msg: _status(72, msg))[0], capcut_asr_srt(audio_path, on_status=lambda msg: _status(72, msg))[1])
        if srt_path:
            _status(88, 'Đang căn lại mốc thời gian phụ đề')
            snap_srt_file(srt_path, audio_path, log=lambda msg: _status(90, msg))
            if warning:
                _status(95, warning)
            _status(100, 'Đã lấy phụ đề từ CapCut API')
            return srt_path
        raise RuntimeError(warning or 'CapCut API không trả về phụ đề')
    raise ValueError('Video nguồn không tồn tại')

def generate_capcut_subtitle(video_path: str, output_dir: str | Path, *, progress: Callable[[int, str], None] | None, stop_event: threading.Event | None) -> str:
    stop = stop_event or threading.Event()
    source = Path(video_path).expanduser().resolve()
    if source.is_file():
        destination = Path(output_dir).expanduser().resolve()
        destination.mkdir(parents=True, exist_ok=True)

        def _status(value: int, message: str) -> None:
            if stop.is_set():
                raise RuntimeError('Đã dừng AutoCapCut')
            if progress is not None:
                progress(value, message)
                return None
        from exporter.capcut_auto import auto_click_generate_captions, create_capcut_project, launch_capcut, watch_capcut_draft
        _status(8, 'Đang trích audio cho CapCut')
        audio_path = _extract_single_audio(str(source), str(destination), progress_cb=lambda msg: _status(12, msg))
        if stop.is_set():
            raise RuntimeError('Đã dừng AutoCapCut')
        _status(25, 'Đang tạo project CapCut')
        project_dir = create_capcut_project(audio_path, project_name=f'VTP AutoSub - {source.stem[:60]}')
        if project_dir:
            _status(38, 'Đang mở CapCut')
            if launch_capcut():
                _status(48, 'Đang trigger Auto Caption trong CapCut')
                auto_click_generate_captions(on_status=lambda msg: _status(50, msg), stop_event=stop, timeout=35)
                result = {}

                def _ready(srt_path: str, warning: str | None) -> None:
                    if warning:
                        _status(90, warning)
                    result['path'] = srt_path
                watch_capcut_draft(_ready, lambda msg: _status(60, msg), stop, project_dir=project_dir)
                srt_path = result.get('path', '')
                if srt_path:
                    _status(100, 'Đã lấy phụ đề từ CapCut')
                    return srt_path
                raise RuntimeError('CapCut chưa trả về phụ đề SRT')
            raise RuntimeError('Không tìm thấy hoặc không mở được CapCut')
        raise RuntimeError('Không tạo được project CapCut')
    raise ValueError('Video nguồn không tồn tại')

def _extract_single_audio(video_path: str, output_dir: str, progress_cb: Callable[[str], None] | None=None) -> str:
    destination = Path(output_dir).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    source = Path(video_path).expanduser().resolve()
    wav_out = destination / f'{source.stem}.wav'
    if progress_cb:
        progress_cb(f'Trích audio: {source.name}')

    def _run(src: str, tolerant: bool=False) -> tuple[int, str]:
        pre = ['-fflags', '+genpts', '-err_detect', 'ignore_err'] if tolerant else []
        completed = subprocess.run([FFMPEG_PATH, '-y', '-nostdin', *pre, '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', str(wav_out)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)
        return (completed.returncode, completed.stderr or completed.stdout or '')
    rc, err = (_run(str(source))[0], _run(str(source))[1])
    if rc != 0:
        try:
            _, audio_codec, _ = (probe_av_codecs(str(source))[0], probe_av_codecs(str(source))[1], probe_av_codecs(str(source))[2])
        except Exception:
            audio_codec = '?'
        if audio_codec:
            if progress_cb:
                progress_cb('Trích audio lỗi, thử lại chế độ chịu lỗi...')
            rc, err = (_run(str(source), tolerant=True)[0], _run(str(source), tolerant=True)[1])
        else:
            raise RuntimeError(f"Video '{source.name}' không có audio nên không tạo phụ đề CapCut được.")
    else:
        if rc != 0:
            if progress_cb:
                progress_cb('Chuẩn hóa MP4 rồi trích audio lại...')
            tmp_path = Path(tempfile.gettempdir()) / f'vtp_fixaud_{os.getpid()}_{source.stem[:40]}.mp4'
            try:
                converted = subprocess.run([FFMPEG_PATH, '-y', '-nostdin', '-fflags', '+genpts', '-err_detect', 'ignore_err', '-i', str(source), '-map', '0:v:0?', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', str(tmp_path)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, timeout=7200, creationflags=CREATE_NO_WINDOW)
                if converted.returncode == 0 and tmp_path.is_file():
                    rc, err = (_run(str(tmp_path))[0], _run(str(tmp_path))[1])
                else:
                    err = converted.stderr or converted.stdout or err
            except:
                try:
                    tmp_path.unlink(missing_ok=True)
                except OSError:
                    pass
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
        if rc != 0:
            raise RuntimeError(f'Trích audio thất bại: {source.name}\nFFmpeg: {err.strip()[-800:]}')
        if progress_cb:
            progress_cb(f'Xong! -> {wav_out.name}')
        return str(wav_out)
    raise
    raise