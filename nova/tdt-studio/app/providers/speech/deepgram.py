'Deepgram STT Nova-3 — HTTP listen, không Qt.'
from __future__ import annotations
import time
from pathlib import Path
import requests
from core.api_keys import parse_api_key_pool
from providers.ai.probe import ProviderProbeResult
LISTEN_URL = 'https://api.deepgram.com/v1/listen'
AUTH_TOKEN_URL = 'https://api.deepgram.com/v1/auth/token'

def segments_from_listen_payload(payload: object) -> list[dict]:
    if isinstance(payload, dict):
        results = payload.get('results')
        if isinstance(results, dict):
            channels = results.get('channels')
            if isinstance(channels, list) and channels:
                first = channels[0]
                if isinstance(first, dict):
                    alternatives = first.get('alternatives')
                    if isinstance(alternatives, list) and alternatives:
                        alt = alternatives[0]
                        if isinstance(alt, dict):
                            transcript = str(alt.get('transcript') or '').strip()
                            words_raw = alt.get('words')
                            words = []
                            if isinstance(words_raw, list):
                                for item in words_raw:
                                    text = str(item.get('word') or item.get('punctuated_word') or item.get('text') or '').strip()
                                    if isinstance(item, dict) and text:
                                        try:
                                            start = float(item.get('start', 0))
                                            end = float(item.get('end', 0))
                                            words.append({'word': text, 'start': start, 'end': end})
                                        except (TypeError, ValueError):
                                            pass
                            if transcript or words:
                                if words:
                                    start = float(words[0]['start'])
                                    end = float(words[-1]['end'])
                                else:
                                    start = 0.0
                                    end = 0.0
                                if not transcript:
                                    transcript = ' '.join((str(item['word']) for item in words))
                                return [{'start': start, 'end': end, 'text': transcript, 'words': words}]
                            return []
    raise RuntimeError('Deepgram trả về dữ liệu nhận dạng không hợp lệ')

def transcribe_wav(audio_path: Path, settings, api_key: str, session) -> list[dict]:
    model = str(getattr(settings, 'model', '') or 'nova-3').strip() or 'nova-3'
    language = str(getattr(settings, 'language', '') or '').strip()
    params = {'model': model, 'smart_format': 'true', 'punctuate': 'true'}
    if language and language != 'auto':
        params['language'] = language
    try:
        audio_bytes = audio_path.read_bytes()
        response = session.post(LISTEN_URL, headers={'Authorization': f'Token {api_key}', 'Content-Type': 'audio/wav'}, params=params, data=audio_bytes, timeout=240)
    except Exception as exc:
        raise RuntimeError('Không kết nối được dịch vụ nhận dạng Deepgram') from exc
    status = int(getattr(response, 'status_code', 0) or 0)
    if status in frozenset({401, 403}):
        raise RuntimeError('Khóa API Deepgram không hợp lệ hoặc chưa có quyền')
    if status == 429:
        raise RuntimeError('Deepgram đang giới hạn lượt gọi (429)')
    if status >= 500:
        raise RuntimeError('Dịch vụ nhận dạng Deepgram đang tạm lỗi')
    if 200 <= status < 300:
        try:
            payload = response.json()
        except Exception as exc:
            raise RuntimeError('Deepgram trả về dữ liệu không đọc được') from exc
        return segments_from_listen_payload(payload)
    raise RuntimeError('Deepgram từ chối tệp âm thanh')

def probe_deepgram_key(provider_id: str, model: str, api_key: str, *, session) -> ProviderProbeResult:
    del provider_id, model
    keys = parse_api_key_pool(api_key)
    if keys:
        key = keys[0]
        http = session or requests.Session()
        started = time.perf_counter()
        try:
            response = http.get(AUTH_TOKEN_URL, headers={'Authorization': f'Token {key}'}, timeout=30)
        except Exception as exc:
            return ProviderProbeResult(False, 'Không kết nối được Deepgram', str(exc) or exc.__class__.__name__, 0)
        latency = int((time.perf_counter() - started) * 1000)
        status = int(getattr(response, 'status_code', 0) or 0)
        return ProviderProbeResult(True, f'Deepgram OK — {latency} ms', 'key live', latency) if status == 200 else ProviderProbeResult(False, 'Khóa Deepgram không hợp lệ', str(status), latency) if status in frozenset({401, 403}) else ProviderProbeResult(False, 'hết quota', '429', latency) if status == 429 else ProviderProbeResult(False, 'Deepgram từ chối kiểm tra khóa', str(status), latency)
    return ProviderProbeResult(False, 'Chưa có khóa', 'Nhập khóa Deepgram rồi bấm «Kiểm tra API» hoặc «Lưu khóa».', 0)