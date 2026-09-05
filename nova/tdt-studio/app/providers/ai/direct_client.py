from __future__ import annotations
import json
import re
import time
from collections.abc import Sequence
from typing import Any
from urllib.parse import quote
import requests
from providers.ai.registry import get_provider

class ProviderRequestError(RuntimeError):
    pass

class ProviderRateLimitError(ProviderRequestError):
    __doc__ = 'HTTP 429/503/529 sau khi đã retry — có thể xoay sang key khác hoặc giảm batch.'

    def __init__(self, message: str='Nhà cung cấp đang giới hạn lượt gọi'):
        super().__init__(message)

class ProviderAuthError(ProviderRequestError):
    __doc__ = 'HTTP 401/403 — key không dùng được.'
_OVERLOAD_STATUS = frozenset({529, 429, 503})
_OVERLOAD_MAX_ATTEMPTS = 6
_DEFAULT_MAX_ATTEMPTS = 4

class DirectAIClient:

    def __init__(self, transport=None, timeout: float=150.0, *, status_cb, connect_timeout: float):
        self.transport = transport or requests.Session()
        self.timeout = float(timeout)
        self.connect_timeout = float(connect_timeout)
        self.status_cb = status_cb

    def _emit_status(self, message: str) -> None:
        if self.status_cb is None:
            pass
        else:
            try:
                self.status_cb(str(message))
            except Exception:
                pass

    def translate_lines(self, *, provider_id: str, model: str, api_key: str, lines: Sequence[str], source_language: str, target_language: str, instruction: str) -> list[str]:
        try:
            provider = get_provider(provider_id)
        except ValueError as exc:
            raise ProviderRequestError(str(exc)) from exc
        if not provider.offline and provider.translation:
            key = api_key.strip()
            if key:
                selected_model = model.strip()
                if selected_model:
                    clean_lines = [str(line).strip() for line in lines]
                    if not clean_lines or any((not line for line in clean_lines)):
                        raise ProviderRequestError('Danh sách câu cần dịch đang trống')
                    system_prompt, user_prompt = _translation_prompts(clean_lines, source_language=source_language, target_language=target_language, instruction=instruction)
                    response_text = self._post_gemini(provider.base_url, selected_model, key, system_prompt, user_prompt) if provider.id == 'gemini' else self._post_openai_compatible(provider.base_url, provider.id, selected_model, key, system_prompt, user_prompt)
                    return _parse_numbered_lines(response_text, len(clean_lines))
                raise ProviderRequestError('Chưa chọn model AI')
            raise ProviderRequestError(f'Chưa có khóa API cá nhân cho {provider.display_name}')
        raise ProviderRequestError('Model cục bộ chưa được cài để dịch')

    def _post_openai_compatible(self, base_url: str, provider_id: str, model: str, api_key: str, system_prompt: str, user_prompt: str) -> str:
        payload = {'model': model, 'messages': [{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': user_prompt}], 'stream': False, 'temperature': 0.2}
        if provider_id == 'openai' and model.startswith('gpt-5.6'):
            payload['reasoning_effort'] = 'none'
        if provider_id == 'nvidia' and model.startswith('deepseek-ai/'):
            payload['chat_template_kwargs'] = {'thinking': False, 'reasoning_effort': 'low'}
        payload['max_tokens'] = 4096
        if provider_id == 'nube' and 'deepseek' in model.casefold():
            payload['reasoning_effort'] = 'none'
        response = self._post(f"{base_url.rstrip('/')}/chat/completions", api_key, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}, json=payload)
        data = _response_json(response, api_key)
        try:
            message = data['choices'][0]['message']
            content = message.get('content')
            if not isinstance(content, str) or not content.strip():
                reasoning = message.get('reasoning') or message.get('reasoning_content')
                if isinstance(reasoning, str) and reasoning.strip():
                    content = reasoning
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderRequestError('Nhà cung cấp không trả về nội dung bản dịch') from exc
        if isinstance(content, str) and content.strip():
            return content
        raise ProviderRequestError('Nhà cung cấp trả về bản dịch trống')

    def _post_gemini(self, base_url: str, model: str, api_key: str, system_prompt: str, user_prompt: str) -> str:
        safe_model = quote(model, safe='-._')
        safe_key = quote(api_key, safe='')
        url = f"{base_url.rstrip('/')}/models/{safe_model}:generateContent?key={safe_key}"
        response = self._post(url, api_key, headers={'Content-Type': 'application/json'}, json={'systemInstruction': {'parts': [{'text': system_prompt}]}, 'contents': [{'role': 'user', 'parts': [{'text': user_prompt}]}], 'generationConfig': {'temperature': 0.2}})
        data = _response_json(response, api_key)
        try:
            parts = data['candidates'][0]['content']['parts']
            content = ''.join((str(part.get('text', '')) for part in parts if isinstance(part, dict)))
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderRequestError('Gemini không trả về nội dung bản dịch') from exc
        if content.strip():
            return content
        raise ProviderRequestError('Gemini trả về bản dịch trống')

    def _post(self, url: str, api_key: str, **kwargs):
        max_attempts = _DEFAULT_MAX_ATTEMPTS
        backoff = 1.5
        last_status = 0
        attempt = 0
        timeout = (self.connect_timeout, self.timeout)
        while attempt < max_attempts:
            self._emit_status(f'Gọi API dịch lần {attempt + 1}/{max_attempts}…')
            try:
                response = self.transport.post(url, timeout=timeout, **kwargs)
                status = int(getattr(response, 'status_code', 0) or 0)
                last_status = status
                if 200 <= status < 300:
                    return response
                if status in frozenset({401, 403}):
                    raise ProviderAuthError('Khóa API không hợp lệ hoặc chưa có quyền')
                if status in _OVERLOAD_STATUS:
                    max_attempts = max(max_attempts, _OVERLOAD_MAX_ATTEMPTS)
                    if attempt < max_attempts - 1:
                        wait = _overload_backoff_seconds(status, attempt)
                        label = {429: 'giới hạn lượt (429)', 503: 'tạm nghẽn (503)', 529: 'quá tải (529)'}.get(status, f'HTTP {status}')
                        self._emit_status(f'API {label}, chờ {wait:.0f}s rồi thử lại ({attempt + 2}/{max_attempts})…')
                        time.sleep(wait)
                        attempt += 1
                        continue
                    raise ProviderRateLimitError(f'Nhà cung cấp đang quá tải/giới hạn (HTTP {status}). Hãy thêm khóa dự phòng (|), giảm số câu/lượt, hoặc chờ 1–2 phút rồi chạy lại.')
                if status >= 500 and attempt < max_attempts - 1:
                    wait = backoff * (attempt + 1)
                    self._emit_status(f'API lỗi {status}, thử lại sau {wait:.0f}s ({attempt + 2}/{max_attempts})…')
                    time.sleep(wait)
                    attempt += 1
                    continue
                if status >= 500:
                    raise ProviderRequestError(f'Dịch vụ AI đang tạm lỗi (HTTP {status}), hãy thử lại sau')
                detail = _safe_error_detail(response, api_key)
                raise ProviderRequestError(f"Nhà cung cấp từ chối yêu cầu{(': ' + detail if detail else '')}")
            except requests.Timeout as exc:
                if attempt < max_attempts - 1:
                    wait = backoff * (attempt + 1)
                    self._emit_status(f'API timeout, thử lại sau {wait:.0f}s ({attempt + 2}/{max_attempts})…')
                    time.sleep(wait)
                    attempt += 1
                    continue
                raise ProviderRequestError('API dịch quá thời gian chờ (timeout). Kiểm tra mạng / khóa API / nhà cung cấp rồi thử lại.') from exc
            except Exception as exc:
                if attempt < max_attempts - 1:
                    wait = backoff * (attempt + 1)
                    self._emit_status(f'Lỗi kết nối API, thử lại sau {wait:.0f}s ({attempt + 2}/{max_attempts})…')
                    time.sleep(wait)
                    attempt += 1
                    continue
                raise ProviderRequestError('Không kết nối được với nhà cung cấp AI') from exc
        raise ProviderRateLimitError(f'Nhà cung cấp từ chối sau {max_attempts} lần (HTTP {last_status})')

def _overload_backoff_seconds(status: int, attempt: int) -> float:
    base = 4.0 if status == 529 else 2.5 if status == 503 else 2.0
    return min(60.0, base * 2 ** attempt + attempt * 2.0)
_TARGET_LANGUAGE_NAMES = {'vi': 'tiếng Việt', 'en': 'tiếng Anh', 'zh': 'tiếng Trung', 'ja': 'tiếng Nhật', 'ko': 'tiếng Hàn', 'th': 'tiếng Thái', 'fr': 'tiếng Pháp', 'de': 'tiếng Đức', 'es': 'tiếng Tây Ban Nha'}
_NON_CJK_TARGETS = frozenset({'de', 'fr', 'en', 'vi', 'es', 'th'})

def _language_display_name(code: str) -> str:
    key = (code or '').strip().lower()[:2]
    return (code or 'auto').strip() or 'auto' if not key or key == 'au' else _TARGET_LANGUAGE_NAMES.get(key, code.strip())

def _translation_prompts(lines: Sequence[str], *, source_language: str, target_language: str, instruction: str) -> tuple[str, str]:
    source = source_language.strip() or 'auto'
    target = target_language.strip() or 'vi'
    target_key = target.lower()[:2]
    target_name = _language_display_name(target)
    source_name = _language_display_name(source)
    extra = instruction.strip()
    system = f'Bạn là biên dịch viên phụ đề. Dịch đúng nghĩa, tự nhiên và ngắn gọn. Giữ nguyên tên riêng Latin/số (Ford, Ferrari, GT40…) và sắc thái. Không giải thích. Trả về đúng số câu, mỗi câu trên một dòng theo dạng SỐ|BẢN DỊCH. Không bọc bản dịch trong dấu ngoặc kép. Ngôn ngữ nguồn: {source_name} ({source}). Ngôn ngữ đích BẮT BUỘC: {target_name} ({target}). Mọi câu phải viết bằng {target_name}.'
    if target_key in _NON_CJK_TARGETS:
        system += f' CẤM giữ nguyên câu chữ Hán/CJK khi đích là {target_name} — phải dịch hết ý sang ngôn ngữ đích (tên thương hiệu viết Latin nếu có).'
    if extra:
        system += f' Yêu cầu thêm: {extra}'
    numbered = '\n'.join((f'{index}|{json.dumps(text, ensure_ascii=False)}' for index, text in enumerate))
    return (system, numbered)

def _response_json(response, api_key: str) -> dict[str, Any]:
    try:
        data = response.json()
    except Exception as exc:
        raise ProviderRequestError('Nhà cung cấp trả về dữ liệu không đọc được') from exc
    if isinstance(data, dict):
        return data
    raise ProviderRequestError('Nhà cung cấp trả về dữ liệu không hợp lệ')

def _safe_error_detail(response, api_key: str) -> str:
    try:
        data = response.json()
        error = data.get('error', {}) if isinstance(data, dict) else {}
        detail = str(error.get('message', '') if isinstance(error, dict) else error)
    except Exception:
        detail = ''
    if api_key:
        detail = detail.replace(api_key, '••••')
    return detail.strip()[:240]

def _clean_translated_line(text: str) -> str:
    value = str(text or '').strip()
    if value:
        try:
            decoded = json.loads(value)
            if value[0] not in frozenset({'"', "'"}) or not isinstance(decoded, str):
                return value[1:-1].strip() if len(value) >= 2 and value[0] == value[-1] and (value[0] in frozenset({'"', "'"})) else value
        except json.JSONDecodeError:
            pass
    else:
        return value

def _strip_model_preamble(content: str) -> str:
    cleaned = str(content or '').strip()
    if cleaned:
        cleaned = re.sub('<think(?:ing)?\\b[^>]*>.*?</think(?:ing)?>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
        cleaned = cleaned.strip()
        if cleaned.startswith('```'):
            rows = cleaned.splitlines()
            rows = rows[1:]
            if rows and rows[-1].strip() == '```':
                rows.pop()
            cleaned = '\n'.join(rows).strip()
        return cleaned
    return ''

def _parse_numbered_lines(content: str, expected_count: int) -> list[str]:
    cleaned = _strip_model_preamble(content)
    expected = max(0, int(expected_count))
    if expected <= 0:
        return []
    values = {}
    current_id = None
    line_re = re.compile('^\\s*(\\d+)\\s*(?:[|:．.\\)]|-)\\s*(.*)$')
    for raw_line in cleaned.splitlines():
        match = line_re.match(raw_line)
        if match is not None:
            item_id = int(match.group(1))
            values[item_id] = _clean_translated_line(match.group(2))
            current_id = item_id
        elif current_id is not None and raw_line.strip():
            values[current_id] = f'{values[current_id]}\n{raw_line.strip()}'
    expected_ids = set(range(1, expected + 1))
    if set(values) == expected_ids and all((values.get(index, '').strip() for index in range(1, expected + 1))):
        return [values[index] for index in range(1, expected + 1)]
    if not values:
        plain_rows = [_clean_translated_line(row) for row in cleaned.splitlines() if not (not row.strip() or re.match('^\\s*```', row))]
        plain_rows = [row for row in plain_rows if not (not row or re.fullmatch('\\d+', row))]
        if len(plain_rows) == expected and all(plain_rows):
            return plain_rows
    elif expected_ids.issubset(set(values)):
        out = [values.get(index, '').strip() for index in range(1, expected + 1)]
        if any(out):
            return [item or '…' for item in out]
    else:
        got = len(values) if values else 0
        raise ProviderRequestError(f'Nhà cung cấp trả về sai số câu phụ đề (nhận {got}/{expected})')