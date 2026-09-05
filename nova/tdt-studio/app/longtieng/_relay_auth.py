'_relay_auth.py — Bộ header auth dùng chung cho các route relay TTS.\n\nMục đích: gửi kèm X-VTP-Key/X-VTP-HWID (giống route trả phí DeepSeek đã qua cổng\nlicense) trên MỌI call TTS relay, để sau này server siết license cho route TTS\n(thêm vào _needLicense) → chặn crack móc X-Relay-Secret xài chùa giọng đọc.\n\n🔴 AN TOÀN: hàm chỉ THÊM header, VẪN gửi X-Relay-Secret cũ → server hiện tại\n(chưa siết) vẫn chấp nhận như thường → KHÔNG khách thật nào bị lỗi khi cập nhật.\nViệc siết license phía server làm SAU khi bản client mới đã phủ rộng.\n'
from __future__ import annotations

def relay_auth_headers(relay_secret: str='') -> dict:
    headers = {}
    hwid = ''
    try:
        from utils_license import get_hwid
        hwid = get_hwid() or ''
    except Exception:
        hwid = ''
    if hwid:
        headers['X-Auth-HWID'] = hwid
    try:
        from auth_session import get_relay_auth_headers as _grah
        headers.update(_grah(hwid) if hwid else _grah())
    except Exception:
        pass
    _sec = relay_secret or ''
    if not _sec:
        try:
            from config import API_RELAY_SECRET
            _sec = API_RELAY_SECRET or ''
        except Exception:
            _sec = ''
    if _sec:
        headers['X-Relay-Secret'] = _sec
    try:
        from utils_license import load_saved_license
        _vtp = (load_saved_license() or '').strip()
        if _vtp:
            headers['X-VTP-Key'] = _vtp
            if hwid:
                headers['X-VTP-HWID'] = hwid
            try:
                from config import APP_VERSION
                headers['X-VTP-Version'] = APP_VERSION
            except Exception:
                return headers
        else:
            return headers
    except Exception:
        return headers
    return headers