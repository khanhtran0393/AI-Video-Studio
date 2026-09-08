'Màn hình Bản quyền — PySide6 (bố cục theo GIALAP_APP.py).'
from __future__ import annotations
from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QDesktopServices, QFont, QPixmap
from PySide6.QtWidgets import QDialog, QFrame, QHBoxLayout, QLabel, QLineEdit, QMessageBox, QPushButton, QVBoxLayout, QWidget
from core.license_client import activate, check, deactivate, machine_short, status_text
from core.paths import PATHS
BUY_RENEW_URL = 'https://tdt.studio'
_INK = '#0a0e15'
_PANEL = '#121a24'
_LINE = '#212b39'
_TEXT = '#ecf1f6'
_DIM = '#8996a8'
_CYAN = '#5cc8ff'
_GREEN = '#31c48d'
_RED = '#f4675f'
_AMBER = '#ff9a42'
_ERROR_VN = {'invalid_key': 'Key không đúng / không tồn tại.', 'locked': 'Key đã bị khóa. Liên hệ admin.', 'expired': 'Key đã hết hạn.', 'device_limit': 'Key đã dùng đủ số máy cho phép.', 'device_revoked': 'Máy này đã bị gỡ khỏi key.', 'machine_mismatch': 'Token không khớp máy này.', 'token_expired': 'Phiên hết hạn, cần kích hoạt lại.', 'bad_token': 'Chưa kích hoạt trên máy này.', 'not_activated': 'Chưa kích hoạt trên máy này.', 'no_server': 'Không kết nối được server bản quyền.', 'missing_fields': 'Thiếu key hoặc machine id.'}

def _error_message(result: dict) -> str:
    err = str(result.get('error') or '')
    text = _ERROR_VN.get(err, err or 'Lỗi')
    if err == 'no_server':
        try:
            from core.license_endpoint import last_license_endpoint
            info = last_license_endpoint()
            tried = ' · '.join((str(u) for u in (info.get('tried') or ())))
            if tried:
                text = f'{text}\nĐã thử: {tried}'
        except Exception:
            return text
    return text

def run_license_gate(parent: QWidget | None=None) -> bool:
    from core.license_client import is_licensed
    try:
        if not is_licensed():
            dialog = LicensePanel(parent, require_license=True)
            dialog.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, True)
            dialog.setWindowModality(Qt.WindowModality.ApplicationModal)
            dialog.show()
            dialog.raise_()
            dialog.activateWindow()
            dialog.exec()
            return bool(is_licensed())
    except Exception:
        pass
    return True

class LicensePanel(QDialog):
    __doc__ = 'Dialog Bản quyền: mã máy, key, kích hoạt / kiểm tra / gỡ.'

    def __init__(self, parent: QWidget | None=None, *, require_license: bool) -> None:
        super().__init__(parent)
        self._require_license = bool(require_license)
        self.setWindowTitle('TDT Studio — Kích hoạt để vào' if self._require_license else 'TDT Studio — Bản quyền')
        self.setModal(True)
        self.setMinimumWidth(640)
        self.setStyleSheet(''.join(['\n            QDialog { background: ', f'{_INK}', '; color: ', f'{_TEXT}', '; }\n            QLabel { color: ', f'{_TEXT}', '; }\n            QLineEdit {\n                background: #0d131b; color: ', f'{_TEXT}', ';\n                border: 1px solid ', f'{_LINE}', '; padding: 8px; border-radius: 4px;\n                selection-background-color: ', f'{_CYAN}', ';\n            }\n            QPushButton {\n                font-weight: 600; padding: 8px 14px; border-radius: 4px;\n            }\n            QPushButton#licActivate {\n                background: ', f'{_CYAN}', '; color: #06202e; border: none;\n            }\n            QPushButton#licSecondary {\n                background: ', f'{_PANEL}', '; color: ', f'{_TEXT}', ';\n                border: 1px solid ', f'{_LINE}', ';\n            }\n            QPushButton#licDeactivate {\n                background: ', f'{_PANEL}', '; color: ', f'{_AMBER}', ';\n                border: 1px solid ', f'{_LINE}', ';\n            }\n            QPushButton#licBuy {\n                background: ', f'{_PANEL}', '; color: ', f'{_DIM}', ';\n                border: 1px solid ', f'{_LINE}', ';\n            }\n            QFrame#licCard {\n                background: ', f'{_PANEL}', '; border: 1px solid ', f'{_LINE}', '; border-radius: 6px;\n            }\n            ']))
        root = QVBoxLayout(self)
        root.setContentsMargins(22, 18, 22, 18)
        root.setSpacing(10)
        title = QLabel('TDT · STUDIO')
        title_font = QFont()
        title_font.setPointSize(16)
        title_font.setBold(True)
        title.setFont(title_font)
        root.addWidget(title)
        subtitle = QLabel('NHẬP KEY ĐỂ VÀO ỨNG DỤNG' if self._require_license else 'MÀN HÌNH BẢN QUYỀN')
        subtitle.setStyleSheet(f'color: {_DIM}; font-size: 9pt;')
        root.addWidget(subtitle)
        mid_row = QHBoxLayout()
        mid_lbl = QLabel('Mã máy:')
        mid_lbl.setStyleSheet(f'color: {_DIM};')
        mid_row.addWidget(mid_lbl)
        mid_val = QLabel(f'{machine_short()}…')
        mid_val.setStyleSheet(f'color: {_CYAN}; font-weight: 700; font-family: Consolas;')
        mid_val.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        mid_row.addWidget(mid_val)
        mid_row.addStretch(1)
        root.addLayout(mid_row)
        pay_qr = QLabel()
        pay_qr.setObjectName('licPayQr')
        pay_qr.setAlignment(Qt.AlignmentFlag.AlignCenter)
        qr_path = PATHS.assets / 'QR_THANH_TOAN_TDT.png'
        qr_pix = QPixmap(str(qr_path)) if qr_path.is_file() else QPixmap()
        if qr_pix.isNull():
            pay_qr.hide()
        else:
            pay_qr.setPixmap(qr_pix.scaled(220, 220, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        pay_hint = QLabel('Quét QR chuyển khoản — Zalo 0867418305 nhận key\nMB · HOANG DAI DINH · 86333333336868')
        pay_hint.setObjectName('licPayHint')
        pay_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pay_hint.setWordWrap(True)
        pay_hint.setStyleSheet(f'color: {_DIM}; font-size: 9pt;')
        pay_col = QVBoxLayout()
        pay_col.setSpacing(6)
        pay_col.addWidget(pay_qr)
        pay_col.addWidget(pay_hint)
        pay_col.addStretch(1)
        body = QHBoxLayout()
        body.setSpacing(16)
        body.addLayout(pay_col, 0)
        card = QFrame()
        card.setObjectName('licCard')
        card_lay = QVBoxLayout(card)
        card_lay.setContentsMargins(14, 14, 14, 14)
        card_lay.setSpacing(8)
        key_lbl = QLabel('Nhập key bản quyền')
        key_lbl.setStyleSheet('font-weight: 700;')
        card_lay.addWidget(key_lbl)
        self.key_edit = QLineEdit()
        self.key_edit.setPlaceholderText('TDT-…')
        self.key_edit.setText('TDT-')
        self.key_edit.setFont(QFont('Consolas', 12))
        card_lay.addWidget(self.key_edit)
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)
        self.btn_activate = QPushButton('Kích hoạt')
        self.btn_activate.setObjectName('licActivate')
        self.btn_activate.clicked.connect(self._on_activate)
        btn_row.addWidget(self.btn_activate)
        self.btn_check = QPushButton('Kiểm tra lại')
        self.btn_check.setObjectName('licSecondary')
        self.btn_check.clicked.connect(lambda: self._on_check(silent=False))
        btn_row.addWidget(self.btn_check)
        self.btn_deactivate = QPushButton('Gỡ máy này')
        self.btn_deactivate.setObjectName('licDeactivate')
        self.btn_deactivate.clicked.connect(self._on_deactivate)
        btn_row.addWidget(self.btn_deactivate)
        btn_row.addStretch(1)
        card_lay.addLayout(btn_row)
        body.addWidget(card, 1)
        root.addLayout(body)
        self.status_label = QLabel()
        self.status_label.setWordWrap(True)
        self.status_label.setStyleSheet(f'color: {_DIM}; font-size: 11pt;')
        root.addWidget(self.status_label)
        buy_row = QHBoxLayout()
        self.btn_buy = QPushButton('Mua / gia hạn')
        self.btn_buy.setObjectName('licBuy')
        self.btn_buy.clicked.connect(self._on_buy)
        buy_row.addWidget(self.btn_buy)
        buy_row.addStretch(1)
        if self._require_license:
            self.btn_quit = QPushButton('Thoát')
            self.btn_quit.setObjectName('licBuy')
            self.btn_quit.clicked.connect(self.reject)
            buy_row.addWidget(self.btn_quit)
        root.addLayout(buy_row)
        self._refresh_status_from_client()

    def _set_status(self, text: str, color: str) -> None:
        self.status_label.setText(text)
        self.status_label.setStyleSheet(f'color: {color}; font-size: 11pt;')

    def _refresh_status_from_client(self) -> None:
        text = status_text()
        ok_color = _GREEN if text.startswith('Bản quyền hợp lệ') else _DIM
        if any((token in text.lower() for token in ('không hợp lệ', 'đã hết hạn', 'đã bị khóa', 'chưa kích hoạt', 'không kết nối', 'không khớp', 'bị gỡ', 'phiên hết hạn'))):
            ok_color = _RED
        self._set_status(text, ok_color)

    def _on_activate(self) -> None:
        key = self.key_edit.text().strip().upper()
        if not key or key == 'TDT-':
            QMessageBox.warning(self, 'Thiếu key', 'Nhập key trước đã.')
            return None
        result = activate(key)
        if result.get('ok'):
            self._set_status(status_text(), _GREEN)
            if self._require_license:
                self.accept()
            return None
        self._set_status(f'✗ {_error_message(result)}', _RED)

    def _on_check(self, *, silent: bool) -> None:
        result = check()
        if result.get('ok'):
            self._set_status(status_text(), _GREEN)
            if self._require_license:
                self.accept()
            return None
        if silent and result.get('error') in frozenset({'not_activated', 'bad_token'}):
            self._set_status(status_text(), _DIM)
            return None
        self._set_status(f'✗ {_error_message(result)}\n{status_text()}', _RED)

    def _on_deactivate(self) -> None:
        result = deactivate()
        if result.get('ok'):
            self._set_status('✔ Đã trả slot. Máy này có thể Kích hoạt lại bất cứ lúc nào.', _GREEN)
            return None
        self._set_status(f'✗ {_error_message(result)}', _RED)

    def _on_buy(self) -> None:
        QDesktopServices.openUrl(QUrl(BUY_RENEW_URL))