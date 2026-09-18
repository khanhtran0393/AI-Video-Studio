/* ── Skill Catalog — Part 03/3 (4 entries) ──────────────────────
   Catalog v4 UPGRADED: 14 deep core skills + trường mới (visualHints,
   voiceUse, voiceAvoid, crosswalk, qaChecklist, personaVN, hookLabels).
   Nguồn duy nhất: nova/scripts/tmp/masters.js (gốc) + upgrade-data/e01..14.js.
   Nạp TRƯỚC `index.js` (concat) để tạo SKL_CATALOG toàn cục.
   Renderer KHÔNG build step: khai báo cấp đầu là var SKL_PART_NN. */
var SKL_PART_03 = [
  {
    "name": "CORE 11 · Nghệ thuật, Sân khấu & Hài — Ánh đèn sân khấu có bóng",
    "version": "v2",
    "topic": "Âm nhạc / Điện ảnh / Showbiz / Hài",
    "style": "Tự sự thuần · hậu trường",
    "role": "Persona ghép: Adam Moss (\"The Work of Art\" 2024 — quá trình làm tác phẩm từ trong ra) + W. Somerset Maugham (\"Theatre\" 1937 — sân khấu là nghề và là nghiện) + Steve Martin (\"Born Standing Up\" 2007 — hài là kỹ thuật của sự lùi lại). DISCLAIMER: writing frame — mọi tên nghệ sĩ thật chỉ dùng làm bối cảnh công khai, không bịa đời tư.",
    "audience": "Người xem 18–40 tuổi, fan The Voice, showbiz news, Stand-up Comedy Việt, kênh hậu trường; thích nghe chuyện \"trước khi lên đèn\" — luyện thế nào, vụng thế nào, giá của tiếng cười và tràng pháo tay là gì.",
    "voice": "Người kể là NGƯỜI TRONG HẬU TRƯỜNG: nói về gương, tay sẹo, dây đàn sờn, miếng băng dính trên sân khấu. Hài là THỜI GIAN đúng (timing), không phải lắm lời. Văn có nhịp trình diễn: câu dài — câu đột ngột ngắn — ngừng một nhịp.",
    "structure": [
      "1) Mở bằng MỘT HÀNH ĐỘNG LUYỆN TẬP điên khờ cụ thể (hát vào chén nước, đập bóng 10.000 lần, đứng gương 6 tiếng) — không mở bằng ánh hào quang.",
      "2) NGHỆ THUẬT là NGHỀ: tiền phòng trọ, ông bầu, chuyến xe khách 8 tiếng, tiếng cười nô lệ của khán giả — hào quang là phần trăm nhỏ, kể phần còn lại.",
      "3) Một TÁC PHẨM/BUỔI DIỄN là cột truyện: chuẩn bị → ra mắt → đánh giá — tác phẩm phải được mô tả đủ để người xem NGHE/THẤY được trong đầu.",
      "4) Cần mẫn vs TÀI NĂNG: nhân vật phụ có tài mà bỏ, nhân vật chính không đủ tài mà cần mẫn — truyện phải công bằng với cả hai, không bồi đắp ảo.",
      "5) Ánh đèn có bóng: mỗi thành công để lại MỘT MẤT MÁT riêng (sức khỏe, người thân, tính riêng, tuổi trẻ) — không có miễn phí.",
      "6) Hài/kịch là KỸ THUẬT: ghi rõ thủ thuật (để trống 3 nhịp, đổi giọng ở từ thứ 9, lùi lại sau tiếng cười) — người xem phải HỌC được một mẹo thật.",
      "7) Cú SÂN KHẤU: một buổi diễn thất bại/toàn thắng thay đổi người nghệ sĩ — thất bại phải có nguyên nhân nghề nghiệp cụ thể, không phải duyên không may.",
      "8) Kết: không phải đỉnh cao — là MỘT BỮA CƠM SAU DIỄN, một tin nhắn khán giả cũ, một chi tiết cho thấy nghề đã đi vào cơ thể nhân vật."
    ],
    "hookTemplates": [
      "\"Mười năm trong nghề, tôi học được: khán giả vỗ tay nhiều nhất không phải ở bài hay nhất — mà ở bài NGAY SAU bài hay nhất, vì tai họ chưa kịp hạ xuống. Người biết giữ tay mình ở khoảng hạ đó là người sống được bằng nghề.\"",
      "\"Suýt thành công là gì? Là 3 năm chờ một cú điện thoại. Điện thoại reo. Ông bầu nói: cậu có duyên — nhưng duyên đến từ chỗ nào, ta cũng không biết. Tôi ngồi hết gói thuốc, rồi bắt đầu luyện lần thứ hai.\"",
      "\"Người ta hỏi nghệ sĩ hài: đi làm là làm cười suốt sao? Ông già lão nghề trả lời: tôi có công việc buồn nhất — vì tôi phải biết trước người ta cười ở từ nào. Họ không cười, thì đó là lỗi của tôi.\""
    ],
    "rules": [
      "Nghệ thuật viết theo QUY TRÌNH LÀM VIỆC thật (luyện tập — ra mắt — phản hồi — sửa) — không viết \"tài năng trời cho bừng lên\".",
      "Mỗi thành công phải có MỘT MẤT MÁT song hành (sức khỏe, tình thân, tính riêng) — hào quang không miễn phí.",
      "Thủ thuật trình diễn phải CỤ THỂ và học được (timing, khoảng lặng, lùi nửa bước) — người xem rời truyện phải mang được một mẹo.",
      "Tài năng vs cần mẫn xử lý công bằng: truyện không hứa \"cần mẫn thắng tài năng\" và cũng không hứa \"tài năng thắng tất cả\" — nó kể giá của mỗi lựa chọn.",
      "Tên nghệ sĩ thật chỉ dùng ở tầng bối cảnh công khai; không bịa đời tư người thật.",
      "Kết không phải đỉnh cao — là một chi tiết hậu trường cho thấy nghề đã THẤM vào con người nhân vật."
    ],
    "antiPatterns": [
      "✗ \"Đêm đó, cả khán phòng đứng dậy\" như kết mặc định — tràng pháo tay không phải cấu trúc.",
      "✗ Tài năng hiện ra tự nhiên không qua luyện — vi phạm hợp đồng \"nghệ là nghề\".",
      "✗ Hài được kể bằng cách ghi chú \"và mọi người cười\" — không ghi rõ thủ thuật thì không có gì để cười.",
      "✗ Kẻ xấu là ông bầu giấu mặt kiếm tiền — người bầu phải là người có bài toán thật.",
      "✗ Kết hoàn hảo cả sự nghiệp lẫn đời tư — hào quang trọn vẹn là nói dối.",
      "✗ Bịa chuyện đời tư nghệ sĩ thật (tan vỡ, trầm cảm) — cấm tuyệt đối."
    ],
    "examples": {
      "hook": "\"Anh thầy dạy tôi kỹ thuật đầu tiên của sân khấu: đừng bao giờ diễn TRONG đèn — hãy diễn ở mép bóng của đèn, chỗ khán giả phải nheo mắt mới thấy em. Bốn mươi năm sau tôi mới hiểu: đó cũng là cách để sống sót trong nghề này.\"",
      "outro": "\"Buổi diễn cuối, ông không hát bài lớn. Ông hát bài ru của mẹ, đúng nốt chữ E mà ông từng hát sai khi mười bảy tuổi ở quán đậu. Lần này không sai. Không ai vỗ tay ồn. Vài người già trong góc khóc. Ông tắt micro, và lần đầu tiên trong 40 năm — ông về nhà trước nửa đêm.\""
    },
    "instructions": "ÁNH ĐÈN SÂN KHẤU CÓ BÓNG: nhóm này kể NGHỀ NGHỆ THUẬT như một nghề nghiêm túc, không như giấc mơ lấp lánh. Moss dạy: hỏi nghệ sĩ \"bạn làm gì khi tác phẩm không ra\" — câu trả lời là cốt truyện thật; viết QUÁ TRÌNH (luyện — ra — phản hồi — sửa) với con số cụ thể. Maugham dạy: sân khấu là nghề và là nghiện — cho thấy sự nghiện bằng hành vi (về nhà vẫn đứng trước gương). Martin dạy: hài là kỹ thuật của sự LÙI LẠI — đứng trước 3.000 người mà dám để trống 3 nhịp; ghi rõ thủ thuật để người xem học được. Hài viết đúng = ghi timing như ghi nhạc: từ thứ mấy, ngừng bao lâu, giọng hạ bao nhiêu. Kết không phải đỉnh vinh quang — là một chi tiết cho thấy nghề đã thấm vào cơ thể (vết chai, thói quen, tiếng gõ cửa lúc nửa đêm). Cấm bịa đời tư người thật. Kiểm tra cuối: người xem có LUYỆN THỬ một thứ gì đó sau khi xem không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "đỏ nhung",
        "vàng đèn sân khấu",
        "đen hậu trường",
        "bạc kim loại",
        "tím mộng",
        "trắng đèn spotlight"
      ],
      "wardrobe": [
        "vest hơi nhăn sau buổi diễn",
        "áo sơ mi trắng cởi cúc",
        "đồ diễn viên lấm lem",
        "áo thun band",
        "giày cao gót hậu trường",
        "áo khoác len hát đám tang"
      ],
      "locations": [
        "sân khấu khi chưa lên đèn",
        "hậu trường có gương",
        "phòng tập nhỏ",
        "quán cà phê ban đêm",
        "phòng thu âm",
        "xe khách đêm diễn xa"
      ],
      "camera": "medium theo HÀNH ĐỘNG LUYỆN (đập bóng, hát vào chén, đứng gương) + slow-mo khi lên đèn; close-up ĐÔI TAY (ngón tay trên phím, tay cầm micro).",
      "fx": "đèn spotlight chập chờn; tiếng vỗ tay xa; tiếng micro feedback; ánh nến hậu trường; tiếng bước chân trên sàn gỗ; tiếng đàn luyện tập giờ khuya.",
      "props": [
        "micro có dây",
        "đàn guitar cũ",
        "gương tập",
        "kịch bản sờn gáy",
        "rượu nhỏ sau diễn",
        "vé cũ"
      ]
    },
    "voiceUse": [
      "Hài là THỜI GIAN (timing) — ghi rõ từ thứ mấy, ngừng bao lâu, giọng hạ bao nhiêu.",
      "Đứng trước 3.000 người mà dám để trống 3 nhịp — đó là kỹ thuật.",
      "Câu dài — câu ngắn đột ngột — ngừng một nhịp (nhịp trình diễn).",
      "Người kể là NGƯỜI TRONG HẬU TRƯỜNG: gương, tay sẹo, dây đàn sờn, băng dính trên sàn.",
      "Kết không phải đỉnh cao — là MỘT BỮA CƠM SAU DIỄN, tin nhắn khán giả cũ."
    ],
    "voiceAvoid": [
      "\"Đêm đó, cả khán phòng đứng dậy\" như kết mặc định — tràng pháo tay không phải cấu trúc.",
      "Tài năng hiện ra tự nhiên không qua luyện — vi phạm hợp đồng \"nghệ là nghề\".",
      "Hài được kể \"và mọi người cười\" — không ghi rõ thủ thuật thì không có gì để cười.",
      "Kẻ xấu là ông bầu giấu mặt kiếm tiền — người bầu phải có bài toán thật.",
      "Kết hoàn hảo cả sự nghiệp lẫn đời tư — hào quang trọn vẹn là nói dối.",
      "Bịa chuyện đời tư nghệ sĩ thật (tan vỡ, trầm cảm) — cấm tuyệt đối."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 09 · Nghề nghiệp & Chuyên môn",
        "CORE 06 · Chiến trường & Đối kháng",
        "CORE 10 · Tình yêu & Khoảng cách"
      ],
      "contrastWith": [
        "CORE 09 (CORE 09 nghề tĩnh; CORE 11 nghề có ÁNH ĐÈN — kèm theo MẤT MÁT)",
        "CORE 06 (CORE 06 cơ thể chiến đấu; CORE 11 cơ thể BIỂU DIỄN — cũng trả giá)"
      ],
      "genre": "Âm nhạc / sân khấu / hài / điện ảnh — hào quang có bóng",
      "forbidMix": "CẤM bịa đời tư nghệ sĩ thật. CẤM dùng nghệ sĩ thật làm nhân vật chính (chỉ dùng ở tầng bối cảnh)."
    },
    "qaChecklist": [
      "✓ Mở bằng HÀNH ĐỘNG LUYỆN cụ thể, không mở bằng hào quang?",
      "✓ Tác phẩm/buổi diễn được mô tả đủ để người xem NGHE/THẤY trong đầu?",
      "✓ Mỗi thành công có MẤT MÁT song hành (sức khỏe/tình thân/tính riêng)?",
      "✓ Thủ thuật trình diễn CỤ THỂ (timing, khoảng lặng, lùi nửa bước) — người xem học được?",
      "✓ Tài năng vs cần mẫn xử lý CÔNG BẰNG — không phe nào thắng?",
      "✓ Tên nghệ sĩ thật chỉ ở tầng bối cảnh — không bịa đời tư?",
      "✓ Kết không phải đỉnh cao — là chi tiết hậu trường cho thấy nghề đã THẤM?",
      "✓ Có ÍT NHẤT 1 mẹo thật người xem mang đi được (Moss/Martin)?"
    ],
    "personaVN": "Nghệ thuật Việt: cải lương (NSƯT Thanh Nga — cẩn thận bịa), bài chòi (Bình Định), hát chầu văn, hài kịch Saigon (Trấn Thành — bối cảnh OK, đời tư KHÔNG), dân ca. Tận dụng chi tiết hậu trường Việt: rạp hát, gánh hát, đờn ca tài tử. CẤM gọi hài kịch = \"nghệ thuật cao cấp\" mà quên mồ hôi hậu trường.",
    "hookLabels": [
      "hành-động-luyện",
      "timing-là-kỹ-thuật",
      "hào-quang-có-bóng",
      "bữa-cơm-sau-diễn"
    ],
    "negativePrompts": [
      "nghệ sĩ thành công sau một buổi diễn",
      "hài kịch dựa trên nhại lại và tai nạn",
      "hậu trường yên tĩnh và lãng mạn",
      "đạo diễn hoàn hảo không có lần thứ hai",
      "khán giả chỉ vỗ tay vì cảm xúc ăn ý"
    ],
    "seedQuestions": [
      "Câu nói nào trong vở kịch này khiến diễn viên thật sự đau?",
      "Bóng tối sau ánh đèn trông như thế nào với người trong nghề?",
      "Có ai đang diễn cả với khán giả lẫn đồng nghiệp?",
      "Nếu vở diễn thất bại đêm nay, ai sẽ mất việc — và tại sao?"
    ],
    "pacing": {
      "tempo": "hậu-trường-nhịp-nhanh-có-pha-chậm",
      "beatMap": [
        "mở bằng chuẩn bị",
        "hài đến bằng timing",
        "leo thang qua sự cố thật",
        "hạ cánh bằng khoảnh khắc không ai nhìn"
      ]
    },
    "voiceSample": "Khán giả cười — nhưng tôi quên mất câu thứ 3, và ba giây im lặng đó là cả một đêm mất ngủ của diễn viên phụ vai tôi."
  },
  {
    "name": "CORE 12 · Ẩm thực, Đất & Mùa vụ — Mỗi món, mỗi mùa là câu chuyện người làm ra",
    "version": "v2",
    "topic": "Ẩm thực / Nông nghiệp / Ngư nghiệp / Làm vườn",
    "style": "Tự sự thuần · có mùi có vị",
    "role": "Persona ghép: Anthony Bourdain (\"Kitchen Confidential\" 2000 — bếp là chiến hạm, món ăn là gặp gỡ con người) + Ruth Reichl (\"Garlic and Sapphires\" 2005 — vị ngon là ký ức) + 刘亮程 Lưu Lượng Trình (\"一个人的村庄\" 1998 — đất và con vật dạy chậm). DISCLAIMER: writing frame — mọi công thức/mùa vụ phải khớp thực tế Việt Nam/Đông Á, không bịa nguyên liệu hay canh tác vô lý.",
    "audience": "Người xem 25–55 tuổi, fan MasterChef, vlog nông thôn, kênh làm vườn, Bourdain; thích mùi khói, tiếng xào, mùa màng; ghét \"món ăn thần thánh không công thức\" và ghét kịch tính gượng ép trong bếp.",
    "voice": "Có MÙI, CÓ TIẾNG, CÓ VỊ: xèo xèo, mùi mắm, tay dính bột. Người nấu kể bằng TAY (cách cầm dao, cách nhấn muỗng), người làm đất kể bằng THỜI GIAN TRỜI (sau cơn mưa thứ hai, trước tết Hàn thực). Thuật ngữ ẩm thực và nông vụ thật, không giải thích sổ sách.",
    "structure": [
      "1) Mở bằng MỘT MÓN ĐANG NẤU hoặc MỘT MÙA ĐANG TRỔI — mùi, tiếng, bàn tay. Không giải thích bối cảnh trước.",
      "2) Mỗi bước làm = 1 phần câu chuyện: người nấu/người trồng kể qua tay (Bourdain: đầu bếp kể qua cách cầm dao; Lưu Lượng Trình: nông dân kể qua vết cuốc).",
      "3) Mỗi nhân vật phụ mang theo MỘT MÓN/MỘT MÙA của quê mình — bàn ăn/cánh đồng là cuộc họp của nhiều quê hương, nhiều đời người.",
      "4) Xung đột là nhịp thật của nghề: một vụ mất vì mưa muộn, một bữa lợ vì người vắng, một quán hụt khách vì đổi đường — không thêm đốt nhà, cướp đất, tai nạn xe.",
      "5) Loop \"ai dạy người này làm\" — gieo 2-3 lần, mỗi lần một người thầy (mẹ, bà, ông chủ quán cũ); giải bằng một CÂU CHUYỆN CỤ THỂ, không phải \"bà tôi dạy tôi\".",
      "6) Công thức/mùa vụ phải THẬT và test được (nguyên liệu, thời gian, canh nông thật) — sai một chi tiết mất toàn bộ niềm tin.",
      "7) Cao trào là MỘT BỮA/MỘT VỤ HOÀN THÀNH — kết quả không hoàn hảo: cơm hơi nhão, vụ bội nhưng giá tụt — và vẫn được ăn/được gặt.",
      "8) Kết: vị ngon = người cùng ăn, không phải nguyên liệu (Reichl); đất không hứa hẹn, đất chỉ trả công theo công (Lưu Lượng Trình) — câu cuối để lại một mùi."
    ],
    "hookTemplates": [
      "\"Ông nấu 30 năm. Ông phục vụ 1 triệu suất. Ông chỉ nhớ 3 món: món mẹ nấu, món người yêu cũ nấu, và món ông sẽ nấu hôm nay. Món này không có tên — ông đặt theo tên người sẽ ăn.\"",
      "\"Sau cơn mưa thứ hai của tháng Chạp, ông già đào mương hơn phải ra ruộng nhìn 10 phút rồi về. Bà vợ không hỏi. Bà đã hiểu: vụ này khó. Bà chỉ thêm một nắm muối vào nồi cám heo.\"",
      "\"Công thức viết tay năm 1975, mực đã nhòe: \"Bún bò: 5 lít nước, 1 kg xương, 200g mắm ruốc.\" Dòng cuối cùng ghi: \"Tình yêu — 1 muỗng canh. Không thiếu được.\"",
      "\"Đứa trẻ nói: \"Con muốn ăn cơm với mẹ.\" Không ai trong bàn hiểu. Mẹ khóc lúc rửa bát. Cơm nguội.\""
    ],
    "rules": [
      "MỖI món ăn/mùa vụ phải có CÔNG THỨC/công canh thật — nguyên liệu, bước, thời gian; sai 1 chi tiết = mất uy tín (Bourdain).",
      "Người nấu/người trồng phải có LÝ DO làm — luôn có một người để làm cho (Reichl).",
      "Mỗi nhân vật phụ có 1 món/1 mùa riêng của quê họ — không \"ai cũng thích phở\".",
      "Bữa ăn/mùa gặt phải có XUNG ĐỘT nhịp đời thật (người vắng, giá tụt, mưa lệch) — không kịch tính giả.",
      "Viết bằng GIÁC QUAN: mỗi món có mùi, tiếng, vị; mỗi mùa có nắng, nước, bụi — không tả bằng tính từ chung.",
      "Loop \"ai dạy làm\" giải bằng 1 câu chuyện cụ thể có tên riêng, có năm, có món đó."
    ],
    "antiPatterns": [
      "✗ \"Món ăn thần thánh bí truyền\" không công thức — ẩm thực không phải phép màu.",
      "✗ Công thức sai thật (tỷ lệ, thời gian, nguyên liệu không tồn tại) — người biết ẩm thực tắt ngay.",
      "✗ Bếp/cánh đồng chỉ làm phông cho tình yêu/kịch tính — món phải là chủ ngữ.",
      "✗ Tả món bằng chuỗi tính từ (\"ngon tuyệt, đậm đà\") — tả bằng mùi, tiếng, hành động tay.",
      "✗ Thêm tội ác/tai nạn để \"đổi vị\" — nhịp nghề đã đủ căng.",
      "✗ Kết \"món này ngon nhất thế giới\" — vị ngon là của người ăn, không phải của người kể."
    ],
    "examples": {
      "hook": "\"Nồi phở của cụ bắc lúc 3 giờ sáng, đúng 30 năm. Khách quen hỏi bao giờ cụ nghỉ. Cụ đáp: khi nào tìm được người nấu đúng nốt nước ngọt. Nốt nước ngọt là gì? Cụ cười: là lúc nước trong vắt nhưng không in thấy mặt mình — chuyện đó phải trải qua mất một người mới hiểu.\"",
      "outro": "\"Vụ lúa cuối cùng trước khi đất chuyển đổi, ông gặt bằng tay, từ trái sang phải, như ba mươi năm trước. Hết ruộng, ông đứng ở mé, gieo lại một nắm lúa vào đất mới — đất đó sắp thành khu nhà. Ông nói với con trai: để coi nó dám mọc không. Câu đó không phải cho cây lúa.\""
    },
    "instructions": "MỖI MÓN/MỖI MÙA LÀ CÂU CHUYỆN CỦA NGƯỜI LÀM RA NÓ. Nguyên tắc: (1) món ăn/đất là CHỦ NGỮ — truyện không mượn bếp để kể chuyện khác; (2) kể qua TAY: cách cầm dao, cách nhấn muỗng, cách bắt sâu — tay chân kể trung thực hơn miệng; (3) Bourdain dạy: bếp là chiến hạm — có cấp bậc, có mùi mồ hôi, có tiếng la; đừng tả bếp như tivi quảng cáo; (4) Reichl dạy: vị ngon là ký ức — món nào cũng có một người đứng sau; (5) Lưu Lượng Trình dạy: đất không hứa hẹn — nông nghiệp là nghề của thời gian trời, xung đột hay nhất là mưa lệch, giá tụt, người vắng. Công thức phải THẬT và test được: nguyên liệu, thời gian, canh nông đúng vùng miền. Loop \"ai dạy làm\" là trục ký ức: giải bằng một con người có tên, có năm, có món. Kết để lại một MÙI, không phải một bài học. Kiểm tra cuối: người xem có ĐÓI hoặc muốn gọi điện về nhà không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "vàng nghệ",
        "đỏ gạch",
        "xanh lá mùa vụ",
        "nâu đất",
        "trắng sữa",
        "cam lửa bếp"
      ],
      "wardrobe": [
        "tạp dề vải dày",
        "khăn rằn",
        "áo bà ba",
        "mũ lá",
        "tay áo xắn lên",
        " dép tổ ong"
      ],
      "locations": [
        "bếp củi giữa vườn",
        "chợ phiên sáng sớm",
        "ruộng lúa lúc vàng",
        "lò nướng truyền thống",
        "bến thuyền mùa cá",
        "vườn rau nhà bà"
      ],
      "camera": "close-up TAY LÀM (tay cầm dao, tay nhấn muỗng, tay bắt sâu) — tay chân kể trung thực hơn miệng. Slow-mo khi nguyên liệu chạm nước sôi; wide khi cả cánh đồng.",
      "fx": "tiếng nước sôi lục bục; tiếng dao chạm thớt; mùi khói bếp; tiếng gió qua ruộng; tiếng giã chàm; ánh nắng sớm trên lá.",
      "props": [
        "nồi đất",
        "chày cối đá",
        "mẹt tre",
        "bó rau mùi",
        "cá tươi trong rổ",
        "bình vôi ăn trầu"
      ]
    },
    "voiceUse": [
      "Mỗi món/mùa có TÊN RIÊNG, NĂM, VÙNG — cụ thể đến mức người trong nghề gật.",
      "Viết bằng GIÁC QUAN: mùi, tiếng, vị; mỗi mùa có nắng, nước, bụi.",
      "Công thức THẬT và test được: nguyên liệu, thời gian, canh nông đúng vùng miền.",
      "Câu có SỐ LIỆU (giờ, kg, mm mưa, %) — nông nghiệp đo bằng số.",
      "Kết để lại MÙI, không phải bài học."
    ],
    "voiceAvoid": [
      "\"Món ăn thần thánh bí truyền\" không công thức — ẩm thực không phải phép màu.",
      "Công thức sai thật (tỷ lệ, thời gian, nguyên liệu không tồn tại) — người biết ẩm thực tắt ngay.",
      "Bếp/cánh đồng chỉ làm phông cho tình yêu/kịch tính — món phải là CHỦ NGỮ.",
      "Tả món bằng chuỗi tính từ (\"ngon tuyệt, đậm đà\") — tả bằng mùi, tiếng, hành động tay.",
      "Thêm tội ác/tai nạn để \"đổi vị\" — nhịp nghề đã đủ căng.",
      "Kết \"món này ngon nhất thế giới\" — vị ngon là của người ăn, không phải của người kể."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 08 · Đời thường & Chữa lành",
        "CORE 10 · Tình yêu & Khoảng cách",
        "CORE 14 · Sự thật, Tri thức & Ký ức"
      ],
      "contrastWith": [
        "CORE 08 (CORE 08 bữa cơm là SÂN KHẤU; CORE 12 món ăn là CHỦ NGỮ — quay quanh món, không quay quanh người ăn)",
        "CORE 14 (CORE 14 tài liệu về NGUYÊN LÝ; CORE 12 thực hành về CÁCH LÀM)"
      ],
      "genre": "Ẩm thực / nông nghiệp / mùa vụ — mỗi món, mỗi mùa là câu chuyện người làm ra",
      "forbidMix": "CẤM dùng bếp/cánh đồng làm phông cho tình yêu. CẤM công thức sai. CẤM thêm yếu tố siêu nhiên trừ khi đề tài."
    },
    "qaChecklist": [
      "✓ Mỗi món/mùa có CÔNG THỨC/CÔNG CANH thật (nguyên liệu, bước, thời gian)?",
      "✓ Người nấu/trồng có LÝ DO làm (luôn có 1 người để làm cho — Reichl)?",
      "✓ Mỗi nhân vật phụ có 1 món/1 mùa riêng (không \"ai cũng thích phở\")?",
      "✓ Bữa ăn/mùa gặt có XUNG ĐỘT nhịp đời thật (người vắng, giá tụt, mưa lệch)?",
      "✓ Viết bằng GIÁC QUAN (mỗi món có mùi, tiếng, vị)?",
      "✓ Loop \"ai dạy làm\" giải bằng 1 câu chuyện cụ thể có tên riêng, có năm?",
      "✓ Kết để lại MÙI, không phải bài học?",
      "✓ Người xem có ĐÓI hoặc muốn gọi điện về nhà? (kiểm tra cuối)"
    ],
    "personaVN": "Ẩm thực Việt là VÀNG — phở Hà Nội (công thức ninh xương đúng), bún bò Huế, cơm tấm Sài Gòn, bánh xèo, lẩu mắm. Nông nghiệp: lúa Tây Ninh, cà phê Buôn Ma Thuột, hồ tiêu Phú Quốc. CẤM dùng \"nước mắm Phú Quốc\" khi viết vùng khác. CẤM bịa món (vd: \"phở bò Kobe\").",
    "hookLabels": [
      "người-để-làm-cho",
      "mùa-lệch-nhịp",
      "công-thức-thật",
      "mùi-ở-lại"
    ],
    "negativePrompts": [
      "đầu bếp nấu ngon nhờ cảm hứng mà không giải thích",
      "món ăn hoàn hảo từ lần thử đầu tiên",
      "nông dân thu hoạch xong là kết thúc mùa",
      "ngư dân đánh cá như du lịch",
      "thực phẩm chỉ là thứ để ăn"
    ],
    "seedQuestions": [
      "Món này mất bao lâu để có nguyên liệu — và ai trả giá?",
      "Mùa này khác mùa trước ở điểm nào mà chỉ người làm biết?",
      "Có bao nhiêu bàn tay đã chạm vào thứ trên đĩa?",
      "Nếu mất mùa này, ai sẽ phải đổi nghề — và đứa trẻ nào theo?"
    ],
    "pacing": {
      "tempo": "có-mùi-có-vị-nhịp-thở-đất",
      "beatMap": [
        "mở bằng buổi sáng mùa vụ",
        "leo thang qua công đoạn cụ thể",
        "đỉnh điểm = món ăn đến bàn ăn",
        "hạ cánh bằng khoảng nghỉ"
      ]
    },
    "voiceSample": "Mẹ tôi ướp muối ba ngày, phơi sương hai đêm — tôi chỉ nấu 40 phút, nhưng 40 phút đó bắt đầu từ một buổi chiều mà tôi không có mặt."
  },
  {
    "name": "CORE 13 · Thời gian, Thực tại & Những phiên bản khác — Luật vòng lặp cứng, phép thử đạo đức",
    "version": "v2",
    "topic": "Vòng lặp / Xuyên không / Đồng nhân / Hoán đổi thân phận",
    "style": "Tự sự thuần · nghĩ cho người xem",
    "role": "Persona ghép: Ted Chiang (\"Story of Your Life\" 1998 — biết trước vẫn đi) + Danny Rubin (\"Groundhog Day\" 1993 — vòng lặp là phép thử đạo đức) + Kazuo Ishiguro (\"The Buried Giant\" 2015 — ký ức bị mờ là ký ức được chọn). DISCLAIMER: writing frame — luật thời gian phải tự nhất quán; không dùng xuyên không để giải thích mọi chuyện tùy tiện.",
    "audience": "Người xem 16–35 tuổi, fan Everything Everywhere, Your Name, xuyên không TQ, đồng nhân; thích câu hỏi \"nếu biết trước sẽ làm khác không\", thích tách luật vòng lặp như chơi game có quy tắc.",
    "voice": "Người kể ĐẾM LẦN: lần thứ nhất, lần thứ bảy, lần thứ hai mươi — mỗi lần kể ngắn hơn lần trước vì người xem đã biết (chỉ nêu ĐIỂM KHÁC). Lệch hiện thực được nêu bằng chi tiết nhỏ (lá thư có mực khác, bài hát có một chữ chưa từng viết).",
    "structure": [
      "1) Mở bằng 1 SỰ LỆCH hiện thực nhỏ rồi mới nêu LUẬT lệch (quay lại, xuyên vào, hoán đổi, lặp) — luật phải NÓI RÕ ngay đầu: điều gì lặp, điều gì giữ, điều gì mất.",
      "2) LUẬT CỨNG: vòng lặp/xuyên thủ có giới hạn rõ (số lần, điều kiện mở lại, chi phí) — luật càng hẹp, truyện càng hay; luật dùng để thắng phải gieo trước.",
      "3) Mỗi lần lặp/xuyên KHÔNG kể lại — chỉ kể điểm khác + hệ quả khác; người xem được tin tưởng là đã nhớ.",
      "4) Phép thử đạo đức là trục: lần đầu nhân vật dùng lệch thực vì mình, lần giữa vì người khác, lần cuối TỪ CHỐI dùng — tiến trình này là nhân vật arc.",
      "5) HIỆU ỨNG CHUYỀN VÍA: hành động ở phiên bản khác rách sang phiên bản này (vết thương theo người, người nhớ điều chưa xảy ra) — cài từ sớm, dùng ở cao trào.",
      "6) Nhân vật phụ LUÔN có quyền riêng: một người trong vòng lặp không cùng luật với nhân vật chính — họ cũng đang lựa chọn, và lựa chọn của họ phải bất ngờ.",
      "7) Cú kết của luật: nhân vật phải TRẢ LUẬT (nhận mất ký ức, mất người, ở lại phiên bản kém hơn) — không có kết \"sửa như cũ và mọi người quên hết\".",
      "8) Đồng nhân/xuyên sách: nhân vật ngoài biết KẾT — giá trị của truyện không phải thay kết mà là giải thích điều bản gốc không nói; phải tôn trọng logic bản gốc."
    ],
    "hookTemplates": [
      "\"Lần thứ nhất, tôi chết ở cây cầu lúc 11:47. Lần thứ hai, tôi sống — và phát hiện mình phải mang hộ người khác một ký ức không thuộc về tôi. Lần thứ bảy, tôi bắt đầu hiểu: cây cầu không giết tôi. Cây cầu chỉ đếm.\"",
      "\"Tôi mở mắt trong cuốn tiểu thuyết tôi đọc 3 lần. Điều đầu tiên tôi làm không phải cứu nhân vật chính. Tôi đi tìm nhân vật phụ chết ở chương 4 — vì tôi là người duy nhất nhớ cô ấy tên gì.\"",
      "\"Ngày thứ hai trùng khít ngày thứ nhất: mưa lúc 4:40, xe buýt trễ 12 phút, mẹ hỏi cùng một câu cùng một ngữ điệu. Không phải ngày lặp lại. Là TÔI lặp lại — và chỉ một thứ duy nhất không lặp: cái cân trong đầu, mỗi sáng nặng thêm 1 ký.\"",
      "\"Chiếc điện thoại gọi về từ 20 năm sau. Người bên kia chỉ hỏi một câu: \"Bố mẹ có còn ở nhà không?\" — và tôi nhận ra nó không hỏi người tôi. Nó hỏi người tôi sẽ trở thành.\""
    ],
    "rules": [
      "Luật lệch thực tại NÊU RÕ ngay đầu: điều gì lặp, giữ, mất, phí là gì — không để luật \"mọc\" giữa truyện.",
      "Mọi khả năng thắng bằng luật phải gieo ít nhất 2 lần trước khi dùng — cùng nguyên tắc của kỳ ảo cứng.",
      "Không kể lại nguyên chuỗi ở lần lặp sau — chỉ nêu điểm khác và hệ quả khác.",
      "Phép thử đạo đức bắt buộc 3 mức: dùng vì mình → dùng vì người khác → TỪ CHỐI dùng — arc nhân vật nằm ở đó.",
      "Nhân vật phụ phải có quyền hành động theo luật riêng của họ, và hành động đó phải thay đổi phương án của nhân vật chính.",
      "Kết phải TRẢ GIÁ: không có kết \"sửa xong như cũ, mọi người quên hết, không ai mất gì\".",
      "Đồng nhân/xuyên sách: tôn trọng logic bản gốc; bổ sung điều gốc thiếu, không bẻ kết gốc theo ý thích."
    ],
    "antiPatterns": [
      "✗ Luật lỏng đến mức mọi vấn đề đều dùng xuyên không giải — luật lệch thực là dao có chuôi, không phải cây đũa thần.",
      "✗ Kể lại nguyên chuỗi mỗi lần lặp — người xem chán trước lần thứ ba.",
      "✗ Kết \"quay về như cũ\" không trả giá — vi phạm hợp đồng trọng lượng của nhóm.",
      "✗ Nhân vật phụ là bối cảnh — người trong vòng lặp phải cũng đang LỰA CHỌN.",
      "✗ Xuyên sách nhưng phá nhân vật gốc để \"gột rửa\" — hiểu sai cả thể loại.",
      "✗ Chi phí xuyên không biến mất không lời giải (lần đầu mất ký ức, sau đó đâu không thấy)."
    ],
    "examples": {
      "hook": "\"Quy tắc vòng lặp của tôi chỉ một câu: mỗi lần quay lại, mất đúng một ký ức, không chọn được ký ức nào. Lần thứ mười, tôi đứng trước người mình cần cứu — và không nhớ nổi vì sao tôi muốn cứu. Tôi vẫn cứu. Có lẽ đó mới là tôi thật.\"",
      "outro": "\"Lần cuối, tôi để đồng hồ chạy tiếp qua 11:47. Không có gì xảy ra. Cây cầu mưa, người qua lại, xe buýt trễ 12 phút. Tôi về nhà, ghi sổ: lần này, không ai cần tôi trở lại — và lần đầu tiên, tôi tin mình đã sống xong một ngày.\""
    },
    "instructions": "LỆCH THỰC TẠI LÀ PHÉP THỬ ĐẠO ĐỨC CÓ LUẬT, không phải cỗ máy sửa sai. Quy trình: (1) chọn loại lệch (lặp, xuyên, hoán đổi, đồng nhân) và viết LUẬT THÀNH MỘT CÂU — nếu không viết được một câu thì luật chưa xong; (2) đặt chi phí cụ thể (mỗi lần quay lại mất một ký ức; xuyên vào phải sống đúng nhân vật ấy); (3) kể lần đầu DÀI, các lần sau CHỈ NÊU ĐIỂM KHÁC — người xem là cộng sự; (4) chạy phép thử đạo đức 3 mức (vì mình → vì người → từ chối dùng); (5) kết phải TRẢ LUẬT: nhân vật mất thứ thật để đổi thứ thật. Chiang dạy: biết trước tương lai không bớt nỗi đau, chỉ đổi loại nỗi đau. Rubin dạy: Groundhog Day hay không vì lặp, mà vì mỗi lần lặp là một lựa chọn đạo đức mới. Đồng nhân dạy: giá trị là giải thích điều gốc không nói, không phải viết lại cho đúng ý mình. Kiểm tra cuối: người xem có thể TÓM TẮT LUẬT của truyện trong một câu không? Không — thì luật chưa xong.",
    "visualHints": {
      "colorPalette": [
        "trắng sương",
        "xanh dương cổ điển",
        "vàng nắng sớm",
        "xám kim loại",
        "đen thẳm đứng",
        "tím violet"
      ],
      "wardrobe": [
        "áo sơ mi đồng phục cũ",
        "áo khoác kỷ niệm",
        "đồng phục cấp 3",
        "áo blouse trắng tay áo cuộn",
        "đồ ngủ 3h sáng"
      ],
      "locations": [
        "cây cầu quen thuộc",
        "lớp học lúc tan",
        "quán quen nhưng khác bố trí",
        "phòng khách có đồng hồ cũ",
        "sân ga lúc 11:47",
        "con hẻm dẫn về ký ức"
      ],
      "camera": "đặt lại CÙNG MỘT KHUNG HÌNH nhiều lần (mỗi vòng) — cho người xem THẤY chỗ khác, không cần kể. Khi vòng lặp đổi kết quả: cut jump — không transition.",
      "fx": "tiếng đồng hồ tick; tiếng kẹp cửa; ánh sáng thay đổi theo giờ; mưa trong cùng 1 cảnh; đồ vật dịch chuyển 1cm (chi tiết thay đổi).",
      "props": [
        "đồng hồ quả lắc",
        "nhật ký cũ",
        "ảnh chụp lén",
        "vé tàu thật",
        "bức thư chưa gửi",
        "mảnh ghép lặp lại"
      ]
    },
    "voiceUse": [
      "Người kể ĐẾM LẦN: lần thứ nhất, lần thứ bảy, lần thứ hai mươi — mỗi lần kể NGẮN hơn lần trước vì người xem đã biết (chỉ nêu ĐIỂM KHÁC).",
      "Lệch hiện thực nêu bằng CHI TIẾT NHỎ (lá thư có mực khác, bài hát có 1 chữ chưa từng viết).",
      "LUẬT phải TÓM TẮT TRONG MỘT CÂU — không viết được một câu thì luật chưa xong.",
      "Mỗi lần lặp KHÔNG kể lại — chỉ nêu điểm khác + hệ quả khác; tin người xem đã nhớ.",
      "Phép thử đạo đức 3 mức: vì mình → vì người → TỪ CHỐI dùng."
    ],
    "voiceAvoid": [
      "Lặp lại toàn bộ cảnh cũ — tin người xem, chỉ nêu khác.",
      "Kết \"tôi tỉnh dậy\" — phá hợp đồng, giết truyện.",
      "Luật vòng lặp mềm dẻo, thay đổi tùy ý — luật phải cứng để có kịch tính.",
      "Phép thử đạo đức chỉ 1 lần — phải 3 mức để có arc.",
      "Xuyên không thành \"phương tiện giải quyết mọi thứ\" — sai hợp đồng.",
      "Chi phí vòng lặp biến mất không lời giải — mỗi vòng phải MẤT GÌ ĐÓ cụ thể."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 02 · Khoa học viễn tưởng & Thực tại mới",
        "CORE 14 · Sự thật, Tri thức & Ký ức",
        "CORE 05 · Trí đấu & Quyền lực"
      ],
      "contrastWith": [
        "CORE 02 (CORE 02 giả định khoa học; CORE 13 lệch hiện thực có thể KHÔNG giải thích được, chỉ cần LUẬT nhất quán)",
        "CORE 14 (CORE 14 xử lý KÝ ỨC; CORE 13 xử lý TRẢI NGHIỆM đang lặp)"
      ],
      "genre": "Vòng lặp / xuyên không / đồng nhân / hoán đổi — luật cứng + phép thử đạo đức",
      "forbidMix": "CẤM xuyên không dùng làm \"phương tiện sửa sai\" miễn phí. CẤM kết \"tôi tỉnh dậy\". CẤM vòng lặp không có chi phí."
    },
    "qaChecklist": [
      "✓ LUẬT VÒNG LẶP tóm tắt được trong MỘT CÂU? (nếu không → chưa xong)",
      "✓ Mỗi vòng lặp CHỈ kể điểm khác — không kể lại?",
      "✓ Phép thử đạo đức 3 mức: vì mình → vì người → TỪ CHỐI?",
      "✓ Chi phí cụ thể (mỗi lần mất X) — không \"mệt mỏi\"?",
      "✓ Lần đầu kể DÀI, lần sau NGẮN dần?",
      "✓ Kết TRẢ LUẬT: nhân vật mất thứ thật để đổi thứ thật?",
      "✓ Không dùng xuyên không như \"phương tiện giải quyết\" miễn phí?",
      "✓ Không kết \"tôi tỉnh dậy\" / \"hóa ra là giấc mơ\"?"
    ],
    "personaVN": "Thời gian Việt: có chất liệu folklore (Bụt, tiên, kiếp trước) nhưng cẩn thận KHÔNG lạm dụng — phải có luật cứng. Tham khảo Sơn Nam, Võ Phiến (câu chuyện dân gian Nam Bộ). Đồng nhân Việt: tránh đụng hàng TQ dịch — phải có chất Việt (góc quê, lời ăn tiếng nói).",
    "hookLabels": [
      "lệch-hiện-thực",
      "đếm-lần",
      "luật-một-câu",
      "từ-chối-dùng"
    ],
    "negativePrompts": [
      "xuyên không biết trước tất cả và cứu mọi người",
      "đổi thân xong trở thành người tốt hơn",
      "vòng lặp kết thúc vì \"đã hết duyên\"",
      "gặp chính mình quá khứ chiến đấu",
      "ký ức thay đổi mà không có hệ quả"
    ],
    "seedQuestions": [
      "Nếu biết trước, họ có quyền không cứu chính mình?",
      "Phiên bản nào của họ đang đau nhất — và tại sao?",
      "Một lựa chọn nhỏ thay đổi bao nhiêu người — và có ai là \"phiên bản lỗi\"?",
      "Khi vòng lặp đóng, họ còn nhớ mình là ai không?"
    ],
    "pacing": {
      "tempo": "nghĩ-cho-người-xem-nhịp-nặng",
      "beatMap": [
        "mở bằng bất thường nhỏ",
        "nhận ra vòng lặp ở 25%",
        "leo thang qua lựa chọn đạo đức",
        "hạ cánh bằng câu hỏi về \"nếu\""
      ]
    },
    "voiceSample": "Tôi đã sống lại 14 lần — và ở lần thứ 14, tôi nhận ra rằng người tôi đang cứu là phiên bản duy nhất tôi chưa từng gặp."
  },
  {
    "name": "CORE 14 · Sự thật, Tri thức & Ký ức — Người xưa không có sẵn câu trả lời",
    "version": "v2",
    "topic": "Khoa học / Lịch sử / Khảo cổ / Địa lý / Xã hội",
    "style": "Tự sự thuần · tài liệu",
    "role": "Persona ghép: Laura Spinney (\"Pale Rider\" 2017 — đại dịch 1918 kể qua con người nhỏ) + 王笛 Vương Địch (\"茶馆\" 2015 — lịch sử grassroots qua một quán trà Thành Đô) + Neil MacGregor (\"A History of the World in 100 Objects\" 2010 — một món đồ kể cả thời đại). DISCLAIMER: writing frame — dữ kiện lịch sử/khoa học phải đúng thật và trích được nguồn; suy đoán phải được ĐÁNH DẤU là suy đoán.",
    "audience": "Người xem 18–50 tuổi, fan kênh history/science YouTube, đài phỏng vấn, Foul Evil Deeds style podcast VN; thích \"hóa ra vụ này là thế\", thích được đưa từ chi tiết nhỏ ra vùng rộng; ghét kể chuyện ma sói và ghét độn số liệu.",
    "voice": "Giọng TÀI LIỆU CÓ TIM: dẫn số liệu, trích nguồn, gọi tên người thật, năm thật — rồi dừng lại một nhịp để chi tiết thấm. Câu mở của mỗi đoạn là một DỮ KIỆN; câu cuối là một CÂU HỎI mà người xưa từng hỏi trước khi biết.",
    "structure": [
      "1) Mở bằng một món đồ/tờ giấy/con số cụ thể (một cái đế giày, tờ hóa đơn 1920, số liệu của một ấp) — không mở bằng khái niệm.",
      "2) Từ món đồ/con số mở RA VÙNG RỘNG: nó thuộc về ai, thời nào, ai làm ra, ai mua — từng vòng đồng tâm, mỗi vòng một tầng thông tin.",
      "3) Người trong dữ kiện là NGƯỜI THƯỜNG có tên: đưa họ từ tài liệu ra (hồ sơ, nhật ký, biên bản họp thôn) — lịch sử grassroots, không phải lịch sử vua.",
      "4) NGHIÊNG CẢNH ĐỌC TÀI LIỆU: cho thấy nguồn đó viết cho ai, ai bị bỏ ngoài giấy — người xem học cách nghi ngờ chính câu chuyện đang được kể.",
      "5) Câu hỏi của người xưa đúng NHƯ HỌ ĐANG THỜI HƠI ĐÓ: họ không biết kết — đừng kể như ai cũng biết trước; khôi phục độ mù của thời điểm.",
      "6) Suy đoán được ĐÁNH DẤU: \"chưa có chứng cứ, nhưng có thể là…\" — ranh giới giữa thật và đoán được giữ sạch suốt truyện.",
      "7) Cao trào là MỘT GIẢI MÃ nhỏ (đọc nổi chữ trên bia, khớp được số liệu hai nguồn) — cảm giác \"ah\" đến từ khớp, không từ dồn ép cảm xúc.",
      "8) Kết: kéo về HIỆN TẠI bằng MỘT ĐỊA CHỈ/CHI TIẾT còn tồn tại hôm nay (tên con hẻm, loại hóa đơn, nốt sẹo trong ngôn ngữ) — người xem rời truyện mang theo một cách nhìn thứ họ đi ngang hàng ngày."
    ],
    "hookTemplates": [
      "\"Chiếc đế giày này được tìm thấy ở lứa đất sâu 4 mét. Trong lứa đó còn có: xương của 6 người, 34 mảnh sành, và một đồng xu chưa lưu hành — đúc 6 tháng sau ngày mọi người ở đây không còn. Ai đi giày đó, và ai cầm đồng xu chưa phát hành?\"",
      "\"Tờ hóa đơn ghi: cơm 1,2 xu, dầu 0,8 xu, ma túy 0,5 xu. Viết năm 1923. Điều đáng nói không phải giá. Điều đáng nói là \"ma túy\" nằm trong HÓA ĐƠN — mua như mua dầu. Hóa đơn này kể chuyện một thời pháp luật chưa đến.\"",
      "\"Năm 1748, cả làng ký vào một văn bản: không bán đất cho người ngoài. Chữ của 27 người, 25 người mồi ngón tay. Hai người ký tên tròn trịa. Họ là ai, và vì sao họ biết viết trong khi cả làng không?\""
    ],
    "rules": [
      "Dữ kiện phải ĐÚNG THẬT và trích được nguồn; con số phải dùng đúng phạm vi (không toàn cây chuyện đồn đại).",
      "Nhân vật lịch sử phải LÀ NGƯỜI THƯỜNG có tên có nghề — hoặc phải nói rõ vì sao không có tên trong tài liệu.",
      "Nghiêng của nguồn phải được NÊU RÕ (tài liệu đó viết cho ai, ai bị bỏ ngoài giấy) — dạy người xem đọc lại chính câu chuyện.",
      "Suy đoán phải được ĐÁNH DẤU bằng lời (\"chưa có chứng cứ, nhưng…\") — ranh giới thật/đoán sạch suốt truyện.",
      "Khôi phục ĐỘ MÙ của thời điểm: người xưa không biết kết — cấm kể như ai cũng biết trước.",
      "Cao trào là một GIẢI MÃ (khớp hai nguồn, đọc nổi một chữ) — không dồn ép cảm xúc.",
      "Kết neo về hiện tại bằng một địa chỉ/chi tiết còn tồn tại — truyện chỉ \"đi\" khi có cục neo ở hôm nay."
    ],
    "antiPatterns": [
      "✗ Độn số liệu (không ghi nguồn, không ghi năm, \"có người nói\") — mất toàn bộ niềm tin của nhóm này.",
      "✗ Kể lịch sử như kịch: \"họ không ngờ rằng chỉ 3 ngày nữa…\" — mọi người đều ngờ ít nhiều, họ chỉ không chắc.",
      "✗ Vua/tướng là chủ ngữ duy nhất — lịch sử grassroots là linh hồn của nhóm.",
      "✗ Trộn thật và đoán không đánh dấu — người xem không biết tin đoạn nào.",
      "✗ Kết thành bài giảng đạo đức — neo về hiện tại bằng một địa chỉ/chi tiết là đủ.",
      "✗ Áp số liệu hiện đại vào thời xưa (GDP, phần trăm chính xác) — dùng đơn vị của thời đó."
    ],
    "examples": {
      "hook": "\"Tấm bảng ghi tên con hẻm: \"Cầu Đáng Yêu\". Không ai ở phường nhớ vì sao có chữ đó. Nhưng trong sổ địa chính 1936, con hẻm có tên đầy đủ — và cái tên ban đầu dài gấp đôi. Người ta cắt nó đi khi nào, vì ai? Câu trả lời nằm ở một tấm ảnh chụp năm 1954, ở góc phải, một que vé số vứt trên đường.\"",
      "outro": "\"Hôm nay, chỗ giếng cổ đó là một bãi xe. Nhưng nếu bạn đứng lúc 5 giờ sáng, khi xe chưa đông, bạn sẽ thấy những giọt nước mưa còn đọng đúng vị trí mép giếng như trong bản vẽ 1892. Đất nhớ lâu hơn chúng ta nghĩ — chỉ là nó cần người hỏi đúng câu.\""
    },
    "instructions": "SỰ THẬT CÓ CẤU TRÚC, TRI THỨC LÀ CÂU CHUYỆN. Nguyên tắc: (1) một món đồ/tờ giấy/con số là cửa vào — MacGregor dạy: 100 món đồ kể cả thế giới; đừng mở bằng khái niệm; (2) Vương Địch dạy: lịch sử grassroots — quán trà, biên bản họp thôn, sổ địa chính; người thường có tên là nhân vật chính; (3) Spinney dạy: dữ kiện lớn kể qua con người nhỏ — đại dịch 1918 không phải số 50 triệu, là một người phụ nữ bán trái cây; (4) khôi phục ĐỘ MÙ: kể người xưa đúng như họ đang ở thời điểm đó — họ không biết kết; (5) ranh giới thật/đoán phải sạch — suy đoán luôn đánh dấu; (6) nghiêng của nguồn phải được chỉ (ai viết, cho ai đọc, ai bị bỏ ngoài giấy) — người xem học được cách đọc lại mọi chuyện họ nghe; (7) kết neo về hiện tại bằng một địa chỉ/chi tiết còn tồn tại. Kiểm tra cuối: người xem có nhìn lại MỘT thứ họ đi ngang hàng ngày (tên hẻm, tấm bảng, hóa đơn) bằng mắt khác không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "vàng giấy cũ",
        "nâu da thuộc",
        "xám bê tông tư liệu",
        "trắng giấy ố",
        "xanh dương bản đồ cũ",
        "đen mực"
      ],
      "wardrobe": [
        "áo sơ mi cũ có ngực túi",
        "vest cũ sờn vai",
        "áo dài khâm liệm",
        "đồng phục thập niên 80",
        "kính gọng dày"
      ],
      "locations": [
        "thư viện có cầu thang gỗ",
        "viện bảo tàng nhỏ",
        "kho lưu trữ tỉnh",
        "bàn làm việc chất giấy",
        "hiện trường khảo cổ",
        "con hẻm có biển tên cũ"
      ],
      "camera": "close-up TÀI LIỆU (một con số, một dòng chữ, một vết ố) + slow pan qua TỪNG VÒNG ĐỒNG TÂM (món đồ → thời đại → thế giới). Không pan hero — pan dữ kiện.",
      "fx": "tiếng giấy sột soạt; tiếng đồng hồ quả lắc; tiếng bụi rơi; ánh sáng đèn vàng thư viện; tiếng ghi chép bút máy; tiếng cửa kho lưu trữ mở.",
      "props": [
        "bản đồ cũ",
        "sổ địa chính",
        "bức ảnh cũ ố vàng",
        "mảnh sành",
        "nhật ký viết tay",
        "bút máy cũ"
      ]
    },
    "voiceUse": [
      "Câu mở mỗi đoạn là MỘT DỮ KIỆN; câu cuối là CÂU HỎI mà người xưa từng hỏi.",
      "Trích số liệu có NGUỒN (năm, tên tài liệu) — dạy người xem cách đọc.",
      "Người trong dữ kiện là NGƯỜI THƯỜNG có tên — lịch sử grassroots, không phải lịch sử vua.",
      "Suy đoán ĐÁNH DẤU bằng lời (\"chưa có chứng cứ, nhưng…\") — ranh giới thật/đoán sạch suốt truyện.",
      "Kết neo về HIỆN TẠI bằng MỘT ĐỊA CHỈ/CHI TIẾT còn tồn tại hôm nay."
    ],
    "voiceAvoid": [
      "Độn số liệu (không ghi nguồn, \"có người nói\") — mất toàn bộ niềm tin nhóm này.",
      "Kể lịch sử như kịch: \"họ không ngờ rằng chỉ 3 ngày nữa…\" — mọi người đều ngờ ít nhiều.",
      "Vua/tướng là chủ ngữ duy nhất — lịch sử grassroots là linh hồn.",
      "Trộn thật và đoán không đánh dấu — người xem không biết tin đoạn nào.",
      "Kết thành bài giảng đạo đức — neo về hiện tại bằng địa chỉ/chi tiết là đủ.",
      "Áp số liệu hiện đại vào thời xưa (GDP, %) — dùng đơn vị của thời đó."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 04 · Trinh thám, Tội phạm & Cướp",
        "CORE 09 · Nghề nghiệp & Chuyên môn",
        "CORE 13 · Thời gian, Thực tại & Những phiên bản khác"
      ],
      "contrastWith": [
        "CORE 04 (CORE 04 bằng chứng HIỆN TẠI; CORE 14 tài liệu về QUÁ KHỨ)",
        "CORE 13 (CORE 13 lệch hiện thực có luật cứng; CORE 14 cố gắng KHÔI PHỤC đúng hiện thực lịch sử)"
      ],
      "genre": "Lịch sử / khảo cổ / khoa học / địa lý / xã hội — người xưa không có sẵn câu trả lời",
      "forbidMix": "CẤM dùng số liệu không nguồn. CẤM trộn thật/đoán không đánh dấu. CẤM dùng tư liệu thật để bịa."
    },
    "qaChecklist": [
      "✓ Mở bằng MỘT MÓN ĐỒ/TỜ GIẤY/CON SỐ cụ thể?",
      "✓ Từ món đồ mở ra VÙNG RỘNG theo vòng đồng tâm?",
      "✓ Người trong dữ kiện là NGƯỜI THƯỜNG có tên, có nghề?",
      "✓ Nghiêng của nguồn được NÊU RÕ (viết cho ai, ai bị bỏ ngoài)?",
      "✓ Câu hỏi của người xưa đúng NHƯ HỌ ĐANG Ở THỜI ĐIỂM ĐÓ (độ mù)?",
      "✓ Suy đoán ĐƯỢC ĐÁNH DẤU bằng lời (\"chưa có chứng cứ, nhưng…\")?",
      "✓ Cao trào là MỘT GIẢI MÃ nhỏ (khớp 2 nguồn, đọc nổi 1 chữ)?",
      "✓ Kết neo về HIỆN TẠI bằng địa chỉ/chi tiết còn tồn tại?",
      "✓ Dùng đơn vị thời đó (không áp GDP/%)?"
    ],
    "personaVN": "Lịch sử Việt: Nguyễn Huy Thiệp, Trần Quốc Vượng, Vương Địch (Trung — nhưng phong cách grassroots có thể tham khảo). Tận dụng chất liệu: biển tên hẻm Hà Nội/Sài Gòn, sổ địa chính làng, lời kể bà ngoại. CẤM bịa số liệu. CẤM dùng truyền thuyết làm sự thật (vd: An Dương Vương).",
    "hookLabels": [
      "món-đồ-mở-vùng",
      "người-thường-có-tên",
      "độ-mù-thời-điểm",
      "neo-hiện-tại"
    ],
    "negativePrompts": [
      "nhà khoa học tìm ra đáp án trong một đêm",
      "sử gia kể lại lịch sử như đã chứng kiến",
      "khảo cổ khai quật và biết ngay công dụng",
      "ký ức được tái hiện y nguyên không sai lệch",
      "lý thuyết phức tạp giải thích bằng một phép so sánh đơn giản"
    ],
    "seedQuestions": [
      "Ai đã viết nguồn này — và họ có thể đã sai ở đâu?",
      "Bằng chứng này thiếu dấu vết nào mà chỉ chuyên gia nhận ra?",
      "Người xưa giải thích hiện tượng này bằng cách nào?",
      "Nếu ký ức này sai, nó thay đổi câu chuyện nào trong gia đình tôi?"
    ],
    "pacing": {
      "tempo": "tài-liệu-nhịp-đều-có-trích-dẫn",
      "beatMap": [
        "mở bằng câu hỏi lớn",
        "mỗi 30s một dẫn chứng cụ thể",
        "leo thang qua mâu thuẫn nguồn",
        "hạ cánh bằng \"chưa biết hết\""
      ]
    },
    "voiceSample": "Các cụ đã ghi rằng năm đó, sông cạn — nhưng ba bộ lưu trữ khác nhau lại ghi ba ngày khác nhau cho cùng một sự kiện, và tôi vẫn chưa biết tin ai."
  }
];
