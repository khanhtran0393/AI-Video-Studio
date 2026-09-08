'TDT Studio — Mô-đun BẢN QUYỀN phía APP (client).\n\nHàm chính app cần dùng:\n    set_server(url)            -> đổi địa chỉ server (localhost / tunnel / VPS)\n    machine_id()               -> mã máy ổn định (hash, không lộ thông tin cá nhân)\n    machine_short()            -> 8 ký tự để hiện cho user gửi hỗ trợ\n    activate(key)              -> {ok, plan, expires_at, error}\n    check(force_online=False)  -> trạng thái hiện tại (verify chữ ký + hạn đã ký)\n    deactivate()               -> gỡ máy này khỏi key\n    is_licensed()              -> True/False nhanh gọn để KHÓA tính năng\n    status_text()              -> chuỗi mô tả gọn để hiện lên UI\n\nBảo mật: server URL + hàm này KHÔNG chứa secret. Secret ký token nằm 100% ở\nserver. App chỉ giữ 1 token đã ký và verify bằng khoá công khai.\n'
from __future__ import annotations
import getpass
import hashlib
import json
import os
import platform
import time
import urllib.error
import urllib.request
from pathlib import Path
from core import license_verify as lv
DEFAULT_SERVER = 'http://127.0.0.1:8787'
_HARD_SERVER_ERRORS = frozenset({'device_revoked', 'bad_token', 'expired', 'machine_mismatch', 'invalid_key', 'locked'})
_HARD_LOCAL_ERRORS = frozenset({'expired', 'machine_mismatch', 'bad_token'})
_APP_NAME = 'TDTStudio'
_server_url = DEFAULT_SERVER
_LIC_FILE = None

def set_server(url: str) -> None:
    url = (url or '').strip().rstrip('/')
    if url and (not url.startswith('http')):
        url = 'http://' + url
    _server_url = url or DEFAULT_SERVER

def _appdata_dir() -> Path:
    base = os.environ.get('APPDATA') or os.environ.get('LOCALAPPDATA') or str(Path.home())
    d = Path(base) / _APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d

def _lic_path() -> Path:
    return _LIC_FILE if _LIC_FILE is not None else _appdata_dir() / 'license.dat'

def machine_id() -> str:
    raw = f'{platform.node()}|{getpass.getuser()}|{platform.system()}|{platform.machine()}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def machine_short() -> str:
    return machine_id()[:8].upper()

def _save_state(state: dict) -> None:
    import base64
    path = _lic_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(state).encode('utf-8')
    path.write_bytes(base64.b64encode(raw))

def _load_state() -> dict:
    import base64
    path = _lic_path()
    if path.exists():
        try:
            raw = json.loads(base64.b64decode(path.read_bytes()).decode('utf-8'))
            return raw if isinstance(raw, dict) else {}
        except Exception:
            return {}
    return {}

def _clear_state() -> None:
    try:
        _lic_path().unlink(missing_ok=True)
    except Exception:
        pass

def _api(path: str, body: dict) -> dict:
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(_server_url + path, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            parsed = json.loads(r.read().decode('utf-8'))
            return parsed if isinstance(parsed, dict) else {'ok': False, 'error': 'bad_response'}
    except urllib.error.URLError:
        return {'ok': False, 'error': 'no_server'}
    except Exception as exc:
        return {'ok': False, 'error': f'exc:{exc}'}

def _merge_success(st: dict, token: str, payload: dict, *, offline: bool, now: int) -> dict:
    iat = int(payload.get('iat') or now)
    seen = max(int(st.get('seen_max') or 0), iat, now)
    st.update({'token': token, 'plan': payload.get('plan') or st.get('plan', ''), 'license_expires_at': payload.get('license_expires_at'), 'iat': iat, 'seen_max': seen, 'last_ok': now})
    _save_state(st)
    return {'ok': True, 'status': 'active', 'plan': st.get('plan', ''), 'expires_at': st.get('expires_at'), 'license_expires_at': st.get('license_expires_at'), 'offline': offline}

def activate(key: str) -> dict:
    key = str(key or '').strip().upper()
    r = _api('/api/v1/activate', {'key': key, 'machine_id': machine_id(), 'app_version': _app_version()})
    if r.get('ok'):
        token = str(r.get('token') or '')
        payload = lv.verify_token(token)
        if payload is None:
            return {'ok': False, 'error': 'bad_token', 'status': 'blocked'}
        now = int(time.time())
        st = _load_state()
        iat = int(payload.get('iat') or now)
        _save_state({'token': token, 'key': key, 'plan': payload.get('plan') or r.get('plan', ''), 'expires_at': r.get('expires_at'), 'license_expires_at': payload.get('license_expires_at'), 'iat': iat, 'seen_max': max(int(st.get('seen_max') or 0), iat, now), 'last_ok': now})
        return {'ok': True, 'status': 'active', 'plan': payload.get('plan') or r.get('plan', ''), 'expires_at': r.get('expires_at'), 'license_expires_at': payload.get('license_expires_at'), 'offline': False}
    else:
        return r

def _check(force_online: bool=False) -> dict:
    st = _load_state()
    token = st.get('token')
    if token:
        now = int(time.time())
        seen_max = int(st.get('seen_max') or 0)
        local = lv.local_verdict(str(token), machine_id=machine_id(), now=now, seen_max=seen_max)
        if local.get('ok'):
            return _merge_success(st, str(token), local['payload'], offline=True, now=now)
        if not force_online and local.get('error') in _HARD_LOCAL_ERRORS:
            return {'ok': False, 'status': 'blocked', 'error': local.get('error')}
        r = _api('/api/v1/validate', {'token': token, 'machine_id': machine_id()})
        if r.get('ok'):
            new_token = str(r.get('token') or token)
            payload = lv.verify_token(new_token)
            if payload is None:
                return {'ok': False, 'status': 'blocked', 'error': 'bad_token'}
            if str(payload.get('machine_id') or '') != machine_id():
                return {'ok': False, 'status': 'blocked', 'error': 'machine_mismatch'}
            st['expires_at'] = r.get('expires_at')
            return _merge_success(st, new_token, payload, offline=False, now=now)
        if r.get('error') in _HARD_SERVER_ERRORS:
            return {'ok': False, 'status': 'blocked', 'error': r.get('error')}
        if local.get('ok'):
            return _merge_success(st, str(token), local['payload'], offline=True, now=now)
        if local.get('need_online'):
            return {'ok': False, 'status': 'offline_expired', 'error': 'no_server'}
        err = str(local.get('error') or r.get('error') or 'no_server')
        return {'ok': False, 'status': 'blocked', 'error': err} if err in _HARD_LOCAL_ERRORS else {'ok': False, 'status': 'offline_expired', 'error': 'no_server'}
    return {'ok': False, 'status': 'none', 'error': 'not_activated'}

def check(force_online: bool=False) -> dict:
    return _check(force_online)

def deactivate() -> dict:
    st = _load_state()
    token = st.get('token')
    if token:
        r = _api('/api/v1/deactivate', {'token': token, 'machine_id': machine_id()})
        if r.get('ok'):
            _clear_state()
        return r
    return {'ok': False, 'error': 'not_activated'}

def has_local_token() -> bool:
    return bool(_load_state().get('token'))

def is_licensed() -> bool:
    return bool(_check().get('ok'))

def current_plan() -> str:
    return str(_load_state().get('plan', '') or '')

def status_text() -> str:
    r = check()
    if r.get('ok'):
        tail = '  (đang offline)' if r.get('offline') else ''
        exp = r.get('license_expires_at')
        exp_s = 'vĩnh viễn' if exp is None else str(exp)
        return f"Bản quyền hợp lệ · {r.get('plan') or '—'} · hết hạn {exp_s}{tail}"
    reason = {'not_activated': 'Chưa kích hoạt. Nhập key để dùng.', 'locked': 'Key đã bị khóa. Liên hệ admin.', 'expired': 'Key đã hết hạn. Gia hạn để tiếp tục.', 'device_revoked': 'Máy này đã bị gỡ khỏi key.', 'no_server': 'Không kết nối được máy chủ bản quyền.', 'bad_token': 'Token không hợp lệ.', 'machine_mismatch': 'Token không khớp máy này.'}
    return reason.get(r.get('error'), 'Bản quyền không hợp lệ.')

def _app_version() -> str:
    try:
        from ui_qt.version import APP_UI_VERSION
        return str(APP_UI_VERSION)
    except Exception:
        return ''
if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    print('Server   :', _server_url)
    print('Mã máy   :', machine_short())
    print('Trạng thái:', status_text())