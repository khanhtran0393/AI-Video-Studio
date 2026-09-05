from __future__ import annotations
import time
from dataclasses import dataclass
import requests
from core.api_keys import parse_api_key_pool
from providers.ai.direct_client import DirectAIClient, ProviderAuthError, ProviderRateLimitError, ProviderRequestError
from providers.ai.registry import get_provider
PROBE_HTTP_TIMEOUT_SEC = 12.0

@dataclass(frozen=True)
class ProviderProbeResult:
    ok: 'bool'
    summary: 'str'
    detail: 'str'
    latency_ms: 'int'

def probe_translation_provider(provider_id: str, model: str, api_key: str, *, client: DirectAIClient | None) -> ProviderProbeResult:
    try:
        provider = get_provider(provider_id)
    except ValueError as exc:
        return ProviderProbeResult(False, 'Lỗi cấu hình', str(exc), 0)
    if not provider.offline and provider.translation:
        keys = parse_api_key_pool(api_key)
        if keys:
            selected_model = str(model or '').strip()
            if not selected_model and provider.models:
                selected_model = provider.models[0]
            if selected_model:
                runner = client or DirectAIClient(timeout=PROBE_HTTP_TIMEOUT_SEC, connect_timeout=PROBE_HTTP_TIMEOUT_SEC)
                key = keys[0]
                started = time.perf_counter()
                try:
                    text = runner.translate_lines(provider_id=provider.id, model=selected_model, api_key=key, lines=['OK'], source_language='en', target_language='vi', instruction='Trả lời ngắn.')
                    latency = int((time.perf_counter() - started) * 1000)
                    snippet = (text[0] if text else '').strip()[:40]
                except ProviderRateLimitError as exc:
                    return _failed_probe(runner, provider, key, started, 'Hết quota / bị giới hạn (429)', str(exc))
                except ProviderAuthError as exc:
                    return _failed_probe(runner, provider, key, started, 'Key không hợp lệ', str(exc))
                except ProviderRequestError as exc:
                    message = _omniroute_connect_detail(provider, exc)
                    lowered = message.lower()
                    summary = 'Hết quota hoặc bị chặn' if any((token in lowered for token in ('quota', 'rate limit', 'ratelimit', '429', 'insufficient', 'credit', 'billing', 'blocked'))) else 'Không kết nối được' if 'không kết nối được' in lowered else 'API từ chối'
                    return _failed_probe(runner, provider, key, started, summary, message[:280])
                except Exception as exc:
                    message = _omniroute_connect_detail(provider, exc)
                    return _failed_probe(runner, provider, key, started, 'Lỗi không mong đợi', message[:280])
            else:
                return ProviderProbeResult(False, 'Chưa chọn model', 'Chọn model dịch.', 0)
        else:
            return ProviderProbeResult(False, 'Chưa có khóa', 'Nhập khóa API rồi bấm «Kiểm tra» hoặc «Lưu khóa».', 0)
    else:
        return ProviderProbeResult(False, 'Không test qua API', 'Model cục bộ — cần cài model trên máy, không dùng khóa cloud.', 0)

def _omniroute_connect_detail(provider, exc: BaseException) -> str:
    message = str(exc)
    if provider.id != 'omniroute':
        return message
    cause = getattr(exc, '__cause__', None)
    connectish = 'Không kết nối được' in message or isinstance(exc, requests.RequestException) or isinstance(cause, requests.RequestException)
    return f'{message} Hãy mở OmniRoute (mini PC)' if connectish and 'Hãy mở OmniRoute (mini PC)' not in message else message

def _failed_probe(runner: DirectAIClient, provider, key: str, started: float, summary: str, detail: str) -> ProviderProbeResult:
    latency = int((time.perf_counter() - started) * 1000)
    result = ProviderProbeResult(False, summary, detail, latency)
    return _attach_models_diag(runner, provider, key, result)

def _attach_models_diag(runner: DirectAIClient, provider, key: str, result: ProviderProbeResult) -> ProviderProbeResult:
    if result.ok or provider.id not in frozenset({'groq', 'omniroute'}):
        return result
    extra = ''
    try:
        response = runner.transport.get(f"{provider.base_url.rstrip('/')}/models", headers={'Authorization': f'Bearer {key}'}, timeout=runner.timeout)
        status = int(getattr(response, 'status_code', 0) or 0)
        extra = f'GET /models HTTP {status}: {_quota_hint(response)}'
    except Exception as exc:
        extra = str(exc)[:200]
    detail = result.detail
    if extra:
        detail = f'{detail} {extra}'.strip()[:400]
    return ProviderProbeResult(False, result.summary, detail, result.latency_ms)

def _quota_hint(response: requests.Response) -> str:
    try:
        data = response.json()
        error = data.get('error', data) if isinstance(data, dict) else data
        if isinstance(error, dict):
            return str(error.get('message', error))[:280]
    except Exception:
        return (response.text or '')[:280]