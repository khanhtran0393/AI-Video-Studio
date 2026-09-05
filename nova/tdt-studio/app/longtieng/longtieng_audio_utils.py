'\nlongtieng_audio_utils.py — Audio helper functions (text cleaning, duration,\npitch shift, tempo adjust, silence removal).\nTách từ longtieng_engine.py để giảm kích thước file.\n'
from __future__ import annotations
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable
import config as _cfg
from .longtieng_voices import EDGE_VOICES

def _clean_text_for_tts(text: str) -> str:
    if text:
        import re as _re
        text = _re.sub('\\[MEMORY\\].*', '', text).strip()
        if text:
            text = _re.sub('[\\u200b\\u200c\\u200d\\uFEFF\\xad]', '', text)
            text = _re.sub('[\\(\\[]\\s*(?:nhạc|tiếng|âm nhạc|âm thanh|music|instrumental|applause|laughter|sound|singing|hát|cười|vỗ tay|im lặng|silence|không lời|♪|♫|🎵|🎶)[^)\\]]*[\\)\\]]', '', text, flags=_re.IGNORECASE)
            text = _re.sub('[\\[\\]\\(\\)]', '', text)
            text = text.replace('\n', ' ').replace('\t', ' ')
            text = _re.sub('\\s+', ' ', text).strip()
            text = _re.sub('\\bbố\\b(?!\\s*(?:trí|cục|thí|láo))', 'ba', text)
            text = text.lower()
            dict_ngong = {'fbi': 'ép bi ai', 'cia': 'xi ai ây', 'nasa': 'na xa', 'un': 'u en', 'eu': 'i u', 'nato': 'na tô', 'imf': 'ai ém ép', 'wto': 'đấp liu ti ô', 'asean': 'a xi an', 'apec': 'ay péc', 'opec': 'ô péc', 'unesco': 'u nét cô', 'unicef': 'u ni xép', 'gpt': 'gi pi ti', 'cpu': 'xi pi u', 'gpu': 'gi pi u', 'ram': 'ram', **{'ssd': 'ét ét đi', 'hdd': 'ếch đi đi', 'usb': 'u ét bi', 'wifi': 'wai fai', 'ip': 'ai pi', 'vpn': 'vi pi en', 'api': 'ây pi ai', 'url': 'u ạc eo', 'html': 'ếch ti ém eo', 'css': 'xi ét ét', 'pdf': 'pi đi ép', 'ios': 'ai ô ét', 'android': 'an đroi', 'iphone': 'ai phôn', 'ipad': 'ai pét', 'macbook': 'méc búc', 'laptop': 'láp tóp'}, **{'app': 'ép', 'software': 'sóp qué', 'hardware': 'hát qué', 'server': 'sơ vơ', 'cloud': 'cào', 'update': 'áp đết', 'download': 'đao lốt', 'upload': 'áp lốt', 'online': 'on lai', 'offline': 'óp lai', 'login': 'lóc gin', 'password': 'pát guốt', 'account': 'ơ cào', 'email': 'i meo', 'facebook': 'phây búc', 'youtube': 'du túp', 'tiktok': 'tích tóc'}, **{'instagram': 'in xta gram', 'twitter': 'tuýt tơ', 'telegram': 'tê lê gram', 'zalo': 'za lô', 'google': 'gú gồ', 'ok': 'ô kê', 'okay': 'ô kê', 'hello': 'hê lô', 'hi': 'hai', 'bye': 'bai', 'sorry': 'so ri', 'thank': 'thenk', 'thanks': 'thenks', 'yes': 'dét', 'no': 'nô', 'boss': 'bót', 'game': 'ghêm'}, **{'gamer': 'ghêm mơ', 'team': 'tim', 'fan': 'phen', 'idol': 'ai đồ', 'hot': 'hót', 'cool': 'cu', 'nice': 'nai', 'like': 'lai', 'share': 'se', 'live': 'lai', 'stream': 'xì trim', 'trend': 'tren', 'viral': 'vai rồ', 'vip': 'vi ai pi', 'pro': 'prô', 'baby': 'bê bi', 'love': 'lớp'}, **{'happy': 'hép pi', 'crazy': 'crây zi', 'stress': 'xì trét', 'shock': 'sóc', 'drama': 'đra ma', 'toxic': 'tóc xíc', 'video': 'vi đi ô', 'audio': 'ô đi ô', 'music': 'miu dích', 'movie': 'mu vi', 'food': 'phút', 'hotel': 'hô teo', 'taxi': 'tắc xi', 'bus': 'bớt', 'shop': 'sóp', 'sale': 'xeo', 'free': 'phri'}, **{'check': 'trẹc', 'feedback': 'phít béc', 'review': 'ri viu', 'comment': 'com men', 'post': 'pốt', 'story': 'xì to ri', 'clip': 'kíp', 'filter': 'phin tơ', 'effect': 'ê phéc', 'edit': 'ê đít', 'style': 'xtai', 'design': 'đi zai', 'logo': 'lô gô', 'brand': 'bren', 'marketing': 'ma két ting', 'startup': 'xì tạt áp', 'ceo': 'xi i ô'}, **{'manager': 'ma na giơ', 'usd': 'u ét đi', 'vnd': 'vi en đi', 'eur': 'ơ rô', 'bitcoin': 'bít coi', 'crypto': 'críp tô', 'dollar': 'đô la', 'football': 'phút bo', 'goal': 'gôn', 'penalty': 'pê nan ti', 'champion': 'trem pi ần', 'league': 'líc', 'coach': 'cô trì', 'match': 'mét', 'covid': 'cô vít', 'vaccine': 'véc xin', 'virus': 'vi rút'}, **{'test': 'tét', 'dna': 'đi en ây', 'protein': 'prô tê in'}}
            for sai, dung in dict_ngong.items():
                text = _re.sub('\\b' + _re.escape(sai) + '\\b', dung, text)
            return ('' if len(text.strip()) < 2 else text) if _re.search('[\\w]', text, _re.UNICODE) else ''
    return ''

def get_audio_duration(path: str) -> float:
    try:
        cmd = [_cfg.FFPROBE_PATH, '-v', 'quiet', '-print_format', 'json', '-show_format', path]
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        r = subprocess.run(cmd, capture_output=True, timeout=15, creationflags=flags)
        raw = r.stdout or b''
        text = raw.decode('utf-8', errors='replace')
        data = json.loads(text)
    except Exception:
        return 0.0

def _probe_audio_duration_with_retry(path: str, retries: int=5, delay: float=0.2) -> float:
    if path and os.path.exists(path):
        last_dur = 0.0
        for attempt in range(max(1, retries)):
            last_dur = get_audio_duration(path)
            if last_dur > 0:
                return last_dur
            if attempt + 1 < retries:
                time.sleep(delay)
        return last_dur
    return 0.0

def speed_to_rate(speed: float) -> str:
    pct = int((speed - 1.0) * 100)
    sign = '+' if pct >= 0 else ''
    return f'{sign}{pct}%'

def pitch_to_str(hz: int) -> str:
    sign = '+' if hz >= 0 else ''
    return f'{sign}{hz}Hz'

def _trim_audio(audio_path: str, max_dur: float):
    if max_dur <= 0:
        pass
    else:
        fade = min(0.15, max_dur * 0.06)
        tmp = audio_path + '.trim.mp3'
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)
        try:
            subprocess.run([_cfg.FFMPEG_PATH, '-i', audio_path, '-af', f'afade=t=out:st={max(0, max_dur - fade):.3f}:d={fade:.3f}', '-t', f'{max_dur:.3f}', tmp], capture_output=True, timeout=30, creationflags=flags)
            if os.path.exists(tmp):
                if os.path.getsize(tmp) > 0:
                    os.replace(tmp, audio_path)
                else:
                    return None
            else:
                return None
        except Exception:
            try:
                os.remove(tmp)
            except Exception:
                pass
            return None

def _apply_pitch_shift(audio_path: str, semitones: float):
    if abs(semitones) < 0.1:
        pass
    else:
        pitch_ratio = 2.0 ** (semitones / 12.0)
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)
        tmp = audio_path + '.pitch.mp3'
        af = f'rubberband=pitch={pitch_ratio:.6f}:formant=preserved:pitchq=quality:transients=mixed'
        try:
            subprocess.run([_cfg.FFMPEG_PATH, '-y', '-i', audio_path, '-af', af, '-b:a', '192k', tmp], capture_output=True, timeout=60, creationflags=flags)
            if os.path.exists(tmp) and os.path.getsize(tmp) > 100:
                os.replace(tmp, audio_path)
            else:
                try:
                    probe_result = subprocess.run([_cfg.FFPROBE_PATH, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', audio_path], capture_output=True, text=True, timeout=10, creationflags=flags)
                    sr = int(probe_result.stdout.strip())
                except Exception:
                    sr = 24000
                new_sr = int(sr * pitch_ratio)
                tempo_comp = 1.0 / pitch_ratio
                tempo_filters = []
                r = tempo_comp
                while r > 2.0:
                    tempo_filters.append('atempo=2.0')
                    r /= 2.0
                while r < 0.5:
                    tempo_filters.append('atempo=0.5')
                    r *= 2.0
                if abs(r - 1.0) > 0.01:
                    tempo_filters.append(f'atempo={r:.4f}')
                af_fb = f'asetrate={new_sr},aresample={sr},' + ','.join(tempo_filters)
                try:
                    subprocess.run([_cfg.FFMPEG_PATH, '-y', '-i', audio_path, '-af', af_fb, '-b:a', '192k', tmp], capture_output=True, timeout=60, creationflags=flags)
                    if os.path.exists(tmp):
                        if os.path.getsize(tmp) > 100:
                            os.replace(tmp, audio_path)
                        else:
                            return None
                    else:
                        return None
                except Exception:
                    try:
                        os.remove(tmp)
                    except Exception:
                        pass
                    return None
                return None
        except Exception:
            pass

def _atempo_adjust(audio_path: str, current_dur: float, target_dur: float):
    if current_dur <= 0 or target_dur <= 0:
        pass
    else:
        ratio = current_dur / target_dur
        if ratio > 100.0:
            pass
        else:
            tmp = audio_path + '.tmp.mp3'
            filters = []
            r = ratio
            while r > 2.0:
                filters.append('atempo=2.0')
                r /= 2.0
            while r < 0.5:
                filters.append('atempo=0.5')
                r *= 2.0
            if abs(r - 1.0) > 0.01:
                filters.append(f'atempo={r:.4f}')
            filter_str = ','.join(filters)
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)
            try:
                subprocess.run([_cfg.FFMPEG_PATH, '-y', '-i', audio_path, '-filter:a', filter_str, tmp], capture_output=True, timeout=30, creationflags=flags)
                if os.path.exists(tmp):
                    os.replace(tmp, audio_path)
                else:
                    return None
            except Exception:
                try:
                    os.remove(tmp)
                except Exception:
                    pass
                return None
VOICE_OVERFLOW_WARN_SEC = 0.25

def cascade_voice_segment_starts(voice_results: list[dict], *, min_gap_sec: float, limit_end_sec: float | None) -> list[dict]:
    _ = limit_end_sec
    if len(voice_results) < 2:
        return voice_results
    rs = sorted(voice_results, key=lambda r: float(r.get('start', 0)))
    cursor = 0.0
    gap = max(0.0, float(min_gap_sec))
    for r in rs:
        start = float(r.get('start', 0) or 0)
        if start < cursor:
            start = cursor
        dur = max(0.0, float(r.get('duration', 0) or 0))
        r['start'] = start
        r['end'] = start + dur
        r['duration'] = dur
        cursor = start + dur + gap
    return rs

def voice_track_overflow_sec(voice_results: list[dict], *, limit_end_sec: float) -> float:
    limit = float(limit_end_sec or 0)
    if limit > 0 and voice_results:
        last_end = max((float(row.get('start', 0) or 0) + float(row.get('duration', 0) or 0) for row in voice_results))
        return max(0.0, last_end - limit)
    return 0.0

def format_voice_overflow_warning(overflow_sec: float) -> str:
    shown = '.1f'.replace('.', ',')
    return f'Lời đọc dài hơn hình {shown} s. Rút bớt kịch bản ~{shown} s, hoặc thêm cảnh. Hiện app tự nén để giữ câu kết — preview sẽ lệch dần tới ~{shown} s ở cuối.'

def tts_overflow_sidecar_path(voice_path: str) -> str:
    return str(Path(str(voice_path)).with_suffix('.tts_overflow.json'))

def save_tts_overflow_sidecar(voice_path: str, overflow_sec: float, video_dur_sec: float) -> str:
    dest = tts_overflow_sidecar_path(voice_path)
    payload = {'overflow_sec': float(overflow_sec), 'video_dur_sec': float(video_dur_sec)}
    Path(dest).write_text(json.dumps(payload), encoding='utf-8')
    return dest

def read_tts_overflow_sidecar(voice_path: str) -> float:
    dest = Path(tts_overflow_sidecar_path(voice_path))
    if dest.is_file():
        try:
            data = json.loads(dest.read_text(encoding='utf-8'))
        except (OSError, ValueError, TypeError):
            return 0.0
        try:
            pass
        except (TypeError, ValueError):
            return 0.0
    else:
        return 0.0

def fit_last_voice_segment_to_limit(voice_results: list[dict], *, limit_end_sec: float, max_speed: float) -> list[dict]:
    if voice_results:
        limit = float(limit_end_sec or 0)
        if limit <= 0:
            return voice_results
        rs = sorted(voice_results, key=lambda r: float(r.get('start', 0)))
        last = rs[-1]
        start = float(last.get('start', 0) or 0)
        dur = max(0.0, float(last.get('duration', 0) or 0))
        remaining = limit - start
        if remaining <= 0 or dur <= remaining + 1e-09:
            pass
        else:
            cap = max(1.0, min(2.5, float(max_speed or 1.2)))
            need = dur / remaining if remaining > 0 else cap
            speed = min(cap, max(1.0, need))
            target = dur / speed if speed > 1.001 else dur
            if target < dur - 0.01:
                audio_path = str(last.get('audio_path', '') or '')
                if audio_path and os.path.isfile(audio_path):
                    _atempo_adjust(audio_path, dur, target)
                last['duration'] = target
                last['end'] = start + target
        return rs
    return voice_results

def enforce_non_overlapping_voice_segments(voice_results: list[dict], *, min_gap_sec: float, max_speed: float, smooth: bool, hard_enforce: bool) -> list[dict]:
    if len(voice_results) < 2:
        return voice_results
    rs = sorted(voice_results, key=lambda r: float(r.get('start', 0)))
    n = len(rs)
    slots = []
    durs = []
    for j in range(n):
        start = float(rs[j].get('start', 0))
        cur = float(rs[j].get('duration', 0))
        durs.append(cur)
        if j + 1 < n:
            slot = float(rs[j + 1].get('start', 0)) - start - min_gap_sec
        else:
            slot = float(rs[j].get('end', 0)) - start
            if slot <= 0:
                slot = cur
        slots.append(max(0.08, slot) if slot > 0 else cur)
    need = []
    for j in range(n):
        slot = slots[j]
        need.append(durs[j] / slot if slot > 0 else 1.0)
    cap = max(1.0, min(2.5, float(max_speed or 1.25)))
    if hard_enforce:
        speeds = [min(cap, max(1.0, x)) for x in need]
    else:
        speeds = [min(cap, max(1.0, x)) for x in need]
    if smooth and n >= 3:
        for _ in range(2):
            nxt = speeds[:]
            for j in range(1, n - 1):
                if need[j] <= 1.02 and need[j - 1] <= 1.02 and (need[j + 1] <= 1.02):
                    pass
                else:
                    avg = (speeds[j - 1] + speeds[j] + speeds[j + 1]) / 3.0
                    blended = 0.55 * speeds[j] + 0.45 * avg
                    floor = min(cap, need[j]) if need[j] > 1.0 else 1.0
                    nxt[j] = max(1.0, min(cap, max(floor * 0.92, blended)))
            speeds = nxt
    for j in range(n):
        cur = durs[j]
        speed = speeds[j]
        target = cur / speed if speed > 1.001 else cur
        if hard_enforce and target > slots[j] + 0.01:
            target = slots[j]
        if target < cur - 0.01:
            ap = str(rs[j].get('audio_path', '') or '')
            if ap and os.path.isfile(ap):
                _atempo_adjust(ap, cur, target)
            rs[j]['duration'] = target
            rs[j]['end'] = float(rs[j].get('start', 0)) + target
            durs[j] = target
        else:
            rs[j]['end'] = float(rs[j].get('start', 0)) + float(rs[j].get('duration', 0))
    return rs
    while True:
        pass
    speeds, x = (None, None)

def _remove_silence(audio_path: str):
    if os.path.exists(audio_path):
        tmp = audio_path + '.silence.wav'
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)
        try:
            subprocess.run([_cfg.FFMPEG_PATH, '-y', '-i', audio_path, '-af', 'silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.05', tmp], capture_output=True, timeout=30, creationflags=flags)
            if os.path.exists(tmp):
                if os.path.getsize(tmp) > 0:
                    os.replace(tmp, audio_path)
                else:
                    return None
            else:
                return None
        except Exception:
            pass

def _is_edge_neural_voice(voice: str) -> bool:
    text = str(voice or '').strip()
    if not text or 'Neural' not in text:
        return False
    parts = text.split('-')
    return len(parts) >= 3 and len(parts[0]) == 2
_EDGE_VOICE_ALIASES: 'dict[str, str]' = {'jessie': 'en-US-JennyNeural', 'jessie (en)': 'en-US-JennyNeural', 'en_us_002': 'en-US-JennyNeural', 'bv:en_us_002': 'en-US-JennyNeural', 'bv:bv075_streaming': 'vi-VN-NamMinhNeural', 'bv:bv074_streaming': 'vi-VN-HoaiMyNeural', 'bv:vi_female_huong': 'vi-VN-HoaiMyNeural', 'bv:bv560_streaming': 'vi-VN-NamMinhNeural', 'bv:bv562_streaming': 'vi-VN-HoaiMyNeural', 'bv:bv421_vivn_streaming': 'vi-VN-HoaiMyNeural', 'energetic female': 'en-US-AriaNeural', 'energetic female (en)': 'en-US-AriaNeural', 'female vloger': 'en-US-AriaNeural', 'excited female': 'en-US-JennyNeural', 'charming female': 'en-US-AriaNeural', 'hoài my': 'vi-VN-HoaiMyNeural', 'hoai my': 'vi-VN-HoaiMyNeural', **{'nam minh': 'vi-VN-NamMinhNeural', 'jenny': 'en-US-JennyNeural', 'aria': 'en-US-AriaNeural', 'guy': 'en-US-GuyNeural'}}
_CAPCUT_VOICE_ALIASES: 'dict[str, str]' = {'vi-vn-namminhneural': 'bv:BV075_streaming', 'vi-vn-hoaimyneural': 'bv:vi_female_huong', 'nam minh': 'bv:BV075_streaming', 'hoài my': 'bv:vi_female_huong', 'hoai my': 'bv:vi_female_huong', 'en-us-jennyneural': 'bv:en_us_002', 'en-us-arianeural': 'bv:en_female_makeup', 'en-us-guyneural': 'bv:en_male_narration_moon_bigtts', 'jessie': 'bv:en_us_002', 'jessie (en)': 'bv:en_us_002'}
_DEFAULT_CAPCUT_VOICE = 'bv:BV075_streaming'

def _is_capcut_voice_id(voice: str) -> bool:
    text = str(voice or '').strip()
    return text.startswith(('bv:', 'icl:', 'vn:'))

def _coerce_capcut_voice_id(voice: str) -> str:
    raw = str(voice or '').strip()
    if not raw:
        pass
    else:
        if _is_capcut_voice_id(raw):
            return raw
        mapped = _CAPCUT_VOICE_ALIASES.get(raw.casefold())
        if mapped:
            return mapped
        lang = raw.split('-', 1)[0].lower()
        if lang == 'vi':
            lower = raw.casefold()
            return 'bv:vi_female_huong' if any((kw in lower for kw in ('nữ', 'nu', 'female', 'woman', 'girl'))) else 'bv:BV075_streaming'
        if _is_edge_neural_voice(raw) and lang == 'en':
            lower = raw.casefold()
            return 'bv:en_male_narration_moon_bigtts' if any((kw in lower for kw in ('nam', 'male', 'man', 'narration', 'moon'))) else 'bv:en_us_002'
    return _DEFAULT_CAPCUT_VOICE

def _coerce_edge_voice_id(voice: str, *, prefer_lang: str) -> str:
    raw = str(voice or '').strip()
    if _is_edge_neural_voice(raw):
        return raw
    key = raw.casefold()
    mapped = _EDGE_VOICE_ALIASES.get(key)
    if mapped:
        return mapped
    lang = (prefer_lang or '').strip().lower()[:2]
    if not lang:
        lower = key
        if lower.startswith('bv:') or 'en_' in lower or '(en)' in lower:
            lang = 'en'
        elif 'vi' in lower or 'vn' in lower:
            lang = 'vi'
        else:
            lang = 'en'
    voices = EDGE_VOICES.get(lang) or EDGE_VOICES.get('en') or []
    return voices[0][0] if voices else 'en-US-AriaNeural'

def _auto_fix_edge_voice(voice: str, segments: list[dict]) -> str:
    voice = _coerce_edge_voice_id(voice)
    cur_lang = voice.split('-')[0].lower() if voice else 'vi'
    texts = [s.get('translated') or s.get('text', '') for s in segments[:30]]
    cjk = ko = ja = th = cyrillic = devanagari = arabic = ascii_alpha = latin_ext = 0
    _VN_CHARS = set('ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ')
    vn_specific = 0
    for t in texts:
        for ch in t:
            cp = ord(ch)
            if 19968 <= cp <= 40959 or 13312 <= cp <= 19903:
                cjk += 1
            elif 44032 <= cp <= 55215 or 4352 <= cp <= 4607:
                ko += 1
            elif 12352 <= cp <= 12447 or 12448 <= cp <= 12543:
                ja += 1
            elif 3584 <= cp <= 3711:
                th += 1
            elif 1024 <= cp <= 1279:
                cyrillic += 1
            elif 2304 <= cp <= 2431:
                devanagari += 1
            elif 1536 <= cp <= 1791 or 1872 <= cp <= 1919 or 2208 <= cp <= 2303 or (64336 <= cp <= 65023) or (65136 <= cp <= 65279):
                arabic += 1
            elif cp < 128:
                ascii_alpha += 1
            else:
                latin_ext += 1
                if ch.isalpha() and ch in _VN_CHARS:
                    vn_specific += 1
    latin = ascii_alpha + latin_ext
    total = cjk + ko + ja + th + cyrillic + devanagari + arabic + latin
    if total < 10:
        if cjk >= 2:
            det_lang = 'zh'
            if det_lang == cur_lang:
                pass
            else:
                voices = EDGE_VOICES.get(det_lang)
                if voices:
                    new_voice = voices[0][0]
                    try:
                        print(f"⚠️ Voice '{voice}' không khớp ngôn ngữ text ({det_lang}) → chuyển sang '{new_voice}'")
                    except UnicodeEncodeError:
                        print(f"[voice] '{voice}' lang mismatch ({det_lang}) -> '{new_voice}'")
                        return new_voice
                    return new_voice
            return voice
        if ko >= 2:
            det_lang = 'ko'
        elif ja >= 2:
            det_lang = 'ja'
        elif th >= 2:
            det_lang = 'th'
        elif arabic >= 2:
            det_lang = 'ar'
        else:
            return voice
    else:
        det_lang = cur_lang
        if ko / total > 0.3:
            det_lang = 'ko'
            if det_lang == cur_lang:
                pass
            else:
                voices = EDGE_VOICES.get(det_lang)
                if voices:
                    new_voice = voices[0][0]
                    try:
                        print(f"⚠️ Voice '{voice}' không khớp ngôn ngữ text ({det_lang}) → chuyển sang '{new_voice}'")
                    except UnicodeEncodeError:
                        print(f"[voice] '{voice}' lang mismatch ({det_lang}) -> '{new_voice}'")
                        return new_voice
                    return new_voice
            return voice
        if ja / total > 0.3:
            det_lang = 'ja'
        elif cjk / total > 0.3:
            det_lang = 'zh'
        elif th / total > 0.3:
            det_lang = 'th'
        elif cyrillic / total > 0.3:
            det_lang = 'ru'
        elif devanagari / total > 0.3:
            det_lang = 'hi'
        elif arabic / total > 0.3:
            det_lang = 'ar'
        elif latin / total > 0.5:
            if cur_lang not in ('vi', 'en'):
                return voice
            if latin > 0 and vn_specific / latin >= 0.02:
                det_lang = 'vi'
            else:
                det_lang = 'en'
        else:
            return voice