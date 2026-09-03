/**
 * Voice Native — khởi động backend Voice Studio rồi cho Nova Studio nhúng UI.
 * Backend có thể là voice-backend/voice-studio; engine được chọn theo venv hợp lệ.
 * App gọi start() khi mở tab "Tạo giọng nói" → spawn uvicorn (nếu chưa chạy) → chờ health → trả URL.
 * Nội dung đã tách sang ./voice-native/ (paths → server, gộp ở index.js).
 * File này giữ đường require cũ của consumer (main/ipc/voice.js, main/lifecycle.js,
 * scripts/foundation-test.js, scripts/tts-demo.js, scripts/voice-live-test.js) và hợp đồng
 * module.exports 10 tên không đổi; từng là bản obfuscate của .plain — giờ là shim như
 * flow-native.js (scripts/protect.js đã bỏ target này).
 */
const M = require('./voice-native/index.js');
module.exports = M;
