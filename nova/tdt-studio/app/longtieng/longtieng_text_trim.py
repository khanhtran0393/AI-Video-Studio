'\nlongtieng_text_trim.py — AI-powered text shortening trước khi TTS.\n\nKhi text phụ đề quá dài so với khoảng thời gian cho phép, dùng Gemini\nrút gọn / tóm tắt text TRƯỚC khi sinh audio → audio tự nhiên vừa slot,\ngiảm atempo aggressive và tránh bị cắt giữa câu.\n\nÝ tưởng tham khảo từ VideoLingo (check_len_then_trim).\n'
from __future__ import annotations
import re
import threading
_SPEED_VI = 14.0
_SPEED_EN = 14.0
_SPEED_CJK = 3.5
_OVERHEAD = 0.3

def _count_cjk(text: str) -> int:
    return sum((1 for c in text if '一' <= c <= '鿿' or '\u3040' <= c <= 'ゟ' or '゠' <= c <= 'ヿ' or '가' <= c <= '\ud7af'))

def estimate_tts_duration(text: str) -> float:
    if text:
        text = text.strip()
        n_cjk = _count_cjk(text)
        n_other = len(text) - n_cjk
        n_spaces = text.count(' ')
        n_other = max(0, n_other - n_spaces)
        dur = 0.0
        if n_cjk > 0:
            dur += n_cjk / _SPEED_CJK
        if n_other > 0:
            dur += n_other / _SPEED_VI
        dur += _OVERHEAD
        return dur * 1.15
    return 0.0
_TRIM_PROMPT_TEMPLATE = 'Bạn là chuyên gia rút gọn phụ đề video. Câu gốc sau đây khi đọc TTS dài khoảng {est:.1f} giây, nhưng slot thời gian chỉ có {slot:.1f} giây.\n\nCâu gốc: "{text}"\n\nHãy rút gọn câu trên sao cho:\n1. Giữ nguyên ngôn ngữ gốc ({lang})\n2. Giữ đầy đủ ý chính, chỉ lược bỏ từ thừa/lặp\n3. Khi đọc TTS ước lượng không quá {target:.1f} giây\n4. Nếu câu quá dài, hãy tóm tắt ý chính\n5. CHỈ trả về câu đã rút gọn, KHÔNG giải thích\n'
_gemini_lock = threading.Lock()

def _call_gemini_trim(text: str, est_dur: float, slot_dur: float, lang: str='Tiếng Việt') -> str | None:
    import requests
    try:
        from .translator_utils import GEMINI_API_KEYS, _next_gemini_key
    except Exception:
        return None
    if GEMINI_API_KEYS:
        target_dur = slot_dur * 0.85
        prompt = _TRIM_PROMPT_TEMPLATE.format(est=est_dur, slot=slot_dur, text=text, lang=lang, target=target_dur)
        models = ['gemini-3.1-flash-lite']
        for model in models:
            key = _next_gemini_key()
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
            body = {'contents': [{'role': 'user', 'parts': [{'text': prompt}]}], 'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 512, 'responseMimeType': 'text/plain', 'thinkingConfig': {'thinkingBudget': 0}}, 'safetySettings': [{'category': 'HARM_CATEGORY_HARASSMENT', 'threshold': 'BLOCK_NONE'}, {'category': 'HARM_CATEGORY_HATE_SPEECH', 'threshold': 'BLOCK_NONE'}, {'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold': 'BLOCK_NONE'}, {'category': 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold': 'BLOCK_NONE'}]}
            try:
                resp = requests.post(url, params={'key': key}, json=body, timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
                    result = parts[0].get('text', '').strip()
                    if key and parts and result and (len(result) < len(text) * 0.95) and (len(result) > len(text) * 0.3):
                        return result
                elif resp.status_code == 429:
                    continue
                continue
            except Exception:
                continue
    else:
        return None

def trim_text_if_needed(text: str, seg_dur: float, eff_slot: float, lang: str='Tiếng Việt') -> str:
    if not text or eff_slot <= 0:
        return text
    est = estimate_tts_duration(text)
    if est <= eff_slot * 1.3:
        return text
    if len(text) < 20:
        return text
    with _gemini_lock:
        result = _call_gemini_trim(text, est, eff_slot, lang)
    return result if result else text