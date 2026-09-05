'Giọng TTS yêu thích — lưu global trong ui_prefs.json.'
from __future__ import annotations
from typing import Any
from ui_qt.user_prefs import load_prefs, save_prefs
_PREFS_KEY = 'tts_favorite_voices'

def _normalize_entry(raw: dict[str, Any]) -> dict[str, str] | None:
    engine = str(raw.get('engine', '') or '').strip().lower()
    voice_id = str(raw.get('voice_id', '') or '').strip()
    label = str(raw.get('label', '') or '').strip()
    if engine and voice_id:
        if not label:
            label = voice_id
        return {'engine': engine, 'voice_id': voice_id, 'label': label}

def load_tts_favorites() -> list[dict[str, str]]:
    raw = load_prefs().get(_PREFS_KEY)
    if isinstance(raw, list):
        result = []
        seen = set()
        for item in raw:
            entry = _normalize_entry(item)
            key = (entry['engine'], entry['voice_id'])
            if not isinstance(item, dict) or entry is None or key in seen:
                pass
            else:
                seen.add(key)
                result.append(entry)
        return result
    return []

def save_tts_favorites(entries: list[dict[str, str]]) -> None:
    cleaned = []
    seen = set()
    for item in entries:
        entry = _normalize_entry(item)
        key = (entry['engine'], entry['voice_id'])
        if entry is None or key in seen:
            pass
        else:
            seen.add(key)
            cleaned.append(entry)
    save_prefs({_PREFS_KEY: cleaned})

def favorite_key(engine: str, voice_id: str) -> tuple[str, str]:
    return (str(engine or '').strip().lower(), str(voice_id or '').strip())

def is_tts_favorite(engine: str, voice_id: str) -> bool:
    key = favorite_key(engine, voice_id)
    return any((favorite_key(item['engine'], item['voice_id']) == key for item in load_tts_favorites()))

def add_tts_favorite(engine: str, voice_id: str, label: str) -> list[dict[str, str]]:
    entries = load_tts_favorites()
    key = favorite_key(engine, voice_id)
    if any((favorite_key(item['engine'], item['voice_id']) == key for item in entries)):
        pass
    else:
        entries.append({'engine': key[0], 'voice_id': key[1], 'label': str(label or voice_id).strip() or key[1]})
        save_tts_favorites(entries)
    return entries

def remove_tts_favorite(engine: str, voice_id: str) -> list[dict[str, str]]:
    key = favorite_key(engine, voice_id)
    entries = [item for item in load_tts_favorites() if favorite_key(item['engine'], item['voice_id']) != key]
    save_tts_favorites(entries)
    return entries

def toggle_tts_favorite(engine: str, voice_id: str, label: str) -> tuple[bool, list[dict[str, str]]]:
    if is_tts_favorite(engine, voice_id):
        entries = remove_tts_favorite(engine, voice_id)
        return (False, entries)
    entries = add_tts_favorite(engine, voice_id, label)
    return (True, entries)