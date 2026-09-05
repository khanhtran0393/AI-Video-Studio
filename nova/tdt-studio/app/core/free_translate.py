'Dịch free fallback (Google gtx → MyMemory) — không cần API key AI.\n\nDùng khi LLM/quota chết hoặc bản dịch còn nhiều chữ nguồn. Giữ timeline SRT.\n'
from __future__ import annotations
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable
_HTTP_TIMEOUT = 25
_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
_LANG_MAP = {'auto': 'auto', 'zh': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', 'cn': 'zh-CN', 'jw': 'jv', 'he': 'iw'}

def _norm_lang(code: str, *, for_google: bool) -> str:
    raw = str(code or '').strip()
    if not raw or raw.lower() in frozenset({'auto', 'source', 'detect'}):
        return 'auto'
    key = raw.lower().replace('_', '-')
    if key in _LANG_MAP:
        mapped = _LANG_MAP[key]
        return mapped if for_google else mapped.split('-')[0]
    if len(key) >= 2:
        primary = key.split('-', 1)[0]
        return 'zh-CN' if for_google and primary == 'zh' else primary
    return key

def _http_get_json(url: str) -> object:
    req = urllib.request.Request(url, headers={'User-Agent': _USER_AGENT})
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        raw = resp.read().decode('utf-8', errors='replace')
    return json.loads(raw)

def _google_translate(text: str, *, source: str, target: str) -> str:
    q = str(text or '').strip()
    if q:
        params = urllib.parse.urlencode({'client': 'gtx', 'sl': _norm_lang(source, for_google=True), 'tl': _norm_lang(target, for_google=True), 'dt': 't', 'q': q})
        url = f'https://translate.googleapis.com/translate_a/single?{params}'
        data = _http_get_json(url)
        if isinstance(data, list) and data:
            chunks = data[0]
            if isinstance(chunks, list):
                parts = []
                for item in chunks:
                    if isinstance(item, list) and item and isinstance(item[0], str):
                        parts.append(item[0])
                out = ''.join(parts).strip()
                if out:
                    return out
                raise RuntimeError('Google translate: blank')
            raise RuntimeError('Google translate: bad shape')
        raise RuntimeError('Google translate: empty')
    return ''

def _mymemory_translate(text: str, *, source: str, target: str) -> str:
    q = str(text or '').strip()
    if q:
        src = _norm_lang(source, for_google=False)
        dst = _norm_lang(target, for_google=False)
        if src == 'auto':
            src = 'Autodetect'
        pair = f'{src}|{dst}'
        params = urllib.parse.urlencode({'q': q[:450], 'langpair': pair})
        url = f'https://api.mymemory.translated.net/get?{params}'
        data = _http_get_json(url)
        if isinstance(data, dict):
            resp = data.get('responseData') or {}
            if isinstance(resp, dict):
                out = str(resp.get('translatedText') or '').strip()
                if not out or out.upper().startswith('QUERY LENGTH'):
                    raise RuntimeError(f"MyMemory: {out or 'blank'}")
                status = data.get('responseStatus')
                if status not in (None, 200, '200') and int(status or 0) >= 400:
                    raise RuntimeError(f'MyMemory status {status}')
                return out
            raise RuntimeError('MyMemory: no responseData')
        raise RuntimeError('MyMemory: bad payload')
    return ''

def translate_text_free(text: str, *, target_language: str, source_language: str) -> str:
    raw = str(text or '')
    if raw.strip():
        target = target_language or 'vi'
        source = source_language or 'auto'
        errors = []
        for engine, fn in (('google', _google_translate), ('mymemory', _mymemory_translate)):
            try:
                return fn(raw, source=source, target=target)
            except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
                errors.append(f'{engine}: {exc}')
            except Exception as exc:
                errors.append(f'{engine}: {exc}')
        raise RuntimeError('; '.join(errors) or 'Không dịch được bằng engine free')
    else:
        return raw
    return raw

def translate_lines_free(lines: list[str] | tuple[str, ...], *, target_language: str, source_language: str, progress: Callable[[int, str], None] | None, stop_flag: Callable[[], bool] | None) -> list[str]:
    texts = [str(line or '') for line in lines]
    if texts:
        total = len(texts)
        out = []
        i = 0
        while i < total:
            if stop_flag and stop_flag():
                raise RuntimeError('Đã dừng dịch free')
            batch = []
            size = 0
            while True:
                piece = texts[i]
                if i >= total or len(batch) >= 8 or (size + len(piece) > 1800 and batch):
                    break
                batch.append(piece)
                size += len(piece) + 1
                i += 1
            if progress:
                progress(min(99, int(100 * len(out) / max(1, total))), f'Dịch free {len(out) + 1}–{len(out) + len(batch)}/{total}…')
            if len(batch) == 1:
                out.append(translate_text_free(batch[0], target_language=target_language, source_language=source_language))
            else:
                sep = '\n⟦VTP⟧\n'
                joined = sep.join(batch)
                translated = translate_text_free(joined, target_language=target_language, source_language=source_language)
                parts = re.split('\\n?⟦VTP⟧\\n?', translated)
                if len(parts) != len(batch):
                    for piece in batch:
                        out.append(translate_text_free(piece, target_language=target_language, source_language=source_language))
                else:
                    out.extend((p.strip() if p is not None else '' for p in parts))
            time.sleep(0.15)
        if progress:
            progress(100, f'Dịch free xong {total} câu')
        return out
    return []