'Phân loại lỗi mạch phụ đề/TTS → trỏ đúng ô cấu hình trên UI.'
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class DubErrorFocus:
    __doc__ = 'field: api_key | provider | model | target_lang | stt_engine | tts_voice | subtitle_table | run | generic'
    field: 'str'
    inspector_tab: 'str'
    subtitle_part: 'str'
    hint: 'str'

def classify_dub_error(message: str) -> DubErrorFocus:
    text = str(message or '').strip()
    lowered = text.casefold()
    return DubErrorFocus('export', 'none', 'ai', 'Xuất video / FFmpeg (không phải mạch dịch). Xem last_export_ffmpeg_error.txt cạnh folder xuất') if any((token in lowered for token in ('ffmpeg', 'xuất video', 'encode', 'export video'))) else DubErrorFocus('generic', 'subtitles', 'ai', 'Phụ đề → Công cụ AI (xem log bước trước — không phải lúc nào cũng do khóa API)') if any((token in lowered for token in ('timeout', 'hết giờ', 'mạng', 'network', 'decode', 'giải mã'))) else DubErrorFocus('target_lang', 'subtitles', 'ai', 'Phụ đề → Công cụ AI → «Dịch sang» / Nhà cung cấp / Model') if any((token in lowered for token in ('ngôn ngữ', 'language', 'dịch sang', 'target lang'))) else DubErrorFocus('stt_engine', 'subtitles', 'ai', 'Phụ đề → Công cụ AI → «Cách đọc lời» / CapCut API') if 'groq' in lowered and any((token in lowered for token in ('whisper', 'stt', 'asr', 'cách đọc'))) or any((token in lowered for token in ('capcut', 'nghe giọng', 'stt'))) else DubErrorFocus('api_key', 'subtitles', 'ai', 'Phụ đề → Công cụ AI → Khóa API dịch (Lưu khóa / Kiểm tra API)') if any((token in lowered for token in ('api key', 'khóa api', '401', '403', 'unauthorized', 'sai key', 'invalid api'))) else DubErrorFocus('api_key', 'subtitles', 'ai', 'Phụ đề → Công cụ AI → Khóa API / đổi Nhà cung cấp hoặc Model') if any((token in lowered for token in ('quota', '429', 'rate limit', 'hết lượt', 'credit', 'billing'))) else DubErrorFocus('provider', 'subtitles', 'ai', 'Phụ đề → Công cụ AI → Nhà cung cấp dịch / Model dịch') if any((token in lowered for token in ('provider', 'model', 'nhà cung cấp', '404', 'not found'))) else DubErrorFocus('subtitle_table', 'subtitles', 'edit', 'Phụ đề → Sửa phụ đề (bảng câu) — hoặc chạy lại «Nghe giọng / CapCut API»') if any((token in lowered for token in ('phụ đề', 'subtitle', 'srt', 'bảng câu'))) else DubErrorFocus('tts_voice', 'audio', 'edit', 'Thuộc tính → Âm thanh → Giọng đọc (engine / voice)') if any((token in lowered for token in ('giọng', 'voice', 'tts', 'speech'))) else DubErrorFocus('run', 'subtitles', 'ai', 'Thư viện Media (cột trái) — thêm/chọn video trước') if any((token in lowered for token in ('chưa có video', 'chưa chọn video', 'thêm video', 'chưa có tài sản'))) else DubErrorFocus('generic', 'subtitles', 'ai', 'Phụ đề → Công cụ AI (kiểm tra cấu hình mạch dịch + giọng)')