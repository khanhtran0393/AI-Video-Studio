'Stub panel Nhập — chỉ dùng khi thiếu lõi download từ máy build Nhập.\n\nKHÔNG đặt tên file trùng «feature_download.py» để sync ĐẨY không đè mất\nbản thật trên máy kia.\n'
from __future__ import annotations
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QLabel, QPushButton, QVBoxLayout, QWidget

def build_download_panel_stub(parent: QWidget | None=None) -> QWidget:
    panel = QFrame(parent)
    panel.setObjectName('workbenchSection')
    layout = QVBoxLayout(panel)
    layout.setContentsMargins(12, 12, 12, 12)
    layout.setSpacing(8)
    title = QLabel('Nhập / Tải video — chờ sync từ máy Nhập')
    title.setObjectName('nodeTitle')
    layout.addWidget(title)
    hint = QLabel('Máy này chưa có bản đầy đủ «ui_qt/feature_download.py».\n\nTrên máy build Nhập:\n1. Kiểm tra file còn không (Cursor → Local History nếu mất)\n2. CHAY_VTP_TOOL_SYNC → QUÉT → chỉ ĐẨY file download / KÉO về máy edit\n3. Không ĐẨY cả cây từ máy edit khi đang thiếu file thật\n\nTạm thời: Media → Thêm file / thư mục.')
    hint.setObjectName('mutedLabel')
    hint.setWordWrap(True)
    hint.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
    layout.addWidget(hint)
    tip = QPushButton('Đã hiểu — dùng Media để thêm video')
    tip.setEnabled(False)
    layout.addWidget(tip)
    layout.addStretch(1)
    return panel