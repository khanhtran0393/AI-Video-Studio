from __future__ import annotations
import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING
from core.api_keys import api_blocked_user_hint, parse_api_key_pool
from core.subtitles import SubtitleDocument, SubtitleSegment
from providers.ai.direct_client import ProviderAuthError, ProviderRateLimitError, ProviderRequestError
_CJK_RE = re.compile('[\\u4e00-\\u9fff\\u3400-\\u4dbf]')
_NON_CJK_TARGETS = frozenset({'vi', 'de', 'en', 'fr', 'th', 'es'})
if TYPE_CHECKING:
    from providers.ai.direct_client import DirectAIClient

class SubtitleJobCancelled(RuntimeError):
    pass

@dataclass(frozen=True, slots=True)
class TranslationSettings:
    provider_id: 'str'
    model: 'str'
    source_language: 'str' = 'auto'
    target_language: 'str' = 'vi'
    instruction: 'str' = ''
    batch_size: 'int' = 12

    def validated(self) -> TranslationSettings:
        if not self.provider_id.strip():
            raise ValueError('Chưa chọn nhà cung cấp AI')
        if not self.model.strip():
            raise ValueError('Chưa chọn model AI')
        if not self.target_language.strip():
            raise ValueError('Chưa chọn ngôn ngữ đích')
        if 1 <= int(self.batch_size) <= 100:
            return self
        raise ValueError('Số câu mỗi lượt phải nằm trong khoảng 1–100')

def translate_document(document: SubtitleDocument, settings: TranslationSettings, *, key: str, client: DirectAIClient | None, progress: Callable[[int], None] | None, stop_event: threading.Event | None) -> SubtitleDocument:
    options = settings.validated()
    keys = parse_api_key_pool(key)
    if keys:
        stop = stop_event or threading.Event()
        live_pct = {'value': 0}

        def _client_status(message: str) -> None:
            _emit_progress(progress, live_pct['value'] or 1, message)
        if client is None:
            from providers.ai.direct_client import DirectAIClient
            translator = DirectAIClient(status_cb=_client_status)
        else:
            translator = client
            if getattr(translator, 'status_cb', None) is None:
                translator.status_cb = _client_status
        provider_label = options.provider_id
        auth_failures = 0
        rate_failures = 0
        last_rate_error = None
        batch_plan = [int(options.batch_size)]
        if options.batch_size > 6:
            batch_plan.append(max(4, options.batch_size // 2))
        if options.batch_size > 4:
            batch_plan.append(4)
        batch_plan.append(1)
        seen_bs = set()
        batch_sizes = []
        for size in batch_plan:
            if size not in seen_bs:
                seen_bs.add(size)
                batch_sizes.append(size)
        last_quality_error = None
        for batch_size in batch_sizes:
            sized = TranslationSettings(provider_id=options.provider_id, model=options.model, source_language=options.source_language, target_language=options.target_language, instruction=options.instruction, batch_size=batch_size)
            for index, api_key in enumerate(keys, start=1):
                _raise_if_cancelled(stop)
                if len(keys) > 1 or batch_size != options.batch_size:
                    _emit_progress(progress, max(1, live_pct['value']), f'Dịch bằng key {index}/{len(keys)}, {batch_size} câu/lượt ({provider_label})…')
                try:
                    return _translate_document_with_key(document, sized, api_key=api_key, translator=translator, progress=progress, stop_event=stop, live_pct=live_pct)
                except ProviderAuthError:
                    auth_failures += 1
                    continue
                except ProviderRateLimitError as exc:
                    rate_failures += 1
                    last_rate_error = exc
                    _emit_progress(progress, max(1, live_pct['value']), f'API quá tải với {batch_size} câu/lượt — sẽ giảm batch / đổi key…')
                    time.sleep(2.0)
                    continue
                except ProviderRequestError as exc:
                    last_rate_error = exc
                    msg = str(exc or '').casefold()
                    if 'chưa dịch' in msg or 'chữ hán' in msg:
                        last_quality_error = exc
                    elif any((token in msg for token in ('từ chối', 'refus', 'not supported', 'unsupported', 'quota', 'credit', 'billing', 'insufficient', 'blocked'))):
                        last_quality_error = exc
                        _emit_progress(progress, max(1, live_pct['value']), 'API từ chối yêu cầu — chuyển dịch free…')
                    else:
                        _emit_progress(progress, max(1, live_pct['value']), f'API dịch lỗi: {str(exc)[:80]} — thử key/batch khác…')
                        continue
    else:
        raise ValueError('Chưa nhập khóa API cá nhân')
    free_error = ''
    _emit_progress(progress, max(1, live_pct['value']), 'AI không dịch được — chuyển sang dịch free (Google → MyMemory)…')
    try:
        free_doc = _translate_document_free(document, target_language=options.target_language, source_language=options.source_language, progress=progress, stop_event=stop, live_pct=live_pct)
        if free_doc.segments:
            _emit_progress(progress, 100, 'Đã dịch free (không cần key AI)')
        else:
            if auth_failures and rate_failures == 0:
                raise ProviderRequestError(f'Tất cả {len(keys)} khóa {provider_label} không hợp lệ hoặc hết quyền.' + (f' Free fallback: {free_error}' if free_error else ''))
            detail_ai = str(last_rate_error) if last_rate_error else ''
            hint = api_blocked_user_hint(provider_label, len(keys))
            if free_error:
                hint = f'{hint}\nFree fallback: {free_error}'
            raise ProviderRequestError(f'{detail_ai}\n\n{hint}' if detail_ai else hint)
    except SubtitleJobCancelled:
        raise
    except Exception as free_exc:
        free_error = str(free_exc)

def _translate_document_free(document: SubtitleDocument, *, target_language: str, source_language: str, progress: Callable[..., None] | None, stop_event: threading.Event | None, live_pct: dict[str, int] | None) -> SubtitleDocument:
    from core.free_translate import translate_lines_free
    stop = stop_event or threading.Event()
    total = len(document.segments)
    if total == 0:
        return SubtitleDocument()

    def _prog(pct: int, message: str='') -> None:
        if live_pct is not None:
            live_pct['value'] = int(pct)
        _emit_progress(progress, int(pct), message or 'Đang dịch free…')
    lines = [seg.text for seg in document.segments]
    translated = translate_lines_free(lines, target_language=target_language, source_language=source_language or 'auto', progress=_prog, stop_flag=stop.is_set)
    if len(translated) != total:
        raise ValueError('Dịch free trả sai số câu')
    leftover = count_untranslated_cjk_lines(lines, translated, target_language)
    if leftover and leftover / max(1, total) >= 0.2:
        raise ProviderRequestError(f'Dịch free vẫn còn {leftover}/{total} câu gần như chưa dịch (vẫn chữ Hán) dù đích «{target_language}».')
    return SubtitleDocument(tuple((SubtitleSegment(seg.start_ms, seg.end_ms, text).validated() for seg, text in zip)))

def _translate_document_with_key(document: SubtitleDocument, options: TranslationSettings, *, api_key: str, translator: DirectAIClient, progress: Callable[..., None] | None, stop_event: threading.Event, live_pct: dict[str, int] | None) -> SubtitleDocument:
    _emit_progress(progress, 0, 'Đang dịch phụ đề')
    if live_pct is not None:
        live_pct['value'] = 0
    total = len(document.segments)
    if total == 0:
        _emit_progress(progress, 100, 'Đang dịch phụ đề')
        if live_pct is not None:
            live_pct['value'] = 100
        return SubtitleDocument()
    translated_segments = []
    batch_size = int(options.batch_size)
    total_batches = max(1, (total + batch_size - 1) // batch_size)
    for start in range(0, total, batch_size):
        _raise_if_cancelled(stop_event)
        batch = document.segments[start:start + batch_size]
        batch_no = start // batch_size + 1
        pct_wait = max(1, min(99, round(start * 100 / total)))
        pct_done = min(100, round((start + len(batch)) * 100 / total))
        if live_pct is not None:
            live_pct['value'] = pct_wait
        _emit_progress(progress, pct_wait, f'Đang gọi API dịch ({batch_no}/{total_batches}) — {len(batch)} câu…')
        translated = _translate_lines_adaptive(translator, options=options, api_key=api_key, segments=batch, progress=progress, stop_event=stop_event, pct=pct_wait, pct_cap=max(pct_wait + 1, pct_done - 1), batch_no=batch_no, total_batches=total_batches, live_pct=live_pct)
        _raise_if_cancelled(stop_event)
        if len(translated) != len(batch):
            raise ValueError('Nhà cung cấp trả về sai số câu phụ đề')
        translated_segments.extend((SubtitleSegment(segment.start_ms, segment.end_ms, text).validated() for segment, text in zip))
        if live_pct is not None:
            live_pct['value'] = pct_done
        _emit_progress(progress, pct_done, f'Đã dịch xong lượt {batch_no}/{total_batches}')
    sources = [segment.text for segment in document.segments]
    outputs = [segment.text for segment in translated_segments]
    leftover = count_untranslated_cjk_lines(sources, outputs, options.target_language)
    if leftover:
        ratio = leftover / max(1, len(outputs))
        if ratio >= 0.2:
            _emit_progress(progress, 95, f'AI còn {leftover} câu nghi chưa dịch — thử free repair…')
            try:
                from core.free_translate import translate_text_free
                repaired = []
                for seg, src, out in zip(document.segments, sources, outputs, strict=True):
                    _raise_if_cancelled(stop_event)
                    if line_still_has_source_script(src, out, options.target_language):
                        fixed = translate_text_free(src, target_language=options.target_language, source_language=options.source_language or 'auto')
                        repaired.append(SubtitleSegment(seg.start_ms, seg.end_ms, fixed or out).validated())
                    else:
                        repaired.append(SubtitleSegment(seg.start_ms, seg.end_ms, out).validated())
                outputs2 = [s.text for s in repaired]
                leftover2 = count_untranslated_cjk_lines(sources, outputs2, options.target_language)
                if leftover2 / max(1, len(outputs2)) < 0.2:
                    pass
            except SubtitleJobCancelled:
                raise
            except Exception:
                pass
        else:
            _emit_progress(progress, 100, f'Cảnh báo: còn {leftover} câu có thể chưa dịch hết')
    else:
        return SubtitleDocument(tuple(translated_segments))
    raise ProviderRequestError(f'Bản dịch còn {leftover}/{len(outputs)} câu gần như chưa dịch (vẫn chữ Hán) dù đã chọn đích «{options.target_language}». Đổi nhà cung cấp/model hoặc chạy lại Dịch phụ đề trước khi tạo giọng.')

def _translate_lines_adaptive(translator: DirectAIClient, *, options: TranslationSettings, api_key: str, segments: list[SubtitleSegment] | tuple[SubtitleSegment, ...], progress: Callable[..., None] | None, stop_event: threading.Event, pct: int, pct_cap: int, batch_no: int, total_batches: int, live_pct: dict[str, int] | None) -> list[str]:
    lines = [segment.text for segment in segments]
    try:
        pass
    except (ProviderRateLimitError, ProviderRequestError) as exc:
        msg = str(exc or '')
        split_ok = isinstance(exc, ProviderRateLimitError) or 'sai số câu' in msg.lower()
        if not split_ok or len(segments) <= 1:
            raise
        mid = max(1, len(segments) // 2)
        reason = 'API quá tải' if isinstance(exc, ProviderRateLimitError) else 'Sai số câu từ API'
        _emit_progress(progress, pct, f'{reason} — tách lượt {batch_no} thành {mid}+{len(segments) - mid} câu…')
        time.sleep(2.0)
        left = _translate_lines_adaptive(translator, options=options, api_key=api_key, segments=segments[:mid], progress=progress, stop_event=stop_event, pct=pct, pct_cap=pct_cap, batch_no=batch_no, total_batches=total_batches, live_pct=live_pct)
        right = _translate_lines_adaptive(translator, options=options, api_key=api_key, segments=segments[mid:], progress=progress, stop_event=stop_event, pct=pct, pct_cap=pct_cap, batch_no=batch_no, total_batches=total_batches, live_pct=live_pct)
        return left + right

def _translate_batch_with_heartbeat(translator: DirectAIClient, *, options: TranslationSettings, api_key: str, lines: list[str], progress: Callable[..., None] | None, stop_event: threading.Event, pct: int, pct_cap: int, batch_no: int, total_batches: int, live_pct: dict[str, int] | None) -> list[str]:
    box = {}

    def _worker() -> None:
        try:
            box['result'] = translator.translate_lines(provider_id=options.provider_id, model=options.model, api_key=api_key, lines=lines, source_language=options.source_language or 'auto', target_language=options.target_language, instruction=options.instruction)
        except Exception as exc:
            box['error'] = exc
    worker = threading.Thread(target=_worker, name=f'translate-batch-{batch_no}', daemon=True)
    worker.start()
    elapsed = 0
    hard_cap_sec = 900
    if worker.is_alive():
        _raise_if_cancelled(stop_event)
        worker.join(timeout=3.0)
        while worker.is_alive():
            _raise_if_cancelled(stop_event)
            elapsed += 3
            if elapsed >= hard_cap_sec:
                raise ProviderRequestError(f'API dịch quá lâu ({elapsed}s) — hủy batch {batch_no}/{total_batches}. Thử lại, đổi provider, hoặc giảm số câu mỗi lần dịch.')
            crawl = min(max(0, pct_cap - pct), elapsed // 3)
            shown = min(99, pct + crawl)
            if live_pct is not None:
                live_pct['value'] = shown
            note = ''
            if elapsed >= 60:
                note = ' — vẫn chờ phản hồi API'
            if elapsed >= 180:
                note = ' — API chậm/có thể nghẽn, nên kiểm tra key hoặc bấm Dừng'
            _emit_progress(progress, shown, f'Đang chờ API dịch ({batch_no}/{total_batches})… {elapsed}s{note}')
    if 'error' in box:
        raise box['error']
    result = box.get('result')
    if isinstance(result, list):
        translated = [str(item) for item in result]
        return _repair_untranslated_lines(translator, options=options, api_key=api_key, source_lines=lines, translated=translated, progress=progress, stop_event=stop_event, pct=pct, batch_no=batch_no, total_batches=total_batches, live_pct=live_pct)
    raise ProviderRequestError('API dịch không trả về kết quả')

def line_still_has_source_script(source: str, translated: str, target_language: str) -> bool:
    target = (target_language or '').strip().lower()[:2]
    if target not in _NON_CJK_TARGETS:
        return False
    src = str(source or '')
    out = str(translated or '').strip()
    if out:
        src_cjk = len(_CJK_RE.findall(src))
        if src_cjk < 2:
            return False
        out_cjk = len(_CJK_RE.findall(out))
        if out_cjk < 2:
            return False
        letters = sum((1 for ch in out if ch.isalnum() or _CJK_RE.match(ch)))
        return True if letters <= 0 else out_cjk / letters >= 0.35 or out_cjk >= max(2, int(src_cjk * 0.6))
    return True

def count_untranslated_cjk_lines(sources: list[str] | tuple[str, ...], translated: list[str] | tuple[str, ...], target_language: str) -> int:
    return sum((1 for source, out in zip(sources, translated) if line_still_has_source_script(source, out, target_language)))
_VI_DIAC_RE = re.compile('[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]')
_LATIN_LETTER_RE = re.compile('[A-Za-z]')
_HANGUL_RE = re.compile('[\\uac00-\\ud7a3]')
_KANA_RE = re.compile('[\\u3040-\\u30ff]')
_THAI_RE = re.compile('[\\u0e00-\\u0e7f]')
_CYRILLIC_RE = re.compile('[\\u0400-\\u04ff]')
_LANG_ALIASES = {'vn': 'vi', 'vie': 'vi', 'jp': 'ja', 'jpn': 'ja', 'cn': 'zh', 'zho': 'zh', 'cmn': 'zh', 'tw': 'zh', 'kr': 'ko', 'kor': 'ko', 'eng': 'en', 'fra': 'fr', 'deu': 'de', 'spa': 'es', 'tha': 'th'}

def normalize_language_code(code: str) -> str:
    raw = str(code or '').strip().lower().replace('_', '-')
    if not raw or raw in frozenset({'auto', 'source', 'detect'}):
        return ''
    primary = raw.split('-', 1)[0].strip()
    return (_LANG_ALIASES[primary] if primary in _LANG_ALIASES else primary[:2] if len(primary) >= 2 else primary) if primary else ''

def target_script_family(language_code: str) -> str:
    lang = normalize_language_code(language_code)
    return 'cjk' if lang in frozenset({'zh', 'ja'}) else 'hangul' if lang == 'ko' else 'thai' if lang == 'th' else 'cyrillic' if lang == 'ru' else 'latin'

def _srt_dialogue_body(text: str) -> str:
    lines = []
    for raw in str(text or '').splitlines():
        line = raw.strip()
        if not line or line.isdigit() or '-->' in line:
            pass
        else:
            lines.append(line)
    return '\n'.join(lines)

def _script_char_counts(body: str) -> dict[str, int]:
    return {'cjk': len(_CJK_RE.findall(body)), 'hangul': len(_HANGUL_RE.findall(body)), 'kana': len(_KANA_RE.findall(body)), 'thai': len(_THAI_RE.findall(body)), 'cyrillic': len(_CYRILLIC_RE.findall(body)), 'latin': len(_LATIN_LETTER_RE.findall(body)), 'vi_marks': len(_VI_DIAC_RE.findall(body))}

def subtitle_file_needs_translation(path: str | Path, target_language: str, *, max_chars: int) -> bool:
    target = normalize_language_code(target_language)
    if target:
        candidate = Path(str(path or '').strip()).expanduser()
        if candidate.is_file():
            try:
                raw = candidate.read_text(encoding='utf-8-sig', errors='replace')
            except OSError:
                return True
            body = _srt_dialogue_body(raw[:max(0, int(max_chars))])
            if body.strip():
                counts = _script_char_counts(body)
                script_total = counts['cjk'] + counts['hangul'] + counts['kana'] + counts['thai'] + counts['cyrillic'] + counts['latin']
                if script_total < 12:
                    return False

                def _ratio(key: str) -> float:
                    return counts[key] / script_total
                family = target_script_family(target)
                cjk_like = counts['cjk'] + counts['kana'] + counts['hangul']
                if family == 'latin':
                    return True if cjk_like >= 8 and cjk_like / script_total >= 0.12 else True if counts['thai'] >= 8 and _ratio('thai') >= 0.12 else True if counts['cyrillic'] >= 8 and _ratio('cyrillic') >= 0.12 else (False if counts['vi_marks'] >= 8 else True if counts['latin'] >= 40 and counts['vi_marks'] < 4 else False) if target == 'vi' else (True if counts['vi_marks'] >= 4 else False) if target == 'en' else False
                if family == 'cjk':
                    expected = counts['cjk'] + counts['kana']
                    if expected >= 10 and expected / script_total >= 0.15 if target == 'ja' else counts['cjk'] >= 10 and _ratio('cjk') >= 0.15:
                        return False
                else:
                    return (False if counts['hangul'] >= 10 and _ratio('hangul') >= 0.15 else True if counts['latin'] >= 40 and counts['hangul'] < 8 else True if cjk_like >= 10 and counts['hangul'] < 4 else counts['hangul'] < 8 and script_total >= 24) if family == 'hangul' else (False if counts['thai'] >= 10 and _ratio('thai') >= 0.15 else True if counts['latin'] >= 40 and counts['thai'] < 8 else True if cjk_like >= 8 else counts['thai'] < 8 and script_total >= 24) if family == 'thai' else (False if counts['cyrillic'] >= 10 and _ratio('cyrillic') >= 0.15 else True if counts['latin'] >= 40 and counts['cyrillic'] < 8 else counts['cyrillic'] < 8 and script_total >= 24) if family == 'cyrillic' else False
            else:
                return True
        else:
            return False
    else:
        return False
    return True if counts['latin'] >= 40 and expected < 8 else True if counts['vi_marks'] >= 8 else expected < 8 and script_total >= 24

def _repair_untranslated_lines(translator: DirectAIClient, *, options: TranslationSettings, api_key: str, source_lines: list[str], translated: list[str], progress: Callable[..., None] | None, stop_event: threading.Event, pct: int, batch_no: int, total_batches: int, live_pct: dict[str, int] | None, max_rounds: int) -> list[str]:
    if len(translated) != len(source_lines):
        raise ProviderRequestError('Nhà cung cấp trả về sai số câu phụ đề')
    target = options.target_language
    fixed = list(translated)
    for round_no in range(1, max_rounds + 1):
        bad_idx = [i for i, (src, out) in enumerate(zip(source_lines, fixed, strict=True)) if line_still_has_source_script(src, out, target)]
        if bad_idx:
            _raise_if_cancelled(stop_event)
            _emit_progress(progress, pct, f'Còn {len(bad_idx)} câu chưa dịch hết (lượt {batch_no}/{total_batches}) — thử lại vòng {round_no}/{max_rounds}…')
            repair_instruction = (f'{options.instruction.strip()} '.strip() + ' Dịch lại HOÀN TOÀN sang ngôn ngữ đích; không để lại chữ Hán/CJK.').strip()
            for index in bad_idx:
                _raise_if_cancelled(stop_event)
                try:
                    repaired = translator.translate_lines(provider_id=options.provider_id, model=options.model, api_key=api_key, lines=[source_lines[index]], source_language=options.source_language or 'auto', target_language=target, instruction=repair_instruction)
                except ProviderRateLimitError:
                    time.sleep(2.0)
                    repaired = translator.translate_lines(provider_id=options.provider_id, model=options.model, api_key=api_key, lines=[source_lines[index]], source_language=options.source_language or 'auto', target_language=target, instruction=repair_instruction)
                if len(repaired) != 1:
                    raise ProviderRequestError('Nhà cung cấp trả về sai số câu phụ đề')
                candidate = str(repaired[0])
                if line_still_has_source_script(source_lines[index], candidate, target):
                    old_cjk = len(_CJK_RE.findall(fixed[index]))
                    new_cjk = len(_CJK_RE.findall(candidate))
                    if candidate.strip() and new_cjk < old_cjk:
                        fixed[index] = candidate
                else:
                    fixed[index] = candidate
            if live_pct is None:
                pass
            else:
                live_pct['value'] = pct
            continue
        return fixed
    leftover = count_untranslated_cjk_lines(source_lines, fixed, target)
    if leftover:
        _emit_progress(progress, pct, f'Cảnh báo: còn {leftover} câu gần như chưa dịch trong lượt {batch_no}/{total_batches}')
    return fixed

def _raise_if_cancelled(stop_event: threading.Event) -> None:
    if stop_event.is_set():
        raise SubtitleJobCancelled('Đã dừng xử lý phụ đề')

def _emit_progress(progress: Callable[..., None] | None, value: int, message: str='') -> None:
    if progress is None:
        pass
    else:
        pct = max(0, min(100, int(value)))
        try:
            progress(pct, message)
        except TypeError:
            progress(pct)