from __future__ import annotations
from pathlib import Path
from core.paths import PATHS
from core.brand import APP_DISPLAY_NAME
APP_NAME = APP_DISPLAY_NAME
APP_VERSION = '0.1.0-dev'
CONTACT = ''
APP_PRICE = 0
SUB_PRICE = 0
BANK_ACCOUNT = ''
BANK_ACCOUNT_NAME = ''
BANK_ID = ''
SEPAY_PREFIX = ''
API_RELAY_URL = ''
API_RELAY_SECRET = ''
EL_RELAY_URL = ''
EL_RELAY_SECRET = ''
LICENSE_SERVER_URL = ''
MODEL_ENCRYPT_SECRET = ''
VCACHE_TOKEN_SECRET = ''
SERVER_KEYS_ONLY = False
BUNDLED_GEMINI_KEYS: 'list[str]' = []
BUNDLED_GROQ_KEYS: 'list[str]' = []
BUNDLED_DEEPSEEK_KEY = ''
BUNDLED_GROK_KEY = ''
BUNDLED_EL_KEYS: 'list[str]' = []
BUNDLED_MINIMAX_KEY = ''
BUNDLED_SILICONFLOW_KEY = ''
BUNDLED_ZALO_KEY = ''
COLORS = {'bg_main': '#0B0F17', 'bg_card': '#121925', 'bg_input': '#0C121C', 'fg': '#E7EDF7', 'dim': '#9EB0C7', 'blue': '#2F6FE8', 'green': '#27A87B', 'orange': '#E6A23C', 'red': '#C24B59', 'purple': '#5B7CFA', 'border': '#253044', 'cyan': '#3D7DE8'}
VIDEO_EXTS = ('.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.ts')
FFMPEG_PATH = str(PATHS.ffmpeg)
FFPROBE_PATH = str(PATHS.ffprobe)
FFPLAY_PATH = str(PATHS.ffplay)

def _find_tool(name: str) -> str:
    candidate = PATHS.tools / name
    return str(candidate) if candidate.is_file() else name

def check_ffmpeg() -> bool:
    return Path(FFMPEG_PATH).is_file() and Path(FFPROBE_PATH).is_file()

def __getattr__(name: str):
    if name.startswith('BUNDLED_'):
        return [] if name.endswith('KEYS') else ''
    raise AttributeError(name)