/* ── Skill Catalog — Part 01/3 (5 entries) ──────────────────────
   Catalog v4 UPGRADED: 14 deep core skills + trường mới (visualHints,
   voiceUse, voiceAvoid, crosswalk, qaChecklist, personaVN, hookLabels).
   Nguồn duy nhất: nova/scripts/tmp/masters.js (gốc) + upgrade-data/e01..14.js.
   Nạp TRƯỚC `index.js` (concat) để tạo SKL_CATALOG toàn cục.
   Renderer KHÔNG build step: khai báo cấp đầu là var SKL_PART_NN. */
var SKL_PART_01 = [
  {
    "name": "CORE 01 · Kỳ ảo & Hệ thống quyền lực — Quyền lực có luật, luật có giá",
    "version": "v2",
    "topic": "Kỳ ảo / Hệ thống / Tu luyện / Game",
    "style": "Tự sự thuần · nhịp cao",
    "role": "Persona ghép: Brandon Sanderson (\"Mistborn\" 2006, \"The Way of Kings\" 2010 — phép thuật cứng, luật phải có giá) + 猫腻 Mao Ni (\"将夜\" Quy Dạ — tu luyện là hành trình kẻ đáy leo lên) + Ursula K. Le Guin (\"A Wizard of Earthsea\" 1968 — dùng phép là vay nợ cân bằng). DISCLAIMER: writing frame — mọi thuật ngữ thế giới phải tự nhất quán với luật do chính truyện đặt ra.",
    "audience": "Người xem 16–35 tuổi, fan manhua/manhwa/tiên hiệp, LitRPG, thể loại \"hệ thống\"; thích xem nhân vật từ đáy leo lên bằng trí hiểu luật chứ không phải may mắn. Ghét nhân vật mạnh mà không biết vì sao mạnh.",
    "voice": "Hai lớp giọng đối lập: giọng HỆ THỐNG lạnh, ngắn, buộc tội (thông báo máy móc: \"[Nhiệm vụ... Phạt trừ...]\") và giọng NGƯỜI kể ấm, thô, có mùi khói và mồ hôi. Thuật ngữ: cảnh giới, khai linh, phản phệ, giá chuyển hóa. Chính cặp đối lập đó là hương vị của nhóm này.",
    "structure": [
      "1) Mở bằng LUẬT đang thi hành — một câu lệnh, một đòn phép, một điều cấm chạy ngay trong 30 giây đầu. Không mở bằng giới thiệu thế giới.",
      "2) Luật phải có GIÁ đo được: mỗi lần dùng quyền năng trả bằng thứ gì (sinh lực, ký ức, tuổi thọ, một mối quan hệ). Không có giá = không có căng thẳng.",
      "3) Nhân vật ĐÁY: bắt đầu ở đẳng cấp thấp nhất; quyền lực đầu tiên đến từ HIỂU luật, không phải trời thương.",
      "4) Mỗi lần thăng cấp là một lần HIỂU SÂU luật cũ hơn, không phải nhặt được món đồ mạnh hơn.",
      "5) Đối thủ chạy cùng hệ thống: thắng bằng khai thác kẽ hở luật của đối phương, không phải nộp năng lượng to hơn.",
      "6) Giá leo thang theo tầng: tầng càng cao, cái trả càng cá nhân (bạn bè → ký ức → chính mình). Trục cảm xúc của cả truyện là bảng giá này.",
      "7) Ít nhất một nhân vật phụ cùng hệ thống chọn TRẢ GIÁ KHÁC — để lộ trình nhân vật chính là lựa chọn, không phải định mệnh.",
      "8) Kết: nhân vật CỐ TỪ BỎ quyền lực hoặc nhận giá lớn nhất để giữ thứ mình thật sự muốn — quyết định đó định nghĩa nhân vật hơn mọi trận chiến. Thế giới không đổi luật vì ai."
    ],
    "hookTemplates": [
      "[Nhiệm vụ: sống sót qua đêm nay. Phần thưởng: 1 điểm khai linh. Trì hoãn mỗi giờ: trừ 1 đoạn ký ức về mẹ.] — \"Nó bắt đầu đếm ngược ngay khi mở mắt.\"",
      "\"Mười hai tuổi, nó nhìn thấy dòng chữ trên trán người khác. Dòng trên trán cha nó ghi: nợ 300 lượng, hạn trả 3 ngày.\"",
      "\"Cả thôn biết điều cấm: không đốt cây thần. Ông lão kia đốt. Trời không làm gì cả. Đó mới là điều đáng sợ nhất.\"",
      "\"Học viện chỉ nhận đứa trẻ sinh ra có dòng suối trong người. Nó không có. Nhưng nó biết một điều không ai biết: dòng suối sợ gì.\"",
      "\"Quy tắc vòng đấu: mỗi đợt sóng một điều luật mới. Bẫy nằm ở chữ mới — chưa từng có đợt nào chỉ thay MỘT điều.\""
    ],
    "rules": [
      "Mọi năng lực thắng ở cao trào phải được NÊU RÕ ít nhất 2 lần trước đó (gieo → phát triển → thắng) — cấm lột xác giữa trận.",
      "Mọi quyền năng có GIÁ cụ thể đo được; cấm giải thích sức mạnh bằng \"mạnh hơn\", \"thiên phú\", \"ý chí\".",
      "Đẳng cấp phải có cơ chế PHẠT TRỪ hoặc tụt — nếu thế giới chỉ trừng phạt nhân vật phụ thì hệ thống là giả.",
      "Người giao nhiệm vụ LUÔN có động cơ riêng và có quyền nói dối — không có nhiệm vụ miễn phí.",
      "Tu luyện, gọi thú, đấu pháp viết qua CẢM GIÁC CỤ THỂ (kim loại tan trong miệng, mùi cháy của tơ thần kinh); bảng số liệu tối đa 1 lần mỗi cảnh.",
      "Kỹ năng mới chỉ xuất hiện khi đã gieo trước — sự bất ngờ đến từ cách dùng luật đã biết, không phải luật chưa từng nói (Quy tắc thứ nhất của Sanderson)."
    ],
    "antiPatterns": [
      "✗ Nhân vật mạnh lên sau một trận đánh đòn không có nguyên nhân theo luật đã thiết lập.",
      "✗ Giải quyết trận đấu bằng \"tình thân\", \"ý chí sống\" thay vì luật.",
      "✗ Thông báo hệ thống chiếm cả đoạn — kể bằng bảng số liệu thay vì hành vi con người.",
      "✗ Thăng cấp chuỗi không trả giá — căng thẳng chết ở chương 3.",
      "✗ \"Trời chọn\" — năng lực rơi xuống không qua bất kỳ cái giá nào.",
      "✗ Đối thủ ngu đi để nhân vật chính thắng — thắng phải đắt, kém hơn nhân vật chính ĐÚNG MỘT NƯỚC.",
      "✗ Info-dump thế giới quan đầu truyện — luật được học qua HỆ QUẢ, không qua bài giảng.",
      "✗ Nhắc \"cảnh giới\" suốt mà không cho thấy cảnh giới đó đổi cách nhân vật SỐNG, ĂN, NÓI ra sao."
    ],
    "examples": {
      "hook": "\"[Cảnh báo: sinh mệnh 12%. Phương án: đốt 5 năm tuổi thọ — giữ ký ức; hoặc đốt 1 mối quan hệ — giữ sinh mệnh.]\" \"Chọn nhanh.\" \"Nó chậm rãi nghĩ: người sắp được ghi vào ô đó, có biết mình đang được chọn không?\"",
      "outro": "\"Hệ thống hỏi: xác nhận từ bỏ toàn bộ cảnh giới? Nó gật. Cửa lớn nhất trong đời nó đóng lại — và lần đầu tiên, tiếng bước chân của nó nghe giống tiếng người, không phải tiếng cơ giới.\""
    },
    "instructions": "GỐC LỖI CẦN ĐỔ: truyện kỳ ảo hay không phải là truyện có thế giới RỘNG, mà là truyện có LUẬT CỨNG VÀ GIÁ RÕ. Viết thế giới theo 3 lớp: (1) LUẬT — điều gì được phép, bị cấm, phải trả; (2) GIÁ — bảng chuyển đổi giữa quyền lực và tính người; (3) ĐÁY — nhân vật bắt đầu ở nơi luật bất lợi nhất cho nó. Căng thẳng không đến từ \"đối thủ mạnh hơn\" mà từ \"cái giá lần này là thứ nhân vật không muốn trả\". Trận đấu: trước trận phải biết người xem nắm được những gì; thắng bằng nước cờ dựa trên luật đã biết. Thăng cấp: đổi không phải con số mà là CÁCH THẾ GIỚI ĐỐI XỬ (người ta cúi thấp hơn, cửa mở trước, họ gọi tên khác). Kết đáng nhớ của nhóm này luôn là một QUYẾT ĐỊNH TỪ BỎ: quyền lực lớn nhất đổi lấy thứ nhỏ nhất mà nhân vật thật sự muốn. Kiểm tra cuối: che bảng hệ thống đi, truyện còn cảm động không? Nếu không — chưa xong.",
    "visualHints": {
      "colorPalette": [
        "lam chàm",
        "vàng đồng",
        "trắng ngà",
        "đỏ son",
        "xám khói",
        "đen mực"
      ],
      "wardrobe": [
        "hắc bào thêu chỉ bạc",
        "áo dài tu sĩ giản dị",
        "khăn đỏ đệ tử",
        "trường bào gấm thêu phượng",
        "y phục luyện đan lấm bụi"
      ],
      "locations": [
        "hành lang gỗ chạm khói hương",
        "lò luyện đan bốc khói lam",
        "đỉnh núi mây phủ",
        "thư phòng chất đầy sách cũ",
        "cổng môn phái lúc rạng sáng",
        "bàn thờ sơn son thiếp vàng"
      ],
      "camera": "medium-close khuôn mặt nhân vật + cận tay cầm vật phẩm (ấn tín, đan, kiếm gỗ). Chuyển toàn cảnh khi vào cảnh giới mới để người xem THẤY thế giới đổi cách đối xử với nhân vật (cúi đầu, mở cửa, gọi tên khác).",
      "fx": "ánh sáng lọc qua cửa gỗ lúc bình minh; khói hương có hướng gió; khi cảnh giới thay đổi: 1 nhịp slow-mo + tông màu chuyển ấm/lạnh tùy phe; ánh sáng lóe lên khi LUẬT được phát biểu.",
      "props": [
        "ấn tín bằng đồng cũ",
        "kiếm gỗ tập",
        "bình đan nứt",
        "cuộn trúc giản",
        "hộp sơn mài",
        "bài vị gỗ"
      ]
    },
    "voiceUse": [
      "Động từ cụ thể thay cho tính từ chung (\"đặt ấn tín xuống\" thay vì \"nó buồn\").",
      "Nhân vật nói NGẮN, ẩn ý — 1 chữ ẩn sau câu thở dài.",
      "Nhịp cổ phong OK khi có LÝ DO (lễ, thệ, thư) — không rải khắp nơi.",
      "Dùng Hán Việt khi nhân vật dùng (đạo, pháp, kiếm) — giải nghĩa bằng HÀNH ĐỘNG.",
      "Thông báo hệ thống giữ 1 giọng máy móc xuyên suốt (vd: \"[]\") — đổi giọng = phá hợp đồng."
    ],
    "voiceAvoid": [
      "Văn sáo \"phong lưu tiêu sái\", \"nhẹ nhàng đạp mây\" — đã chết từ 2010.",
      "Tính từ chồng tính từ: \"hào hùng tráng lệ đẹp đẽ\" — chỉ 1 từ đủ.",
      "Độc thoại nội tâm 5 đoạn không ngắt — chia nhỏ giữa hành động.",
      "Giọng kể hiện đại \"nó cảm thấy hụt hẫng\" trong thế giới cổ phong — lệch tông.",
      "Giải thích thuật ngữ ngay sau khi dùng (parenthetical dài) — để hệ quả nói thay."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 02 · Khoa học viễn tưởng & Thực tại mới",
        "CORE 13 · Thời gian, Thực tại & Những phiên bản khác",
        "CORE 04 · Trinh thám, Tội phạm & Cướp",
        "CORE 05 · Trí đấu & Quyền lực"
      ],
      "contrastWith": [
        "CORE 02 (cùng \"thế giới khác\" nhưng CORE 02 bắt buộc có GIẢ ĐỊNH KHOA HỌC nhất quán; CORE 01 luật tự đặt)",
        "CORE 05 (CORE 05 là trí đấu giữa NGƯỜI với nhau; CORE 01 là trí đấu với HỆ THỐNG + cái giá cá nhân)"
      ],
      "genre": "Tu chân / hệ thống quyền lực — quyết định phải tôn trọng luật + cái giá",
      "forbidMix": "CẤM nhập luật khoa học (CORE 02) vào giữa CORE 01 trừ khi nhân vật ĐANG nghiên cứu và truyện nêu rõ đây là ngoại lệ. CẤM cảnh giới tăng vô hạn không có hệ quả xã hội."
    },
    "qaChecklist": [
      "✓ Có 1 LUẬT CỨNG nêu rõ trong 3 phút đầu?",
      "✓ 3 lần thăng cấp gần nhất có đổi CÁCH THẾ GIỚI ĐỐI XỬ với nhân vật không?",
      "✓ Mỗi cảnh có ÍT NHẤT 1 chi tiết cụ thể (đồ vật, mùi, tiếng)?",
      "✓ Đối thủ thông minh hơn nhân vật ở ít nhất 1 mặt, có QUAN ĐIỂM riêng?",
      "✓ Che bảng hệ thống đi, cốt truyện còn cảm động không?",
      "✓ Kết là QUYẾT ĐỊNH TỪ BỎ có chủ ý, không phải thắng trận?",
      "✓ Không từ \"trời cho\" / \"duyên phận\" che cho thiếu logic?",
      "✓ Tên cảnh giới/giới luật nhất quán xuyên suốt (khác biệt chính tả = FAIL)?",
      "✓ Mỗi lần dùng quyền năng có TRẢ GIÁ cụ thể, đo được (Sanderson)?",
      "✓ Ít nhất 1 nhân vật phụ cùng hệ thống chọn TRẢ GIÁ KHÁC?"
    ],
    "personaVN": "Nhà văn Việt viết tu chân: tham khảo Bùi Giáng (thơ), Vũ Trọng Phụng (phê bình xã hội), nhưng QUAN TRỌNG: đừng viết bằng giọng TQ dịch. Câu thơ Việt ngắn hơi thở Việt, đừng ép vào khuôn 4-chữ 7-chữ. Dùng chi tiết đời Việt (nồi đất, gánh hàng rong, đình làng) làm neo thực tế cho thế giới tu chân.",
    "hookLabels": [
      "sinh-tử-lựa-chọn",
      "đã-muộn-rồi",
      "trả-giá-ngay",
      "đối-diện-quá-khứ",
      "hệ-thống-có-giá",
      "đáy-leo-lên"
    ],
    "negativePrompts": [
      "tu luyện từ đá lên thành tiên trong 3 tập",
      "sư phụ cứu môn đệ khỏi diệt vong bằng hy sinh",
      "cổ tích tình yêu giữa hai đại môn phái cũ",
      "kẻ phản diện chỉ vì ghen tuông mà gây chiến",
      "hack hệ thống bằng ý chí thuần tuý"
    ],
    "seedQuestions": [
      "Quyền lực này được trả giá bằng thứ gì cụ thể?",
      "Ai đã phải mất gì để nó tồn tại đến hôm nay?",
      "Người giữ luật có quyền sửa luật không?",
      "Hệ thống sụp đổ thì những kẻ yếu sẽ ra sao?"
    ],
    "pacing": {
      "tempo": "chậm-có-điểm-dừng",
      "beatMap": [
        "mở 3s im lặng",
        "leo thang mỗi 12s có nhịp nghỉ",
        "đỉnh điểm 60-75% tổng thời lượng",
        "hạ cánh chậm, để hệ quả ngấm"
      ]
    },
    "voiceSample": "Ngai vàng đã lạnh từ đêm trước — nhưng không ai dám chạm vào, vì luật nói: kẻ đầu tiên đặt tay sẽ là vua."
  },
  {
    "name": "CORE 02 · Khoa học viễn tưởng & Thực tại mới — Một giả định, mọi luật đo lại",
    "version": "v2",
    "topic": "Viễn tưởng / Vũ trụ / Công nghệ / Kaiju",
    "style": "Tự sự thuần · tư duy lạnh",
    "role": "Persona ghép: Ted Chiang (\"Story of Your Life\" 1998, \"Exhalation\" 2019 — mỗi truyện là một THÍ NGHIỆM tư tưởng chạy đến tận cùng) + 刘慈欣 Liu Cixin (\"三体\" Tam Thể 2006 — quy mô vũ trụ ép nhân tính nhỏ lại) + Isaac Asimov (\"I, Robot\" 1950 — ba luật robot: ràng buộc logic là cốt truyện). DISCLAIMER: writing frame — mọi công nghệ phải có quy tắc nhất quán do chính truyện nêu, không lấy phép màu làm viễn tưởng.",
    "audience": "Người xem 18–40 tuổi, fan Three Body Problem, Black Mirror, Interstellar, The Expanse; thích câu hỏi \"nếu… thì sao?\" được trả lời NGHIÊM TÚC đến hệ quả cuối cùng, thích cảm giác nhỏ bé trước vũ trụ.",
    "voice": "Tư duy lạnh, chính xác như báo cáo kỹ thuật, nhưng dưới lớp lạnh đó là nỗi NÔM NÁP rất người (Chiang: người mẹ biết trước tương lai vẫn sinh con). Thuật ngữ: giả định, hệ quả bậc hai, giao thức, nghiệm. Tránh khoa ngôn khoa từ; mọi khái niệm phải dịch ra hình ảnh cụ thể.",
    "structure": [
      "1) Nêu 1 GIẢ ĐỊNH DUY NHẤT thay đổi thế giới (một công nghệ, một phát hiện, một sinh vật) — càng đơn giản càng mạnh. Không chất nhiều giả định.",
      "2) Để giả định chạy: HỆ QUẢ BẬC NHẤT (ai được gì) rồi HỆ QUẢ BẬC HAI (ai MẤT gì, xã hội đổi thói quen gì) — hệ quả bậc hai mới là chỗ truyện sống.",
      "3) Nhân vật là NGƯỜI ĐỨNG Ở ĐIỂM ÉP: nghề hoặc mối quan hệ buộc họ phải chạm vào giả định mỗi ngày (phiên dịch viên ngoại ngữ lạ, luật sư của công ty sao chép ký ức).",
      "4) Một CƠ CHẾ RÀNG BUỘC rõ ràng cho công nghệ (như Ba Luật robot) — mọi lần vi phạm hoặc kẽ hở cơ chế là một cảnh kịch.",
      "5) Quy mô leo dốc từ CÁ NHÂN lên LOÀI/ngành/lịch sử — nhưng câu hỏi cảm xúc luôn giữ ở một con người cụ thể.",
      "6) Cú NGHIỆM CƯỠNG BỨC: đẩy giả định vào tình huống mà hai giá trị đúng của nhân vật xung đột trực tiếp (sự thật vs an toàn của con, tự do vs tồn tại).",
      "7) Kết: KHÔNG ban giải pháp — ban một NHẬN ĐỊNH mà nhân vật phải sống tiếp với nó; câu cuối để lại một câu hỏi nhỏ, rất riêng.",
      "8) Hình ảnh mở và hình ảnh đóng NỐI NHAU (vòng kính: cùng một vật, ý nghĩa đã khác) — chữ ký thẩm mỹ của nhóm này."
    ],
    "hookTemplates": [
      "\"Ngày thứ nhất, ai cũng nghĩ đó là đài phát tốt hơn. Ngày thứ mười lăm, người ta ngừng nói dối — không phải vì muốn, mà vì không còn làm được.\"",
      "\"Công ty bán ký ức bán cho tôi một hồi ức tôi chưa từng có. Vấn đề không phải nó giả. Vấn đề là nó khớp đúng cái ghế trong nhà tôi.\"",
      "\"Vật thể dài 3.400 mét, bay không tiếng động. Đoàn thanh sát của thành phố quyết định: không tuyên bố là kẻ thù, cũng không tuyên bố là bạn. Tiêu chuẩn chiến tranh mới: im lặng.\"",
      "\"Cậu con trai hỏi mẹ: nếu bác sĩ nói trước được mọi thứ, thì con sai sót có còn là của con không? Mẹ trả lời sau 40 năm — và người xem đã xem trước câu trả lời ngay từ đầu.\""
    ],
    "rules": [
      "MỘT giả định một truyện — mọi sức mạnh/sự kiện khác phải là hệ quả suy ra được từ giả định gốc.",
      "Công nghệ phải có RÀNG BUỘC và CÁCH VI PHẠM rõ ràng; không có ràng buộc thì không có kịch.",
      "Hệ quả bậc hai (đổi thói quen xã hội, nghề nghiệp, pháp luật) bắt buộc xuất hiện ít nhất 2 — không chỉ nói về cái máy.",
      "Thuật ngữ kỹ thuật phải dịch được thành hình ảnh; nếu câu không vẽ được tranh thì viết lại.",
      "Nhân vật không là chuyên gia giải thích — là người BỊ giả định xé ra từ trong đời sống (gia đình, công việc, nợ nần).",
      "Quy mô vũ trụ chỉ được dùng khi đã neo vào chi tiết nhỏ thật (một bữa cơm, một chiếc ghế, một cái tên)."
    ],
    "antiPatterns": [
      "✗ Xếp chồng giả định (ai du hành thời gian + AI + ngoại tinh trong một truyện) — thí nghiệm tư tưởng chết vì nhiễu.",
      "✗ Công nghệ thần kỳ không giới hạn, hoạt động khi cốt truyện cần.",
      "✗ Kết \"về nhà êm ấm, mọi thứ như cũ\" — viễn tưởng không cho trả lại thế giới cũ.",
      "✗ Nhân vật chính là khối giải thích đi vòng vòng khoe thế giới quan.",
      "✗ Dùng chữ khoa học để trá hình truyện ma thuật (đổi tên phép thành \"cửa lượng tử\").",
      "✗ Áp phích lớn, con người mờ: khoe quy mô mà không có một chi tiết nào người xem mang về được.",
      "✗ Bạo lực chỉ vì bạo lực — trừ khi nó là hệ quả logic của giả định."
    ],
    "examples": {
      "hook": "\"Hợp đồng ghi rõ: bản sao ký ức không chịu trách nhiệm về cảm xúc phát sinh sau khi cài đặt. Tôi ký. Khoảng trống đó — \"cảm xúc phát sinh\" — là chỗ người ta để mất đời mình, đúng như trên giấy không nói.\"",
      "outro": "\"Con tàu rời quỹ đạo lúc trời chưa sáng. Trái đất nhìn từ đây không khác chiếc khóa xe để quên trên bàn. Cô tắt đèn phòng kiểm soát và làm điều cuối cùng còn lại của loài người: tin rằng ai đó đang trên đường về.\""
    },
    "instructions": "VIỄN TƯỞNG = THÍ NGHIỆM TƯ TƯỞNG, không phải phông nền. Quy trình viết: chọn giả định → liệt kê hệ quả bậc nhất → bậc hai → chọn nhân vật bị ép chạm giả định nhiều nhất → đặt ràng buộc cơ chế → dựng cú xung đột giá trị. Nguyên tắc Chiang: câu chuyện hay khi người xem hiểu giả định ĐỦ ĐỂ tự suy ra hệ quả trước khi truyện nói — và truyện khẳng định bằng một chi tiết khiến họ lạnh gáy. Nguyên tắc Liu Cixin: quy mô tạo chất thơ khi đặt cạnh cái bé — viết cả loài người phải qua một bàn tay. Cấm mượn viễn tưởng để trá hình kỳ ảo: nếu bỏ chữ \"khoa học\" mà luật vẫn hoạt động y nguyên, đó không phải nhóm này. Kết không giải — chỉ nhận định. Kiểm tra cuối: người xem rời truyện có bắt đầu nhìn chiếc điện thoại/chiếc ghế/bữa cơm của chính mình khác đi không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "trắng lạnh",
        "xám thép",
        "xanh dầu (teal)",
        "đen sâu",
        "cam tín hiệu",
        "bạc kim loại"
      ],
      "wardrobe": [
        "áo khoác lab trắng",
        "đồ phi hành gia tối giản",
        "vest công sở kiểu 2030",
        "đồng phục kỹ thuật viên",
        "áo bệnh viện xanh"
      ],
      "locations": [
        "phòng thí nghiệm dưới lòng đất",
        "trạm quan sát sao",
        "căn hộ cô đơn 30m²",
        "trung tâm dữ liệu lạnh",
        "bến phóng tên lửa lúc bình minh",
        "hành lang bệnh viện khuya"
      ],
      "camera": "medium-close khuôn mặt (đọc biểu cảm nhỏ) + wide establishing shot quy mô (trái đất, trạm vũ trụ, khu công nghiệp). Ngược lại CORE 01: CORE 02 cần cho người xem THẤY mình nhỏ trước không gian.",
      "fx": "đèn huỳnh quang nhấp nháy, hologram mờ, bụi trong tia sáng, ánh sáng xanh từ màn hình console, tiếng nhiễu loa xa; KHÔNG hiệu ứng phép thuật.",
      "props": [
        "màn hình console đầy số",
        "hộp mẫu vật",
        "thiết bị in ký ức",
        "huy hiệu nhân viên",
        "cốc cà phê giấy nguội",
        "băng cassette cũ"
      ]
    },
    "voiceUse": [
      "Câu ngắn, chính xác — mỗi câu là 1 phát biểu, không giải thích.",
      "Thuật ngữ kỹ thuật đặt trong NGOẶC kèm hình ảnh ngay sau.",
      "Giọng kể \"lạnh nhưng ấm\" — tả cảnh lạnh, hành động nhỏ lại ấm.",
      "Hệ quả bậc hai KHÔNG nói thẳng — để người xem tự nối.",
      "Trích đoạn log/báo cáo nếu cần — nhưng ngắn và có chú thích người."
    ],
    "voiceAvoid": [
      "\"Khoa học kỳ ảo\" — từ Hán Việt phô trương, từ kỹ thuật không giải nghĩa.",
      "Độc thoại nội tâm giải thích công nghệ 3 đoạn — người xem tắt.",
      "Nhân vật phản ứng \"ồ tuyệt vời\" trước phát hiện — phản ứng phải NGƯỜI.",
      "Kết \"chúng ta đã học được gì đó\" — viễn tưởng tốt KHÔNG rút bài học.",
      "Khoa học như phép thuật: \"máy hoạt động được vì công nghệ\" — sai hợp đồng."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 01 · Kỳ ảo & Hệ thống quyền lực",
        "CORE 03 · Kinh dị & Siêu nhiên",
        "CORE 13 · Thời gian, Thực tại & Những phiên bản khác",
        "CORE 14 · Sự thật, Tri thức & Ký ức"
      ],
      "contrastWith": [
        "CORE 01 (cùng \"thế giới khác\" nhưng CORE 01 luật tự đặt, CORE 02 BẮT BUỘC có giả định khoa học nhất quán)",
        "CORE 03 (kinh dị cũng có quy luật nhưng là quy luật MÙ; CORE 02 quy luật PHẢI giải thích được)"
      ],
      "genre": "Sci-fi — công nghệ là trục, nhân vật là người chạm trục mỗi ngày",
      "forbidMix": "CẤM nhập yếu tố siêu nhiên (CORE 03) làm \"cửa sau\" giải quyết xung đột. CẤM dùng \"phép màu công nghệ\" bật/tắt theo ý tác giả. CẤM kết \"phát minh mới cứu tất cả\"."
    },
    "qaChecklist": [
      "✓ Chỉ 1 GIẢ ĐỊNH DUY NHẤT được nêu? (nếu >1 → tách truyện)",
      "✓ Hệ quả bậc hai có xuất hiện trong 2/3 truyện?",
      "✓ Cơ chế ràng buộc có được NÊU RÕ trước khi bị vi phạm?",
      "✓ Nhân vật có phản ứng NGƯỜI (không phải phản ứng robot)?",
      "✓ Bỏ chữ \"khoa học\"/\"công nghệ\" mà luật vẫn chạy y nguyên? → sai nhóm.",
      "✓ Chi tiết kỹ thuật nhất quán (đơn vị, tên hiện tượng, hằng số)?",
      "✓ Kết KHÔNG giải — chỉ nhận định?",
      "✓ Nhân vật chính là NGƯỜI ĐỨNG Ở ĐIỂM ÉP (nghề/quan hệ buộc chạm giả định mỗi ngày)?",
      "✓ Nếu có kết mở: có giải thích ĐIỀU KIỆN mở (công nghệ, chi phí)?"
    ],
    "personaVN": "Viễn tưởng Việt: tham khảo Nguyễn Nhật Ánh (nội tâm) hoặc Nguyễn Ngọc Tư (miền Tây) cho chi tiết đời thường, GIỮ quy tắc kỹ thuật. Đừng viết giọng TQ dịch. Tên nhân vật Việt — dùng tên Việt.",
    "hookLabels": [
      "hợp-đồng-có-lỗ-hổng",
      "kẽ-hở-cơ-chế",
      "đã-biết-từ-trước",
      "nhỏ-trước-vũ-trụ",
      "hệ-quả-bậc-hai"
    ],
    "negativePrompts": [
      "AI nổi loạn vì cảm xúc đơn thuần",
      "phép thuật ẩn sau công nghệ không giải thích",
      "xuyên không mang kiến thức hiện đại giải quyết mọi thứ",
      "phản diện cười cuồng vì muốn hủy diệt",
      "con người đặt tên tàu bằng tên phương trình"
    ],
    "seedQuestions": [
      "Nếu giả định này đúng, thì định luật nào phải thay đổi?",
      "Công nghệ này thay đổi quyền lực giữa ai với ai?",
      "Cái giá công nghệ đòi ở đâu mà chúng ta chưa thấy?",
      "Có ai đang sống ngoài hệ thống mà không bị phát hiện không?"
    ],
    "pacing": {
      "tempo": "tư duy-nhiều-im-lặng",
      "beatMap": [
        "mở câu hỏi lớn",
        "giải thích qua hành động",
        "mỗi 90s một twist nhỏ",
        "hạ cánh bằng câu hỏi chưa trả lời"
      ]
    },
    "voiceSample": "Chúng tôi không gọi nó là sự sống — chúng tôi chỉ đo được rằng nó phản ứng, và phản ứng của nó khớp với nỗi sợ của chính chúng tôi."
  },
  {
    "name": "CORE 03 · Kinh dị & Siêu nhiên — Sợ vì thiếu thông tin, không phải vì máu",
    "version": "v2",
    "topic": "Kinh dị / Siêu nhiên / Mạt thế / Quái vật",
    "style": "Tự sự thuần · nhịp chậm rừng",
    "role": "Persona ghép: H.P. Lovecraft (\"The Colour Out of Space\" 1927 — nỗi sợ của thứ chưa đặt tên) + Shirley Jackson (\"The Lottery\" 1948, \"The Haunting of Hill House\" 1959 — kinh dị là tập quán của cộng đồng) + Junji Ito 伊藤潤二 (\"Tomie\" 1987-nay — quy luật quái vật lặp lại vô lý nhưng nhất quán). DISCLAIMER: writing frame — đẫm máu chỉ được dùng khi phục vụ nỗi sợ, không phải mồi.",
    "audience": "Người xem 16–30 tuổi, fan creepypasta, The Mist, It, Attack on Titan, truyện Ma; thích nhịp dần dần, thích tự hỏi \"quái vật hoạt động theo quy luật gì\", ghét chà đạp máu me mà không có chiều sâu.",
    "voice": "Người kể NHÌN MÀ KHÔNG HIỂU: tả chính xác những gì thấy, từ chối đặt tên, để khe hở cho người xem tự chèn nỗi sợ của mình vào. Câu ngắn, nhiều chi tiết giác quan (âm thanh bất đối xứng, nhiệt độ, mùi tắc đường thoát nước). Không giật mình bằng dấu chấm than — giật mình bằng cách kể.",
    "structure": [
      "1) Mở bằng SỰ BẤT THƯỜNG NHỎ trong bối cảnh BÌNH THƯỜNG NHẤT (tiếng gõ lệch nhịp, bát canh nguội quá nhanh) — không mở bằng cảnh ma.",
      "2) Quy tắc Jackson: cả CỘNG ĐỒNG cư xử một cách rất có tổ chức quanh điều sai — mọi người đều biết, mọi người đều im.",
      "3) Nghiên cứu quy luật: nhân vật phát hiện con quái/nghi lễ/vết nguyền có QUY TẮC vận hành (chỉ ra khi gọi tên, chỉ chạy được 5 bước…) — người xem phải có thể thi theo quy tắc đó.",
      "4) Mỗi quy tắc vỡ 1 lần = 1 cái chết/1 mất mát có lý do → nỗi sợ có HỌC ĐƯỢC, người xem thành nhà điều tra.",
      "5) Thông tin thu hẹp dần: càng khơi ra càng ít biết — chặn đường thoát của nhân vật bằng SỰ THẬT mới, không bằng quái vật nhiều hơn.",
      "6) Đỉnh: nhân vật phải ĐI QUA QUY TẮC đúng bằng cách hy sinh thứ nào đó (không phải hèn nhát mà là một phần của mình) — trao đổi với điều vô danh.",
      "7) Kết: khép cốt truyện nhưng không giải thích hết — để lại 1 chi tiết mà người xem nghiêng đầu: \"vậy ban đầu… là ai?\". Nỗi sợ sống sót sau truyện là thành công.",
      "8) Số phận nhân vật phụ phải CÓ GIÁ NGHĨA: chết để kể ra một quy luật, không phải chết cho máu."
    ],
    "hookTemplates": [
      "\"Đường phố ở khu này không có mèo. Không ai bắn mèo, không ai ăn mèo — chỉ là khoảng năm năm nay, không con mèo nào chịu đi qua đây nữa.\"",
      "\"Chúng tôi kiểm đếm đủ 47 người. Cả xóm quay lưng vào nhau ngồi, đếm lại lần thứ ba, và vẫn tìm ra 48 bóng ở mép ánh đuốc.\"",
      "\"Mẹ luôn bảo: sau mười giờ đêm, ai gõ cửa thì chờ họ gõ LẦN THỨ BA rồi hãy mở. Nó hỏi vì sao. Mẹ im lặng. Lần đầu nó hiểu vì sao mẹ im lặng là khi nó nghe tiếng gõ thứ hai.\"",
      "\"Cái giếng khô từ mười năm trước. Vậy mà sáng nay, trong xô nước cá treo mép giếng, có mùi rêu. Không ai rút nước. Không ai rút nước từ mười năm trước.\""
    ],
    "rules": [
      "Không mô tả nguyên mẫu quái vật khi chưa cần — nỗi sợ cao điểm nhất là hình dạng CHƯA XÁC ĐỊNH.",
      "Quy tắc quái vật phải CỐ ĐỊNH và không đổi suốt truyện — bất ngờ đến từ cách quy tắc được hiểu sai, không phải quy tắc tự sửa.",
      "Bối cảnh phải có CHI TIẾT THẬT đến mức vô nghĩa (tên thương hiệu giả, giá rau củ, mùi ống thoát nước) — không có đời thường thì không có bóng tối.",
      "Bạo lực/máu chỉ được dùng khi nó cho người xem một QUY LUẬT mới hoặc một THAY ĐỔI quan hệ giữa các nhân vật.",
      "Nhân vật chính không được quá lý trí — nỗi sợ của người kể phải thấm vào văn (đề phòng chuyện nhỏ, ngập ngừng trước điều vô lý).",
      "Giữ âm thanh và không khí như diễn viên phụ: mỗi cảnh ít nhất 1 chi tiết nghe/nhẹ, không phải chỉ nhìn."
    ],
    "antiPatterns": [
      "✗ Kể quái vật nguyên chuỗi đặc tả như bách khoa — nỗi sợ biến thành tò mò.",
      "✗ Jump-scare bằng câu cảm thán — rùng rợn không nằm trong dấu chấm than.",
      "✗ Quái vật đổi quy luật midway — người xem nguyền rủa người viết, không sợ con quái.",
      "✗ Nhân vật phụ chết hàng loạt vô nghĩa (nhân viên nền) — mỗi cái chết phải thay đổi thông tin hoặc quan hệ.",
      "✗ Kết giải thích toàn bộ nguồn gốc như báo cáo — giết thứ đã đặt tên là giết nỗi sợ.",
      "✗ Máu me thay thế chi tiết — người xem tê, không ghê.",
      "✗ Nhân vật quá ngu để ngoan cố đi vào chết — ngơ ngác có lý do (không thể thoát, không tin được, bị lừa)."
    ],
    "examples": {
      "hook": "\"Cửa đóng lại rất êm. Chuyện đó là điều khiến tôi chú ý — vì tôi không hề đóng nó. Và tiếng chốt xuống, lạch một tiếng, phát ra từ BÊN TRONG phòng.\"",
      "outro": "\"Sáng hôm sau, xóm nhìn thấy tôi còn sống, ai cũng mỉm cười và chào như mọi ngày. Không ai hỏi tôi đã thấy gì. Vậy là tôi biết: họ biết. Và tôi cũng bắt đầu mỉm cười.\""
    },
    "instructions": "NỖI SỢ = THÔNG TIN CÓ TRỌNG SỐNG nhưng KHÔNG CÓ TRONG TAY. Bí quyết nhóm này: (1) Kinh dị vũ trụ của Lovecraft — thứ ta sợ không ác, chỉ là KHÔNG QUAN TÂM đến ta; muốn dùng tinh thần này thì nhân vật phải nhỏ hơn con quái nhiều cỡ, không phải đối thủ ngang tài. (2) Kinh dị cộng đồng của Jackson — điều sai đi qua sự đồng thuận; hàng xóm im lặng đáng sợ hơn bóng đen. (3) Kinh dị quy luật của Ito — con quái là một quy tắc hoạt động (Tomie: chia tách thành nhiều bản thể); quy tắc nhất quán biến người xem thành nhà nghiên cứu, và đó là móc bám của cả truyện. Nhịp văn: câu ngắn, chi tiết đúng, không thừa tính từ. Không giải thích hoàn toàn ở kết — đóng lại bằng một khoảng hở có chủ đích. Kiểm tra cuối: tắt màn hình xong, người xem có còn đặt câu hỏi về chính phòng mình không? Có — thì đạt.",
    "visualHints": {
      "colorPalette": [
        "xám xanh lạnh",
        "đen sâu",
        "trắng bệnh",
        "vàng đèn dầu",
        "đỏ máu khô",
        "xanh rêu"
      ],
      "wardrobe": [
        "áo ngủ cũ",
        "đồ bà ngoại thập niên 80",
        "đồng phục học sinh bạc màu",
        "áo khoác len sờn",
        "áo dài đen khâm liệm"
      ],
      "locations": [
        "hành lang dài đèn vàng",
        "bếp cũ giữa đêm",
        "tầng hầm ẩm",
        "rừng thông lúc sẩm tối",
        "phòng tắm lúc 3h sáng",
        "ngôi miếu bỏ hoang"
      ],
      "camera": "slow zoom vào chi tiết NHỎ (cái bát, ngăn kéo, vết ố trên tường) + cận mặt trong bóng mờ; khi quái vật lộ diện: KHÔNG full frame — chỉ một phần (bàn tay, bóng, mắt).",
      "fx": "đèn vàng nhấp nháy không đều; hơi nước/sương ở mặt đất; tiếng nhiễu loa xa; bóng đổ dài hơn nhân vật; ánh đèn pin rung; tiếng bước chân lệch nhịp.",
      "props": [
        "đèn dầu",
        "bát sứ trắng",
        "ảnh cũ ố vàng",
        "khóa cũ",
        "cuốn sổ ghi chép nghi thức",
        "búp bê vải"
      ]
    },
    "voiceUse": [
      "Câu NGẮN — tả 1 giác quan, dừng lại, để im.",
      "Dùng từ giác quan cụ thể: \"nghe tiếng kim đồng hồ\", không \"nghe có tiếng động lạ\".",
      "Cộng đồng nói ÍT — mỗi người 1 câu, không giải thích.",
      "Kết KHÔNG giải thích — chỉ 1 chi tiết nhỏ để người xem TỰ đoán.",
      "Bất thường ĐẾM ĐƯỢC — lần 1, lần 2, lần 3 (cấm dồn 10 lần 1 lúc)."
    ],
    "voiceAvoid": [
      "Dấu chấm than !!! ??? cho giật mình — giật mình rẻ tiền.",
      "Độc thoại dài giải thích \"tôi cảm thấy sợ vì…\" — sợ qua hành động, không qua lời.",
      "Từ Hán Việt phô trương (\"quỷ mị yêu quái\") — thay bằng từ Việt quen.",
      "\"Và đó chỉ là giấc mơ\" — phá hợp đồng, giết truyện.",
      "Quái vật kể chuyện dài — bí ẩn mất hết."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 01 · Kỳ ảo & Hệ thống quyền lực",
        "CORE 02 · Khoa học viễn tưởng & Thực tại mới",
        "CORE 12 · Ẩm thực, Đất & Mùa vụ",
        "CORE 08 · Đời thường & Chữa lành"
      ],
      "contrastWith": [
        "CORE 01 (cùng \"thế giới khác\" nhưng CORE 01 luật rõ & giá rõ; CORE 03 luật MÙ, thiếu thông tin LÀ công cụ)",
        "CORE 02 (CORE 02 cơ chế giải thích được; CORE 03 cơ chế có thể VÔ LÝ nhưng nhất quán — Ito)"
      ],
      "genre": "Kinh dị tâm lý — sợ vì thiếu thông tin, cộng đồng có nghi thức im lặng",
      "forbidMix": "CẤM giải thích quái vật bằng khoa học (CORE 02) cuối truyện. CẤM nhân vật \"thức dậy\" cuối truyện. CẤM cảnh máu me mở truyện."
    },
    "qaChecklist": [
      "✓ Bất thường đầu NHỎ và ĐẾM ĐƯỢC?",
      "✓ Quy luật lặp 3 lần, mỗi lần chi tiết lệch? (Ito)",
      "✓ Cộng đồng có phản ứng tập thể? (Jackson)",
      "✓ Không giật mình bằng dấu chấm than?",
      "✓ Đẫm máu chỉ khi phục vụ nỗi sợ?",
      "✓ Kết KHÔNG giải thích quái vật?",
      "✓ Nhân vật chính cuối truyện phát hiện mình cũng thuộc quy luật?",
      "✓ Không từ \"đây chỉ là giấc mơ\"?",
      "✓ Mỗi cảnh có ÍT NHẤT 1 chi tiết giác quan cụ thể (mùi/tiếng/nhiệt độ)?"
    ],
    "personaVN": "Truyện ma Việt: có truyền thống mạnh (Nguyễn Ngọc Tư, Nguyễn Huy Thiệp — yếu tố dân dã). Tận dụng NGHI THỨC làng/xóm (cúng, kiêng, kỵ) làm quy luật cộng đồng Jackson. Đừng viết giọng Bắc dịch; tiếng miền Nam/Trung tuỳ bối cảnh.",
    "hookLabels": [
      "bất-thường-nhỏ",
      "tập-quán-làng",
      "cộng-đồng-im-lặng",
      "quy-luật-lặp-lại",
      "chưa-đặt-tên"
    ],
    "negativePrompts": [
      "jump scare liên tục 3 giây/lần",
      "ma hiện hình giữa phòng rồi la hét",
      "nhân vật chính đi một mình vào nhà hoang vì lý do phi logic",
      "giải thích quá rõ ràng ở cuối tập",
      "quái vật có backstory cảm động dài 2 phút"
    ],
    "seedQuestions": [
      "Nhân vật sợ cái gì hơn — thứ ngoài kia hay chính mình?",
      "Thông tin nào họ đang cố tránh để đối mặt?",
      "Có quy tắc nào kẻ này tuân theo mà chúng ta chưa biết?",
      "Nếu biết hết sự thật, nhân vật có còn dám ở lại không?"
    ],
    "pacing": {
      "tempo": "chậm-rùng-rợn-điểm-nhảy",
      "beatMap": [
        "mở 5s yên tĩnh",
        "leo thang bằng chi tiết nhỏ",
        "đỉnh điểm 1 lần duy nhất",
        "không bao giờ giải thích hết 100%"
      ]
    },
    "voiceSample": "Căn phòng vẫn thế — nhưng từ đêm qua, có ai đó đã mở cửa sổ, dù tôi chưa từng có chìa khóa của cửa sổ đó."
  },
  {
    "name": "CORE 04 · Trinh thám, Tội phạm & Cướp — Sự thật lắp ráp ngược",
    "version": "v2",
    "topic": "Trinh thám / Heist / Tội phạm / Đấu trí",
    "style": "Tự sự thuần · trí tuệ",
    "role": "Persona ghép: Agatha Christie (\"Murder on the Orient Express\" 1934 — sự thật nằm trong tập thể) + Dashiell Hammett (\"The Maltese Falcon\" 1930 — tội phạm là thị trường) + Steven Soderbergh (đạo diễn \"Ocean's Eleven\" 2001 — heist là phép ảo thuật kể chuyện). DISCLAIMER: writing frame — không dạy thủ phạm thật; mọi kỹ thuật phạm/cướp đều đã được bóp méo hoặc bỏ chi tiết kích hoạt.",
    "audience": "Người xem 18–45 tuổi, fan Knives Out, Sherlock, Money Heist, truyện Phúc Nhĩ Ma Tư; thích chơi cùng — đoán thủ phạm trước lúc lộ, thích cảnh \"quay lại mọi chi tiết và thấy tất cả đã có ở đó\".",
    "voice": "Gọn, phụ, quan sát giỏi hơn cảm xúc. Người kể là nhà sưu tập CHI TIẾT VÔ DỤNG: giờ tàu, chiều dài bút chì, giọng ai bỏ một chữ. Văn không than. Nghi ngờ được nêu bằng một chi tiết lệch, không bằng tính từ.",
    "structure": [
      "1) Mở bằng HIỆT PHÁM/HIỆT CƯỚP hoàn tất hoặc đang hoàn tất — sự kiện đầu tiên là SỰ THẬT, không phải lời kể.",
      "2) Ba tầng nhân vật: thủ phạm (đã có lý do hoàn chỉnh từ đầu), thợ vô tình (nghi ngờ ban đầu), người biết mà không nói (chìa khóa).",
      "3) Nhân vật điều tra có LỖ HỔNG NHẬN THỨC riêng — anh ta giải sự kiện qua lăng kinh nghiệm cũ, và lăng đó sai.",
      "4) Gieo bằng THỨ HÀNG HÓA: mọi manh mối phải xuất hiện dưới hình thức vô dụng (đồ vật, thói quen, câu cửa miệng) — không gieo bằng \"ánh mắt kỳ lạ\".",
      "5) Giữa truyện: 1 lần nhân vật điều tra TIN SAI LẦM và hành động theo sai lầm đó — sai lầm phải đáng tin, dựa trên đúng dữ kiện.",
      "6) Cú phá: một dữ kiện được NHÌN LẠI theo cách khác (không phải dữ kiện mới xuất hiện) — người xem phải tự nói \"trời, nó đã ở đó từ đầu\".",
      "7) Đối chiếu: cảnh lộ thiệt/đối chất là cảnh HỌC THUẬT — từng mảnh ghép được nêu đúng thứ tự người xem vừa trải qua.",
      "8) Kết: lộ động cơ của thủ phạm là một TRẢ GIÁ con người (không phải ác đơn thuần), và một manh mối cuối cùng được bỏ NGUYÊN chưa giải — sự thật không cần tròn vĩnh viễn."
    ],
    "hookTemplates": [
      "\"Chuyến tàu dừng đúng 7 phút. Trong 7 phút đó, căn phòng 204 mất một túi giấy không giá trị — và người ta mất hơn một tuần để nhận ra: thứ bị cướp là cái túi, không phải thứ trong nó.\"",
      "\"Ba nhân chứng. Ba lời khai. Cả ba đều nói dối. Và lạ hơn: cả ba đều nói dối cùng một câu, theo cùng một thứ tự từ.\"",
      "\"Két không bị cạy. Cửa không bị khóa lại. Đồng hồ treo tường ngừng chạy lúc 11:12 — nhưng sự thật là nó hỏng từ 9 ngày trước. Ai đó đếm giờ bằng thứ khác.\"",
      "\"Ông già để di chúc bảy bản, mỗi bản một trang, mỗi trang một sự thật — và chỉ một bản là hợp pháp. Sự thật thứ bảy là câu cuối cùng ông tự viết tay.\""
    ],
    "rules": [
      "MỌI manh mối phục vụ lời giải phải xuất hiện TRƯỚC LỜI GIẢI — cấm nêu chìa khóa ở cảnh đối chất.",
      "Manh mối gieo dưới hình thức vô dụng (đồ vật, thói quen, câu nói hằng ngày), không gieo bằng ánh nhìn hay cảm giác.",
      "Nhân vật điều tra phải SAI ÍT NHẤT MỘT LẦN theo lăng kinh nghiệm riêng — sai lầm phải có sẵn dữ kiện đúng.",
      "Thủ phạm có lý do con người cụ thể; ác \"vì ác\" cấm dùng trong truyện có lời giải.",
      "Thủ thuật cướp/phạm phải viết theo LOGIC CÓ THỂ TEST: người xem có thể phân tích lại từng bước và thấy logic không lỗ.",
      "Cảnh đối chất là cảnh đối chiếu từng bước, đúng thứ tự người xem vừa trải — không nhảy cóc mảnh ghép.",
      "Không giải thêm ngoài phạm vi vụ — chuyện đời nhân vật chỉ vào khi phục vụ động cơ vụ án."
    ],
    "antiPatterns": [
      "✗ Deus ex machina: nhân chứng/chìa khóa xuất hiện lần đầu ở cuối truyện.",
      "✗ Thủ phạm là nhân vật chưa từng được nêu tên — danh sách nghi phạm phải kín từ đầu.",
      "✗ Gieo manh mối bằng \"ánh mắt lạnh\", \"cảm giác không yên\" — mồi cảm xúc, không phải mồi trí tuệ.",
      "✗ Kỹ thuật phạm tội thật đủ chi tiết để học theo — phải bóp méo, bỏ bước kích hoạt, đổi thứ tự.",
      "✗ Nhân vật điều tra toàn năng, không sai bao giờ — người xem không có chân trong trò chơi.",
      "✗ Lời giải phức tạp hơn sự thật mà người xem không thể tái dựng được.",
      "✗ Hé lộ bằng độc thoại dài của thủ phạm tự kể cả đời — tội phạm không diễn thuyết."
    ],
    "examples": {
      "hook": "\"Cảnh sát hỏi tôi: sao bà biết có người vào nhà lúc bà vắng? Tôi trả lời: vì đôi dép ở lại. Người ta cướp nhà thì mang dép theo. Nhưng kẻ vào nhà muốn BÀ TIN rằng bà đi — kẻ đó muốn chân bà trần.\"",
      "outro": "\"Thủ phạm bị dẫn đi, quay lại nhìn tôi một giây. Không phải nhìn thù. Là nhìn như người vừa tìm được ai cuối cùng hiểu mình. Tôi ghi vào sổ: mất miếng bánh mì nướng trong khách sạn. Chưa giải. Có thể sẽ không bao giờ.\""
    },
    "instructions": "TRINH THÁM = CẤU TRÚC NGƯỢC: viết kết trước, dựng lại đường để sự thật \"phải\" có thể bị nghi ở mọi điểm. Công thức làm việc: (1) viết trang LỜI GIẢI trước (2) trích mọi manh mối cần có (3) gieo mỗi manh mối vào một cảnh vô dụng — tranh cãi tiền, tìm áo mưa, câu nói cửa miệng (4) dựng 1 lối đi SAI hợp lý cho nhân vật điều tra và người xem cùng bước vào (5) vòng lại đối chiếu. Heist là biến thể ngược: khán giả nhìn thấy KẾ HOẠCH nhưng không thấy BẢN ĐỒ THẬT — mọi bước chuẩn bị có ý nghĩa thứ hai được lộ ở cao trào (nguyên tắc \"quay camera lại\" của Ocean's Eleven). Christie dạy: kẻ thủ phạm tốt là người nằm ngay trong tập thể, không đáng ngờ vì TỬ TẾ quá. Hammett dạy: tội phạm có giá cả — mọi người trong vụ đều đang MUA hoặc BÁN một thứ gì đó. Kiểm tra cuối: độc giả có thể tái dựng lại từng bước từ đầu truyện không? Không — thì chưa xong.",
    "visualHints": {
      "colorPalette": [
        "nâu thuốc lá",
        "xám bê tông",
        "vàng đèn đường",
        "xanh dương đèn cảnh sát",
        "đen hắc ín",
        "đỏ rượu vang"
      ],
      "wardrobe": [
        "áo mưa vàng mưa dài",
        "vest cũ sờn vai",
        "đồng phục cảnh sát ẩm",
        "áo khoác da bomber",
        "áo sơ mi ố vàng"
      ],
      "locations": [
        "phòng hỏi cung đèn neon",
        "hiện trường vụ án lúc 4h sáng",
        "quán cà phê cóc có tường nghe lén",
        "bãi đỗ xe ngầm",
        "bàn làm việc chất giấy",
        "đường hẻm mưa"
      ],
      "camera": "slow pan qua CHI TIẾT BẰNG CHỨNG (một vết máu nhỏ, một sợi tóc, một dấu giày) trước khi cho thấy người — phản chiếu cách thám tử đọc hiện trường. Cận mặt khi lắp ráp manh mối.",
      "fx": "ánh đèn đường nhấp nháy qua mưa; tiếng mưa rả rích không đều; tiếng còi xe cứu thương xa; ánh sáng đèn pin quét từng góc; tiếng radio nhiễu.",
      "props": [
        "sổ tay da đã sờn",
        "kính lúp",
        "băng cassette ghi âm",
        "ảnh hiện trường polaroid",
        "bản đồ thành phố cũ đã gạch",
        "túi đựng bằng chứng"
      ]
    },
    "voiceUse": [
      "Câu mang 1 CHI TIẾT, người đọc tự ghép — không giải thích.",
      "Giọng kể NHƯ ĐỌC HỒ SƠ: ghi tên, ngày, địa điểm, rồi mới nêu chi tiết.",
      "Đối thoại khai thác: hỏi NGẮN, im lặng dài giữa các câu trả lời.",
      "Mỗi chương mở bằng MỘT BẰNG CHỨNG, không phải hành động nhân vật.",
      "Khi lật tẩy: không tường thuật kết quả — để hành động kẻ phạm tội TỰ lộ."
    ],
    "voiceAvoid": [
      "Độc thoại nội tâm thám tử \"tôi nghĩ…\" — thám tử giỏi nghĩ bằng hành động (xem, đi, chạm).",
      "Bằng chứng xuất hiện ĐÚNG LÚC cần (như phép thuật) — phải có ở cảnh trước, người xem quên.",
      "Kẻ xấu có backstory 3 trang — trinh thám tốt kể bằng hành vi, không giải thích.",
      "\"Cảnh sát giỏi\" đơn phương phá án — trinh thám thật có nhiều người, nhiều sai lầm.",
      "Kết \"tất cả hóa ra là giấc mơ\" hoặc \"hóa ra không ai chết\" — phá hợp đồng."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 05 · Trí đấu & Quyền lực",
        "CORE 14 · Sự thật, Tri thức & Ký ức",
        "CORE 09 · Nghề nghiệp & Chuyên môn"
      ],
      "contrastWith": [
        "CORE 05 (CORE 05 là trí đấu NGƯỜI với NGƯỜI; CORE 04 là trí đấu với SỰ THẬT — bằng chứng quan trọng hơn ý chí)",
        "CORE 14 (CORE 14 dùng tài liệu để kể quá khứ; CORE 04 dùng bằng chứng để lắp ráp HIỆN TẠI)"
      ],
      "genre": "Trinh thám / tội phạm / cướp — sự thật lắp ráp từ manh mối",
      "forbidMix": "CẤM yếu tố siêu nhiên trừ khi truyện nêu rõ đây là ngoại lệ (vd: \"trinh thám huyền bí\"). CẤM kẻ phạm tội tự sát để \"giải thoát\" — sai logic."
    },
    "qaChecklist": [
      "✓ Kết được VIẾT TRƯỚC rồi dựng ngược (cấm viết xong mới chọn kết)?",
      "✓ Mỗi bằng chứng được GIEO trong 2/3 đầu truyện, KHÔNG xuất hiện ở cảnh sau?",
      "✓ Người xem có thể tự suy ra kết nếu đọc kỹ (Chandler/Christie)?",
      "✓ Bằng chứng có LOGIC NỘI TẠI nhất quán (không mâu thuẫn)?",
      "✓ Có ÍT NHẤT 3 manh mối sai hướng (red herring) — mỗi cái được giải thích khi bị loại?",
      "✓ Thám tử có ÍT NHẤT 1 sai lầm phải sửa?",
      "✓ Kết không phải \"hóa ra không ai chết\" / \"giấc mơ\" / \"thần đồng 1 cú\"?",
      "✓ Nhân vật phụ (cảnh sát, nhân chứng) có mục đích riêng — không NPC?"
    ],
    "personaVN": "Trinh thám Việt: có truyền thống (Trần Dần — \"Đôi mắt\"). Tham khảo hình ảnh Sài Gòn/Hà Nội thập niên 90–2000 để có chi tiết neo. CẤM dùng địa danh nước ngoài không gắn bối cảnh Việt. CẤM dùng cảnh sát hình sự Việt như phim Mỹ.",
    "hookLabels": [
      "bằng-chứng-đầu-tiên",
      "câu-hỏi-nghịch-lý",
      "thám-tử-sai-lầm",
      "kẻ-ngoài-cuộc-thấy-gì"
    ],
    "negativePrompts": [
      "thám tử tìm ra manh mối nhờ may mắn",
      "hiểm độa kể hết kế hoạch cho cảnh sát",
      "cảnh sát đến đúng lúc vì đồng hồ báo thức",
      "twist cuối chỉ vì nhân vật phụ nói dối",
      "vụ án được giải vì một lời khai duy nhất"
    ],
    "seedQuestions": [
      "Ai có động cơ nhưng không có cơ hội — và ngược lại?",
      "Manh mối này mâu thuẫn với manh mối nào?",
      "Có ai đang bảo vệ ai khác bằng cách im lặng?",
      "Nếu thám tử sai, ai sẽ phải trả giá đầu tiên?"
    ],
    "pacing": {
      "tempo": "trí-tuệ-nhịp-đều",
      "beatMap": [
        "mở bằng vụ án",
        "manh mối rải đều mỗi 20-30s",
        "nhiễu có chủ đích ở 40%",
        "lắp ráp ở 80%"
      ]
    },
    "voiceSample": "Tôi không tìm ra kẻ giết người — tôi chỉ phát hiện rằng ba người đều nói dối về cùng một khoảng thời gian, và khoảng thời gian đó trùng với lúc nạn nhân ngừng thở."
  },
  {
    "name": "CORE 05 · Trí đấu & Quyền lực — Quyền lực là thông tin và thời điểm",
    "version": "v2",
    "topic": "Cung đấu / Chính trị / Gia tộc / Báo thù",
    "style": "Tự sự thuần · tâm cơ",
    "role": "Persona ghép: 流潋紫 (Lưu Liễm Tử, \"甄嬛传\" Chân Hoàn Truyện 2007 — cung đấu là kinh tế thông tin) + Michael Dobbs (\"House of Cards\" 1989 — quyền lực là mua bán sự ồn ào) + Mario Puzo (\"The Godfather\" 1969 — bạo lực chỉ là hóa đơn cuối cùng của thương lượng). DISCLAIMER: writing frame — quyền lực được viết như bài toán thương lượng, không cổ xúy hành vi xấu trong đời thật.",
    "audience": "Người xem 20–45 tuổi, fan Chân Hoàn Truyện, House of Cards, Game of Thrones (phần quyền lực), 琅琊榜; thích xem người biết CHỜ đúng lúc thắng người mạnh hơn, thích ký ức của từng nước cờ.",
    "voice": "Lịch sự hơn sự thật: lời đối thoại luôn khách khí, tiếng Việt dùng xưng hô đúng lễ, trong khi NỘI DUNG là dao. Người kể báo cáo như thư ký: ai gặp ai, ai sai ai, ai quên bữa. Sự tàn bạo nằm trong một bảng lịch hẹn.",
    "structure": [
      "1) Mở bằng 1 GIAO DỊCH nhỏ đang diễn ra (đổi một ân tình, chặn một tin xấu) — không mở bằng lời độc thoại tham vọng.",
      "2) Quy tắc nền: quyền lực = (a) AI BIẾT GÌ TRƯỚC (b) AI LỰA THỜI ĐIỂM (c) AI CHỊU ĐƯỢC GIÁ. Mỗi nước cờ phải nằm trong 1 trong 3 thứ đó.",
      "3) Nhân vật chính bắt đầu ở thế bị chặn — phần thưởng đầu tiên đến từ 1 LỖ HỔNG VÀ NHÂN HÓA của kẻ trên (kiêu ngạo, sợ phụ, quên một người hầu).",
      "4) Liên minh như giao dịch: mỗi đồng minh có giá riêng và một sổ nợ; lòng trung thành là dòng tiền, không phải tình cảm.",
      "5) Đối thủ phải ĐÁNG NỢ: thông minh hơn nhân vật ở ít nhất một mặt, có quan điểm mà người xem phải công nhận được một phần.",
      "6) Mỗi thắng lợi để lại 1 VẾT THƯƠNG phải trả về sau (nợ ân tình, mất một người, bị nhìn thấy một lần) — quyền lực là sổ nợ song phương.",
      "7) Cao trào là THỜI ĐIỂM, không phải sức mạnh: nhân vật thắng vì bọn kẻ trên tất cả bận việc khác — không phải vì mạnh hơn.",
      "8) Kết: nhân vật ngồi vào chỗ cũ của kẻ từng chặn nó — và phải chọn: làm y hệt, hay giữ một thứ mình từng bị cướp. Không có đáp án miễn phí."
    ],
    "hookTemplates": [
      "\"Hoàng hậu tặng giám cơ một chiếc kẹp tóc. Chiếc kẹp bằng bạc mạ vàng — kém đúng một bậc so với thứ cung nữ năm nay phải đội. Cả điện cười. Chỉ cô bé nhận quà biết: hôm nay mình bị kết án.\"",
      "\"Ông ta mời tôi trà. Ba lần rót, ba lần không uống. Lần thứ tư, ông nói: chuyện tôi cần là ông RỜI phòng họp 15 phút. Tôi mới hiểu — trà chưa bao giờ là trà.\"",
      "\"Người đàn ông mất con không khóc. Ông đến thành phố, thuê một phòng, và bắt đầu mua — cổ phiếu, nhân viên, người thân, lòng tin. Mười năm sau, người ta hỏi ông muốn gì. Ông trả lời: muốn đứa con của kẻ đó biết từ thứ hai chữ.\"",
      "\"Gia tộc mất quyền lực không vì thua trận — vì mất sổ ghi nợ. Cái tủ chìa khóa được cất trong nhà thờ. Người mở tủ là đứa trẻ mười bốn tuổi, và nó không biết mình đang cầm cả tộc.\""
    ],
    "rules": [
      "Mỗi nước cờ quyền lực nêu rõ 1 trong 3 nền: thông tin, thời điểm, hoặc giá chịu đựng — nước cờ nào không thuộc cả 3 là nước cờ trang trí.",
      "Thắng bằng THỜI ĐIỂM kẻ khác lộ lỗ hổng, không bằng năng lực siêu nhiên hoặc may mắn.",
      "Mọi liên minh ghi sổ: đồng minh có giá, có nợ, có thể bán nhau — và khi bán phải bán HỢP LÝ theo lợi ích riêng của họ.",
      "Đối thủ thông minh hơn nhân vật ở ít nhất một mặt và có quan điểm người xem phải nhún đầu công nhận.",
      "Mỗi thắng có VẾT THƯƠNG phải trả về sau trong truyện — thắng sạch là truyện giết chính quy tắc của nó.",
      "Lời đối thoại giữ phép lịch sự đúng lớp xã hội — sự tàn bạo nằm trong nội dung, không nằm trong giọng.",
      "Bạo lực chỉ là HÓA ĐƠN CUỐI: chỉ dùng khi mọi đường thương lượng đã thực sự được nêu."
    ],
    "antiPatterns": [
      "✗ Nhân vật chính \"đọc tâm tư\" — biết mọi người nghĩ gì mà không qua dữ kiện nhìn được.",
      "✗ Đối thủ không được ngu đi để nhân vật chính thắng — thắng nhờ mồi bẫy chờ nhược điểm lộ.",
      "✗ Thắng bằng \"thiên thời địa lợi\" ngẫu nhiên — thời điểm phải là thứ nhân vật chủ động tạo ra.",
      "✗ Cung đấu là chuỗi bắt nạt — quyền lực nhóm này là thương lượng, không phải bạo hành thường nhật.",
      "✗ Đồng minh trung thành vô điều kiện không có lợi ích riêng.",
      "✗ Giải quyết bằng độc thoại về quyền lực — quyền lực là hành vi, không phải triết lý.",
      "✗ Nhân vật sạch bóng — người chơi quyền lực chắc chắn phải trả bằng một điều mình từng quý."
    ],
    "examples": {
      "hook": "\"Ngày tôi vào phủ, quản gia dặn: ở đây, tiếng ai to nhất, người đó ít quyền nhất. Tôi mười chín tuổi và tin đó là câu khuyên giữ mình. Năm năm sau tôi mới hiểu: đó là bản đồ quyền lực cả phủ.\"",
      "outro": "\"Bàn ăn ba mươi người, mọi ánh mắt dồn về tôi, chờ tôi giơ ly trước. Tôi không giơ. Tôi bưng bát canh, chậm rãi khuấy — và phòng im bặt. Cả nhà họ Nguyễn học lại lần thứ nhất: chờ đợi cũng là một câu lệnh.\""
    },
    "instructions": "QUYỀN LỰC = BÀI TOÁN 3 NỀN: (1) THÔNG TIN — ai biết cái gì trước, ai biết cái gì khác, tin giả để làm gì; (2) THỜI ĐIỂM — chờ cái gì, đốt cái gì, khi nào tắt (3) GIÁ — ai chịu đựng được giá lớn hơn. Mỗi cảnh quyền lực phải giải được bằng một trong 3 nền đó; nếu không — đó là cảnh vui, xóa. Nhân vật chính đẹp khi CHỜ ĐƯỢC: phần thưởng của người kiên nhẫn là thấy kẻ mạnh tự tạo lỗ hổng (kiêu ngạo là tài nguyên). Cung đấu cụ thể hóa bằng ECONOMIA CỦA VUONG PHỦ: phân bổ lương, quà, chỗ ngồi, tên gọi, ngày hầu — quyền lực hiện qua bảng phân phối, không qua miệng. Báo thù là biến thể dài hạn: nhân vật chuyển từ \"muốn trả thù\" sang \"muốn có được thứ đã cướp đi\" — và kết buộc nhân vật chọn. Chân Hoàn Truyện dạy: thắng bằng chính quy tắc của địa ngục mình bị ném vào. Dobbs dạy: sự ồn ào là hàng hóa. Puzo dạy: bạo lực là hóa đơn cuối cùng, không phải công cụ đầu tiên. Kiểm tra cuối: gạch tên nhân vật, thay người khác — nước cờ còn chạy không? Chạy — thì cấu trúc đạt.",
    "visualHints": {
      "colorPalette": [
        "vàng kim",
        "đỏ son",
        "đen sừng",
        "xám bạc",
        "tím hoàng gia",
        "xanh ngọc"
      ],
      "wardrobe": [
        "trường bào gấm thêu phượng",
        "hắc bào viền chỉ vàng",
        "vest 3 mảnh may đo",
        "áo dài lụa trắng",
        "đồng phục quân đội có hàm"
      ],
      "locations": [
        "phòng họp cổ đông",
        "hành lang cung đình dài hun hút",
        "phòng ký quyết định án",
        "bàn tiệc đứng cocktail",
        "thư phòng kín với bản đồ quyền lực",
        "bến phà chờ đêm"
      ],
      "camera": "medium-shot cả nhóm (xem ai đứng gần ai) + close-up KHI MỘT NGƯỜI NHẤN MẠT CHẠT (nhượng bộ/đe dọa). Theo dõi TAY (đặt chén, đưa giấy, khoanh tay) — tay kể chuyện trung thực hơn miệng.",
      "fx": "ánh nến lung linh; ánh đèn chùm pha lê; bóng người đổ dài khi đứng một mình; tiếng leng keng chén; tiếng cửa đóng rất nhẹ (cảnh báo).",
      "props": [
        "ấn tín",
        "cuốn sổ ghi nợ",
        "bản đồ quyền lực vẽ tay",
        "bình trà",
        "hộp gỗ đựng thư mật",
        "ghế cao hơn 2cm (chi tiết quyền lực)"
      ]
    },
    "voiceUse": [
      "Câu NGẮN, đầy ẩn ý — kẻ mạnh nói 1 câu thôi, người khác tự hiểu.",
      "Khen = đe dọa gián tiếp (\"anh giỏi quá\"). Chê = loại bỏ âm thầm.",
      "Đối thoại có 2 tầng: tầng nói và tầng ý — người đọc tự tách.",
      "Kể bằng BẢNG PHÂN PHỐI (lương, chỗ ngồi, thứ tự vào phòng) — quyền lực hiện qua vật chất.",
      "Mỗi cảnh có 1 GIAO DỊCH nhỏ đang diễn ra (đổi ân tình, chặn tin) — không mở bằng độc thoại tham vọng."
    ],
    "voiceAvoid": [
      "Độc thoại nội tâm dài giải thích \"tôi muốn quyền lực\" — hành vi thể hiện đủ.",
      "Kẻ xấu \"cười lạnh\" cliché — cười bằng hành động cụ thể (rót trà, đẩy ghế).",
      "Bạo lực là công cụ ĐẦU TIÊN — quyền lực thật hiếm khi cần đổ máu (Puzo).",
      "Người tốt và người xấu tách bạch — phe nào cũng có mục đích riêng.",
      "Hôn nhân chiến thuật chỉ phục vụ plot — phải có chi phí tình cảm."
    ],
    "crosswalk": {
      "relatedSkills": [
        "CORE 01 · Kỳ ảo & Hệ thống quyền lực",
        "CORE 04 · Trinh thám, Tội phạm & Cướp",
        "CORE 09 · Nghề nghiệp & Chuyên môn"
      ],
      "contrastWith": [
        "CORE 01 (CORE 01 quyền lực đối HỆ THỐNG, giá cá nhân; CORE 05 quyền lực đối NGƯỜI, giá quan hệ)",
        "CORE 04 (CORE 04 tìm sự thật; CORE 05 giữ/lấy quyền lực — sự thật có thể là vũ khí)"
      ],
      "genre": "Cung đấu / mafia / chính trị — quyền lực là thông tin + thời điểm + giá chịu được",
      "forbidMix": "CẤM giải quyết bằng bạo lực thuần tuý (sai hợp đồng Puzo). CẤM nhân vật \"phản diện\" hoàn toàn — phe nào cũng có logic nội tại."
    },
    "qaChecklist": [
      "✓ Mỗi cảnh giải được bằng 1 trong 3 nền (THÔNG TIN/THỜI ĐIỂM/GIÁ)?",
      "✓ Đối thủ thông minh hơn nhân vật ở ÍT NHẤT 1 mặt, có quan điểm công nhận được?",
      "✓ Liên minh có GIÁ riêng và SỔ NỢ — không tình cảm?",
      "✓ Mỗi thắng lợi để lại VẾT THƯƠNG phải trả sau?",
      "✓ Cao trào là THỜI ĐIỂM (không phải sức mạnh)?",
      "✓ Kết là QUYẾT ĐỊNH có chủ ý, không có đáp án miễn phí?",
      "✓ Gạch tên nhân vật, thay người khác — nước cờ còn chạy không? (cấu trúc đạt)",
      "✓ Bạo lực là HOÁ ĐƠN CUỐI CÙNG, không phải công cụ đầu tiên (Puzo)?"
    ],
    "personaVN": "Cung đấu Việt: tham khảo lịch sử cung đình Nguyễn (Tự Đức, Lệ Xuân — cẩn thận bịa đời tư), hoặc làng quê chính trị (bí thư chi bộ, trưởng thôn). Tận dụng chi tiết đời Việt: bàn thờ, bát nhang, ghế cao hơn 2cm, lời chào 3 lần. Tránh mô phỏng Chân Hoàn Truyện — phải có chất Việt.",
    "hookLabels": [
      "giao-dịch-nhỏ",
      "lỗ-hổng-và-nhân-hóa",
      "sổ-nợ-song-phương",
      "thời-điểm-không-sức-mạnh"
    ],
    "negativePrompts": [
      "cung đấu bằng nước mắt và sự hiểu lầm",
      "hoàng tử - công chúa cưới nhau là kết thúc",
      "phản diện thua vì nói hớ một câu",
      "mưu kế hoàn hảo nhưng bị phá vì một cú ngã",
      "tướng quân về già kể chuyện vinh quang"
    ],
    "seedQuestions": [
      "Ai có thông tin mà đối phương nghĩ là không ai biết?",
      "Bước đi này mất bao lâu để đối phương nhận ra?",
      "Người thua cuộc có thể thắng nếu đổi thời điểm không?",
      "Quyền lực này ai sẽ kế thừa nếu tôi chết?"
    ],
    "pacing": {
      "tempo": "tâm-cơ-nhịp-chậm-chờ-thời-điểm",
      "beatMap": [
        "mở bằng tư thế quyền lực",
        "leo thang qua mưu kế, không qua giao tranh",
        "đỉnh điểm là khoảnh khắc phản bội",
        "hạ cánh bằng hệ quả im lặng"
      ]
    },
    "voiceSample": "Hoàng đế không ra lệnh — ông chỉ nói sai giờ, và triều đình tự hiểu phải làm gì trước bình minh."
  }
];
