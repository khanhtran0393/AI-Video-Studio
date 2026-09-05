from __future__ import annotations
import re
from pathlib import Path
_SAFE_KEY_RE = re.compile('[^a-zA-Z0-9_-]')
_KEYED_FULL_RE = re.compile('_tts_(?P<key>.+)_full\\.mp3$', re.IGNORECASE)

def make_tts_voice_key(engine: str, voice: str, lang: str='') -> str:
    raw = f'{engine}_{voice}'[:40]
    base = _SAFE_KEY_RE.sub('_', raw).strip('_') or 'default'
    lang_part = _SAFE_KEY_RE.sub('_', str(lang or '').strip().lower()).strip('_')
    return f'{lang_part}_{base}' if lang_part else base

def extract_tts_voice_key_from_path(path: str | Path | None) -> str:
    name = Path(str(path or '')).name
    if name:
        lower = name.casefold()
        if lower.endswith('_tts_full.mp3'):
            return ''
        match = _KEYED_FULL_RE.search(name)
        return '' if match is None else str(match.group('key') or '').strip()
    return ''

def voice_audio_matches_settings(path: str | Path | None, *, engine: str, voice: str, lang: str, stored_key: str) -> bool:
    text = str(path or '').strip()
    if text:
        try:
            if Path(text).is_file():
                expected = make_tts_voice_key(engine, voice, lang)
                if expected:
                    name = Path(text).name
                    name_cf = name.casefold()
                    keyed = extract_tts_voice_key_from_path(name)
                    if keyed:
                        return keyed == expected
                    if name_cf.endswith('_tts_full.mp3') or ('_tts_' in name_cf and name_cf.endswith('_full.mp3')):
                        stored = str(stored_key or '').strip()
                        return bool(stored) and stored == expected
                return True
        except OSError:
            return False
    return False

def current_tts_voice_key_from_values(values: dict | None) -> str:
    bag = values or {}
    return make_tts_voice_key(str(bag.get('tts_engine', 'edge') or 'edge'), str(bag.get('tts_voice', '') or ''), str(bag.get('subtitle_target_language') or bag.get('tts_lock_lang') or ''))