'use strict';
/* ============================================================
   SRT TRANSLATE — PRESET THỂ LOẠI (main process, thuần Node)
   ------------------------------------------------------------
   Preset phong cách dịch theo thể loại nội dung (kể truyện,
   cổ trang, anime, phim Hàn, Âu Mỹ…). translateCues() ghép
   prompt thể loại vào SYSTEM prompt — AI chọn KHÔNG được tự
   đặt thể loại, chỉ user chọn tên preset trong UI (Luật 8).
   Thể loại rỗng/'' → không áp (dịch trung tính như trước).
   ID lạ → lỗi lộ liễu SRTT_GENRE_UNKNOWN (KHÔNG fallback ngầm
   về không-ap — Luật 10).
   Prompt chỉ thêm QUY TẮC THỂ LOẠI (xưng hô, tên riêng, giọng
   văn) — ràng buộc kỹ thuật (JSON, số phần tử, giữ timestamp)
   vẫn thuộc SYSTEM trong engine.js.
   ============================================================ */

const GENRES = {
  ke_chuyen: {
    label: 'Kể truyện / Tóm tắt phim',
    prompt: [
      'BỐI CẢNH: video KỂ TRUYỆN / TÓM TẮT PHIM — một giọng dẫn dắt toàn bộ, xen thoại nhân vật.',
      '★ LỜI DẪN: ngôi thứ ba (hắn, nàng, gã, y); trầm ấm, lôi cuốn, nhịp gọn tạo kịch tính; dùng "…" tạo khoảng lặng khi cần.',
      '★ THOẠI NHÂN VẬT: theo bối cảnh phim — hiện đại (mặc định) xưng đúng quan hệ; chỉ cổ trang khi ngữ cảnh xác nhận rõ.',
      '★ TỪ NỐI TRUYỆN: 他没想到→Hắn không ngờ | 就在这时→Đúng lúc này | 结果→Kết quả | 然而→Nhưng mà.',
      '★ TÊN RIÊNG: tên Trung → phiên Hán-Việt; tên Tây/tổ chức quốc tế → giữ nguyên.',
    ].join('\n'),
  },
  cot_trang: {
    label: 'Cổ trang / Tiên hiệp / Kiếm hiệp',
    prompt: [
      'BỐI CẢNH: phim CỔ TRANG / CUNG ĐẤU / TU TIÊN (dấu hiệu: Hoàng thượng, triều đình, giang hồ, tu vi).',
      '★ XƯNG HÔ: ta/ngươi/hắn/nàng; Trẫm/Bản vương/Bổn tọa; tên Trung phiên Hán-Việt.',
      '★ TUYỆT ĐỐI không lẫn từ hiện đại (tôi, bạn, OK, công ty, điện thoại).',
      '★ Chiêu thức/cảnh giới dịch thoát ý giữ chất võ hiệp; danh xưng tôn ti rõ (Hoàng thượng, Sư phụ, Tiền bối).',
    ].join('\n'),
  },
  anime: {
    label: 'Anime / Donghua',
    prompt: [
      'BỐI CẢNH: ANIME (Nhật), DONGHUA (Trung), hoạt hình.',
      '★ TÊN: tên Nhật GIỮ Romaji (Naruto, Tanjiro) — KHÔNG Hán-Việt hoá; tên Trung donghua → Hán-Việt (萧炎→Tiêu Viêm).',
      '★ KÍNH NGỮ quen thuộc GIỮ NGUYÊN: Senpai (Tiền bối), Sensei (Thầy), -sama (Ngài); KHÔNG thêm từ đệm Nhật (eto, ano) vào bản dịch.',
      '★ GIỌNG ĐIỆU: đời thường → nhẹ nhàng; shounen/chiến đấu → dứt khoát, máu lửa.',
    ].join('\n'),
  },
  han_quoc: {
    label: 'Phim Hàn Quốc',
    prompt: [
      'BỐI CẢNH: phim HÀN QUỐC — drama, tình cảm, xã hội.',
      '★ TÔN XƯNG LÀ TÍNH HIỆU QUAN HỆ: kính ngữ (yo/sum-ni-da) → thêm "ạ/dạ" + xưng khiêm; thân mật (banmal) → bỏ "ạ". Giữ đúng từng lần chuyển kính ↔ thân.',
      '★ DANH XƯNG: Sunbae→Tiền bối, 회장→Chủ tịch, 팀장→Trưởng phòng; xã hội/giang hồ → đại ca, tao/mày.',
      '★ TÊN RIÊNG: TUYỆT ĐỐI KHÔNG phiên Hán-Việt — giữ Latin (Lee Min Ho, Park); địa danh giữ nguyên (Seoul, Gangnam).',
      '★ LƯU Ý ASR: đuôi câu tiếng Hàn (yo, sum-ni-da) có thể bị nhận nhầm thành từ vô nghĩa → bỏ qua, dịch theo nghĩa chính.',
    ].join('\n'),
  },
  au_my: {
    label: 'Phim Âu Mỹ',
    prompt: [
      'BỐI CẢNH: phim ÂU MỸ (Hollywood, Netflix) — nguồn thường là bản thuyết minh/phụ đề tiếng Trung của phim gốc.',
      '★ XƯNG HÔ hiện đại: xã giao tôi/anh/cô; thân thiết tôi/cậu, anh/em; căng thẳng/kẻ thù tao/mày. KHÔNG dùng danh xưng Á Đông (huynh đệ, sư phụ, bệ hạ, ta, ngươi).',
      '★ TÊN RIÊNG: giữ nguyên 100% tên người/địa danh/tổ chức tiếng Anh (John, FBI, New York); TUYỆT ĐỐI KHÔNG phiên âm kiểu "Giôn", "Ma-ri"; giữ từ viết tắt khoa học/quân sự.',
      '★ Thán từ phương Tây: 该死→Chết tiệt, 上帝啊→Lạy Chúa, Buddy→Anh bạn.',
    ].join('\n'),
  },
  hai_kich: {
    label: 'Hài kịch / Giải trí',
    prompt: [
      'BỐI CẢNH: video HÀI / VUI NHỘN / GAMESHOW.',
      '★ Câu gọn sắc — chốt ĐÚNG punch line, không giải thích lời đùa (giải thích = chết tiếng cười).',
      '★ Khẩu ngữ tự nhiên, dùng thành ngữ/chơi chữ tiếng đích tương đương thay vì dịch chữ.',
      '★ Giữ nhịp: ưu tiên câu ngắn, cho phép phá cách nhẹ để giữ độ hài.',
    ].join('\n'),
  },
  kinh_di: {
    label: 'Kinh dị / Ly kỳ',
    prompt: [
      'BỐI CẢNH: KINH DỊ / LY KỲ / THRILLER.',
      '★ Câu NGẮN rợn; dùng "…" tạo suspense và khoảng lặng.',
      '★ Từ ngữ lạnh, chậm; tránh thoại giải thích dài — để im lặng làm việc.',
      '★ Giữ sự mơ hồ có chủ đích: không làm rõ điều nguyên tác cố giấu.',
    ].join('\n'),
  },
  hanh_dong: {
    label: 'Hành động / Cảm giác mạnh',
    prompt: [
      'BỐI CẢNH: HÀNH ĐỘNG / CẢNH NỔ / ĐỘT KÍCH.',
      '★ Câu DỨT KHOÁT, mạnh, mệnh lệnh; động từ mạnh, bỏ từ đệm.',
      '★ Cực ngắn theo nhịp cắt — mỗi dòng một hành động/hô lệnh.',
      '★ Tên súng/đơn vị tác chiến giữ nguyên tiếng gốc.',
    ].join('\n'),
  },
  tai_lieu: {
    label: 'Tài liệu / Review / Kiến thức',
    prompt: [
      'BỐI CẢNH: TÀI LIỆU / REVIEW / CHIA SẺ KIẾN THỨC — giọng dẫn trung tính.',
      '★ Chính xác thuật ngữ: giữ nguyên thuật ngữ khoa học/kỹ thuật chưa có từ đích phổ cập.',
      '★ Số liệu, đơn vị đo, tên riêng học thuật giữ nguyên; câu trần thuật mạch lạc, không hoa mỹ.',
      '★ Review: ngôi thứ nhất hoặc ba theo giọng bản gốc, giữ quan điểm/tông văn bản.',
    ].join('\n'),
  },
};

/* Trả { id, label, prompt } hoặc null khi không áp (''/undefined).
   ID lạ → ném lộ liễu SRTT_GENRE_UNKNOWN. */
function resolveGenre(id) {
  const key = String(id == null ? '' : id).trim();
  if (!key) return null;
  const g = GENRES[key];
  if (!g) {
    const e = new Error('Thể loại không hợp lệ: "' + key + '". Dùng một thể loại có trong danh sách hoặc để trống.');
    e.code = 'SRTT_GENRE_UNKNOWN';
    throw e;
  }
  return { id: key, label: g.label, prompt: g.prompt };
}

module.exports = { GENRES, resolveGenre };
