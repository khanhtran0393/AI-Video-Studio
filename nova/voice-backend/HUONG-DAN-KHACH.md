# Cài Giọng Nói AI (OmniVoice) cho Nova Studio

Giọng nói AI chạy **ngay trên máy bạn** — đọc bao nhiêu cũng **miễn phí**, không cần internet sau khi cài. Chỉ cài **1 lần**.

## Cần chuẩn bị
- **Mạng internet** + khoảng **5GB trống** (để tải thư viện + model).
- Python 3.11 — **script tự cài giúp** (Windows: qua winget; Mac: qua Homebrew). Không có sẵn cũng không sao.

> `setup-omni` sẽ **tự lo hết**: cài Python 3.11 (nếu thiếu) → cài thư viện AI → model tự tải khi tạo giọng lần đầu.

---

## Windows
1. **Tải** file nén voice-studio (link Nova Studio cung cấp) → **giải nén** ra 1 thư mục.
2. Vào thư mục đó, **double-click `setup-omni.bat`** → chờ cài xong (~vài phút, cửa sổ đen sẽ báo "XONG").
3. Mở **Nova Studio** → tab **Tạo giọng nói** → bấm **"📁 Đã cài — chọn thư mục voice-studio"** → chọn đúng thư mục vừa giải nén.
4. Xong! Bấm **Tạo giọng** — lần đầu model tự tải (~vài GB), các lần sau nhanh.

## Mac
1. **Tải** & **giải nén** voice-studio.
2. **Double-click `setup-omni.command`** (lần đầu macOS chặn → **chuột phải → Open → Open**).
3. Chờ cài xong.
4. Mở **Nova Studio** → **Tạo giọng nói** → **"📁 Đã cài — chọn thư mục"** → chọn thư mục voice-studio.

---

## Gặp lỗi?
- **"Không tìm thấy Python 3.11"** → chưa cài Python 3.11 hoặc quên tick "Add to PATH" (Windows). Cài lại rồi chạy `setup-omni` lần nữa.
- **Cài thư viện lỗi** → do mạng; chạy lại `setup-omni`.
- **Nova Studio vẫn báo chưa có backend** → bấm **"🔄 Kiểm tra lại"**, hoặc chọn lại đúng thư mục (thư mục phải chứa folder `backend`).

> Máy yếu (không GPU) vẫn chạy được, chỉ chậm hơn khi tạo giọng.
