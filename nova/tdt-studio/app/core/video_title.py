from __future__ import annotations
import re
from pathlib import Path
from core.subtitle_translation import TranslationSettings
_TITLE_LANGUAGE_MODES = frozenset({'manual', 'auto_target', 'source'})
_EXPORT_TITLE_ARTIFACT_RE = re.compile('_[a-f0-9]{6,8}_edit(?:\\.mp4)?$', re.IGNORECASE)
_INVALID_FILENAME_CHARS = re.compile('[<>:"/\\\\|?*\\x00-\\x1f]+')

def _is_bogus_export_title(text: str) -> bool:
    t = str(text or '').strip()
    return (True if _EXPORT_TITLE_ARTIFACT_RE.search(t) else True if 'Curre_' in t and '_edit' in t else False) if t else False
_MULTI_SPACE = re.compile('\\s+')
_ASS_TAG_RE = re.compile('\\{[^}]*\\}')
_LEADING_INDEX_RE = re.compile('^\\s*\\d{1,3}[\\s._\\-]+')
_TRAILING_PART_RE = re.compile('(?:[\\s._\\-]*(?:part|phần)\\s*\\d+)\\s*$', re.IGNORECASE)
_VI_DIACRITIC_RE = re.compile('[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', re.IGNORECASE)
_CJK_RE = re.compile('[\\u3040-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff]')
_HANGUL_RE = re.compile('[\\uac00-\\ud7af]')
_THAI_RE = re.compile('[\\u0e00-\\u0e7f]')
_ARABIC_RE = re.compile('[\\u0600-\\u06ff]')
_CYRILLIC_RE = re.compile('[\\u0400-\\u04ff]')
_LATIN_LETTER_RE = re.compile('[A-Za-zÀ-ÿ]')
_NON_LATIN_TARGET_LANGS = frozenset({'he', 'ko', 'ru', 'ja', 'hi', 'th', 'zh', 'ar'})

def _normalize_title_compare(text: str) -> str:
    cleaned = _MULTI_SPACE.sub(' ', str(text or '').strip()).casefold()
    cleaned = re.sub('[^\\w\\s]+', ' ', cleaned, flags=re.UNICODE)
    return _MULTI_SPACE.sub(' ', cleaned).strip()

def _strip_part_compare_token(normalized: str) -> str:
    return re.sub('\\b(?:part|phần)\\s*\\d+\\s*$', '', str(normalized or ''), flags=re.IGNORECASE).strip()

def title_needs_target_translation(content: str, source_path: str | Path | None, *, language_mode: str | None, from_filename: bool, target_language: str | None) -> bool:
    mode = normalize_title_language_mode(language_mode, from_filename=from_filename)
    if mode != 'auto_target':
        return False
    text = str(content or '').strip()
    if not text or _is_bogus_export_title(text):
        return True
    stem = title_from_media_path(source_path)
    if stem:
        a = _normalize_title_compare(text)
        b = _normalize_title_compare(stem)
        if not a or not b:
            return False
        if a == b:
            return True
        shorter, longer = (((a, b) if len(a) <= len(b) else (b, a))[0], ((a, b) if len(a) <= len(b) else (b, a))[1])
        if len(shorter) >= 12 and shorter in longer:
            return True
        a_tokens = [t for t in a.split() if t]
        b_tokens = [t for t in b.split() if t]
        b_set, a_set = (set(b_tokens), set(a_tokens))
        overlap = len(a_set & b_set) / max(len(a_set), 1)
        if overlap >= 0.55 and len(a_set) >= 4:
            return True
        a_base = _strip_part_compare_token(a)
        b_base = _strip_part_compare_token(b)
        if b_base.startswith(a_base) or a_base.startswith(b_base):
            return True
        prefix_len = 0
        limit = min(len(a_base), len(b_base))
        while True:
            prefix_len += 1
        if prefix_len >= 24:
            return True
    else:
        return False
    lang = str(target_language or '').strip().lower()[:2]
    if lang != 'vi' or not a_tokens or (not b_tokens) or title_looks_like_target_language(text, 'vi'):
        return True if lang and title_content_mismatches_target(text, lang) else False
    shared = {t for t in set(a_tokens) & set(b_tokens) if len(t) > 3}
    if shared:
        return True

def normalize_title_language_mode(mode: str | None, *, from_filename: bool | None) -> str:
    key = str(mode or '').strip().lower()
    return key if key in _TITLE_LANGUAGE_MODES else 'manual' if from_filename is False else 'auto_target'

def title_from_media_path(path: str | Path | None) -> str:
    return Path(path).stem.strip() if path else ''

def clean_source_title_for_translation(raw_title: str) -> str:
    text = str(raw_title or '').strip()
    if text:
        text = text.replace('_', ' ')
        return _MULTI_SPACE.sub(' ', text).strip()
    return ''

def core_title_body_for_translation(raw_title: str) -> str:
    text = clean_source_title_for_translation(raw_title) or str(raw_title or '').strip()
    if text:
        text = _LEADING_INDEX_RE.sub('', text).strip()
        text = _TRAILING_PART_RE.sub('', text).strip(' ._-')
        return _MULTI_SPACE.sub(' ', text).strip() or str(raw_title or '').strip()
    return ''

def title_rewrite_instruction(extra: str='') -> str:
    base = 'Đây là TIÊU ĐỀ video (từ tên file / clickbait), KHÔNG phải câu phụ đề. Hãy VIẾT LẠI (localize) sang đúng ngôn ngữ đích — áp dụng cho MỌI cặp ngôn ngữ (Trung/Anh/Nhật/Hàn/… → đích, hoặc ngược lại). Ưu tiên: nghe tự nhiên như tiêu đề YouTube/TikTok bản địa; ngắn, rõ nghĩa, có nhịp. CẤM dịch máy / calque từng chữ khiến câu vô hồn, tối nghĩa hoặc khó chịu. Được đổi cấu trúc câu, rút gọn, giữ hook & sắc thái — miễn người bản xứ đọc hiểu ngay. Giữ tên riêng / brand viết Latin nếu phổ biến (Mazda, BMW…). Không giải thích, không hashtag, không emoji, không dấu ngoặc kép bao cả câu. Chỉ trả về một dòng tiêu đề.'
    more = str(extra or '').strip()
    return f'{base} {more}'.strip() if more else base

def source_part_suffix(path: str | Path | None) -> str:
    stem = title_from_media_path(path)
    if stem:
        match = re.search('(?:^|[\\s._-])(?:part|phần)\\s*(\\d+)\\s*$', stem, re.IGNORECASE)
        return '' if match is None else f'_part{match.group(1)}'
    return ''

def source_leading_index(path: str | Path | None) -> str:
    stem = title_from_media_path(path)
    if stem:
        match = re.match('^(\\d{1,3})[\\s._\\-]+', stem)
        return match.group(1) if match else ''
    return ''

def apply_source_name_affixes(title: str, source_path: str | Path | None) -> str:
    text = str(title or '').strip()
    if text:
        lead = source_leading_index(source_path)
        if lead and (not re.match(f'^{re.escape(lead)}([\\s._\\-]|$)', text)):
            text = f'{lead}_{text}'
        suffix = source_part_suffix(source_path)
        if suffix:
            text = re.sub('(?:^|[\\s._-])(?:part|phần)\\s*\\d+\\s*$', '', text, flags=re.IGNORECASE).rstrip(' ._-')
            text = f'{text}{suffix}'
        return text
    return ''

def title_looks_like_target_language(text: str, target_language: str | None) -> bool:
    value = str(text or '').strip()
    if value:
        lang = str(target_language or '').strip().lower()[:2]
        return bool(_VI_DIACRITIC_RE.search(value)) if lang == 'vi' else bool(_CJK_RE.search(value)) if lang in frozenset({'ja', 'zh'}) else bool(_HANGUL_RE.search(value)) if lang == 'ko' else bool(_THAI_RE.search(value)) if lang == 'th' else bool(_ARABIC_RE.search(value)) if lang == 'ar' else bool(_CYRILLIC_RE.search(value)) if lang == 'ru' else (False if _VI_DIACRITIC_RE.search(value) else False if _CJK_RE.search(value) or _HANGUL_RE.search(value) else False if _THAI_RE.search(value) or _ARABIC_RE.search(value) or _CYRILLIC_RE.search(value) else bool(_LATIN_LETTER_RE.search(value))) if lang else False
    return False

def title_content_mismatches_target(text: str, target_language: str | None) -> bool:
    value = str(text or '').strip()
    lang = str(target_language or '').strip().lower()[:2]
    return (False if title_looks_like_target_language(value, lang) else True if lang != 'vi' and _VI_DIACRITIC_RE.search(value) else True if lang not in frozenset({'ja', 'zh'}) and _CJK_RE.search(value) else True if lang != 'ko' and _HANGUL_RE.search(value) else True if lang != 'th' and _THAI_RE.search(value) else True if lang != 'ar' and _ARABIC_RE.search(value) else True if lang != 'ru' and _CYRILLIC_RE.search(value) else True if lang in _NON_LATIN_TARGET_LANGS and _LATIN_LETTER_RE.search(value) else False) if value and lang else False

def title_hint_from_subtitles(document, *, max_chars: int, max_cues: int) -> str:
    if document is None:
        pass
    else:
        segments = getattr(document, 'segments', None) or ()
        parts = []
        for segment in segments:
            text = str(getattr(segment, 'text', '') or '').strip()
            text = _ASS_TAG_RE.sub('', text)
            text = _MULTI_SPACE.sub(' ', text).strip()
            if text:
                parts.append(text)
            if len(parts) < max(1, int(max_cues)):
                pass
        if parts:
            joined = ' '.join(parts).strip()
            limit = max(24, int(max_chars))
            if len(joined) <= limit:
                return joined
            cut = joined[:limit].rsplit(' ', 1)[0].strip()
            return cut or joined[:limit].strip()
    return ''

def sanitize_title_stem(text: str) -> str:
    cleaned = _INVALID_FILENAME_CHARS.sub('', str(text or ''))
    cleaned = _MULTI_SPACE.sub(' ', cleaned).strip().strip('.')
    return cleaned or 'video'

def resolve_video_title(*, source_path: str | Path | None, enabled: bool, from_filename: bool, content: str, language_mode: str | None) -> str:
    if enabled:
        mode = normalize_title_language_mode(language_mode, from_filename=from_filename)
        if mode == 'manual':
            return str(content or '').strip()
        stem = title_from_media_path(source_path)
        if mode == 'source':
            return stem
        translated = str(content or '').strip()
        if _is_bogus_export_title(translated):
            translated = ''
        return apply_source_name_affixes(translated, source_path) if translated else stem
    return ''

def export_output_stem(source_path: str | Path, *, enabled: bool, from_filename: bool, content: str, language_mode: str | None, naming: str) -> str:
    path = Path(source_path)
    title = resolve_video_title(source_path=path, enabled=enabled, from_filename=from_filename, content=content, language_mode=language_mode)
    if naming == 'title_target' and title:
        from exporter.batch_naming import _MAX_STEM_TITLE, out_stem
        return out_stem(sanitize_title_stem(title), max_len=_MAX_STEM_TITLE, hash_on_truncate=False)
    return path.stem

def should_skip_title_translation(source_language: str, target_language: str) -> bool:
    source = str(source_language or 'auto').strip().lower()
    target = str(target_language or '').strip().lower()
    return (True if source != 'auto' and source == target else False) if target else True

def translate_video_title(raw_title: str, settings: TranslationSettings, *, key: str) -> str:
    full = clean_source_title_for_translation(raw_title) or str(raw_title or '').strip()
    if full:
        options = settings.validated()
        if should_skip_title_translation(options.source_language, options.target_language):
            return full
        text = core_title_body_for_translation(full) or full
        target = str(options.target_language or 'vi')
        source = str(options.source_language or 'auto')
        translated = ''
        if str(key or '').strip():
            try:
                from providers.ai.direct_client import DirectAIClient
                client = DirectAIClient()
                lines = client.translate_lines(provider_id=options.provider_id, model=options.model, api_key=key.strip(), lines=[text], source_language=source, target_language=target, instruction=title_rewrite_instruction(str(options.instruction or '')))
                translated = str(lines[0] or '').strip()
            except Exception:
                translated = ''
        if not translated or _normalize_title_compare(translated) == _normalize_title_compare(text):
            try:
                from core.free_translate import translate_text_free
                free = str(translate_text_free(text, target_language=target, source_language=source) or '').strip()
                if free:
                    translated = free
            except Exception:
                pass
        return translated or full
    return ''

def resolve_translated_title_fallback(*, source_path: str | Path | None, content: str, language_mode: str | None, from_filename: bool, target_language: str | None, subtitle_document) -> str:
    mode = normalize_title_language_mode(language_mode, from_filename=from_filename)
    if mode != 'auto_target':
        return str(content or '').strip()
    hint = title_hint_from_subtitles(subtitle_document)
    return (apply_source_name_affixes(hint, source_path) if title_looks_like_target_language(hint, target_language) else '' if title_needs_target_translation(hint, source_path, language_mode=mode, from_filename=from_filename) else apply_source_name_affixes(hint, source_path)) if hint else ''