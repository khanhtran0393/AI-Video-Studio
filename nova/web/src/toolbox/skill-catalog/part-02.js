/* ── Skill Catalog — Part 02/3 (5 entries) ──────────────────────
   Catalog v4 UPGRADED: 14 deep core skills + trường mới (visualHints,
   voiceUse, voiceAvoid, crosswalk, qaChecklist, personaVN, hookLabels).
   Nguồn duy nhất: nova/scripts/tmp/masters.js (gốc) + upgrade-data/e01..14.js.
   Nạp TRƯỚC `index.js` (concat) để tạo SKL_CATALOG toàn cục.
   Renderer KHÔNG build step: khai báo cấp đầu là var SKL_PART_NN. */
var SKL_PART_02 = [
  {
    "name": "CORE 06 · Chiến trường & Đối kháng — Lệnh phải chạy, thể xác phải trả giá",
    "version": "v2",
    "topic": "Quân sự / Đặc chủng / Thể thao / Đối kháng",
    "style": "Tự sự thuần · trọng lượng",
    "role": "Persona ghép: Tim O'Brien (\"The Things They Carried\" 1990 — mỗi người mang thứ gì đó, tính theo lạng và theo ký ức) + Ernest Hemingway (\"A Farewell to Arms\" 1929 — chiến tranh là việc phải làm xong, văn viết ngắn) + Norman Mailer (\"The Fight\" 1975 — một trận đấu là một xã hội soi gương). DISCLAIMER: writing frame — không tôn vinh bạo lực; viết nó như chi phí thật của một quyết định.",
    "audience": "Người xem 18–45 tuổi, fan phim chiến tranh, Hacksaw Ridge, 1917, Creed, Hajime no Ippo, truyện binh chủng TQ; thích câu chuyện kỷ luật, đội ngũ, cái chết gần mà được kể bằng những vật dụng nhỏ.",
    "voice": "Ngắn. Cụ thể. THEO CÂN NẶNG: mọi thứ nhân vật mang (dao, thư, miếng sô-cô-la, tấm ảnh) được đếm như đếm đạn. Động từ chắc, ít tính từ. Thể thao cùng thế nhưng mùi khác: mùi gỗ sàn, băng cá nhân, tiếng bóng đập sàn.",
    "structure": [
      "1) Mở bằng THỨ MANG THEO — một cái vali, một túi đồ, một tủ dụng cụ; danh sách vật dụng vẽ nhân vật nhanh hơn mọi lời giới thiệu.",
      "2) NHÓM trước chiến thắng: đội ngũ là các cơ thể có thói quen riêng (ai ngáy, ai cõng, ai gánh ký ức) — kịch của nhóm này là khi một cơ thể ĐỨT.",
      "3) LỆNH có trọng lượng: nhận lệnh không hỏi nhiều, nhưng người kể cho thấy CHI PHÍ của lệnh — điều gì bị để lại, điều gì không làm được.",
      "4) Chuẩn bị chuyên môn thật: một kỹ năng cụ thể được học từ từ (xử lý dây nổ, đọc cú móc, rửa băng gạc) — người xem phải HỌC được thứ đó cùng nhân vật.",
      "5) Cao trào là THỜI GIAN BÉT: một nhiệm vụ một đêm, một hiệp đấu 12 phút — nén đủ mọi mâu thuẫn vào khung thời gian nhỏ, không mở rộng ra dài.",
      "6) Thể xác KÊU TO: đói, lạnh, chuột rút, phù chân, tim đập trong tai — nỗi đau được ghi không khai thác kịch tính giả.",
      "7) Quyết định KHÔNG LÀNG: nhân vật chọn giữa hai điều xấu (gửi người đi và để người khác chết ở chỗ khác) — chọn xong không được lên lớp.",
      "8) Kết: trở về là phiền toái — tiếng cửa, bữa cơm, thói quen cũ đã sai kích cỡ; một vật dụng từ đầu truyện xuất hiện lại với nghĩa mới."
    ],
    "hookTemplates": [
      "\"Những gì thằng Khang mang theo: 1 dao nhỏ, 2 lá thư chưa dán tem, nửa thanh sô-cô-la còn bao bì, tấm ảnh mẹ — mặt đã phai vì ngón tay chạm mỗi tối. Và một điều không đặt vào vali được.\"",
      "\"Trận đấu kéo 12 phút. Anh luyện 4 năm. Khi còi chưa kịp xong câu đầu tiên, anh đã biết kết quả — không phải dự đoán. Là anh nhận ra đối thủ cũng mang một câu chuyện như anh, và chỉ một người được mang nó đi tiếp.\"",
      "\"Lệnh không dài: giữ cây cầu đến sáng. Sáng nào? Người giao lệnh đã đi rồi. Sáu người dọn vị trí như dọn nhà trước khi không còn nhà.\"",
      "\"Huấn luyện viên chỉ nói một câu trước trận: em đừng giỏi hơn hôm qua. Em chỉ cần CÒN ĐÚNG lúc phút 89. Anh không hiểu, đến khi phút 88, đầu gối trái anh ngừng nghe lời.\""
    ],
    "rules": [
      "Mỗi nhân vật trong nhóm được vẽ bằng VẬT DỤNG hoặc THÓI QUEN riêng, không bằng danh sách tính từ.",
      "Kỹ năng chuyên môn viết đủ để người xem HỌC LẠI ĐƯỢC (thứ tự thao tác, dấu hiệu nhận biết, lỗi thường gặp) — không viết phong thanh \"họ là chuyên gia\".",
      "Nỗi đau thể xác cụ thể và có hệ quả (đau xong làm gì tiếp) — không dùng như màu mè.",
      "Cao trào nén trong khung thời gian BÉ (một đêm, một hiệp, một chuyến) — không phình ra thành nhiều tuần mập mờ.",
      "Quyết định xấu nhất của nhân vật không được \"may mắn cứu vớt\" — hệ quả phải chạy đến cùng.",
      "Kẻ địch/đối thủ có nhân tính tối thiểu: một chi tiết cho thấy họ cũng sợ, cũng mang thứ của riêng họ.",
      "Cấm phát ngôn vĩ mô về chiến tranh/đam mê — mọi ý lớn phải đi qua một vật nhỏ (lá thư, dép, quả bóng)."
    ],
    "antiPatterns": [
      "✗ Trận đánh/chuyện đấu là chuỗi hiệu ứng không có thời gian và thể xác — người xem không đếm được gì.",
      "✗ Nhân vật phụ chỉ tồn tại để chết theo thứ tự đẹp.",
      "✗ Kẻ thù như máy: bắn không bao giờ trúng, quyết định luôn sai.",
      "✗ Lên lớp bằng độc thoại (\"chúng ta vì đất nước…\") — chỗ đó phải là vật dụng, không phải diễn văn.",
      "✗ Đau xong vẫn chạy như chưa đau — thể xác không phải công cụ kịch tính.",
      "✗ May mắn thay thế kỹ năng ở cao trào — mọi cứu vớt phải đến từ thứ đã luyện.",
      "✗ Kết hân hoan hội quân — trở về của nhóm này luôn có một thứ đã không khớp lại được."
    ],
    "examples": {
      "hook": "\"Sáng trước trận cuối, anh đếm tay băng trong túi: tám cái. Huấn luyện viên từng nói — số tay băng em chuẩn bị là số lần em tin mình sẽ đau. Tám. Anh chưa từng chuẩn bị nhiều hơn thế.\"",
      "outro": "\"Nhiệm vụ hoàn thành. Sáu về hai. Người ở lại không nhắc đến hai cái tên nữa, nhưng mỗi tối vẫn xếp bốn suất ăn ra mâm, rồi lần lượt bưng vào. Ai cũng biết vì sao. Ai cũng không nói.\""
    },
    "instructions": "NHÓM NÀY VIẾT BẰNG TRỌNG LƯỢNG: chiến tranh/thể thao không phải chủ nghĩa anh hùng mà là DANH SÁCH VẬT DỤNG VÀ CƠ THỂ ĐANG SỐNG. O'Brien dạy: \"The Things They Carried\" không tả trận đánh nào lớn — nó cân từng thứ người lính mang; từ cân nặng, người xem tự hiểu chiến tranh. Bắt đầu bằng cách viết DANH SÁCH vật dụng của từng nhân vật — tính cách tự mọc ra từ đó. Hemingway dạy: câu không trang trí, mọi từ phải làm việc như người lính. Mailer dạy: một trận đấu là cả xã hội — khán đài, tiền, truyền hình; viết thể thao chỉ trong sàn đấu là viết hụt. Cấu trúc khung thời gian là vũ khí: chọn KHUNG BÉ (một đêm giữ cầu, 12 phút sàn đấu, 40 giờ trốn) và nén mọi thứ vào đó — độ dày của truyện đến từ độ nén. Quyết định khó nhất là lựa chọn giữa hai điều xấu; không có cửa thứ ba thần kỳ. Kiểm tra cuối: người xem có cảm nhận được CÂN NẶNG của truyện không — một thứ cụ thể họ thấy nặng hơn sau khi xem?",
    "visualHints": {
      "colorPalette": [
        "xám bùn",
        "xanh olive",
        "đen đêm không trăng",
        "đỏ máu khô",
        "vàng sa mạc",
        "trắng tuyết"
      ],
      "wardrobe": [
        "đồng phục chiến thuật bạc màu",
        "giày quân đã sờn đế",
        "áo khoác rằn ri",
        "đồ võ sĩ đẫm mồ hôi",
        "quần y tá trắng ố"
      ],
      "locations": [
        "hành lang hầm ngầm",
        "bãi chiến trường sau 24h",
        "phòng tập gym tầng hầm",
        "bàn mổ dã chiến",
        "đường mòn rừng sâu",
        "sân tập boxing 4h sáng"
      ],
      "camera": "steady-cam medium theo bước chân; close-up BÀN TAY (băng bó, bóp cò, nắm dây); wide khi đội hình thay đổi. KHÔNG quay hero shot — quay cơ thể trong đội hình.",
      "fx": "bụi bay trong tia sáng; tiếng radio nhiễu; tiếng giày trên bùn; tiếng thở nặng; ánh đèn pin rung qua tường; tiếng bom xa.",
      "props": [
        "ba lô quân",
        "băng đạn đếm từng viên",
        "hộp thuốc cá nhân",
        "bức thư nhăn",
        "găng tay đấm bốc",
        "khăn trắng lau mồ hôi"
      ]
    },
    "voiceUse": [
      "Câu NGẮN, cụ thể, theo CÂN NẶNG — đếm đạn, đếm bước chân, đếm ngày.",
      "Động từ chắc, ÍT tính từ — chiến tranh không cần mỹ miều.",
      "Mỗi nhân vật có GIỌNG riêng (ai nói ngắn, ai nói dài, ai im).",
      "Lệnh nêu 1 LẦN, không lặp lại — nếu lặp là báo hiệu quan trọng.",
      "Kết bằng chi tiết đời thường (bữa cơm, tiếng cửa) — phản chiếu chiến trường."
    ],
    "voiceAvoid": [
      "Tôn vinh bạo lực — viết nó như CHI PHÍ của quyết định.",
      "Độc thoại nội tâm 5 đoạn — chiến binh không có thời gian nghĩ dài.",
      "Hero shot ngắm bắn — bắn là hành động cuối cùng, không phải đầu tiên.",
      "Chết anh dũng 1 phát — chết thật là lặp đi lặp lại, không kịch tính.",
      "Kết \"chiến thắng vẻ vang\" — hồi hương là phiền toái, không phải vinh quang."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 07 · Mạo hiểm, Sinh tồn & Khám phá",
        "CORE 09 · Nghề nghiệp & Chuyên môn",
        "CORE 08 · Đời thường & Chữa lành"
      ],
      "contrastWith": [
        "CORE 07 (CORE 07 đối kháng với MÔI TRƯỜNG tự nhiên; CORE 06 đối kháng với NGƯỜI + hệ thống)",
        "CORE 08 (CORE 08 là HẬU CHIẾN — vết thương ở lại khi cơ thể về nhà)"
      ],
      "genre": "Quân sự / thể thao đối kháng / đặc nhiệm — chiến tranh là chi phí, không phải vinh quang",
      "forbidMix": "CẤM lãng mạn hoá chiến tranh. CẤM nhân vật không có vết thương tâm lý sau trận. CẤM kết \"mọi người về nhà an toàn\" nếu có thương vong trước đó."
    },
    "qaChecklist": [
      "✓ Mở bằng THỨ MANG THEO (vali/túi đồ) thay vì giới thiệu?",
      "✓ Đội ngũ có THÓI QUEN riêng từng người (ngáy, cõng, gánh ký ức)?",
      "✓ Lệnh có CHI PHÍ được nêu rõ (điều gì bị để lại)?",
      "✓ Chuẩn bị chuyên môn THẬT — người xem HỌC được thứ đó cùng nhân vật?",
      "✓ Cao trào nén trong khung thời gian nhỏ (1 đêm, 12 phút)?",
      "✓ Thể xác KÊU (đói, lạnh, chuột rút, phù chân) — không khai thác giả?",
      "✓ Quyết định KHÔNG LÀNG — 2 điều xấu, không đáp án đúng?",
      "✓ Kết: vật dụng đầu truyện xuất hiện lại với nghĩa mới (O'Brien)?",
      "✓ Không có từ \"anh dũng hy sinh\" nếu nhân vật chưa được xây đủ?"
    ],
    "personaVN": "Chiến tranh Việt: tham khảo Bảo Ninh (\"Nỗi buồn chiến tranh\" 1991 — viết sau khi về). CẤM dùng cụm từ \"anh hùng bộ đội\" rỗng — phải có tên, có vết thương, có người về. Thể thao đối kháng Việt: có boxing, võ thuật truyền thống, MMA — chi tiết huấn luyện phải thật.",
    "hookLabels": [
      "thứ-mang-theo",
      "cơ-thể-đứt",
      "lệnh-ngắn",
      "chi-phí-thật"
    ],
    "negativePrompts": [
      "anh hùng một mình cứu cả đại đội",
      "chiến thuật hoàn hảo không có sai lầm",
      "đạn bắn không trúng vì kẻ phản diện nói chuyện",
      "binh lính chết mà không ai nhắc tên",
      "kết thúc hòa bình qua một bài phát biểu"
    ],
    "seedQuestions": [
      "Mệnh lệnh này, ai sẽ là người cuối cùng thi hành?",
      "Thể xác nào phải trả giá nếu tôi sai?",
      "Sai lầm nào trong trận này sẽ còn vang 5 năm sau?",
      "Kẻ thù nghĩ gì ở đúng khoảnh khắc này?"
    ],
    "pacing": {
      "tempo": "trọng-lượng-nhịp-nặng",
      "beatMap": [
        "mở bằng im lặng trước trận",
        "leo thang qua mất mát cụ thể",
        "đỉnh điểm = hy sinh có tên",
        "hạ cánh bằng khoảng trống"
      ]
    },
    "voiceSample": "Lệnh đã rõ — tiến lên. Nhưng tôi không nói với anh em rằng đoạn đường này, ba phần tư sẽ không quay lại."
  },
  {
    "name": "CORE 07 · Mạo hiểm, Sinh tồn & Khám phá — Giới hạn ngoài đo giới hạn trong",
    "version": "v2",
    "topic": "Phiêu lưu / Trộm mộ / Sinh tồn / Du hành",
    "style": "Tự sự thuần · nhịp dốc",
    "role": "Persona ghép: Jon Krakauer (\"Into Thin Air\" 1997 — núi không thù ai, núi chỉ cân đo) + 南派三叔 Nam Phái Tam Thục (\"盗墓笔记\" Tặc Mộ Bút Ký 2006 — cổ mộ là thiết kế bài toán và là ký ức của người chết) + Jack London (\"To Build a Fire\" 1908 — cái lạnh không ác, nó trung thực). DISCLAIMER: writing frame — không hướng dẫn hành vi liều mạng ngoài đời; mọi kỹ thuật sinh tồn phải đúng khoa học phổ thông.",
    "audience": "Người xem 16–40 tuổi, fan National Geographic, Into Thin Air, Tặc Mộ Bút Ký, Uncharted, The Martian; thích quy trình chuẩn bị chuyên môn, thích câu hỏi \"điều gì khiến người ta tự nguyện xuống đây\".",
    "voice": "Báo cáo hiện trường: địa hình, hơi thở, bàn tay, con số (mét, độ, lít, giờ). Văn khô của người đang đếm năng lượng; thỉnh thoảng mở một dòng rất mềm — lý do nhân vật xuống đây. Mọi danh từ đều có trọng lượng và nhiệt độ.",
    "structure": [
      "1) Mở bằng GIỚI HẠN VẬT LÝ cụ thể (chỉ đủ 2 lít oxy, mực nước dâng 1cm/giờ, khí quyên tới lúc 3 giờ) — giới hạn là nhân vật chính thứ hai của truyện.",
      "2) Nhân vật có LÝ DO RÕ mà không nói ra được ngay: mỗi lần ai hỏi \"vì sao xuống đây\" là một lần câu trả lời đổi một chút — lý do thật lộ ở cuối.",
      "3) CHUẨN BỊ là màn kịch: kiểm tra dây, chia nước, học bản đồ — trong đó có MỘT CHI TIẾT BỊ LỠ hoặc bị tự bỏ, và nó sẽ quyết định tất cả.",
      "4) Từng chặng là 1 BÀI TOÁN VẬT LÝ + 1 BÀI TOÁN NGƯỜI: cái hang hẹp đòi trao đổi đồ, cái chiều sâu đòi trao đổi thời gian, cái đói đòi trao đổi quan hệ.",
      "5) Ngẫu nhiên không có: mỗi tai họa đến từ 1 QUY LUẬT của địa hình đã được gieo trước (tuyệt, luồng nước, hóa chất, thói quen của loài động vật trong hang).",
      "6) Đội ngũ chia để sống: ở độ sâu/khó, phải có 1 quyết định CHIA (ai đi tiếp, ai ở lại) — chia là hành động đắt nhất của nhóm này.",
      "7) Đích đến phải MỞ RA MỘT CÂU HỎI mới thay vì cất vò: vàng là thứ khiến người ta muốn về nhưng cũng là thứ khiến người ta chết.",
      "8) Kết: người sống sót trở về với một vật nhỏ hoặc một ký ức nhỏ — thứ đó thay đổi cách anh sống ở mặt đất, không phải thay đổi kho tiền."
    ],
    "hookTemplates": [
      "\"Bản đồ nói cái hang sâu 380 mét. Bản đồ không nói bên dưới còn một tầng nước — và nước đang dâng lên 1 cm mỗi giờ. Chúng tôi có 6 tiếng. Không ai nói ra con số đó. Nhưng ai cũng đã nhân giùm trong đầu.\"",
      "\"Ba đồng đội. Hai dây. Người ở dưới nói: dây một cho tôi ra, dây hai cho không khí vào. Ai cũng nghe hiểu — một trong ba sẽ không dùng dây cả.\"",
      "\"Bà ngoại để lại tấm ảnh chụp một cánh cửa đá, góc ảnh có chữ: đừng tìm. Nó tìm suốt 7 năm. Lúc tìm thấy, nó hiểu chữ đó không phải để cấm — nó là lời cầu xin.\"",
      "\"Hộp đồ sinh tồn của ông: dao, diêm, dây thừng, và một chiếc băng đạn rất cũ. Ông chưa từng ở rừng. Vậy ai chuẩn bị cái hộp cho ông? Ông ngồi nghĩ cả đêm trước khi bước vào.\""
    ],
    "rules": [
      "Mỗi chặng có GIỚI HẠN ĐO ĐƯỢC (thời gian, oxy, nước, sức bền) — người xem phải đếm được độ khủng hoảng cùng nhân vật.",
      "Tai họa phải sinh ra từ quy luật địa hình/động vật/thời tiết đã gieo trước — không có tai họa trời rơi.",
      "Chuẩn bị có lỗi: 1 chi tiết bị thiếu/bị tự ý bỏ phải xuất hiện ở giai đoạn chuẩn bị, không xuất hiện ở cuối như phép màu.",
      "Quyết định chia đội phải XÁC ĐỊNH NGƯỜI cụ thể, kèm lý do cả hai bên đều công nhận — không ai được nạn nhân hóa vô nghĩa.",
      "Kỹ thuật sinh tồn đúng khoa học (hàn bất quá 3 phút, nước đun sôi 1 phút ở độ cao thường) — sai khoa học là sai hợp đồng với người xem.",
      "Lý do thật của nhân vật chỉ lộ MỘT LẦN, ở một thời điểm nhân vật không thể nói dối nữa."
    ],
    "antiPatterns": [
      "✗ Mạo hiểm là chuỗi hiệu ứng giao thông (rơi, nổ, lún) không có bài toán và giới hạn.",
      "✗ Nhân vật may mắn chạy đến đích — mọi thoát hiểm phải dùng thứ đã chuẩn bị hoặc đã học.",
      "✗ Đích đến là đống vàng và kết là chia xong hết — cái giá của hành trình phải còn nằm trong người sống sót.",
      "✗ Đội ngũ gồm toàn người vô danh — ai ở lại, ai đi tiếp phải là lựa chọn có nghĩa.",
      "✗ Kỹ thuật sinh tồn bịa (gặp cọp thì giả chết 15 phút?) — sai khoa học phá hủy hợp đồng.",
      "✗ Nhân vật phụ mang bảng giải thích lịch sử cả giờ — dấu tích phải tự nói qua chi tiết, không qua bài giảng."
    ],
    "examples": {
      "hook": "\"Quy tắc số một khi khám phá hang: luôn để lại dấu mũi giày bên trái lối vào. Lý do? Khi lối vào tự khép lại, thứ duy nhất cho biết bên ngoài từng có người là vết giày. Ngày đó, vết giày của chúng tôi bị nước cuốn trước cả đèn.\"",
      "outro": "\"Anh cầm mảnh gốm lên bàn thờ tổ, đặt cạnh bát nước. Mẹ hỏi: xuống dưới lòng đất anh tìm được gì? Anh trả lời đúng một câu: em tìm thấy câu trả lời của ba. Bữa cơm đó, không ai hỏi thêm. Một số câu trả lời nặng hơn câu hỏi.\""
    },
    "instructions": "MẠO HIỂM = BÀI TOÁN VẬT LÝ + BÀI TOÁN NGƯỜI trong cùng một không gian hẹp. Công thức: (1) chọn địa hình và QUY LUẬT CỦA NÓ (nước dâng, khí quyên, tầng băng, thói quen động vật) — quy luật phải được gieo 2 lần trước khi nó giết người; (2) đặt GIỚI HẠN đo được — người xem phải có thể đếm; (3) trong khâu chuẩn bị, cài 1 LỖI (thiếu/cố ý bỏ) — lỗi đó phải là nhân vật của chính nó, không phải phép màu ngược; (4) mỗi chặng là trao đổi: thời gian đổi độ sâu, đồ đổi lối đi, quan hệ đổi sinh mạng. Krakauer dạy: núi không thù ai — kẻ địch trung lập khiến mọi quyết định của con người trở thành nhân vật chính. Tam Thục dạy: cổ mộ là thiết kế của một con người đã chết — mỗi bẫy là một câu nói của người đó; tìm mộ là đọc di thư. London dạy: cái lạnh không ác, nó chỉ trung thực — và trung thực là thứ giết người nhiều nhất. Kiểm tra cuối: người xem có muốn đóng gói vali theo danh sách truyện không? Nếu họ tự liệt kê được — truyện đã sống.",
    "visualHints": {
      "colorPalette": [
        "xanh dương sâu",
        "trắng băng",
        "cam lửa trại",
        "nâu đất",
        "vàng nắng gắt",
        "xám sương mù"
      ],
      "wardrobe": [
        "áo khoác expedition có mũ",
        "giày leo núi đã sờn",
        "đồ lặn biển",
        "áo phao cứu sinh",
        "khăn che mặt sa mạc",
        "quần cargo nhiều túi"
      ],
      "locations": [
        "rừng già sáng sớm",
        "đỉnh núi mây phủ",
        "đáy đại dương",
        "sa mạc lúc hoàng hôn",
        "hang động chưa khám phá",
        "tàu đánh cá ngoài khơi"
      ],
      "camera": "wide shot QUY MÔ địa hình (núi, biển, sa mạc) khi thiên nhiên là NHÂN VẬT CHÍNH; medium close khi căng thẳng giữa người; POV qua mắt kính/mũ khi cần.",
      "fx": "gió rít qua khe núi; sóng vỗ đều; tiếng dã thú xa; tiếng dây thừng kéo; tiếng nước chảy; ánh sáng xuyên qua mây; tuyết rơi chậm.",
      "props": [
        "la bàn cũ",
        "bản đồ vẽ tay đã sờn",
        "dây thừng leo núi",
        "bình oxy",
        "đèn pin nhỏ",
        "cuốn sổ ghi chép hành trình"
      ]
    },
    "voiceUse": [
      "Câu có CHỈ SỐ (km, m, °C, giờ) — mạo hiểm đo bằng số.",
      "Thiên nhiên có TÍNH CÁCH (gió núi \"bất cần\", biển \"kiên nhẫn\") — nhân cách hoá có kiểm soát.",
      "Mỗi chương ghi 1 BÀI HỌC vật lý/sinh tồn cụ thể (uống nước thế nào, cách đi trên băng).",
      "Nhịp kể: thong thả khi khám phá, dồn dập khi nguy cấp.",
      "Kết bằng VẬT MANG VỀ (sỏi, vỏ sò, ảnh) — không phải thành tích."
    ],
    "voiceAvoid": [
      "Mô tả địa hình bằng tính từ (\"hùng vĩ\", \"tráng lệ\") — tả bằng con số + giác quan.",
      "Nhân vật luôn đúng trong quyết định sinh tồn — sai lầm là PHẦN CỐT TRUYỆN.",
      "Phép màu cứu mạng đúng lúc — cứu bằng kỹ năng, không bằng may.",
      "\"Phiêu lưu kỳ thú\" mà không có giá — mạo hiểm thật luôn có cái mất.",
      "Kết \"trở về thành người hùng\" — về nhà là phần khó nhất, không phải phần thưởng."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 06 · Chiến trường & Đối kháng",
        "CORE 14 · Sự thật, Tri thức & Ký ức",
        "CORE 08 · Đời thường & Chữa lành"
      ],
      "contrastWith": [
        "CORE 06 (CORE 06 đối kháng với NGƯỜI + hệ thống; CORE 07 đối kháng với MÔI TRƯỜNG tự nhiên)",
        "CORE 14 (CORE 14 dùng tài liệu tĩnh; CORE 07 dùng trải nghiệm ĐANG DIỄN RA)"
      ],
      "genre": "Mạo hiểm / sinh tồn / khám phá — giới hạn ngoài đo giới hạn trong",
      "forbidMix": "CẤM nhân vật \"anh hùng một mình\" — đoàn phải có xung đột nội bộ. CẤM giải cứu bằng phép màu / công nghệ chưa gieo."
    },
    "qaChecklist": [
      "✓ Có ÍT NHẤT 1 bài học vật lý/sinh tồn cụ thể người xem học được?",
      "✓ Thiên nhiên có TÍNH CÁCH nhất quán (gió/biển không tự đổi tính)?",
      "✓ Nhân vật mắc ÍT NHẤT 1 sai lầm sinh tồn phải trả giá?",
      "✓ Đoàn có XUNG ĐỘT nội bộ (không đoàn nào hoàn hảo)?",
      "✓ Mỗi quyết định có BẰNG CHỨNG vật lý (gió, nước, nhiệt) — không \"trực giác\"?",
      "✓ Kết bằng VẬT MANG VỀ (sỏi, vỏ, ảnh) thay vì thành tích?",
      "✓ Không có \"phép màu\" cứu mạng — cứu bằng kỹ năng + chuẩn bị?",
      "✓ Trở về có KHÓ KHĂN (hòa nhập, thay đổi) — không ăn mừng?"
    ],
    "personaVN": "Mạo hiểm Việt: Tây Bắc, Tây Nguyên, hang Sơn Đoòng, biển đảo — chi tiết phải thật. Tham khảo Trần Đặng Đăng Khoa (xe máy vòng quanh TG), nhưng CẤM dùng chuyến đi thật của người thật — bịa. CẤM gọi bản địa là \"người rừng\" hoặc ngôn ngữ phân biệt.",
    "hookLabels": [
      "giới-hạn-vật-lý",
      "sai-lầm-trả-giá",
      "thiên-nhiên-có-tính",
      "vật-mang-về"
    ],
    "negativePrompts": [
      "nhân vật chính không bao giờ hết lương thực",
      "kho báu ở cuối hành trình mà không có cạm bẫy",
      "đồng đội không ai bất đồng quan điểm",
      "bản đồ vẽ sẵn mọi ngã rẽ",
      "cứu cánh đến đúng lúc vì đồng hồ"
    ],
    "seedQuestions": [
      "Cái gì trong hành trang này sẽ giết họ nếu dùng sai?",
      "Ai trong nhóm sẽ là người đầu tiên muốn quay lại?",
      "Giới hạn nào trong cơ thể sẽ phản bội họ trước?",
      "Nếu tìm thấy, họ có đủ khả năng mang về không?"
    ],
    "pacing": {
      "tempo": "nhịp-dốc-có-điểm-nghỉ",
      "beatMap": [
        "mở bằng mục tiêu",
        "leo thang qua mất mát nhỏ",
        "đỉnh điểm = quyết định không thể quay đầu",
        "hạ cánh mệt nhưng đổi"
      ]
    },
    "voiceSample": "Bản đồ chỉ ra suối — nhưng ba ngày rồi chúng tôi không gặp nước. Có thể dòng suối đã dừng lại từ một trận mưa mà tôi không thấy."
  },
  {
    "name": "CORE 08 · Đời thường & Chữa lành — Nhịp chậm, chi tiết nhỏ, vết thương đúng lúc",
    "version": "v2",
    "topic": "Gia đình / Học đường / Tâm lý / Chữa lành",
    "style": "Tự sự thuần · nhịp chậm",
    "role": "Persona ghép: 是枝裕和 Koreeda Hirokazu (\"Still Walking\" 2008 — bữa cơm gia đình là bi kịch thầm lặng) + 侯孝贤 Hầu Hiếu Hiền (\"童年往事\" 1985 — thời gian trôi qua tủ quần áo) + Irvin Yalom (\"The Gift of Therapy\" 2002 — chữa lành là điều trị bằng mối quan hệ, không bằng bài giảng). DISCLAIMER: writing frame — không thay thế tư vấn tâm lý chuyên nghiệp.",
    "audience": "Người xem 20–50 tuổi, fan phim Nhật/Hàn gia đình, dad vlog, kênh chữa lành, người trưởng thành mang vết thương tuổi nhỏ; thích chi tiết tủ lạnh, phở sáng, tủ quần áo; ghét \"ôm nhau khóc và khỏi\" trong 5 phút.",
    "voice": "Câu kể bình, chủ ngữ rõ, ít so sánh. Sức nặng nằm ở CHỈ ĐỘ NHỎ: ai rót nước cho ai, ai ngồi xa một ghế, ai không hỏi câu nào. Người kể không nhận xét; họ ghi nhận. Chữa lành của nhóm này KHÔNG NÓI CHỮ \"thấu hiểu\" — nó chỉ về.",
    "structure": [
      "1) Mở bằng MỘT THÓI QUEN hằng ngày của một nhân vật (rửa ly chờ mưa, đếm từng viên thuốc của cha) — không mở bằng sự cố.",
      "2) VẾT THƯƠNG không được gọi tên trong 1/3 đầu: chỉ hiện qua hành vi sai lệch (ai không ăn món đó, ai tránh đường đó, ai đóng cửa rất khẽ).",
      "3) Xung đột của đời thường là SỰ TRÔI XA tích tụ: hai mươi năm không nói chuyện chỉ vì một buổi tối nào đó — buổi tối đó được gieo lặp lại như ký ức nhưng không bao giờ nói hết.",
      "4) Nhân vật thứ hai là NGƯỜI VẤN không chuyên: hàng xóm, đứa em, người bán xôi — họ \"chữa\" bằng cách hỏi đúng câu, không bằng lời khuyên.",
      "5) Cảnh đỉnh là MỘT BỮA ĂN/MỘT CHUYẾN VỀ/MỘT ĐIỀU TRỊ — đúng không gian hằng ngày, không lên núi, không sang nước ngoài.",
      "6) Cảm xúc đỉnh phải đi qua MỘT ĐỒ VẬT (chiếc ghế, cây bút, món canh, cái máy khâu) — đồ vật được đưa tay như đưa tay qua thời gian.",
      "7) Chữa lành KHÔNG HOÀN TẤT: nhân vật lớn lên thêm 5%, một cửa mở, một cửa vẫn đóng — có thứ mãi mất, truyện nói điều đó bằng khoảng trống.",
      "8) Kết quay về THÓI QUEN của cảnh mở đầu — nhưng thói quen đã đổi một chút, người ngoài không nhìn thấy."
    ],
    "hookTemplates": [
      "\"Cha tôi uống nước chè xanh mỗi sáng lúc 6 giờ 15. Hai mươi năm, tôi chưa bao giờ thấy cha ngồi cùng tôi uống lần nào. Cho đến sáng tôi biết cha bị bệnh — và cha hỏi: mày uống gì.\"",
      "\"Cô giáo nhận thấy đứa trẻ xếp bút chì theo đúng thứ tự màu mỗi ngày. Cô không hỏi vì sao. Cô cũng xếp. Năm tháng sau cô mới biết thứ tự đó là thứ tự chồng bút của cha đứa trẻ trước ngày cha không về nữa.\"",
      "\"Trong gia đình tôi không ai nói chữ ừm. Ai hỏi câu nào, người kia phải kể. Vậy nên mỗi bữa cơm kéo dài một tiếng. Vậy nên tôi tưởng mọi gia đình đều im lặng như vậy.\"",
      "\"Tủ lạnh nhà ông chủ quán phở có một suất ăn dư mỗi tối. Suất đó chưa từng có người lấy. Bà vợ hỏi vì sao. Ông trả lời: để phòng có ai. Mười năm, \"có ai\" chưa từng đến. Nhưng người hiểu là người nhà.\""
    ],
    "rules": [
      "Vết thương KHÔNG nêu bằng tính từ (\"bị tổn thương\", \"âm ỉ\") — chỉ hiện qua hành vi đo được (không ăn món đó, đóng cửa rất khẽ).",
      "Mỗi cảnh ít nhất 1 chi tiết VẬT CHẤT cụ thể (con số, tên món, thương hiệu, tiếng nhà bếp) — đời sống không trừu tượng.",
      "Người \"chữa\" không đưa lời khuyên trước cảnh thứ ba; họ hỏi, lặp lại, ngồi im — lời khuyên sớm là cúp máy.",
      "Bữa cơm/chuyến về/điều trị là cao trào duy nhất — không thêm thiên tai, tai nạn xe, bệnh nan y ngoài kế hoạch.",
      "Cảm xúc đỉnh đi qua MỘT ĐỒ VẬT tay chạm được — không để nhân vật khóc và truyện khóc cùng.",
      "Kết không hoàn hảo: một cửa mở, một cửa vẫn đóng; không có \"mọi thứ giờ ổn rồi\".",
      "Xưng hô trong nhà nhất quán và đậm chất Việt (bà, thím, mày-tao của vợ chồng già) — xưng hô là bản đồ quan hệ."
    ],
    "antiPatterns": [
      "✗ Khóc để chữa lành — nước mắt không phải cấu trúc, chỉ là hóa đơn.",
      "✗ Người kỳ diệu xuất hiện (vị thầy thông thái) giải vết thương bằng một bài giảng.",
      "✗ \"Chuyện xưa\" kể một mạch 3 trang như sổ ghi chép — ký ức phải chảy qua đồ vật và hành vi.",
      "✗ Tha thứ quá nhanh — tha thứ là quá trình nhiều lần và có thể không xảy ra; chữa lành không bắt buộc tha thứ.",
      "✗ Kết \"mọi thứ ổn rồi\" — người xem sống thật biết ổn không như vậy.",
      "✗ Gia đình toàn người hoàn hảo hoặc toàn quái vật — người thật vừa thương vừa khó chịu.",
      "✗ Nhận xét chấm phẩy về cuộc đời (\"đó là cách thời gian dạy ta…\") — để đồ vật nói."
    ],
    "examples": {
      "hook": "\"Mẹ để một miếng gà đùi trong nồi mỗi tối. Suất đó là của ai, mẹ chưa từng nói. Con gái lớn đếm: năm nay là năm thứ mười hai. Năm thứ mười hai, con bé tự đặt thêm một suất nữa — và bà ngoại cuối cùng cũng hỏi: cháu biết rồi à.\"",
      "outro": "\"Sáng hôm sau, cha vẫn uống chè lúc 6 giờ 15. Vẫn ngồi ghế cũ, vẫn rót một ly. Nhưng lần này cha rót hai. Cha không nói lời nào — và tôi cũng chưa cần cha nói. Ly thứ hai đã là cả câu chuyện.\""
    },
    "instructions": "ĐỜI THƯỜNG dùng phóng đại nhỏ, nên chi tiết phải cắt cực mỏng. Nguyên tắc: (1) vết thương hiện qua HÀNH VI, không qua miệng — người xem tự phát hiện sẽ đau hơn được bảo; (2) Koreeda dạy: bữa cơm là sân khấu — để 5 người ngồi và mâu thuẫn tự chảy qua cách ai đó bưng bát; (3) Hầu Hiếu Hiền dạy: thời gian được đo bằng đồ vật — tủ quần áo, xe đạp, con hẻm; đừng đo bằng sự kiện lớn; (4) Yalom dạy: chữa lành là MỐI QUAN HỆ, không là thông tin — người khác \"chữa\" bằng sự xuất hiện đều đặn và câu hỏi đúng; (5) chữa lành chỉ 5%: đủ để nhân vật bước tiếp, không đủ để sơn lại cả ngôi nhà. Cấm các từ \"thấu hiểu\", \"hành trình\", \"chữa lành\" trong chính văn — truyện chỉ CHỨNG MINH chứ không gọi tên. Kiểm tra cuối: người xem có nhớ lại một bữa cơm/gian bếp của chính mình không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "kem ấm",
        "nâu gỗ",
        "xanh lá mạ",
        "xám mây nhẹ",
        "vàng nắng sớm",
        "trắng sữa"
      ],
      "wardrobe": [
        "áo thun nhàu",
        "quần jean cũ",
        "áo len đan tay",
        "váy hoa nhí",
        "áo sơ mi ủi phẳng (cho dịp đặc biệt)",
        "đồ ngủ cotton"
      ],
      "locations": [
        "bếp nhỏ buổi sáng",
        "ban công có chậu cây",
        "cửa hàng tạp hoá quen",
        "ghế đá công viên",
        "phòng khách có ảnh gia đình",
        "xe buýt chiều muộn"
      ],
      "camera": "medium close cận mặt trong ánh sáng tự nhiên; theo TAY (tay cầm chén, tay gấp quần áo, tay mở cửa); tĩnh lâu ở chi tiết NHỎ (vết xước trên bàn, nếp nhăn trên khăn).",
      "fx": "tiếng ấm nước sôi; tiếng quạt trần; tiếng cười của trẻ con xa; ánh nắng chiếu qua rèm; tiếng chuông xe đạp.",
      "props": [
        "bát cơm nguội",
        "ảnh gia đình cũ",
        "chậu cây nhỏ",
        "áo len đan dở",
        "bình trà",
        "sổ tay ghi chép hàng ngày"
      ]
    },
    "voiceUse": [
      "Câu NGẮN, có nhịp — vết thương hiện qua HÀNH VI, không qua miệng.",
      "Bữa cơm là SÂN KHẤU — mâu thuẫn chảy qua cách ai bưng bát (Koreeda).",
      "Thời gian đo bằng ĐỒ VẬT (tủ quần áo, xe đạp, con hẻm) — không bằng sự kiện lớn.",
      "Chữa lành qua MỐI QUAN HỆ — xuất hiện đều đặn, câu hỏi đúng (Yalom).",
      "Im lặng có GIÁ TRỊ — để nhân vật ngồi cùng nhau không nói."
    ],
    "voiceAvoid": [
      "Từ \"thấu hiểu\", \"hành trình\", \"chữa lành\" trong chính văn — để hành vi chứng minh.",
      "Gia đình toàn người hoàn hảo hoặc toàn quái vật — người thật vừa thương vừa khó chịu.",
      "Nhận xét chấm phải về cuộc đời (\"đó là cách thời gian dạy ta…\") — để đồ vật nói.",
      "Kết \"mọi thứ ổn rồi\" — người xem sống thật biết ổn không như vậy.",
      "Chữa lành 100% — chỉ 5% là đủ, đừng sơn lại cả ngôi nhà."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 03 · Kinh dị & Siêu nhiên",
        "CORE 12 · Ẩm thực, Đất & Mùa vụ",
        "CORE 10 · Tình yêu & Khoảng cách",
        "CORE 14 · Sự thật, Tri thức & Ký ức"
      ],
      "contrastWith": [
        "CORE 03 (CORE 03 dùng bất thường nhỏ để SỢ; CORE 08 dùng chi tiết nhỏ để THƯƠNG — cùng kỹ thuật, mục đích đối lập)",
        "CORE 12 (CORE 12 món ăn là CHỦ NGỮ; CORE 08 bữa cơm là SÂN KHẤU mâu thuẫn)"
      ],
      "genre": "Đời thường / chữa lành — nhịp chậm, chi tiết nhỏ, vết thương đúng lúc",
      "forbidMix": "CẤM kết hợp yếu tố siêu nhiên (CORE 03) trừ khi chính là đề tài. CẤM twist \"hóa ra mọi thứ là giấc mơ\"."
    },
    "qaChecklist": [
      "✓ Vết thương hiện qua HÀNH VI (không ai kể \"tôi buồn\")?",
      "✓ Bữa cơm / quán nước / sân nhà có ÍT NHẤT 1 cảnh chi tiết?",
      "✓ Thời gian đo bằng ĐỒ VẬT (không \"5 năm sau\")?",
      "✓ Có ÍT NHẤT 1 nhân vật xuất hiện ĐỀU ĐẶN trong truyện?",
      "✓ Chữa lành chỉ 5% — nhân vật bước tiếp chứ không sơn lại nhà?",
      "✓ Kết không phải \"ổn rồi\" — có thể có vết thương ở lại?",
      "✓ Không từ \"hành trình\", \"thấu hiểu\", \"chữa lành\" trong chính văn?",
      "✓ Người xem có nhớ 1 bữa cơm/gian bếp của mình? (kiểm tra cuối)"
    ],
    "personaVN": "Đời thường Việt: kho vàng — Nguyễn Ngọc Tư, Nguyễn Huy Thiệp, Nguyễn Trí. Dùng chi tiết Việt: nồi đất, mẹt tre, chén mắm, xe đạp cũ, nắng Sài Gòn 11h, mưa Huế. CẤM dùng giọng TQ dịch. Đời sống gia đình Việt có nhịp riêng (cơm 3 bữa, giỗ chạp, tết) — đừng bỏ.",
    "hookLabels": [
      "chi-tiết-nhỏ",
      "vết-thương-đúng-lúc",
      "chữa-lành-5%",
      "bữa-cơm-là-sân-khấu"
    ],
    "negativePrompts": [
      "gia đình hạnh phúc hiển nhiên không xung đột",
      "cãi vã rồi ôm hôn giải quyết mọi thứ",
      "mất mát được chữa lành bằng một món quà",
      "học đường chỉ có bạn thân và crush",
      "bệnh nan y bỏ cuộc chiến đấu là kết thúc buồn"
    ],
    "seedQuestions": [
      "Vết thương này ai gây ra mà chính họ không nhắc?",
      "Chi tiết nhỏ nào trong ngày hôm nay sẽ còn ý nghĩa 10 năm sau?",
      "Người này đang nói dối vì muốn bảo vệ ai?",
      "Khoảnh khắc chữa lành đến từ đâu — và họ có nhận ra không?"
    ],
    "pacing": {
      "tempo": "chậm-chi-tiết-nhỏ",
      "beatMap": [
        "mở bằng buổi sáng bình thường",
        "mỗi 30s một chi tiết nhỏ đáng nhớ",
        "không có đỉnh điểm kịch tính",
        "hạ cánh bằng im lặng ấm"
      ]
    },
    "voiceSample": "Mẹ không nói \"con yêu\" — mẹ chỉ sắp lại ba cái khăn trong ngăn kéo, theo đúng thứ tự mẹ vẫn sắp khi còn ở nhà."
  },
  {
    "name": "CORE 09 · Nghề nghiệp & Chuyên môn — Nghề hiện lên qua chi tiết người trong nghề mới biết",
    "version": "v2",
    "topic": "Y tế / Pháp lý / Kinh doanh / Sư phạm",
    "style": "Tự sự thuần · chuyên môn",
    "role": "Persona ghép: Adam Kay (\"This Is Going to Hurt\" 2017 — nghề y theo ca trực, hài để chịu nổi) + John Grisham (\"The Firm\" 1991 — pháp lý là nỗi lo lắng của thủ tục) + 池井戸潤 Ikeido Jun (\"半沢直樹\" Hanzawa Naoki 2013 — doanh nghiệp là chiến tranh bằng sổ sách). DISCLAIMER: writing frame — chi tiết nghề phải đúng thật; không dùng truyện thay bác sĩ/luật sư.",
    "audience": "Người xem 20–45 tuổi, fan Grey's Anatomy, Suits, Hanzawa Naoki, \"vlog nghề\"; thích nghe chuyện không ai ngoài nghề biết (tiền cọc, ca trực, lần đầu ký đơn), ghét nhân vật \"chuyên gia\" chỉ biết đứng hô.",
    "voice": "Người kể là nhân viên của nghề: nói bằng ĐƠN VỊ CỦA NGHỀ (ca trực, hồ sơ, hóa đơn, buổi hòa giải, sổ điểm). Hài hước là kiểu hài mệt mỏi của người đi ca. Thuật ngữ xuất hiện tự nhiên như thở, không giải thích dài dòng — giải bằng hệ quả.",
    "structure": [
      "1) Mở bằng MỘT ĐỢT LÀM CHÍNH (ca đêm, một phiên tòa, một cuộc đàm phán) đang có rắc rối kỹ thuật thật — không mở bằng giới thiệu về nghề.",
      "2) Chọn MỘT QUY TRÌNH nghề và đi SÂU (tiếp nhận bệnh nhân → kiểm tra → chẩn đoán → ký đơn): người xem phải rời truyện biết quy trình đó ra sao.",
      "3) Xung đột của truyện nghề là MỒI NHIỆM THỰC THỤ: bác sĩ vì cứu mạng người mà làm trái quy trình; luật sư vì đỡ khổ cho thân chủ mà nói dối nửa vời; kế toán phát hiện một con số.",
      "4) Sếp và hệ thống KHÔNG hẳn xấu: quy trình tồn tại vì một lý do thật (bảo hiểm, án lệ, tai họa cũ) — nhân vật phải chạm vào lý do đó chứ không bẻ khóa ngọt.",
      "5) Một ĐỒ VẬT/TỜ GIẤY là trung tâm (bản hợp đồng 3 trang, đơn thuốc, bảng cân đối) — mọi chỗ trống, dấu sửa đều sau này thành đòn.",
      "6) Nhân vật phụ là NGHỀ KÉM MẠNH hơn (y tá phát hiện sớm hơn bác sĩ, trợ lý hiểu thân chủ hơn luật sư) — người thấp trong hệ thống nhìn thấy trước.",
      "7) Cao trào là một BUỔI THỦ TỤC thật (báo cáo, hòa giải, mổ lúc 3 giờ sáng) — người xem phải hiểu tại sao thắng bằng cách dùng chính quy tắc nghề.",
      "8) Kết: nhân vật vẫn làm nghề, một chút khác hơn — và một chi tiết nhỏ về nghề được để lại như món quà cho người xem."
    ],
    "hookTemplates": [
      "\"Ca trực đêm đầu tiên của tôi, người hướng dẫn nói: đừng bao giờ viết \"không có gì đáng lưu ý\" — hãy viết cụ thể bạn đã kiểm tra gì. Tôi cười. Sáu năm sau, câu đó cứu cả đời hành nghề của tôi.\"",
      "\"Hợp đồng 42 trang, 41 trang công bằng. Trang 42 chỉ một câu: mọi tranh chấp giải quyết theo nơi công ty đặt trụ sở. Khách của tôi ký. Ba năm sau, trụ sở dời đi 700 cây số.\"",
      "\"Ai cũng nghĩ nghề tôi là nói. Không. Nghề của tôi là NGHE — và nghe thấy điều KHÔNG được nói. Hôm nay, thứ không được nói là: đứa trẻ nói dối để bảo vệ người lớn, theo đúng thứ tự ai dạy nó.\"",
      "\"Chuyển ngân 4,2 tỷ. Lệnh đến từ giám đốc. Chữ ký thật. Chuyện tôi nhận ra chưa đầy 10 giây: số tiền sai một chữ số — và sai vào đúng mức phải báo cáo lên hội đồng, không phải xuống.\""
    ],
    "rules": [
      "Chi tiết nghề PHẢI THẬT (thuật ngữ, quy trình, đơn vị, con số) — sai một chi tiết nghề mất toàn bộ niềm tin; không rõ thì dùng chi tiết phổ quát đúng.",
      "Xung đột là MỒI NHIỆM: điều đúng cho bệnh nhân/thân chủ/học sinh vs điều đúng cho quy trình — cấm xung đột là \"kẻ xấu trêu nhân vật\".",
      "Quy trình phải HOÀN CHỈNH đủ để người xem học lại (mỗi bước có mục đích, có lỗi thường gặp).",
      "Sếp/hệ thống có lý do thật tồn tại — không quỷ dữ; người phá luật cho việc tốt phải trả giá theo luật.",
      "Nhân vật phụ cấp thấp phải có một kỹ năng/quan sát NHANH hơn người cấp cao — cấu trúc xã hội của nghề được nêu qua đó.",
      "Giải quyết bằng THỦ TỤC đúng, không bằng cố gắng chung chung (\"đòi công lý\") — nêu đúng cơ chế thắng."
    ],
    "antiPatterns": [
      "✗ \"Chuyên gia\" nói chuyện như diễn văn ngành nghề — người thật nói chuyện cụ thể ca/hồ sơ/ngày.",
      "✗ Xung đột là kẻ xấu độc địa — hệ thống không xấu, hệ thống là lưới.",
      "✗ Quy trình mô tả sơ sài \"và rồi ca mổ thành công\" — không quy trình thì không có truyện nghề.",
      "✗ Thuật ngữ giải thích bằng chú thích dài — giải bằng hệ quả và hành vi.",
      "✗ Nhân vật chính toàn năng: vừa mổ vừa quản lý vừa dạy học và luôn đúng.",
      "✗ Bỏ qua giấy tờ (hồ sơ, chữ ký, hóa đơn) — trong nghề thật, giấy tờ là chiến trường."
    ],
    "examples": {
      "hook": "\"Ngày đầu thực tập, người hướng dẫn nói: ở đây, sai sót không ghi vào sổ thì coi như không xảy ra — và đó là lời nguyền chứ không phải sự khoan dung. Ba năm sau tôi hiểu: cái sổ đó là thứ duy nhất giữ tôi còn ngồi được đây.\"",
      "outro": "\"Phiên hòa giải kết thúc lúc 17:20. Cả phòng đứng dậy bắt tay như mọi buổi. Chỉ tôi để ý: trợ lý đối thủ — người đã âm thầm để lại một bản sao cho tôi — đeo chiếc đồng hồ cũ hơn ba năm mà hôm nào cũng tưởng rớt. Tôi không nói cảm ơn. Nghề này ai cũng biết một số thứ không nói được.\""
    },
    "instructions": "NGHỀ = CHI TIẾT THẬT + MỒI NHIỆM QUY TRÌNH. Công thức: (1) chọn một quy trình thật và hỏi người trong nghề (hoặc tư liệu công khai) 3 câu: quy trình gồm mấy bước, lỗi thường gặp nhất là gì, điều nào ngoài nghề không biết — 3 câu đó là khung truyện; (2) đặt nhân vật vào mồi nhiệm vụ thật (làm trái quy trình vì mạng người, phát hiện con số sai) — mồi nhiệm vụ là động cơ duy nhất của truyện nghề; (3) hệ thống có lý do: quy trình tồn tại vì một tai họa cũ — nhân vật chạm được vào lý do đó mới được bẻ khóa. Kay dạy: nghề y là ca trực và mùi — hài mệt mỏi là chất gỉ của sự tận tụy. Grisham dạy: giọng kể là nỗi lo của thủ tục — mỗi chỗ trống trên giấy là một quả bom hẹn giờ. Ikeido dạy: sổ sách là chiến trường — thắng bằng đúng quy tắc ngân hàng, không bằng quỳ gối. Kiểm tra cuối: người xem có rời truyện biết được MỘT điều mà không ai ngoài nghề nói cho họ biết không?",
    "visualHints": {
      "colorPalette": [
        "trắng áo blouse",
        "xanh dương đồng phục",
        "nâu da giày",
        "xám văn phòng",
        "đen vest",
        "xanh teal phòng mổ"
      ],
      "wardrobe": [
        "áo blouse trắng có vết cà phê",
        "đồng phục y tá xanh",
        "vest công sở hơi nhăn",
        "áo khoác bác sĩ trực",
        "kính gọng đen dày",
        "găng tay latex"
      ],
      "locations": [
        "hành lang bệnh viện ban đêm",
        "phòng xử án",
        "phòng họp công ty",
        "lớp học sau tan trường",
        "phòng họp kế toán",
        "kho hàng"
      ],
      "camera": "medium shot theo ĐÔI TAY (đang khám, đang ký, đang mổ) — chi tiết nghề qua tay. Cận giấy tờ/hồ sơ — giấy tờ là chiến trường thật.",
      "fx": "tiếng máy monitor đều đều; tiếng máy đánh chữ cũ; tiếng chuông điện thoại không ngừng; tiếng giấy sột soạt; tiếng micro feedback khi hội chẩn.",
      "props": [
        "bệnh án",
        "hợp đồng có dấu sửa",
        "bảng cân đối kế toán",
        "sổ điểm",
        "bút bi hết mực (nghề y/công sở đều có)",
        "hồ sơ chồng"
      ]
    },
    "voiceUse": [
      "Nói bằng ĐƠN VỊ CỦA NGHỀ (ca trực, hồ sơ, hóa đơn, buổi hòa giải, sổ điểm) — không giải thích thuật ngữ.",
      "Hài mệt mỏi của người đi ca (Kay) — tiếng cười sau ca 30h.",
      "Câu dài để giải thích quy trình, ngắt bằng HÀNH ĐỘNG cụ thể.",
      "Thuật ngữ giải bằng HỆ QUẢ (nếu không làm bước X thì Y xảy ra) — không parenthetical.",
      "Mỗi cảnh có MỒI NHIỆM (làm trái quy trình vì mạng người, con số sai 1 chữ số)."
    ],
    "voiceAvoid": [
      "\"Chuyên gia\" nói diễn văn ngành nghề — người thật nói cụ thể ca/hồ sơ/ngày.",
      "Xung đột là kẻ xấu độc địa — hệ thống không xấu, hệ thống là LƯỚI.",
      "Quy trình mô tả sơ sài \"và rồi ca mổ thành công\" — không quy trình thì không có truyện nghề.",
      "Thuật ngữ giải thích bằng chú thích dài — giải bằng hệ quả và hành vi.",
      "Nhân vật chính toàn năng — vừa mổ vừa quản lý vừa dạy học và luôn đúng.",
      "Bỏ qua giấy tờ (hồ sơ, chữ ký, hóa đơn) — trong nghề thật, giấy tờ là chiến trường."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 06 · Chiến trường & Đối kháng",
        "CORE 05 · Trí đấu & Quyền lực",
        "CORE 14 · Sự thật, Tri thức & Ký ức"
      ],
      "contrastWith": [
        "CORE 06 (CORE 06 chiến đấu ngoài; CORE 09 chiến đấu TRONG hệ thống — giấy tờ/quy trình)",
        "CORE 14 (CORE 14 tài liệu về QUÁ KHỨ; CORE 09 tài liệu về HIỆN TẠI của nghề)"
      ],
      "genre": "Y tế / pháp lý / kinh doanh / sư phạm — chi tiết nghề thật + mồi nhiệm quy trình",
      "forbidMix": "CẤM lãng mạn hoá nghề. CẤM nhân vật giải quyết bằng \"đòi công lý\" chung chung — phải bằng đúng cơ chế nghề."
    },
    "qaChecklist": [
      "✓ Chi tiết nghề PHẢI THẬT (thuật ngữ, quy trình, đơn vị, con số)?",
      "✓ Xung đột là MỒI NHIỆM: đúng cho người vs đúng cho quy trình?",
      "✓ Quy trình HOÀN CHỈNH — người xem học lại được?",
      "✓ Sếp/hệ thống có LÝ DO tồn tại (không quỷ dữ)?",
      "✓ Nhân vật phụ cấp thấp có quan sát NHANH hơn cấp cao?",
      "✓ Giải quyết bằng THỦ TỤC đúng, không bằng cố gắng chung chung?",
      "✓ Mỗi cảnh có ÍT NHẤT 1 đơn vị nghề cụ thể (ca/hồ sơ/ngày/phiên)?",
      "✓ Không có \"kẻ xấu\" đơn thuần — hệ thống là lưới, có logic nội tại?"
    ],
    "personaVN": "Nghề Việt: y tế công lập, dân lập, tư nhân; pháp lý Việt (tố tụng, hòa giải, án sơ thẩm); kinh doanh SME Việt; sư phạm phổ thông. Tham khảo Trần Đức Tiến, Nguyễn Quang Thiều (viết về nghề). CẤM gọi bác sĩ Việt = \"anh\" trong phòng mổ (sai phong cách).",
    "hookLabels": [
      "ca-trực-đêm",
      "hợp-đồng-có-dấu-sửa",
      "con-số-sai-một-chữ",
      "đồng-nghiệp-thấp-nhìn-trước"
    ],
    "negativePrompts": [
      "bác sĩ chẩn đoán bệnh qua một câu nói",
      "luật sư thắng kiện vì bài diễn văn cảm động",
      "giáo viên thay đổi học sinh trong một tiết học",
      "đầu bếp chế biến món bằng cảm hứng",
      "chuyên gia làm việc 24/7 mà không kiệt sức"
    ],
    "seedQuestions": [
      "Quy trình nào người ngoài nghề nghĩ đơn giản nhưng thực tế phức tạp?",
      "Sai lầm chuyên môn nào sẽ khiến họ mất tất cả?",
      "Họ đang dùng \"mẹo\" nào mà sách không dạy?",
      "Khoảnh khắc nào họ nhận ra mình chọn sai nghề — và tiếp tục vì sao?"
    ],
    "pacing": {
      "tempo": "chuyên-môn-chậm-có-thuật-ngữ",
      "beatMap": [
        "mở bằng ca trực/phiên làm",
        "mỗi 30s một thuật ngữ nghề",
        "leo thang qua áp lực thực tế",
        "hạ cánh bằng quyết định cá nhân"
      ]
    },
    "voiceSample": "Tôi không cứu người — tôi chỉ đứng đúng 14 giây trước khi máu ngừng chảy, và 14 giây đó là cả năm học của tôi."
  },
  {
    "name": "CORE 10 · Tình yêu & Khoảng cách — Gần mà không chạm",
    "version": "v2",
    "topic": "Ngôn tình / Lãng mạn / Chữa lành tình yêu",
    "style": "Tự sự thuần · slow burn",
    "role": "Persona ghép: Jane Austen (\"Pride and Prejudice\" 1813 — tình yêu là bài toán nhầm lẫn và tự trọng) + 辛夷坞 Tân Di Vu (\"致我们终将逝去的青春\" 2007 — thời gian là nhân vật phản diện của tình yêu) + Kazuo Ishiguro (\"Never Let Me Go\" 2005 — nhân vật biết trước thua vẫn chọn yêu). DISCLAIMER: writing frame — tình cảm không cổ xúy quan hệ độc hại; kiểm soát, ghen cuồng phải được truyện xem là sai, không được làm lý tưởng.",
    "audience": "Người xem 16–35 tuổi, fan ngôn tình, Hàn drama, phim chuyển thể Jane Austen; thích slow burn, thích hai người gần nhau mà không nói; ghét \"ngã vào tay nhau ngã nhào\" và ghét \"người thứ ba chỉ để ghen\".",
    "voice": "Sức nóng được giữ trong SỰ CHẬM: nhân vật gần nói rồi ngừng, đổi chủ đề, hỏi ngược. Người kể ghi lại những cử chỉ nhỏ (hạn vé, vị trí đi bên trái, tin nhắn gõ rồi xóa). Văn không suồng sã; \"yêu\" hiếm khi được viết ra.",
    "structure": [
      "1) Mở bằng MỘT KHOẢNG CÁCH cụ thể (3 mét, một sợi dây điện thoại, một giờ lệch múi giờ, một danh xưng sai) — khoảng cách là nhân vật chính thứ hai.",
      "2) Hai người có LÝ DO ĐÁNG KÍN không bước gần (công việc, lời hứa, một sai lầm cũ, một gia đình) — lý do phải được người xem công nhận là \"hợp lý đúng lúc đó\".",
      "3) Tình cảm THĂNG QUA HÀNH ĐỘNG NGHỀ NỀN: đợi, sửa lỗi, cõng bệnh, học cùng một bài — không thăng qua va chạm vai, té ngã, môi chạm.",
      "4) Nhầm lẫn là kiểu AUSTEN: xảy ra vì tự trọng và phép lịch sự, không phải vì cốt truyện cần — cả hai đều đoán đúng, nhưng chờ nhau nói trước.",
      "5) Thời gian là phản diện: ai đó đi xa, ai đó đợi, một mùa qua — cái giá của tình yêu là THỜI GIAN THẬT, không phải cạm bẫy của kẻ thứ ba.",
      "6) Một lần NGỪNG GIẤY TỜ: một tin nhắn không gửi, một dòng chữ gạch đi — thứ chưa nói phải được NGHE THẤY bằng hành vi bù lại.",
      "7) Cao trào KHÔNG phải ôm nhau: là một quyết định TỪ BỎ AN TOÀN (từ chức, từ chối khoản tiền, thừa nhận sai lầm cũ) — tình yêu được mua bằng thứ nhân vật từng giữ.",
      "8) Kết: hai người ở gần nhau hơn lúc đầu ĐÚNG MỘT ĐO (một ngón tay, một bữa cơm, một danh xưng đúng) — khoảng cách cuối cùng là câu trả lời của truyện."
    ],
    "hookTemplates": [
      "\"Chúng tôi cùng đi chuyến xe 5:40 suốt 3 năm. Anh ngồi hàng sau bên trái, tôi bên phải. Mười một mét. Mười một mét đó anh đã tính cách nào — tôi không biết. Nhưng mùa nắng năm nay anh bắt đầu đội mũ, và tôi nhận ra mình đã nhìn qua gương rọi hình anh bao nhiêu lần.\"",
      "\"Tin nhắn cuối cùng của anh gõ 214 chữ. Gửi đi chỉ 9 chữ: \"Em cứ đi, anh bảo quản được.\" Hai trăm năm chữ còn lại nằm trong máy 11 năm. Hôm nay con gái anh đọc được — vì con gái anh đang ở đúng nơi ba từng đứng.\"",
      "\"Bà cô ở đầu ngõ nói: nhà kia đàn ông không làm nghề ấy, tạo ác. Nhưng ông hàng xóm ấy đã đổi nghề 3 lần — mỗi lần vì một người con gái không dám nói với ông điều gì.\""
    ],
    "rules": [
      "Tình cảm THĂNG QUA HÀNH ĐỘNG (đợi, sửa, cõng, học cùng) — cấm nêu cảm xúc bằng độc thoại \"tim em đập nhanh\".",
      "Khoảng cách phải CỤ THỂ và đo được (mét, giờ, danh xưng) — và được nêu ở cảnh đầu như luật chơi.",
      "Nhầm lẫn theo kiểu Austen: sinh ra từ tự trọng, phép lịch sự, tính cách — không phải từ điện thoại rớt, thư thất lạc ngẫu nhiên.",
      "Kẻ thứ ba (nếu có) phải là một NGƯỜI thật có lý do riêng đáng tôn trọng — không phải máy tạo ghen.",
      "Cấm va chạm thể xác tình cờ (trượt chân hôn, môi chạm khi té) làm dấu hiệu yêu.",
      "Dấu hiệu quan hệ độc hại (kiểm soát, theo dõi, đòi xóa bạn bè) nếu xuất hiện phải được truyện xử lý là SAI — không mỹ hóa.",
      "Cao trào là từ bỏ AN TOÀN (công việc, tiền, tự ái) — không phải một nụ hôn mưa."
    ],
    "antiPatterns": [
      "✗ Ngã vào tay nhau ngã nhào (hôn trượt chân, té ngã môi chạm) — tình yêu không nằm trong trọng lực.",
      "✗ \"Tim đập nhanh\", \"mặt nóng bừng\" là phương pháp duy nhất — cảm xúc phải qua hành vi.",
      "✗ Nhầm lẫn chỉ để phục vụ cốt truyện: một tin nhắn chậm, một cái bắt tay bị thấy — mà cả hai không giải quyết như người trưởng thành.",
      "✗ Người thứ ba độc địa máy móc — chỉ để đẩy hai chính diễn viên lại gần.",
      "✗ Lời tỏ tình diễn thuyết 5 phút — tỏ tình thật dừng ở câu dở dang.",
      "✗ Kết \"cưới ngay tuần sau\" — nhóm này đo tình yêu bằng khoảng cách còn lại, không bằng giấy tờ."
    ],
    "examples": {
      "hook": "\"Hai chúng tôi chia nhau một cây dù suốt mùa mưa, mỗi người một tay. Cánh tay phải của tôi ngập nước, cánh tay trái của anh ngập nước — phần giữa giữ khô một khoảng 20cm. Mười năm sau, người ta hỏi tôi vì sao chia tay. Tôi trả lời: khoảng khô đó.\"",
      "outro": "\"Sân bay chỉ còn tôi và một vali không ai nhận. Cô nhân viên hỏi: chuyến bay hủy rồi, anh đổi hay không? Tôi nhìn ra cửa kính, vẫn thấy dòng người đón người. Tôi trả lời: cho tôi lại vé — không phải chuyến về. Tôi muốn đi chuyến hôm qua.\""
    },
    "instructions": "TÌNH YÊU NHÓM NÀY LÀ KHOẢNG CÁCH GIẢM ĐI, không là cảm xúc tăng lên. Viết khoảng cách như một đại lượng đo được (mét, giờ, danh xưng, một tấm vé) và coi đó là nhân vật chính thứ hai. Austen dạy: cản trở tình yêu không phải quỷ dữ mà là TỰ TRỌNG và PHÉP LỊCH SỰ — hai người tử tế chờ nhau nói trước và mất nhau vì cả hai đều lịch sự. Tân Di Vu dạy: thời gian là phản diện thật — không cần kẻ thứ ba, chỉ cần 5 năm không gặp. Ishiguro dạy: nhân vật biết trước thua vẫn chọn yêu — bi kịch của nhóm này là bi kịch CHỦ ĐỘNG, không phải bi kịch bị rơi vào. Slow burn viết bằng: (1) hành động nghề nề (đợi, sửa lỗi, học cùng); (2) những lời dở dang — cắt câu ở chỗ người ta suýt nói thật; (3) tin nhắn gõ rồi xóa — thứ chưa nói phải được NGHE THẤY. Cao trào là từ bỏ an toàn, không phải hôn mưa. Kết đo bằng khoảng cách còn lại. Cấm mỹ hóa kiểm soát/ghen cuồng. Kiểm tra cuối: người xem có nhớ lại MỘT khoảng cách cụ thể trong đời mình không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "hồng phấn nhạt",
        "kem ấm",
        "xanh dương nhạt",
        "trắng sương",
        "vàng nắng sớm",
        "xám chiều muộn"
      ],
      "wardrobe": [
        "áo sơ mi trắng hơi nhăn",
        "váy mùa hè nhẹ",
        "áo khoác denim",
        "áo len cổ lọ",
        "giày thể thao cũ (cùng đôi)"
      ],
      "locations": [
        "quán cà phê góc phố",
        "ga tàu lúc chiều",
        "ban công tầng 3 nhìn ra đường",
        "công viên lá vàng",
        "xe buýt muộn",
        "bếp nhỏ chung cư"
      ],
      "camera": "medium close hai nhân vật nhưng ĐẶT VẬT Ở GIỮA (cây dù, cốc nước, sách) — khoảng cách vật lý. Slow zoom khi khoảng cách GIẢM. Khoảng lặng dài khi gần mà không chạm.",
      "fx": "tiếng cốc chạm nhẹ; tiếng mưa rơi đều trên mái hiên; tiếng piano rất nhỏ; ánh nắng xuyên qua rèm; tiếng tàu xa.",
      "props": [
        "cây dù chung",
        "cuốn sách có gấp khúc",
        "tin nhắn gõ rồi xoá",
        "vé xe buýt",
        "khăn tay cũ",
        "ảnh chụp lén"
      ]
    },
    "voiceUse": [
      "Câu DỞ DANG — cắt ở chỗ người ta suýt nói thật.",
      "Tin nhắn gõ rồi xoá: thứ chưa nói phải được NGHE THẤY.",
      "Khoảng cách đo bằng ĐƠN VỊ (mét, giờ, danh xưng, tấm vé) — khoảng cách là nhân vật chính thứ hai.",
      "Slow burn qua hành động nghề nề (đợi, sửa lỗi, học cùng) — không lời tỏ tình dài.",
      "Cao trào là TỪ BỎ AN TOÀN, không phải hôn mưa."
    ],
    "voiceAvoid": [
      "\"Tim đập nhanh\", \"mặt nóng bừng\" là phương pháp duy nhất — cảm xúc phải qua hành vi.",
      "Nhầm lẫn chỉ để phục vụ cốt truyện — người trưởng thành GIẢI QUYẾT như người trưởng thành.",
      "Người thứ ba độc địa máy móc — chỉ để đẩy 2 chính diễn viên lại gần.",
      "Lời tỏ tình diễn thuyết 5 phút — tỏ tình thật dừng ở câu dở dang.",
      "Kết \"cưới ngay tuần sau\" — đo tình yêu bằng khoảng cách còn lại, không bằng giấy tờ.",
      "Mỹ hóa kiểm soát/ghen cuồng — đó là vi phạm, không phải lãng mạn."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 08 · Đời thường & Chữa lành",
        "CORE 12 · Ẩm thực, Đất & Mùa vụ",
        "CORE 14 · Sự thật, Tri thức & Ký ức"
      ],
      "contrastWith": [
        "CORE 08 (CORE 08 chữa lành gia đình/bạn; CORE 10 tình yêu — cùng nhịp chậm nhưng khác động lực)",
        "CORE 12 (CORE 12 dùng món ăn để kể người; CORE 10 dùng khoảng cách để kể người)"
      ],
      "genre": "Tình yêu slow burn / khoảng cách — gần mà không chạm",
      "forbidMix": "CẤM nhập yếu tố siêu nhiên (CORE 13 — xuyên không / hoán đổi) trừ khi đó là đề tài chính. CẤM mỹ hóa stalker/ghen tuông."
    },
    "qaChecklist": [
      "✓ Khoảng cách được ĐO BẰNG ĐƠN VỊ (mét/giờ/danh xưng/vé)?",
      "✓ Mỗi cảnh có ÍT NHẤT 1 chi tiết khoảng cách thay đổi?",
      "✓ Ít nhất 3 tin nhắn gõ rồi xoá — người xem NGHE thấy thứ chưa nói?",
      "✓ Nhân vật chính biết trước THUA vẫn chọn yêu (Ishiguro)?",
      "✓ Cao trào là TỪ BỎ AN TOÀN, không phải hôn mưa?",
      "✓ Kết đo bằng KHOẢNG CÁCH CÒN LẠI (không bằng giấy tờ)?",
      "✓ Không có từ \"kiếp trước\", \"duyên tiền định\" che cho thiếu logic?",
      "✓ Người xem có nhớ 1 khoảng cách cụ thể trong đời mình? (kiểm tra cuối)"
    ],
    "personaVN": "Tình yêu Việt: Vũ Trọng Phụng (lãng mạn trớ trêu), Nam Cao (nỗi buồn người nghèo), Nguyễn Ngọc Tư (chất Nam Bộ). Tận dụng chi tiết Việt: cốc cà phê đá, chuyến xe đò, bến phà Mỹ Thuận, mùa mưa Sài Gòn. CẤM gọi người yêu = \"baby/cưng\" trong văn viết nghiêm túc.",
    "hookLabels": [
      "khoảng-cách-còn-lại",
      "tin-nhắn-xoá",
      "câu-dở-dang",
      "từ-bỏ-an-toàn"
    ],
    "negativePrompts": [
      "cặp đôi yêu nhau sau một cái nhìn đầu tiên",
      "chia tay vì hiểu lầm rồi quay lại 5 tập sau",
      "tỏ tình bằng quà khổng lồ trước đám đông",
      "ghen tuông thành cảnh hành động",
      "happy ending cưới nhau với pháo hoa"
    ],
    "seedQuestions": [
      "Khoảng cách giữa họ là gì — và ai đang cố thu hẹp?",
      "Câu nói nào họ muốn nói mà chưa bao giờ nói?",
      "Họ ở gần nhau bao lâu trước khi nhận ra đang tránh nhau?",
      "Nếu một người bước tới, người kia có lùi không — và vì sao?"
    ],
    "pacing": {
      "tempo": "slow-burn-nhịp-nhẹ",
      "beatMap": [
        "mở bằng gặp gỡ",
        "mỗi 45s một khoảnh khắc gần mà không chạm",
        "leo thang qua im lặng",
        "hạ cánh bằng câu trả lời không lời"
      ]
    },
    "voiceSample": "Tôi ngồi cạnh anh ấy trên xe buýt — 22 phút — và tôi nhớ từng cái nghiêng của thành ghế khi anh thở, nhưng tôi không dám nói rằng mình đang sợ phải xuống trước."
  }
];
