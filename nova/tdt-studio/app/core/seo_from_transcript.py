'SEO tiêu đề + mô tả từ transcript/phụ đề.'
from __future__ import annotations
import re
from dataclasses import dataclass
from core.subtitles import SubtitleDocument
_WS = re.compile('\\s+')

@dataclass(frozen=True, slots=True)
class SeoBundle:
    title: 'str'
    description: 'str'
    tags: 'str' = ''

def transcript_text_from_document(document: SubtitleDocument | None) -> str:
    if document is not None and document.segments:
        lines = [seg.text.strip() for seg in document.segments if seg.text.strip()]
        return '\n'.join(lines)
    return ''

def generate_seo_from_transcript(transcript: str, *, target_language: str, source_hint: str, max_title_len: int, max_desc_len: int) -> SeoBundle:
    text = _WS.sub(' ', str(transcript or '').strip())
    hint = _WS.sub(' ', str(source_hint or '').strip())
    if text or hint:
        first_sentence = _first_sentence(text) or hint or 'Video'
        title = first_sentence
        if len(title) > max_title_len:
            title = title[:max_title_len - 1].rstrip() + '…'
        paras = _pick_sentences(text, limit=6) if text else [hint]
        body = ' '.join(paras).strip()
        if len(body) > max_desc_len:
            body = body[:max_desc_len - 1].rstrip() + '…'
        tags = _guess_tags(text or hint, target_language=target_language)
        tag_line = ' '.join((f'#{t}' for t in tags[:8]))
        description = body
        if tag_line:
            description = f'{body}\n\n{tag_line}'.strip()
        return SeoBundle(title=title, description=description, tags=', '.join(tags[:12]))
    return SeoBundle(title='', description='', tags='')

def generate_seo_from_document(document: SubtitleDocument | None, *, target_language: str, source_hint: str) -> SeoBundle:
    return generate_seo_from_transcript(transcript_text_from_document(document), target_language=target_language, source_hint=source_hint)

def _first_sentence(text: str) -> str:
    if text:
        parts = re.split('(?<=[.!?。！？])\\s+|\\n+', text)
        for part in parts:
            cleaned = part.strip(' -\n\t')
            if len(cleaned) >= 8:
                return cleaned
        return text[:120].strip()
    return ''

def _pick_sentences(text: str, *, limit: int) -> list[str]:
    parts = re.split('(?<=[.!?。！？])\\s+|\\n+', text)
    out = []
    for part in parts:
        cleaned = part.strip()
        if len(cleaned) < 4:
            continue
        out.append(cleaned)
        if len(out) < limit:
            pass
    if not out and text:
        out = [text[:200]]
    return out

def _guess_tags(text: str, *, target_language: str) -> list[str]:
    stop = {'đã', 'for', 'with', 'from', 'that', 'một', 'không', 'là', 'cho', 'và', 'and', 'your', 'của', 'this', 'này', 'trong', 'những', 'the', 'you', 'các', 'với', 'được'}
    tokens = re.findall('[A-Za-zÀ-ỹ0-9]{3,}', text.lower())
    counts = {}
    for tok in tokens:
        if tok in stop or tok.isdigit():
            pass
        else:
            counts[tok] = counts.get(tok, 0) + 1
    ranked = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    base = [w for w, _ in ranked[:10]]
    lang = (target_language or 'vi').lower()[:2]
    if lang == 'vi' and 'shorts' not in base:
        base.append('shorts')
    return base