'\ntranslator_utils.py — Shared utilities for translator pipeline.\nTách từ longtieng_translator.py để tránh circular imports.\n'
from __future__ import annotations
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable
import config as _cfg
_WORK_DIR = Path(tempfile.gettempdir()) / 'tdt_translator'
_WORK_DIR.mkdir(parents=True, exist_ok=True)
_WHISPER_VOCAB_PROMPTS = {'zh': '以下是一段中文短剧台词，包含现代都市剧和古装仙侠剧内容。赌场，筹码，下注，手气，牌桌，翻盘，庄家，荷官，会所，蓝水会所，场子，包间，单间，大厅，夜总会，转账，取钱，手续费，老年机，智能机，手机，萨瓦迪卡，缅甸，泰国，金三角，坤叔，何情，大人物，老大，兄弟，嫂子，手下，马仔，私生子，手术费，废物，交代，下药，拼命，圈子，眼界，高高在上，上不得台面，吃人不吐骨头，鬼鬼祟祟，修炼，修仙，修为，功力，功法，内力，法术，法器，灵气，灵力，气运，真气，元气，天道，造化，渡劫，飞升，封印，解封，重生，轮回，结界，阵法，妖怪，魔王，仙人，菩萨，观音，如来，施主，阿弥陀佛，承接，滔天，气韵，牙口，好牙口', 'ja': '以下は中国語の短編ドラマのセリフです。法身、法力、修行、気運、造化、金剛、菩薩、観音、如来、妖怪、魔王、仙人、凡人、肉体、魂魄、元神、雷劫、阿弥陀仏、施主、貧僧', 'ko': '다음은 중국 단편 드라마 대본입니다. 법신, 법력, 수련, 기운, 조화, 금강, 보살, 관음, 여래, 요괴, 마왕, 선인, 범인, 육체, 혼백, 원신'}

def _log(cb: Callable[[str], None] | None, msg: str):
    if cb:
        cb(msg)
        return None
    print(msg)

def _run_ffmpeg(cmd: list[str]):
    kwargs = {}
    if hasattr(subprocess, 'CREATE_NO_WINDOW'):
        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
    result = subprocess.run(cmd, capture_output=True, **kwargs)
    if result.returncode != 0:
        stderr = (result.stderr or b'').decode('utf-8', errors='replace')[:500] if result.stderr else '(no stderr)'
        raise RuntimeError(f'FFmpeg lỗi (code {result.returncode}): {stderr}')

def _probe_duration(video_path: str) -> float:
    try:
        kwargs = {}
        if hasattr(subprocess, 'CREATE_NO_WINDOW'):
            kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
        result = subprocess.run([_cfg.FFPROBE_PATH, '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', video_path], capture_output=True, **kwargs)
        val = (result.stdout or b'').decode('utf-8', errors='replace').strip()
        if not val:
            return 0.0
    except Exception:
        return 0.0

def _probe_video_bitrate(video_path: str) -> int:
    try:
        kwargs = {}
        if hasattr(subprocess, 'CREATE_NO_WINDOW'):
            kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
        result = subprocess.run([_cfg.FFPROBE_PATH, '-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=bit_rate', '-of', 'default=noprint_wrappers=1:nokey=1', video_path], capture_output=True, **kwargs)
        val = (result.stdout or b'').decode('utf-8', errors='replace').strip()
        if val and val.isdigit():
            return int(val) // 1000
        result2 = subprocess.run([_cfg.FFPROBE_PATH, '-v', 'quiet', '-show_entries', 'format=bit_rate', '-of', 'default=noprint_wrappers=1:nokey=1', video_path], capture_output=True, **kwargs)
        val2 = (result2.stdout or b'').decode('utf-8', errors='replace').strip()
        if not val2 or not val2.isdigit():
            return 0
    except Exception:
        return 0

def _safe_remove(path: str):
    try:
        if os.path.isfile(path):
            os.remove(path)
        else:
            return None
    except OSError:
        pass

def _seconds_to_srt_time(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    h = int(sec // 3600)
    m = int(sec % 3600 // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    return f'02d:{s}02d,{ms}03d'

def _srt_time_to_seconds(time_str: str) -> float:
    time_str = time_str.replace(',', '.')
    parts = time_str.split(':')
    h = float(parts[0])
    m = float(parts[1])
    s = float(parts[2])
    return h * 3600 + m * 60 + s

def _escape_ffmpeg_path(path: str) -> str:
    path = path.replace('\\', '/')
    path = path.replace(':', '\\:')
    return path

def _load_gemini_keys_from_config() -> list[str]:
    import json
    cfg_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exporter', 'prompts', 'user_config.json')
    keys = []
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        primary = cfg.get('gemini_api_key', '').strip()
        if primary and len(primary) >= 30:
            keys.append(primary)
        for k in cfg.get('gemini_backup_keys', cfg.get('gemini_keys', [])):
            k = k.strip() if isinstance(k, str) else ''
            if k and len(k) >= 30:
                keys.append(k)
    except Exception:
        pass
    personal_path = os.path.join(os.path.dirname(os.path.abspath(sys.executable)), 'prompts', 'user_personal.json') if getattr(sys, 'frozen', False) else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exporter', 'prompts', 'user_personal.json')
    try:
        import json as _json
        with open(personal_path, 'r', encoding='utf-8') as pf:
            pk = _json.load(pf).get('api_key', '').strip()
        if pk and len(pk) >= 30 and (pk not in keys):
            keys.insert(0, pk)
    except Exception:
        pass
    try:
        from config import BUNDLED_GEMINI_KEYS
        for bk in BUNDLED_GEMINI_KEYS:
            if bk not in keys:
                keys.append(bk)
    except Exception:
        return keys
    return keys
    while True:
        while True:
            pass
        if len(k) < 30:
            pass
        elif k not in keys:
            keys.append(k)

def _parse_srt(srt_path: str) -> list[dict]:
    import os as _os
    entries = []
    if _os.path.isfile(srt_path):
        with open(srt_path, 'r', encoding='utf-8') as f:
            content = f.read()
        blocks = re.split('\\n\\s*\\n', content.strip())
        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue
            try:
                idx = int(lines[0].strip())
                ts_match = re.match('(\\d{2}:\\d{2}:\\d{2}[,.]\\d{3})\\s*-->\\s*(\\d{2}:\\d{2}:\\d{2}[,.]\\d{3})', lines[1].strip())
                if ts_match:
                    start_sec = _srt_time_to_seconds(ts_match.group(1))
                    end_sec = _srt_time_to_seconds(ts_match.group(2))
                    text = '\n'.join(lines[2:]).strip()
                    entries.append({'index': idx, 'start_sec': start_sec, 'end_sec': end_sec, 'text': text})
            except ValueError:
                pass
    return entries
GEMINI_API_KEYS: 'list[str]' = _load_gemini_keys_from_config()
_gemini_key_idx = 0

def _fetch_gemini_key_from_relay() -> str | None:
    try:
        from config import API_RELAY_URL, API_RELAY_SECRET
        if API_RELAY_URL:
            from auth_session import get_relay_auth_headers
            import requests
            headers = {'Content-Type': 'application/json'}
            headers.update(get_relay_auth_headers())
            if API_RELAY_SECRET:
                headers['X-Relay-Secret'] = API_RELAY_SECRET
            resp = requests.post(f"{API_RELAY_URL.rstrip('/')}/gemini/key", json={}, headers=headers, timeout=5)
            if resp.status_code != 200:
                return None
        else:
            return None
    except Exception:
        pass

def _next_gemini_key() -> str:
    relay_key = _fetch_gemini_key_from_relay()
    if relay_key:
        return relay_key
    if GEMINI_API_KEYS:
        key = GEMINI_API_KEYS[_gemini_key_idx % len(GEMINI_API_KEYS)]
        _gemini_key_idx += 1
        return key
    raise RuntimeError('Không có Gemini API key nào!')