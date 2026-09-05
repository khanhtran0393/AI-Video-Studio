'\ntranslator_render.py — Translation & final rendering pipeline steps.\nTách từ longtieng_translator.py để giảm kích thước file.\n'
from __future__ import annotations
import io
import math
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Callable
import config as _cfg
from .translator_utils import _WORK_DIR, _log, _run_ffmpeg, _probe_duration, _probe_video_bitrate, _seconds_to_srt_time, _srt_time_to_seconds, _safe_remove, _escape_ffmpeg_path, _load_gemini_keys_from_config, _next_gemini_key, GEMINI_API_KEYS, _parse_srt
_FILLER_WORDS = frozenset(('ừm', 'ừ', 'hừ', 'hm', 'hmm', 'hmmm', 'um', 'umm', 'uh', 'uhh', 'ah', 'ahh', 'oh', 'ohh', 'eh', 'erm', 'er', 'mhm', 'mmm', 'mm', 'ờ', 'ơ', '嗯', '嗯嗯', '唔', '呃', '哦', '哼', '啊', '嘛', '呵'))

def _strip_filler_srt(srt_text: str) -> str:
    blocks = re.split('\\n\\s*\\n', srt_text.strip())
    kept = []
    for block in blocks:
        lines = block.strip().split('\n')
        text = ' '.join(lines[2:]).strip()
        cleaned = re.sub('[.,!?\\-…\\s\\u3000-\\u303f\\uff00-\\uff65]', '', text.lower())
        if len(lines) < 3 or cleaned in _FILLER_WORDS:
            pass
        else:
            kept.append(block)
    out = []
    for i, block in enumerate(kept, 1):
        lines = block.strip().split('\n')
        lines[0] = str(i)
        out.append('\n'.join(lines))
    return '\n\n'.join(out) + '\n'

def _calc_midpoints(srt_entries: list[dict]) -> list[float]:
    return [(e['start_sec'] + e['end_sec']) / 2.0 for e in srt_entries]

def _extract_keyframes(video_path: str, timestamps: list[float], chunk_idx: int, log_cb: Callable[[str], None] | None=None) -> list[str]:
    frame_dir = _WORK_DIR / f'frames_{chunk_idx:03d}'
    frame_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    vid_dur = _probe_duration(video_path)
    for i, ts in enumerate(timestamps):
        if vid_dur > 0 and ts > vid_dur:
            log_cb(f'   ⚠️ Bỏ qua frame tại {ts:.2f}s (vượt thời lượng {vid_dur:.1f}s)')
            continue
        out_path = frame_dir / f'frame_{i:02d}.jpg'
        try:
            _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-ss', f'{ts:.3f}', '-noaccurate_seek', '-i', video_path, '-frames:v', '1', '-q:v', '2', out_path])
            if os.path.isfile(out_path) and os.path.getsize(out_path) > 0:
                paths.append(out_path)
                continue
            try:
                _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-ss', f'{ts + 0.5:.3f}', '-noaccurate_seek', '-i', video_path, '-frames:v', '1', '-q:v', '2', out_path])
                if os.path.isfile(out_path) and os.path.getsize(out_path) > 0:
                    paths.append(out_path)
            except Exception as e:
                log_cb(f'   ⚠️ Bỏ qua frame {ts:.2f}s (video lỗi GOP)')
        except Exception:
            pass
    return paths

def _make_grid_image(image_paths: list[str], output_path: str, cols: int=3):
    from PIL import Image
    _RESAMPLE = getattr(Image, 'LANCZOS', getattr(Image, 'ANTIALIAS', Image.BICUBIC))
    images = [Image.open(p) for p in image_paths]
    if images:
        n = len(images)
        rows = math.ceil(n / cols)
        actual_cols = min(n, cols)
        w, h = (images[0].size[0], images[0].size[1])
        if w > 640:
            ratio = 640 / w
            h, w = (int(h * ratio), 640)
            images = [img.resize((w, h), _RESAMPLE) for img in images]
        grid_w = actual_cols * w
        grid_h = rows * h
        grid = Image.new('RGB', (grid_w, grid_h), (0, 0, 0))
        for i, img in enumerate(images):
            r, c = divmod(i, actual_cols)
            grid.paste(img.resize((w, h), _RESAMPLE), (c * w, r * h))
        grid.save(output_path, 'JPEG', quality=85)
    else:
        return None

def _openrouter_relay_translate(system_prompt: str, user_content: str, log_cb=None, stop_flag=None, grid_path: str | None=None) -> str | None:
    try:
        import requests, base64, os
        from config import API_RELAY_URL
        from ._relay_auth import relay_auth_headers
    except Exception:
        return None
    if API_RELAY_URL:
        headers = {'Content-Type': 'application/json'}
        try:
            headers.update(relay_auth_headers())
        except Exception:
            return None
        if headers.get('X-VTP-Key'):
            try:
                kr = requests.post(f"{API_RELAY_URL.rstrip('/')}/openrouter/key", json={}, headers=headers, timeout=30)
                if kr.status_code != 200:
                    return None
                runtime = (kr.json() or {}).get('key')
            except Exception:
                return None
            if runtime:
                uc = user_content
                try:
                    if grid_path and os.path.isfile(grid_path):
                        with open(grid_path, 'rb') as gf:
                            _raw = gf.read()
                        enc = base64.b64encode(_raw).decode()
                        _mime = 'image/png' if _raw[:8].startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg'
                        uc = [{'type': 'text', 'text': user_content}, {'type': 'image_url', 'image_url': {'url': f'data:{_mime};base64,' + enc}}]
                except Exception:
                    uc = user_content
                body = {'model': 'google/gemini-3.1-flash-lite', 'messages': [{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': uc}], 'temperature': 0.1, 'max_tokens': min(32768, max(8192, len(user_content)))}
                for _att in range(2):
                    if stop_flag and stop_flag.is_set():
                        return None
                    try:
                        r = requests.post('https://openrouter.ai/api/v1/chat/completions', json=body, headers={'Authorization': 'Bearer ' + runtime, 'Content-Type': 'application/json'}, timeout=110)
                    except Exception:
                        return None
                    if r.status_code == 200:
                        try:
                            pass
                        except Exception:
                            pass
                    elif 400 <= r.status_code < 500:
                        return None

def _describe_grids(grid_paths, log_cb=None, stop_flag=None, max_grids=8, srt_texts=None, prompt_hint=''):
    if os.environ.get('VTP_NO_EYES') == '1':
        if log_cb:
            log_cb('⚠️ Mắt xưng hô tạm nghỉ, thử lại sau.')
    else:
        if isinstance(grid_paths, str):
            grid_paths = [grid_paths]
        grid_paths = [p for p in grid_paths or [] if p and os.path.isfile(p)][:max_grids]
        if grid_paths:
            try:
                import requests as _rq
                import base64 as _b64
                from config import API_RELAY_URL
                from ._relay_auth import relay_auth_headers
            except Exception:
                return None
            if API_RELAY_URL:
                headers = {'Content-Type': 'application/json'}
                try:
                    headers.update(relay_auth_headers())
                except Exception:
                    return None
                if headers.get('X-VTP-Key'):
                    try:
                        kr = _rq.post(f"{API_RELAY_URL.rstrip('/')}/gemini/eyes-pool", json={}, headers=headers, timeout=30)
                        if kr.status_code != 200:
                            if kr.status_code == 429 and log_cb:
                                log_cb('⚠️ Mắt xưng hô tạm nghỉ, thử lại sau.')
                        else:
                            _pool = [k for k in (kr.json() or {}).get('keys') or [] if k]
                            if _pool:
                                _parts = []
                                _n = len(grid_paths)
                                _dlg = ''
                                _lines = [str(t).replace('\n', ' ').strip() for t in srt_texts or [] if str(t).strip()]
                                if _lines:
                                    _joined = '\n'.join((f'{i + 1}. {t}' for i, t in enumerate))
                                    _dlg = "\nThe SUBTITLE LINES of this segment (in order) are below. Use them TOGETHER with the images: read the dialogue to work out each person's ROLE and who talks to whom, and use the images to fix each person's GENDER. This lets you resolve who 'your son / your wife / your husband / your family' refers to.\n[DIALOGUE]\n" + _joined + '\n'
                                _hint = ''
                                if prompt_hint and str(prompt_hint).strip():
                                    _hint = f'''\nThe user labelled this video's category as: "{str(prompt_hint).strip()}". If this NAMES a genre/setting, use it as a SOFT hint for SETTING; if it is generic (e.g. 'AI auto/smart', 'Custom', 'Translate'), IGNORE the label and judge purely from the images. The IMAGES are the primary evidence.\n'''
                                _prompt = f"""You are analyzing {_n} keyframe grid(s) from ONE video segment (chronological order; may contain MULTIPLE scenes) to help a subtitle translator pick correct pronouns/forms of address for ANY target language.\nFor EACH main character determine GENDER (Male/Female) AND APPROXIMATE AGE (child / teen / ~20s / ~30s / ~40s / middle-aged / elderly) by looking CAREFULLY at face, skin, hairstyle, body, makeup and clothing — NEVER from job/title (a doctor, boss, CEO, master... can be FEMALE). Read any on-screen name/role caption.\n{_dlg}{_hint}Reply CONCISE in this structure (context ONLY — do NOT translate, do NOT describe every frame):\nSETTING: the video's genre/era judged MAINLY from costumes & scenery — e.g. HISTORICAL (ancient/period costume drama), WUXIA-XIANXIA (martial-arts / immortal cultivation), MODERN (present-day), or OTHER — name it briefly (nature/animal documentary, survival, gameplay, review/recap, news, kids...). This decides the ADDRESS STYLE: HISTORICAL/WUXIA use archaic forms; everything else uses everyday forms.\nCHARACTERS (one line each):\n- <name or role> — <Male/Female> — <approx age, e.g. 'woman ~25', 'man ~40'> — <role>\nRELATIONSHIP: how they relate (married / family / lovers / senior-subordinate / friends / strangers arguing) and who addresses whom. IMPORTANT: for the main interacting pair(s), say WHO IS OLDER / YOUNGER (or same age) — this decides the form of address (a younger listener → intimate forms; an older one → respectful).\nTIMELINE: if characters ENTER or LEAVE across the segment, say WHO is present in the EARLY vs LATE part (e.g. 'the husband only appears at the end').\nKEY REFERENCES: for lines that mention 'your son / your family / your wife / your husband', state WHICH character (by gender) is being addressed — e.g. "'your son' is said TO the mother (Female)". GENDER accuracy is the TOP priority."""
                                _parts.append({'text': _prompt})
                                for _p in grid_paths:
                                    try:
                                        with open(_p, 'rb') as gf:
                                            _raw = gf.read()
                                        _mime = 'image/png' if _raw[:8].startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg'
                                        _parts.append({'inline_data': {'mime_type': _mime, 'data': _b64.b64encode(_raw).decode()}})
                                        continue
                                    except Exception:
                                        continue
                                if len(_parts) < 2:
                                    pass
                                else:
                                    body = {'contents': [{'parts': _parts}], 'generationConfig': {'maxOutputTokens': 900, 'temperature': 0.15}}
                                    _api = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'
                                    for _key in _pool:
                                        if stop_flag and stop_flag.is_set():
                                            return None
                                        try:
                                            r = _rq.post(f'{_api}?key={_key}', json=body, headers={'Content-Type': 'application/json'}, timeout=90)
                                            if r.status_code == 200:
                                                try:
                                                    _desc = (r.json()['candidates'][0]['content']['parts'][0]['text'] or '').strip() or None
                                                except Exception:
                                                    _desc = None
                                                if _desc:
                                                    try:
                                                        _dbg = os.path.join(os.path.dirname(grid_paths[0]), '_eyes_debug.txt')
                                                        with open(_dbg, 'w', encoding='utf-8') as _f:
                                                            _f.write(_desc + '\n')
                                                    except Exception:
                                                        pass
                                                    if log_cb:
                                                        log_cb('👁️ Mắt xưng hô: đã đọc ngữ cảnh nhân vật.')
                                                    return _desc
                                            elif r.status_code in (401, 403, 429):
                                                try:
                                                    _rq.post(f"{API_RELAY_URL.rstrip('/')}/gemini/key-dead", json={'key': _key}, headers=headers, timeout=10)
                                                except Exception:
                                                    pass
                                        except Exception:
                                            pass
                                    if log_cb:
                                        log_cb('⚠️ Mắt xưng hô tạm nghỉ, thử lại sau ít phút.')
                            else:
                                if log_cb:
                                    log_cb('⚠️ Mắt xưng hô tạm nghỉ, thử lại sau ít phút.')
                                return None
                    except Exception:
                        return None
    return None

def step3_translate_chunk(chunk: dict, ngon_ngu: str, the_loai: str, max_retries: int=30, log_cb: Callable[[str], None] | None=None, rolling_memory: str='', gemini_model: str='gemini-2.5-flash-lite', stop_flag=None) -> dict:
    from google import genai
    from google.genai import types
    from PIL import Image
    idx = chunk['index']
    srt_path = chunk.get('srt_path')
    grid_path = chunk.get('grid_image_path')
    if srt_path and os.path.isfile(srt_path):
        _log(log_cb, f'🌐 Bước 3 — Chunk {idx}: Gemini 3.1 Pro dịch...')
        with open(srt_path, 'r', encoding='utf-8') as f:
            srt_content = f.read()
        srt_content = _strip_filler_srt(srt_content)
        system_prompt = f"Bạn là dịch giả phụ đề video chuyên nghiệp.\nNgôn ngữ gốc: {ngon_ngu}. Thể loại: {the_loai}.\nNhìn bối cảnh trong ảnh lưới gửi kèm để dịch chuẩn xác file SRT sang tiếng Việt.\n\nQUY TẮC:\n- Giữ nguyên cấu trúc SRT (index, timestamp). Không thêm bớt dòng.\n- Dịch sát nghĩa, giữ giọng điệu nhân vật. Không thêm từ đệm (lắm, thật, quá, nhé, đấy, à, ư, chứ, vậy, mà, đó) nếu bản gốc không có.\n- ⚠️ DẤU CÂU BẮT BUỘC: Bản dịch tiếng Việt PHẢI có đầy đủ dấu câu như bản gốc.\n  Câu kết thúc → dấu chấm (.). Câu hỏi → dấu hỏi (?). Câu cảm thán → dấu chấm than (!).\n  Liệt kê / ngừng nghỉ giữa câu → dấu phẩy (,). Câu bỏ lửng / đang nói → dấu chấm lửng (...).\n  TUYỆT ĐỐI KHÔNG để câu dịch không có dấu câu kết thúc.\n- ⚠️ XƯNG HÔ: TRƯỚC KHI DỊCH MỖI CÂU → xác định AI ĐANG NÓI, AI ĐANG NGHE.\n  Đại từ phải ĐÚNG GÓC NHÌN CỦA NGƯỜI NÓI, TUYỆT ĐỐI KHÔNG ĐẢO NGƯỢC.\n  VD: Bề trên nói với bề dưới → gọi bề dưới 'cậu/ngươi'. Bề dưới nói với bề trên → gọi bề trên 'ông/ngài'.\n  Bề trên KHÔNG gọi bề dưới là 'ông', bề dưới KHÔNG gọi bề trên là 'cậu'.\n- Không dịch chú thích âm thanh (nhạc nền, tiếng cười...). Nếu câu chỉ có chú thích → thay bằng ...\n- Phụ đề gốc do AI nhận diện giọng nói, có thể sai chính tả. Khi gặp từ vô nghĩa → suy luận từ phát âm gần giống trong ngữ cảnh.\n\n★ ĐỘ DÀI CHO LỒNG TIẾNG (BẮT BUỘC):\n- Bản dịch dùng để LỒNG TIẾNG (dubbing), thời gian đọc phải xấp xỉ bản gốc.\n- Số âm tiết bản dịch KHÔNG được vượt quá 110% số âm tiết/chữ gốc.\n- Ưu tiên dùng từ ngắn, từ đồng nghĩa ngắn hơn, lược bỏ hư từ thừa.\n- Nếu câu gốc ngắn (≤5 chữ) → bản dịch PHẢI ≤6 âm tiết.\n- VÍ DỤ: '镇压我爱徒' (5 chữ) → 'Trấn áp đồ đệ ta' (5 âm tiết) ✅ | 'Trấn áp đồ đệ yêu quý của ta' (8 âm tiết) ❌\n\nKÝ ỨC: Sau khi dịch xong, thêm đúng 1 dòng cuối:\n[MEMORY] <tóm tắt xưng hô, tên riêng, quan hệ nhân vật, AI là bề trên/bề dưới>\nVí dụ: [MEMORY] Nam chính (bề dưới) xưng 'tôi', gọi cha 'ông'. Cha (bề trên) xưng 'ta', gọi con 'cậu'."
        parts = []
        if grid_path and os.path.isfile(grid_path):
            img = Image.open(grid_path)
            parts.append(img)
        parts.append(f'Dịch file SRT sau sang tiếng Việt:\n\n{srt_content}')
        if rolling_memory:
            parts.append(f'\nXưng hô từ đoạn trước:\n{rolling_memory}\nÁp dụng đúng quy tắc này. Cập nhật [MEMORY] nếu có nhân vật mới.')
        translated_text = None
        attempts = 0
        _ds_user = f'Dịch file SRT sau sang tiếng Việt:\n\n{srt_content}'
        if rolling_memory:
            _ds_user += f'\n\nXưng hô từ đoạn trước:\n{rolling_memory}\nÁp dụng đúng quy tắc này. Cập nhật [MEMORY] nếu có nhân vật mới.'
        _shell_text = _openrouter_relay_translate(system_prompt, _ds_user, log_cb, stop_flag, grid_path=grid_path)
        if _shell_text:
            _src_cues = srt_content.count('-->')
            _shell_cues = _shell_text.count('-->')
            if _src_cues > 0 and _shell_cues >= max(1, int(_src_cues * 0.6)):
                translated_text = _shell_text
                _log(log_cb, f'   ✅ Chunk {idx}: Dịch thành công')
            else:
                _log(log_cb, f'   ↩️ Chunk {idx}: Dịch chưa đủ dòng, thử lại...')
        if translated_text is None and attempts < max_retries:
            if not stop_flag or not stop_flag.is_set():
                api_key = _next_gemini_key()
                attempts += 1
                try:
                    client = genai.Client(api_key=api_key)
                    response = client.models.generate_content(model=gemini_model, contents=parts, config=types.GenerateContentConfig(system_instruction=system_prompt, temperature=0.1))
                    translated_text = response.text
                    _log(log_cb, f'   ✅ Chunk {idx}: Dịch thành công')
                except Exception as e:
                    err_str = str(e)
                    _n_keys = len(GEMINI_API_KEYS) if GEMINI_API_KEYS else 1
                    if '429' in err_str or 'quota' in err_str.lower() or 'rate' in err_str.lower():
                        if attempts % _n_keys == 0:
                            wait = 30
                            _log(log_cb, f'   ⚠️ Tools đang quá tải, chờ {wait}s...\n   ⏳ Google đang bận, hệ thống tự thử lại — vui lòng chờ')
                        else:
                            wait = min(3 + attempts * 2, 15)
                            _log(log_cb, f'   ⚠️ Tools đang quá tải, chờ {wait}s rồi thử key kế...')
                        if stop_flag:
                            if stop_flag.wait(wait):
                                raise InterruptedError('Pipeline bị dừng bởi người dùng.')
                        else:
                            time.sleep(wait)
                    elif '503' in err_str or 'overloaded' in err_str.lower() or 'unavailable' in err_str.lower():
                        wait = min(5 + attempts * 3, 30)
                        _log(log_cb, f'   ⚠️ Tools đang quá tải, chờ {wait}s...\n   ⏳ Google đang bận, hệ thống tự thử lại — vui lòng chờ')
                        if stop_flag:
                            if stop_flag.wait(wait):
                                raise InterruptedError('Pipeline bị dừng bởi người dùng.')
                        else:
                            time.sleep(wait)
                    else:
                        _log(log_cb, f'   ⚠️ Tools đang quá tải: {e}\n   ⏳ Google đang bận, hệ thống tự thử lại — vui lòng chờ')
                        if stop_flag:
                            if stop_flag.wait(3):
                                raise InterruptedError('Pipeline bị dừng bởi người dùng.')
                        else:
                            time.sleep(3)
                else:
                    if translated_text is None:
                        _log(log_cb, f'   ⚠️ Chunk {idx}: Dịch thất bại sau {max_retries} lần, giữ text gốc.')
                        import shutil
                        translated_srt_path = _WORK_DIR('chunk_' / f'{idx}03d_translated.srt')
                        shutil.copy2(srt_path, translated_srt_path)
                    else:
                        translated_srt_path = _WORK_DIR('chunk_' / f'{idx}03d_translated.srt')
                        cleaned = _clean_gemini_srt_output(translated_text)
                        _new_memory = ''
                        for _ml in cleaned.split('\n'):
                            if _ml.strip().startswith('[MEMORY]'):
                                _new_memory = _ml.strip()[len('[MEMORY]'):].strip()
                        str
                        chunk['rolling_memory'] = _new_memory
                        if _new_memory:
                            cleaned = '\n'.join((l for l in cleaned.split))
                        cleaned = _strip_filler_words(cleaned)
                        _is_land = chunk.get('_is_landscape', False)
                        _wl = 25 if _is_land else 15
                        _enforced_lines = []
                        for _el in cleaned.split('\n'):
                            _es = _el.strip()
                            _words = _es.split()
                            if _es and (not _es.isdigit()) and ('-->' not in _es) and (len(_words) > _wl):
                                _el = ' '.join(_words[:_wl])
                            _enforced_lines.append(_el)
                        cleaned = '\n'.join(_enforced_lines)
                        with open(translated_srt_path, 'w', encoding='utf-8') as f:
                            f.write(cleaned)
                    chunk['translated_srt_path'] = translated_srt_path
                    return chunk
            raise InterruptedError('Pipeline bị dừng bởi người dùng.')
    else:
        _log(log_cb, f'   ⚠️ Chunk {idx}: Không có SRT, bỏ qua dịch.')
        chunk['translated_srt_path'] = None
        return chunk
    while True:
        if translated_text is not None:
            pass
        elif attempts < max_retries:
            pass

def _clean_gemini_srt_output(text: str) -> str:
    text = text.strip()
    text = re.sub('^```(?:srt)?\\s*\\n?', '', text)
    text = re.sub('\\n?```\\s*$', '', text)
    return text.strip() + '\n'
_FILLER_TAIL_RE = re.compile('\\s+(?:lắm|thật|quá|nhé|đấy|đó|à|ư|ắt|chứ|vậy|mà|cơ|kìa|sao)\\s*([.!?…]*)$', re.IGNORECASE)

def _strip_filler_words(srt_text: str) -> str:
    lines = []
    for line in srt_text.split('\n'):
        stripped = line.strip()
        if stripped and (not stripped.isdigit()) and ('-->' not in stripped):
            prev = None
            while True:
                prev = stripped
                stripped = _FILLER_TAIL_RE.sub('\\1', stripped)
            lines.append(stripped)
        else:
            lines.append(line)
    return '\n'.join(lines)

def step4_merge_srt(chunks: list[dict], output_srt: str | None=None, log_cb: Callable[[str], None] | None=None) -> str:
    _log(log_cb, '📎 Bước 4: Gom nối SRT thành Master SRT...')
    if output_srt is None:
        output_srt = str(_WORK_DIR / 'master_translated.srt')
    global_index = 1
    master_lines = []
    for chunk in chunks:
        srt_path = chunk.get('translated_srt_path')
        if srt_path and os.path.isfile(srt_path):
            offset_sec = chunk['start_sec']
            entries = _parse_srt(srt_path)
            for entry in entries:
                new_start = entry['start_sec'] + offset_sec
                new_end = entry['end_sec'] + offset_sec
                master_lines.append(f"{global_index}\n{_seconds_to_srt_time(new_start)} --> {_seconds_to_srt_time(new_end)}\n{entry['text']}\n")
                global_index += 1
    with open(output_srt, 'w', encoding='utf-8') as f:
        f.write('\n'.join(master_lines))
    _log(log_cb, f'✅ Master SRT: {global_index - 1} dòng → {output_srt}')
    return output_srt

def step5_final_render(video_path: str, master_srt: str, output_path: str | None=None, tts_audio_path: str | None=None, tts_engine: str='edge', tts_voice: str='vi-VN-HoaiMyNeural', tts_speed: float=1.0, log_cb: Callable[[str], None] | None=None) -> str:
    _log(log_cb, '🎬 Bước 5: Final Render...')
    if output_path is None:
        p = Path(video_path)
        output_path = str(p.parent / (p.stem + '_translated' + p.suffix))
    if tts_audio_path is None:
        tts_audio_path = str(_WORK_DIR / 'tts_dubbed_audio.wav')
        _tts_placeholder(master_srt, tts_audio_path, tts_engine=tts_engine, tts_voice=tts_voice, tts_speed=tts_speed, log_cb=log_cb)
    src_vbitrate = _probe_video_bitrate(video_path)
    _crf = '18'
    _preset = 'medium'
    _maxrate = f'{src_vbitrate}k' if src_vbitrate else '2000k'
    _bufsize = f'{src_vbitrate * 2}k' if src_vbitrate else '4000k'
    if os.path.isfile(tts_audio_path):
        _log(log_cb, f'   📊 Video gốc ~{src_vbitrate}kbps → maxrate={_maxrate}')
        _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-i', video_path, '-i', tts_audio_path, '-map', '0:v:0', '-map', '1:a:0', '-vf', f"subtitles='{_escape_ffmpeg_path(master_srt)}'", '-c:v', 'libx264', '-crf', _crf, '-preset', _preset, '-maxrate', _maxrate, '-bufsize', _bufsize, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k', '-ar', '44100', '-movflags', '+faststart', '-shortest', output_path])
    else:
        _log(log_cb, '   ⚠️ Không tìm thấy audio TTS, render chỉ hardsub (không lồng tiếng).')
        _log(log_cb, f'   📊 Video gốc ~{src_vbitrate}kbps → maxrate={_maxrate}')
        _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-i', video_path, '-vf', f"subtitles='{_escape_ffmpeg_path(master_srt)}'", '-c:v', 'libx264', '-crf', _crf, '-preset', _preset, '-maxrate', _maxrate, '-bufsize', _bufsize, '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output_path])
    _log(log_cb, f'🏁 Hoàn tất! Video đầu ra: {output_path}')
    return output_path

def _tts_placeholder(srt_path: str, audio_output: str, tts_engine: str='edge', tts_voice: str='vi-VN-HoaiMyNeural', tts_speed: float=1.0, log_cb: Callable[[str], None] | None=None):
    from pydub import AudioSegment
    from .longtieng_engine import EdgeTTSEngine, VienewTTSEngine, get_audio_duration
    _log(log_cb, f'   🔊 TTS ({tts_engine}): Đang tạo audio lồng tiếng...')
    entries = _parse_srt(srt_path)
    if entries:
        total_sec = max((e['end_sec'] for e in entries)) + 1.0
        total_ms = int(total_sec * 1000)
        canvas = AudioSegment.silent(duration=total_ms, frame_rate=44100)
        engine = (VienewTTSEngine if tts_engine == 'vienew' else EdgeTTSEngine)(voice=tts_voice, speed=tts_speed)
        tts_tmp_dir = _WORK_DIR / 'tts_segments'
        tts_tmp_dir.mkdir(parents=True, exist_ok=True)
        success_count = 0
        for i, entry in enumerate(entries):
            text = entry['text'].strip()
            import re as _re_tts
            text = _re_tts.sub('\\|\\d+\\s*$', '', text).strip()
            if text:
                seg_start_ms = int(entry['start_sec'] * 1000)
                seg_dur_sec = entry['end_sec'] - entry['start_sec']
                tmp_path = tts_tmp_dir('tts_seg_' / f'{i}04d.mp3')
                try:
                    if tts_engine == 'vienew':
                        engine.generate(text, tmp_path)
                    else:
                        engine.generate(text, tmp_path)
                    seg_audio = AudioSegment.from_file(tmp_path)
                    audio_dur = len(seg_audio) / 1000.0
                    ratio = audio_dur / seg_dur_sec
                    if audio_dur > 0 and audio_dur > seg_dur_sec > 0.3 and (ratio > 1.1):
                        sped_path = tts_tmp_dir('tts_seg_' / f'{i}04d_fast.mp3')
                        _cfg.FFMPEG_PATH(['-y', '-i', tmp_path, '-filter:a', 'atempo=', f'{min(ratio, 1.3)}.4f', sped_path])
                        seg_audio = AudioSegment.from_file(sped_path)
                    canvas = canvas.overlay(seg_audio, position=seg_start_ms)
                    success_count += 1
                except Exception as e:
                    _log(log_cb, f'   ⚠️ TTS lỗi câu {i + 1}: {e}')
        _log(log_cb, f'   ✅ TTS xong: {success_count}/{len(entries)} câu')
        canvas.export(audio_output, format='wav', parameters=['-ar', '44100', '-sample_fmt', 's16'])
    else:
        _log(log_cb, '   ⚠️ SRT rỗng, tạo audio im lặng.')
        _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-t', '1', audio_output])