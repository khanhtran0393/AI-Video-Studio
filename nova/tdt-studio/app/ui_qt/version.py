'Phiên bản UI — tăng khi reload để biết code mới đã nạp.'
APP_UI_VERSION = '2026.08.26-668'
APP_RELEASE_VERSION = '1.0.0'

def display_version() -> str:
    from core.runtime_flavor import is_frozen_packaged
    return APP_RELEASE_VERSION if is_frozen_packaged() else APP_UI_VERSION