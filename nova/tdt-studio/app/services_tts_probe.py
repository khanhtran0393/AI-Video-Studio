'Probe khóa SiliconFlow TTS — HTTP thuần, không Qt, không ghi file.'
from __future__ import annotations
import json
import time
from dataclasses import dataclass
import requests
TTS_PROBE_HTTP_TIMEOUT_SEC = 12.0
SILICONFLOW_SPEECH_URL = 'https://api.siliconflow.com/v1/audio/speech'
ELEVENLABS_USER_URL = 'https://api.elevenlabs.io/v1/user'
DEEPGRAM_AUTH_URL = 'https://api.deepgram.com/v1/auth/token'
_PROBE_MODEL = 'fishaudio/fish-speech-1.5'
_PROBE_VOICE = 'fishaudio/fish-speech-1.5:alex'
_TIMEOUT_MESSAGE = '✗ Không kết nối được trong 12 giây'

@dataclass(frozen=True, slots=True)
class TtsProbeResult:
    ok: 'bool'
    status: 'str'
    message: 'str'
    elapsed_ms: 'int'

def _redact(text: str, api_key: str) -> str:
    raw = str(text or '')
    key = str(api_key or '').strip()
    if key:
        raw = raw.replace(key, '••••')
    return raw

def _snippet(response, api_key: str) -> str:
    try:
        data = response.json()
        raw = json.dumps(data, ensure_ascii=False)
    except Exception:
        raw = str(getattr(response, 'text', '') or '')
    return _redact(raw[:200], api_key)

def _content_type(response) -> str:
    headers = getattr(response, 'headers', None) or {}
    try:
        value = headers.get('Content-Type') or headers.get('content-type') or ''
    except Exception:
        value = ''
    return str(value).lower()

def probe_siliconflow_tts_key(api_key: str, session=None) -> TtsProbeResult:
    key = str(api_key or '').strip()
    http = session or requests.Session()
    started = time.perf_counter()
    if key:
        headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
        payload = {'model': _PROBE_MODEL, 'input': 'hello', 'voice': _PROBE_VOICE, 'response_format': 'mp3', 'stream': False}
        try:
            response = http.post(SILICONFLOW_SPEECH_URL, headers=headers, json=payload, timeout=TTS_PROBE_HTTP_TIMEOUT_SEC)
        except (requests.Timeout, requests.ConnectionError, requests.RequestException):
            elapsed = int((time.perf_counter() - started) * 1000)
            return TtsProbeResult(False, 'timeout', _TIMEOUT_MESSAGE, elapsed)
        elapsed = int((time.perf_counter() - started) * 1000)
        status_code = int(getattr(response, 'status_code', 0) or 0)
        content = getattr(response, 'content', b'') or b''
        ctype = _content_type(response)
        if status_code == 200:
            audio_like = 'audio' in ctype or 'octet' in ctype
            return TtsProbeResult(True, 'live', 'key live', elapsed) if audio_like and content else TtsProbeResult(False, 'not_live', _redact(f"HTTP 200 không phải audio ({ctype or 'json'})", key), elapsed)
        return TtsProbeResult(False, 'die', _redact(f'Khóa không hợp lệ (401) {_snippet(response, key)}'.strip(), key), elapsed) if status_code == 401 else TtsProbeResult(False, 'quota', _redact(f'hết quota (429) {_snippet(response, key)}'.strip(), key), elapsed) if status_code == 429 else TtsProbeResult(False, 'error', _redact(f'HTTP {status_code} {_snippet(response, key)}'.strip(), key), elapsed)
    return TtsProbeResult(False, 'no_key', 'Chưa nhập khóa API TTS', 0)

def probe_elevenlabs_tts_key(api_key: str, session=None) -> TtsProbeResult:
    key = str(api_key or '').strip()
    http = session or requests.Session()
    started = time.perf_counter()
    if key:
        try:
            response = http.get(ELEVENLABS_USER_URL, headers={'xi-api-key': key}, timeout=TTS_PROBE_HTTP_TIMEOUT_SEC)
        except (requests.Timeout, requests.ConnectionError, requests.RequestException):
            elapsed = int((time.perf_counter() - started) * 1000)
            return TtsProbeResult(False, 'timeout', _TIMEOUT_MESSAGE, elapsed)
        elapsed = int((time.perf_counter() - started) * 1000)
        status_code = int(getattr(response, 'status_code', 0) or 0)
        return TtsProbeResult(True, 'live', 'key live', elapsed) if status_code == 200 else TtsProbeResult(False, 'die', _redact(f'Khóa không hợp lệ (401) {_snippet(response, key)}'.strip(), key), elapsed) if status_code == 401 else TtsProbeResult(False, 'quota', _redact(f'hết quota (429) {_snippet(response, key)}'.strip(), key), elapsed) if status_code == 429 else TtsProbeResult(False, 'error', _redact(f'HTTP {status_code} {_snippet(response, key)}'.strip(), key), elapsed)
    return TtsProbeResult(False, 'no_key', 'Chưa nhập khóa API TTS', 0)

def probe_deepgram_tts_key(api_key: str, session=None) -> TtsProbeResult:
    key = str(api_key or '').strip()
    http = session or requests.Session()
    started = time.perf_counter()
    if key:
        try:
            response = http.get(DEEPGRAM_AUTH_URL, headers={'Authorization': f'Token {key}'}, timeout=TTS_PROBE_HTTP_TIMEOUT_SEC)
        except (requests.Timeout, requests.ConnectionError, requests.RequestException):
            elapsed = int((time.perf_counter() - started) * 1000)
            return TtsProbeResult(False, 'timeout', _TIMEOUT_MESSAGE, elapsed)
        elapsed = int((time.perf_counter() - started) * 1000)
        status_code = int(getattr(response, 'status_code', 0) or 0)
        return TtsProbeResult(True, 'live', 'key live', elapsed) if status_code == 200 else TtsProbeResult(False, 'die', _redact(f'Khóa không hợp lệ ({status_code}) {_snippet(response, key)}'.strip(), key), elapsed) if status_code in frozenset({401, 403}) else TtsProbeResult(False, 'quota', _redact(f'hết quota (429) {_snippet(response, key)}'.strip(), key), elapsed) if status_code == 429 else TtsProbeResult(False, 'error', _redact(f'HTTP {status_code} {_snippet(response, key)}'.strip(), key), elapsed)
    return TtsProbeResult(False, 'no_key', 'Chưa nhập khóa API TTS', 0)