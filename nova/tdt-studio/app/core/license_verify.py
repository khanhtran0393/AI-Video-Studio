'Verify token bản quyền v2 Ed25519 — thuần, không Qt.\n\nPublic key được nhúng (không phải secret). Test inject RAM qua set_verify_keys.\nThiếu khoá / sai chữ ký → fail-closed.\n'
from __future__ import annotations
import base64
import json
try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
except ImportError:
    InvalidSignature = Exception
    Ed25519PublicKey = None
DEFAULT_KID = 's1'
CLOCK_SKEW_SECONDS = 300
VERIFY_PUBLIC_B64 = 'TZZFXzYXOVowd7O5wOdikSzUD5U+VyCMTEZNaD566E8='
_PUBLIC_KEY = None
_KID = DEFAULT_KID

def set_verify_keys(public_key, *, kid: str) -> None:
    global _PUBLIC_KEY, _KID
    _PUBLIC_KEY = public_key
    _KID = str(kid or DEFAULT_KID)

def clear_verify_keys() -> None:
    global _PUBLIC_KEY, _KID
    _PUBLIC_KEY = None
    _KID = DEFAULT_KID

def _b64url_decode(text: str) -> bytes:
    padded = text + '=' * (-len(text) % 4)
    return base64.urlsafe_b64decode(padded.encode('ascii'))

def _ensure_verify_key() -> bool:
    global _PUBLIC_KEY
    if _PUBLIC_KEY is not None:
        return True
    if Ed25519PublicKey is None:
        return False
    raw_b64 = (VERIFY_PUBLIC_B64 or '').strip()
    if not raw_b64:
        return False
    try:
        raw = base64.b64decode(raw_b64)
        _PUBLIC_KEY = Ed25519PublicKey.from_public_bytes(raw)
    except (ValueError, TypeError):
        return False
    return _PUBLIC_KEY is not None

def verify_token(token: str) -> dict | None:
    raw = str(token or '')
    parts = raw.split('.')
    if len(parts) != 3 or parts[0] != 'v2':
        return None
    if not _ensure_verify_key():
        return None
    sig_b64, body = (parts[2], parts[1])
    try:
        _PUBLIC_KEY.verify(_b64url_decode(sig_b64), body.encode('ascii'))
    except (InvalidSignature, ValueError, TypeError):
        return None
    try:
        payload = json.loads(_b64url_decode(body).decode('utf-8'))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    return None if not isinstance(payload, dict) or int(payload.get('ver') or 0) != 2 else payload

def local_verdict(token: str, *, machine_id: str, now: int, seen_max: int) -> dict:
    payload = verify_token(token)
    if payload is None:
        return {'ok': False, 'error': 'bad_token'}
    if str(payload.get('machine_id') or '') != str(machine_id):
        return {'ok': False, 'error': 'machine_mismatch'}
    exp = payload.get('license_expires_at')
    if exp is not None:
        if isinstance(exp, bool) or not isinstance(exp, int):
            return {'ok': False, 'error': 'bad_token'}
        if int(now) >= int(exp):
            return {'ok': False, 'error': 'expired'}
    else:
        return {'ok': False, 'error': 'clock_rollback', 'need_online': True} if int(now) < int(seen_max or 0) - CLOCK_SKEW_SECONDS else {'ok': True, 'payload': payload}