from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class AppModule:
    id: 'str'
    title: 'str'
    short_title: 'str'
    description: 'str'
    ready: 'bool' = False
APP_MODULES: 'tuple[AppModule, ...]' = (AppModule('media', 'Media / Biên tập', 'Media', 'Cắt, tỷ lệ khung, tốc độ và chỉnh hình — không gồm mã hóa xuất.', ready=True), AppModule('tts', 'Âm thanh', 'Âm thanh', 'Âm gốc, TTS, nhạc nền, SFX và trộn âm khi xuất.', ready=True), AppModule('subtitle', 'Văn bản / Phụ đề', 'Văn bản', 'Phụ đề, kiểu chữ và công cụ AI (STT, dịch).', ready=True), AppModule('effects', 'Lớp', 'Lớp', 'Nền, hòa trộn, lớp phủ, logo — chồng lên video, không phải grain/filter.', ready=True), AppModule('look', 'Hiệu ứng', 'Hiệu ứng', 'Grain, quét sáng, vignette — look cả khung. Chọn trái, chỉnh phải.', ready=True), AppModule('kho', 'Kho', 'Kho', 'Thư viện Ảnh · Khung · Video · Mẫu Text · Sticker — nạp rồi kéo lên timeline.', ready=True), AppModule('filters', 'Bộ lọc', 'Bộ lọc', 'Preset màu như CapCut — vivid, warm, cinematic…', ready=True), AppModule('transitions', 'Chuyển tiếp', 'Chuyển tiếp', 'Fade / cắt giữa các cảnh trên timeline Video.', ready=True), AppModule('preset', 'Cấu hình', 'Cấu hình', 'Build 1 lần (lớp phủ, mix, giọng, ngôn ngữ…) → lưu gói A→Z → đổi video / batch chỉ cần áp lại cấu hình.', ready=True), AppModule('batch', 'Xuất', 'Xuất', 'Mã hóa CPU/GPU, hàng đợi xuất và đặt tên file.', ready=True), AppModule('downloader', 'Nhập', 'Nhập', 'Tải video/MP3 từ nhiều nền tảng và thêm vào dự án.', ready=True), AppModule('summary', 'Tóm tắt nhanh', 'Tóm tắt', 'Xem nhanh toàn bộ cấu hình đang edit — bấm 1 dòng để nhảy tới chỗ sửa.', ready=True), AppModule('settings', 'Cài đặt', 'Cài đặt', 'Cấu hình xuất (CPU/GPU, codec) + preset, license, runtime.', ready=True))
LIBRARY_MODULE_IDS = frozenset({'tts', 'look', 'transitions', 'filters', 'media', 'kho', 'subtitle', 'preset', 'effects'})
TOOL_MODULE_IDS = frozenset({'summary', 'settings', 'batch', 'downloader'})
EDIT_RAIL_MODULE_IDS = frozenset({*LIBRARY_MODULE_IDS, 'summary'})

def module_by_id(module_id: str) -> AppModule:
    return next((module for module in APP_MODULES if module.id == str(module_id or '').strip()), APP_MODULES[0])

def is_library_module(module_id: str) -> bool:
    return str(module_id or '') in LIBRARY_MODULE_IDS

def is_tool_module(module_id: str) -> bool:
    return str(module_id or '') in TOOL_MODULE_IDS

def is_edit_rail_module(module_id: str) -> bool:
    return str(module_id or '') in EDIT_RAIL_MODULE_IDS