'\nlongtieng_translator.py — Dịch phụ đề video thông minh (Smart Video Subtitle Translator).\n\nPipeline 5 bước:\n  1. Băm nhỏ video (Chunking) tại khoảng lặng âm thanh\n  2. STT → SRT + Smart Keyframes Grid cho từng chunk\n  3. Gọi Gemini API dịch (round-robin 6 keys)\n  4. Gom nối tất cả SRT đã dịch thành Master SRT\n  5. Render cuối: TTS placeholder + hardsub + chèn audio mới\n\nThư viện: ffmpeg-python, pydub, Pillow, google-generativeai.\n'
from __future__ import annotations
import os
import sys
import time
from typing import Callable
from .translator_utils import _WORK_DIR, _WHISPER_VOCAB_PROMPTS, _log, _run_ffmpeg, _probe_duration, _probe_video_bitrate, _safe_remove, _seconds_to_srt_time, _srt_time_to_seconds, _escape_ffmpeg_path, _load_gemini_keys_from_config, _next_gemini_key, GEMINI_API_KEYS
from .translator_stt import step1_chunk_video, step2_process_chunk, _stt_cloud, _merge_micro_segments, _split_long_srt_segments, _parse_srt
from .translator_render import _calc_midpoints, _extract_keyframes, _make_grid_image, step3_translate_chunk, _clean_gemini_srt_output, _strip_filler_words, step4_merge_srt, step5_final_render, _tts_placeholder

def run_full_pipeline(video_path: str, ngon_ngu: str, the_loai: str, output_path: str | None=None, tts_audio_path: str | None=None, tts_engine: str='edge', tts_voice: str='vi-VN-HoaiMyNeural', tts_speed: float=1.0, gemini_model: str='gemini-2.5-flash-lite', log_cb: Callable[[str], None] | None=None, stop_flag=None) -> str:
    _log(log_cb, '============================================================')
    _log(log_cb, '🚀 BẮT ĐẦU PIPELINE DỊCH PHỤ ĐỀ VIDEO')
    _log(log_cb, f'   Video:    {video_path}')
    _log(log_cb, f'   Ngôn ngữ: {ngon_ngu}')
    _log(log_cb, f'   Thể loại: {the_loai}')
    _log(log_cb, '============================================================')
    start_time = time.time()
    if stop_flag and stop_flag.is_set():
        raise InterruptedError('Pipeline bị dừng bởi người dùng.')
    chunks = step1_chunk_video(video_path, log_cb=log_cb)
    _is_land = False
    try:
        import cv2 as _cv2
        _cap = _cv2.VideoCapture(video_path)
        _vw = _cap.get(_cv2.CAP_PROP_FRAME_WIDTH)
        _vh = _cap.get(_cv2.CAP_PROP_FRAME_HEIGHT)
        _cap.release()
        _is_land = _vw > _vh
    except Exception:
        pass
    for _ch in chunks:
        _ch['_is_landscape'] = _is_land
    for chunk in chunks:
        if stop_flag and stop_flag.is_set():
            raise InterruptedError('Pipeline bị dừng bởi người dùng.')
        step2_process_chunk(chunk, ngon_ngu=ngon_ngu, log_cb=log_cb)
    _rolling_memory = ''
    for chunk in chunks:
        if stop_flag and stop_flag.is_set():
            raise InterruptedError('Pipeline bị dừng bởi người dùng.')
        step3_translate_chunk(chunk, ngon_ngu=ngon_ngu, the_loai=the_loai, log_cb=log_cb, rolling_memory=_rolling_memory, gemini_model=gemini_model, stop_flag=stop_flag)
        _chunk_mem = chunk.get('rolling_memory', '')
        if _chunk_mem:
            _rolling_memory = _chunk_mem
    if stop_flag and stop_flag.is_set():
        raise InterruptedError('Pipeline bị dừng bởi người dùng.')
    master_srt = step4_merge_srt(chunks, log_cb=log_cb)
    if stop_flag and stop_flag.is_set():
        raise InterruptedError('Pipeline bị dừng bởi người dùng.')
    result = step5_final_render(video_path, master_srt, output_path=output_path, tts_audio_path=tts_audio_path, tts_engine=tts_engine, tts_voice=tts_voice, tts_speed=tts_speed, log_cb=log_cb)
    elapsed = time.time() - start_time
    log_cb('🎉 PIPELINE HOÀN TẤT trong ', f'{elapsed}.1fs')
    return result