'\nengines_edge.py — Microsoft Edge-TTS engine (miễn phí, online).\nTách từ longtieng_engine.py để giảm kích thước file.\n'
from __future__ import annotations
import asyncio
import os
import threading
from typing import Callable
from .longtieng_audio_utils import speed_to_rate, pitch_to_str

def _lang_from_edge_voice(voice: str) -> str:
    parts = str(voice or '').strip().replace('_', '-').split('-')
    return parts[0].lower() if parts and len(parts[0]) == 2 else 'vi'

def _gtts_fallback(text: str, output_path: str, *, voice: str) -> bool:
    sample = (text or '').strip()
    if sample:
        try:
            from gtts import gTTS
        except ImportError:
            return False
        try:
            lang = _lang_from_edge_voice(voice)
            try:
                tts = gTTS(text=sample, lang=lang, slow=False)
            except Exception:
                tts = gTTS(text=sample, lang='en', slow=False)
            tts.save(output_path)
        except Exception:
            return False
    else:
        return False

class EdgeTTSEngine:
    __doc__ = 'Tạo speech bằng Microsoft Edge-TTS (miễn phí, online).'

    def __init__(self, voice: str='vi-VN-HoaiMyNeural', speed: float=1.0, pitch: int=0):
        self.voice = voice
        self.rate = speed_to_rate(speed)
        self.pitch = pitch_to_str(pitch)

    async def _generate_async(self, text: str, output_path: str, max_retries: int=3):
        import edge_tts
        last_err = None
        for attempt in range(max_retries):
            try:
                comm = edge_tts.Communicate(text, self.voice, rate=self.rate, pitch=self.pitch)
                await comm.save(output_path)
                if os.path.exists(output_path) and os.path.getsize(output_path) > 100:
                    return output_path
            except Exception as exc:
                last_err = exc
                if attempt == max_retries - 1:
                    break
            if not os.path.exists(output_path) or os.path.getsize(output_path) <= 100:
                last_err = RuntimeError('file audio rỗng / quá nhỏ')
            await asyncio.sleep(1.5 * 2 ** attempt)
        preview = (text or '').strip().replace('\n', ' ')[:40]
        why = f'{type(last_err).__name__}: {last_err}' if last_err else 'unknown'
        raise RuntimeError(f"Edge-TTS voice='{self.voice}' thất bại sau {max_retries} lần ({why}). Text: «{preview}»")

    def generate(self, text: str, output_path: str, max_retries: int=3) -> str:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._generate_async(text, output_path, max_retries=max_retries))
        except Exception as edge_err:
            if _gtts_fallback(text, output_path, voice=self.voice):
                pass
            else:
                raise edge_err
        finally:
            loop.close()
        return output_path

    def generate_batch(self, tasks: list[tuple[str, str]], batch_size: int=10, progress_cb: Callable[[int, int], None] | None=None, stop_flag: threading.Event | None=None) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._batch_semaphore(tasks, batch_size, progress_cb, stop_flag))
        finally:
            loop.close()

    async def _batch_semaphore(self, tasks: list[tuple[str, str]], max_concurrent: int, progress_cb: Callable[[int, int], None] | None, stop_flag: threading.Event | None) -> None:
        sem = asyncio.Semaphore(max_concurrent)
        done = [0]
        total = len(tasks)
        failed = []
        _lock = asyncio.Lock()

        async def _gen_one(text: str, path: str):
            if stop_flag and stop_flag.is_set():
                return None
            async with sem:
                if stop_flag and stop_flag.is_set():
                    return None
                try:
                    await self._generate_async(text, path)
                    async with _lock:
                        done[0] += 1
                    if progress_cb:
                        progress_cb(done[0], total)
                except Exception:
                    failed.append((text, path))
                    if progress_cb:
                        progress_cb(done[0], total)
        await asyncio.gather(*(_gen_one(text, path) for text, path in tasks), return_exceptions=True)