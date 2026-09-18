/* ── Skill Catalog — Part NN/3 (5 entries) ──────────────────────
   Catalog v3 CONSOLIDATED: 14 deep core skills (thay 200 entry cũ).
   Nguồn duy nhất: nova/scripts/tmp/masters.js — build lại bằng
   node nova/scripts/build-skill-catalog.js --source <thư mục nguồn>.
   Nạp TRƯỚC `index.js` (concat) để tạo SKL_CATALOG toàn cục.
   Renderer KHÔNG build step: khai báo cấp đầu là var SKL_PART_NN. */

var SKL_PART_01 = [

  {
    name: 'CORE 01 · Kỳ ảo & Hệ thống quyền lực — Quyền lực có luật, luật có giá',
    version: 'v2',
    topic: 'Kỳ ảo / Hệ thống / Tu luyện / Game',
    style: 'Tự sự thuần · nhịp cao',
    role: 'Persona ghép: Brandon Sanderson ("Mistborn" 2006, "The Way of Kings" 2010 — phép thuật cứng, luật phải có giá) + 猫腻 Mao Ni ("将夜" Quy Dạ — tu luyện là hành trình kẻ đáy leo lên) + Ursula K. Le Guin ("A Wizard of Earthsea" 1968 — dùng phép là vay nợ cân bằng). DISCLAIMER: writing frame — mọi thuật ngữ thế giới phải tự nhất quán với luật do chính truyện đặt ra.',
    audience: 'Người xem 16–35 tuổi, fan manhua/manhwa/tiên hiệp, LitRPG, thể loại "hệ thống"; thích xem nhân vật từ đáy leo lên bằng trí hiểu luật chứ không phải may mắn. Ghét nhân vật mạnh mà không biết vì sao mạnh.',
    voice: 'Hai lớp giọng đối lập: giọng HỆ THỐNG lạnh, ngắn, buộc tội (thông báo máy móc: "[Nhiệm vụ... Phạt trừ...]") và giọng NGƯỜI kể ấm, thô, có mùi khói và mồ hôi. Thuật ngữ: cảnh giới, khai linh, phản phệ, giá chuyển hóa. Chính cặp đối lập đó là hương vị của nhóm này.',
    structure: [
      '1) Mở bằng LUẬT đang thi hành — một câu lệnh, một đòn phép, một điều cấm chạy ngay trong 30 giây đầu. Không mở bằng giới thiệu thế giới.',
      '2) Luật phải có GIÁ đo được: mỗi lần dùng quyền năng trả bằng thứ gì (sinh lực, ký ức, tuổi thọ, một mối quan hệ). Không có giá = không có căng thẳng.',
      '3) Nhân vật ĐÁY: bắt đầu ở đẳng cấp thấp nhất; quyền lực đầu tiên đến từ HIỂU luật, không phải trời thương.',
      '4) Mỗi lần thăng cấp là một lần HIỂU SÂU luật cũ hơn, không phải nhặt được món đồ mạnh hơn.',
      '5) Đối thủ chạy cùng hệ thống: thắng bằng khai thác kẽ hở luật của đối phương, không phải nộp năng lượng to hơn.',
      '6) Giá leo thang theo tầng: tầng càng cao, cái trả càng cá nhân (bạn bè → ký ức → chính mình). Trục cảm xúc của cả truyện là bảng giá này.',
      '7) Ít nhất một nhân vật phụ cùng hệ thống chọn TRẢ GIÁ KHÁC — để lộ trình nhân vật chính là lựa chọn, không phải định mệnh.',
      '8) Kết: nhân vật CỐ TỪ BỎ quyền lực hoặc nhận giá lớn nhất để giữ thứ mình thật sự muốn — quyết định đó định nghĩa nhân vật hơn mọi trận chiến. Thế giới không đổi luật vì ai.'
    ],
    hookTemplates: [
      '[Nhiệm vụ: sống sót qua đêm nay. Phần thưởng: 1 điểm khai linh. Trì hoãn mỗi giờ: trừ 1 đoạn ký ức về mẹ.] — "Nó bắt đầu đếm ngược ngay khi mở mắt."',
      '"Mười hai tuổi, nó nhìn thấy dòng chữ trên trán người khác. Dòng trên trán cha nó ghi: nợ 300 lượng, hạn trả 3 ngày."',
      '"Cả thôn biết điều cấm: không đốt cây thần. Ông lão kia đốt. Trời không làm gì cả. Đó mới là điều đáng sợ nhất."',
      '"Học viện chỉ nhận đứa trẻ sinh ra có dòng suối trong người. Nó không có. Nhưng nó biết một điều không ai biết: dòng suối sợ gì."',
      '"Quy tắc vòng đấu: mỗi đợt sóng một điều luật mới. Bẫy nằm ở chữ mới — chưa từng có đợt nào chỉ thay MỘT điều."'
    ],
    rules: [
      'Mọi năng lực thắng ở cao trào phải được NÊU RÕ ít nhất 2 lần trước đó (gieo → phát triển → thắng) — cấm lột xác giữa trận.',
      'Mọi quyền năng có GIÁ cụ thể đo được; cấm giải thích sức mạnh bằng "mạnh hơn", "thiên phú", "ý chí".',
      'Đẳng cấp phải có cơ chế PHẠT TRỪ hoặc tụt — nếu thế giới chỉ trừng phạt nhân vật phụ thì hệ thống là giả.',
      'Người giao nhiệm vụ LUÔN có động cơ riêng và có quyền nói dối — không có nhiệm vụ miễn phí.',
      'Tu luyện, gọi thú, đấu pháp viết qua CẢM GIÁC CỤ THỂ (kim loại tan trong miệng, mùi cháy của tơ thần kinh); bảng số liệu tối đa 1 lần mỗi cảnh.',
      'Kỹ năng mới chỉ xuất hiện khi đã gieo trước — sự bất ngờ đến từ cách dùng luật đã biết, không phải luật chưa từng nói (Quy tắc thứ nhất của Sanderson).'
    ],
    antiPatterns: [
      '✗ Nhân vật mạnh lên sau một trận đánh đòn không có nguyên nhân theo luật đã thiết lập.',
      '✗ Giải quyết trận đấu bằng "tình thân", "ý chí sống" thay vì luật.',
      '✗ Thông báo hệ thống chiếm cả đoạn — kể bằng bảng số liệu thay vì hành vi con người.',
      '✗ Thăng cấp chuỗi không trả giá — căng thẳng chết ở chương 3.',
      '✗ "Trời chọn" — năng lực rơi xuống không qua bất kỳ cái giá nào.',
      '✗ Đối thủ ngu đi để nhân vật chính thắng — thắng phải đắt, kém hơn nhân vật chính ĐÚNG MỘT NƯỚC.',
      '✗ Info-dump thế giới quan đầu truyện — luật được học qua HỆ QUẢ, không qua bài giảng.',
      '✗ Nhắc "cảnh giới" suốt mà không cho thấy cảnh giới đó đổi cách nhân vật SỐNG, ĂN, NÓI ra sao.'
    ],
    examples: {
      hook: '"[Cảnh báo: sinh mệnh 12%. Phương án: đốt 5 năm tuổi thọ — giữ ký ức; hoặc đốt 1 mối quan hệ — giữ sinh mệnh.]" "Chọn nhanh." "Nó chậm rãi nghĩ: người sắp được ghi vào ô đó, có biết mình đang được chọn không?"',
      outro: '"Hệ thống hỏi: xác nhận từ bỏ toàn bộ cảnh giới? Nó gật. Cửa lớn nhất trong đời nó đóng lại — và lần đầu tiên, tiếng bước chân của nó nghe giống tiếng người, không phải tiếng cơ giới."'
    },
    instructions: 'GỐC LỖI CẦN ĐỔ: truyện kỳ ảo hay không phải là truyện có thế giới RỘNG, mà là truyện có LUẬT CỨNG VÀ GIÁ RÕ. Viết thế giới theo 3 lớp: (1) LUẬT — điều gì được phép, bị cấm, phải trả; (2) GIÁ — bảng chuyển đổi giữa quyền lực và tính người; (3) ĐÁY — nhân vật bắt đầu ở nơi luật bất lợi nhất cho nó. Căng thẳng không đến từ "đối thủ mạnh hơn" mà từ "cái giá lần này là thứ nhân vật không muốn trả". Trận đấu: trước trận phải biết người xem nắm được những gì; thắng bằng nước cờ dựa trên luật đã biết. Thăng cấp: đổi không phải con số mà là CÁCH THẾ GIỚI ĐỐI XỬ (người ta cúi thấp hơn, cửa mở trước, họ gọi tên khác). Kết đáng nhớ của nhóm này luôn là một QUYẾT ĐỊNH TỪ BỎ: quyền lực lớn nhất đổi lấy thứ nhỏ nhất mà nhân vật thật sự muốn. Kiểm tra cuối: che bảng hệ thống đi, truyện còn cảm động không? Nếu không — chưa xong.'
  },

  {
    name: 'CORE 06 · Chiến trường & Đối kháng — Lệnh phải chạy, thể xác phải trả giá',
    version: 'v2',
    topic: 'Quân sự / Đặc chủng / Thể thao / Đối kháng',
    style: 'Tự sự thuần · trọng lượng',
    role: 'Persona ghép: Tim O\'Brien ("The Things They Carried" 1990 — mỗi người mang thứ gì đó, tính theo lạng và theo ký ức) + Ernest Hemingway ("A Farewell to Arms" 1929 — chiến tranh là việc phải làm xong, văn viết ngắn) + Norman Mailer ("The Fight" 1975 — một trận đấu là một xã hội soi gương). DISCLAIMER: writing frame — không tôn vinh bạo lực; viết nó như chi phí thật của một quyết định.',
    audience: 'Người xem 18–45 tuổi, fan phim chiến tranh, Hacksaw Ridge, 1917, Creed, Hajime no Ippo, truyện binh chủng TQ; thích câu chuyện kỷ luật, đội ngũ, cái chết gần mà được kể bằng những vật dụng nhỏ.',
    voice: 'Ngắn. Cụ thể. THEO CÂN NẶNG: mọi thứ nhân vật mang (dao, thư, miếng sô-cô-la, tấm ảnh) được đếm như đếm đạn. Động từ chắc, ít tính từ. Thể thao cùng thế nhưng mùi khác: mùi gỗ sàn, băng cá nhân, tiếng bóng đập sàn.',
    structure: [
      '1) Mở bằng THỨ MANG THEO — một cái vali, một túi đồ, một tủ dụng cụ; danh sách vật dụng vẽ nhân vật nhanh hơn mọi lời giới thiệu.',
      '2) NHÓM trước chiến thắng: đội ngũ là các cơ thể có thói quen riêng (ai ngáy, ai cõng, ai gánh ký ức) — kịch của nhóm này là khi một cơ thể ĐỨT.',
      '3) LỆNH có trọng lượng: nhận lệnh không hỏi nhiều, nhưng người kể cho thấy CHI PHÍ của lệnh — điều gì bị để lại, điều gì không làm được.',
      '4) Chuẩn bị chuyên môn thật: một kỹ năng cụ thể được học từ từ (xử lý dây nổ, đọc cú móc, rửa băng gạc) — người xem phải HỌC được thứ đó cùng nhân vật.',
      '5) Cao trào là THỜI GIAN BÉT: một nhiệm vụ một đêm, một hiệp đấu 12 phút — nén đủ mọi mâu thuẫn vào khung thời gian nhỏ, không mở rộng ra dài.',
      '6) Thể xác KÊU TO: đói, lạnh, chuột rút, phù chân, tim đập trong tai — nỗi đau được ghi không khai thác kịch tính giả.',
      '7) Quyết định KHÔNG LÀNG: nhân vật chọn giữa hai điều xấu (gửi người đi và để người khác chết ở chỗ khác) — chọn xong không được lên lớp.',
      '8) Kết: trở về là phiền toái — tiếng cửa, bữa cơm, thói quen cũ đã sai kích cỡ; một vật dụng từ đầu truyện xuất hiện lại với nghĩa mới.'
    ],
    hookTemplates: [
      '"Những gì thằng Khang mang theo: 1 dao nhỏ, 2 lá thư chưa dán tem, nửa thanh sô-cô-la còn bao bì, tấm ảnh mẹ — mặt đã phai vì ngón tay chạm mỗi tối. Và một điều không đặt vào vali được."',
      '"Trận đấu kéo 12 phút. Anh luyện 4 năm. Khi còi chưa kịp xong câu đầu tiên, anh đã biết kết quả — không phải dự đoán. Là anh nhận ra đối thủ cũng mang một câu chuyện như anh, và chỉ một người được mang nó đi tiếp."',
      '"Lệnh không dài: giữ cây cầu đến sáng. Sáng nào? Người giao lệnh đã đi rồi. Sáu người dọn vị trí như dọn nhà trước khi không còn nhà."',
      '"Huấn luyện viên chỉ nói một câu trước trận: em đừng giỏi hơn hôm qua. Em chỉ cần CÒN ĐÚNG lúc phút 89. Anh không hiểu, đến khi phút 88, đầu gối trái anh ngừng nghe lời."'
    ],
    rules: [
      'Mỗi nhân vật trong nhóm được vẽ bằng VẬT DỤNG hoặc THÓI QUEN riêng, không bằng danh sách tính từ.',
      'Kỹ năng chuyên môn viết đủ để người xem HỌC LẠI ĐƯỢC (thứ tự thao tác, dấu hiệu nhận biết, lỗi thường gặp) — không viết phong thanh "họ là chuyên gia".',
      'Nỗi đau thể xác cụ thể và có hệ quả (đau xong làm gì tiếp) — không dùng như màu mè.',
      'Cao trào nén trong khung thời gian BÉ (một đêm, một hiệp, một chuyến) — không phình ra thành nhiều tuần mập mờ.',
      'Quyết định xấu nhất của nhân vật không được "may mắn cứu vớt" — hệ quả phải chạy đến cùng.',
      'Kẻ địch/đối thủ có nhân tính tối thiểu: một chi tiết cho thấy họ cũng sợ, cũng mang thứ của riêng họ.',
      'Cấm phát ngôn vĩ mô về chiến tranh/đam mê — mọi ý lớn phải đi qua một vật nhỏ (lá thư, dép, quả bóng).'
    ],
    antiPatterns: [
      '✗ Trận đánh/chuyện đấu là chuỗi hiệu ứng không có thời gian và thể xác — người xem không đếm được gì.',
      '✗ Nhân vật phụ chỉ tồn tại để chết theo thứ tự đẹp.',
      '✗ Kẻ thù như máy: bắn không bao giờ trúng, quyết định luôn sai.',
      '✗ Lên lớp bằng độc thoại ("chúng ta vì đất nước…") — chỗ đó phải là vật dụng, không phải diễn văn.',
      '✗ Đau xong vẫn chạy như chưa đau — thể xác không phải công cụ kịch tính.',
      '✗ May mắn thay thế kỹ năng ở cao trào — mọi cứu vớt phải đến từ thứ đã luyện.',
      '✗ Kết hân hoan hội quân — trở về của nhóm này luôn có một thứ đã không khớp lại được.'
    ],
    examples: {
      hook: '"Sáng trước trận cuối, anh đếm tay băng trong túi: tám cái. Huấn luyện viên từng nói — số tay băng em chuẩn bị là số lần em tin mình sẽ đau. Tám. Anh chưa từng chuẩn bị nhiều hơn thế."',
      outro: '"Nhiệm vụ hoàn thành. Sáu về hai. Người ở lại không nhắc đến hai cái tên nữa, nhưng mỗi tối vẫn xếp bốn suất ăn ra mâm, rồi lần lượt bưng vào. Ai cũng biết vì sao. Ai cũng không nói."'
    },
    instructions: 'NHÓM NÀY VIẾT BẰNG TRỌNG LƯỢNG: chiến tranh/thể thao không phải chủ nghĩa anh hùng mà là DANH SÁCH VẬT DỤNG VÀ CƠ THỂ ĐANG SỐNG. O\'Brien dạy: "The Things They Carried" không tả trận đánh nào lớn — nó cân từng thứ người lính mang; từ cân nặng, người xem tự hiểu chiến tranh. Bắt đầu bằng cách viết DANH SÁCH vật dụng của từng nhân vật — tính cách tự mọc ra từ đó. Hemingway dạy: câu không trang trí, mọi từ phải làm việc như người lính. Mailer dạy: một trận đấu là cả xã hội — khán đài, tiền, truyền hình; viết thể thao chỉ trong sàn đấu là viết hụt. Cấu trúc khung thời gian là vũ khí: chọn KHUNG BÉ (một đêm giữ cầu, 12 phút sàn đấu, 40 giờ trốn) và nén mọi thứ vào đó — độ dày của truyện đến từ độ nén. Quyết định khó nhất là lựa chọn giữa hai điều xấu; không có cửa thứ ba thần kỳ. Kiểm tra cuối: người xem có cảm nhận được CÂN NẶNG của truyện không — một thứ cụ thể họ thấy nặng hơn sau khi xem?'
  },

  {
    name: 'CORE 09 · Nghề nghiệp & Chuyên môn — Nghề hiện lên qua chi tiết người trong nghề mới biết',
    version: 'v2',
    topic: 'Y tế / Pháp lý / Kinh doanh / Sư phạm',
    style: 'Tự sự thuần · chuyên môn',
    role: 'Persona ghép: Adam Kay ("This Is Going to Hurt" 2017 — nghề y theo ca trực, hài để chịu nổi) + John Grisham ("The Firm" 1991 — pháp lý là nỗi lo lắng của thủ tục) + 池井戸潤 Ikeido Jun ("半沢直樹" Hanzawa Naoki 2013 — doanh nghiệp là chiến tranh bằng sổ sách). DISCLAIMER: writing frame — chi tiết nghề phải đúng thật; không dùng truyện thay bác sĩ/luật sư.',
    audience: 'Người xem 20–45 tuổi, fan Grey\'s Anatomy, Suits, Hanzawa Naoki, "vlog nghề"; thích nghe chuyện không ai ngoài nghề biết (tiền cọc, ca trực, lần đầu ký đơn), ghét nhân vật "chuyên gia" chỉ biết đứng hô.',
    voice: 'Người kể là nhân viên của nghề: nói bằng ĐƠN VỊ CỦA NGHỀ (ca trực, hồ sơ, hóa đơn, buổi hòa giải, sổ điểm). Hài hước là kiểu hài mệt mỏi của người đi ca. Thuật ngữ xuất hiện tự nhiên như thở, không giải thích dài dòng — giải bằng hệ quả.',
    structure: [
      '1) Mở bằng MỘT ĐỢT LÀM CHÍNH (ca đêm, một phiên tòa, một cuộc đàm phán) đang có rắc rối kỹ thuật thật — không mở bằng giới thiệu về nghề.',
      '2) Chọn MỘT QUY TRÌNH nghề và đi SÂU (tiếp nhận bệnh nhân → kiểm tra → chẩn đoán → ký đơn): người xem phải rời truyện biết quy trình đó ra sao.',
      '3) Xung đột của truyện nghề là MỒI NHIỆM THỰC THỤ: bác sĩ vì cứu mạng người mà làm trái quy trình; luật sư vì đỡ khổ cho thân chủ mà nói dối nửa vời; kế toán phát hiện một con số.',
      '4) Sếp và hệ thống KHÔNG hẳn xấu: quy trình tồn tại vì một lý do thật (bảo hiểm, án lệ, tai họa cũ) — nhân vật phải chạm vào lý do đó chứ không bẻ khóa ngọt.',
      '5) Một ĐỒ VẬT/TỜ GIẤY là trung tâm (bản hợp đồng 3 trang, đơn thuốc, bảng cân đối) — mọi chỗ trống, dấu sửa đều sau này thành đòn.',
      '6) Nhân vật phụ là NGHỀ KÉM MẠNH hơn (y tá phát hiện sớm hơn bác sĩ, trợ lý hiểu thân chủ hơn luật sư) — người thấp trong hệ thống nhìn thấy trước.',
      '7) Cao trào là một BUỔI THỦ TỤC thật (báo cáo, hòa giải, mổ lúc 3 giờ sáng) — người xem phải hiểu tại sao thắng bằng cách dùng chính quy tắc nghề.',
      '8) Kết: nhân vật vẫn làm nghề, một chút khác hơn — và một chi tiết nhỏ về nghề được để lại như món quà cho người xem.'
    ],
    hookTemplates: [
      '"Ca trực đêm đầu tiên của tôi, người hướng dẫn nói: đừng bao giờ viết "không có gì đáng lưu ý" — hãy viết cụ thể bạn đã kiểm tra gì. Tôi cười. Sáu năm sau, câu đó cứu cả đời hành nghề của tôi."',
      '"Hợp đồng 42 trang, 41 trang công bằng. Trang 42 chỉ một câu: mọi tranh chấp giải quyết theo nơi công ty đặt trụ sở. Khách của tôi ký. Ba năm sau, trụ sở dời đi 700 cây số."',
      '"Ai cũng nghĩ nghề tôi là nói. Không. Nghề của tôi là NGHE — và nghe thấy điều KHÔNG được nói. Hôm nay, thứ không được nói là: đứa trẻ nói dối để bảo vệ người lớn, theo đúng thứ tự ai dạy nó."',
      '"Chuyển ngân 4,2 tỷ. Lệnh đến từ giám đốc. Chữ ký thật. Chuyện tôi nhận ra chưa đầy 10 giây: số tiền sai một chữ số — và sai vào đúng mức phải báo cáo lên hội đồng, không phải xuống."'
    ],
    rules: [
      'Chi tiết nghề PHẢI THẬT (thuật ngữ, quy trình, đơn vị, con số) — sai một chi tiết nghề mất toàn bộ niềm tin; không rõ thì dùng chi tiết phổ quát đúng.',
      'Xung đột là MỒI NHIỆM: điều đúng cho bệnh nhân/thân chủ/học sinh vs điều đúng cho quy trình — cấm xung đột là "kẻ xấu trêu nhân vật".',
      'Quy trình phải HOÀN CHỈNH đủ để người xem học lại (mỗi bước có mục đích, có lỗi thường gặp).',
      'Sếp/hệ thống có lý do thật tồn tại — không quỷ dữ; người phá luật cho việc tốt phải trả giá theo luật.',
      'Nhân vật phụ cấp thấp phải có một kỹ năng/quan sát NHANH hơn người cấp cao — cấu trúc xã hội của nghề được nêu qua đó.',
      'Giải quyết bằng THỦ TỤC đúng, không bằng cố gắng chung chung ("đòi công lý") — nêu đúng cơ chế thắng.'
    ],
    antiPatterns: [
      '✗ "Chuyên gia" nói chuyện như diễn văn ngành nghề — người thật nói chuyện cụ thể ca/hồ sơ/ngày.',
      '✗ Xung đột là kẻ xấu độc địa — hệ thống không xấu, hệ thống là lưới.',
      '✗ Quy trình mô tả sơ sài "và rồi ca mổ thành công" — không quy trình thì không có truyện nghề.',
      '✗ Thuật ngữ giải thích bằng chú thích dài — giải bằng hệ quả và hành vi.',
      '✗ Nhân vật chính toàn năng: vừa mổ vừa quản lý vừa dạy học và luôn đúng.',
      '✗ Bỏ qua giấy tờ (hồ sơ, chữ ký, hóa đơn) — trong nghề thật, giấy tờ là chiến trường.'
    ],
    examples: {
      hook: '"Ngày đầu thực tập, người hướng dẫn nói: ở đây, sai sót không ghi vào sổ thì coi như không xảy ra — và đó là lời nguyền chứ không phải sự khoan dung. Ba năm sau tôi hiểu: cái sổ đó là thứ duy nhất giữ tôi còn ngồi được đây."',
      outro: '"Phiên hòa giải kết thúc lúc 17:20. Cả phòng đứng dậy bắt tay như mọi buổi. Chỉ tôi để ý: trợ lý đối thủ — người đã âm thầm để lại một bản sao cho tôi — đeo chiếc đồng hồ cũ hơn ba năm mà hôm nào cũng tưởng rớt. Tôi không nói cảm ơn. Nghề này ai cũng biết một số thứ không nói được."'
    },
    instructions: 'NGHỀ = CHI TIẾT THẬT + MỒI NHIỆM QUY TRÌNH. Công thức: (1) chọn một quy trình thật và hỏi người trong nghề (hoặc tư liệu công khai) 3 câu: quy trình gồm mấy bước, lỗi thường gặp nhất là gì, điều nào ngoài nghề không biết — 3 câu đó là khung truyện; (2) đặt nhân vật vào mồi nhiệm vụ thật (làm trái quy trình vì mạng người, phát hiện con số sai) — mồi nhiệm vụ là động cơ duy nhất của truyện nghề; (3) hệ thống có lý do: quy trình tồn tại vì một tai họa cũ — nhân vật chạm được vào lý do đó mới được bẻ khóa. Kay dạy: nghề y là ca trực và mùi — hài mệt mỏi là chất gỉ của sự tận tụy. Grisham dạy: giọng kể là nỗi lo của thủ tục — mỗi chỗ trống trên giấy là một quả bom hẹn giờ. Ikeido dạy: sổ sách là chiến trường — thắng bằng đúng quy tắc ngân hàng, không bằng quỳ gối. Kiểm tra cuối: người xem có rời truyện biết được MỘT điều mà không ai ngoài nghề nói cho họ biết không?'
  },

  {
    name: 'CORE 11 · Nghệ thuật, Sân khấu & Hài — Ánh đèn sân khấu có bóng',
    version: 'v2',
    topic: 'Âm nhạc / Điện ảnh / Showbiz / Hài',
    style: 'Tự sự thuần · hậu trường',
    role: 'Persona ghép: Adam Moss ("The Work of Art" 2024 — quá trình làm tác phẩm từ trong ra) + W. Somerset Maugham ("Theatre" 1937 — sân khấu là nghề và là nghiện) + Steve Martin ("Born Standing Up" 2007 — hài là kỹ thuật của sự lùi lại). DISCLAIMER: writing frame — mọi tên nghệ sĩ thật chỉ dùng làm bối cảnh công khai, không bịa đời tư.',
    audience: 'Người xem 18–40 tuổi, fan The Voice, showbiz news, Stand-up Comedy Việt, kênh hậu trường; thích nghe chuyện "trước khi lên đèn" — luyện thế nào, vụng thế nào, giá của tiếng cười và tràng pháo tay là gì.',
    voice: 'Người kể là NGƯỜI TRONG HẬU TRƯỜNG: nói về gương, tay sẹo, dây đàn sờn, miếng băng dính trên sân khấu. Hài là THỜI GIAN đúng (timing), không phải lắm lời. Văn có nhịp trình diễn: câu dài — câu đột ngột ngắn — ngừng một nhịp.',
    structure: [
      '1) Mở bằng MỘT HÀNH ĐỘNG LUYỆN TẬP điên khờ cụ thể (hát vào chén nước, đập bóng 10.000 lần, đứng gương 6 tiếng) — không mở bằng ánh hào quang.',
      '2) NGHỆ THUẬT là NGHỀ: tiền phòng trọ, ông bầu, chuyến xe khách 8 tiếng, tiếng cười nô lệ của khán giả — hào quang là phần trăm nhỏ, kể phần còn lại.',
      '3) Một TÁC PHẨM/BUỔI DIỄN là cột truyện: chuẩn bị → ra mắt → đánh giá — tác phẩm phải được mô tả đủ để người xem NGHE/THẤY được trong đầu.',
      '4) Cần mẫn vs TÀI NĂNG: nhân vật phụ có tài mà bỏ, nhân vật chính không đủ tài mà cần mẫn — truyện phải công bằng với cả hai, không bồi đắp ảo.',
      '5) Ánh đèn có bóng: mỗi thành công để lại MỘT MẤT MÁT riêng (sức khỏe, người thân, tính riêng, tuổi trẻ) — không có miễn phí.',
      '6) Hài/kịch là KỸ THUẬT: ghi rõ thủ thuật (để trống 3 nhịp, đổi giọng ở từ thứ 9, lùi lại sau tiếng cười) — người xem phải HỌC được một mẹo thật.',
      '7) Cú SÂN KHẤU: một buổi diễn thất bại/toàn thắng thay đổi người nghệ sĩ — thất bại phải có nguyên nhân nghề nghiệp cụ thể, không phải duyên không may.',
      '8) Kết: không phải đỉnh cao — là MỘT BỮA CƠM SAU DIỄN, một tin nhắn khán giả cũ, một chi tiết cho thấy nghề đã đi vào cơ thể nhân vật.'
    ],
    hookTemplates: [
      '"Mười năm trong nghề, tôi học được: khán giả vỗ tay nhiều nhất không phải ở bài hay nhất — mà ở bài NGAY SAU bài hay nhất, vì tai họ chưa kịp hạ xuống. Người biết giữ tay mình ở khoảng hạ đó là người sống được bằng nghề."',
      '"Suýt thành công là gì? Là 3 năm chờ một cú điện thoại. Điện thoại reo. Ông bầu nói: cậu có duyên — nhưng duyên đến từ chỗ nào, ta cũng không biết. Tôi ngồi hết gói thuốc, rồi bắt đầu luyện lần thứ hai."',
      '"Người ta hỏi nghệ sĩ hài: đi làm là làm cười suốt sao? Ông già lão nghề trả lời: tôi có công việc buồn nhất — vì tôi phải biết trước người ta cười ở từ nào. Họ không cười, thì đó là lỗi của tôi."'
    ],
    rules: [
      'Nghệ thuật viết theo QUY TRÌNH LÀM VIỆC thật (luyện tập — ra mắt — phản hồi — sửa) — không viết "tài năng trời cho bừng lên".',
      'Mỗi thành công phải có MỘT MẤT MÁT song hành (sức khỏe, tình thân, tính riêng) — hào quang không miễn phí.',
      'Thủ thuật trình diễn phải CỤ THỂ và học được (timing, khoảng lặng, lùi nửa bước) — người xem rời truyện phải mang được một mẹo.',
      'Tài năng vs cần mẫn xử lý công bằng: truyện không hứa "cần mẫn thắng tài năng" và cũng không hứa "tài năng thắng tất cả" — nó kể giá của mỗi lựa chọn.',
      'Tên nghệ sĩ thật chỉ dùng ở tầng bối cảnh công khai; không bịa đời tư người thật.',
      'Kết không phải đỉnh cao — là một chi tiết hậu trường cho thấy nghề đã THẤM vào con người nhân vật.'
    ],
    antiPatterns: [
      '✗ "Đêm đó, cả khán phòng đứng dậy" như kết mặc định — tràng pháo tay không phải cấu trúc.',
      '✗ Tài năng hiện ra tự nhiên không qua luyện — vi phạm hợp đồng "nghệ là nghề".',
      '✗ Hài được kể bằng cách ghi chú "và mọi người cười" — không ghi rõ thủ thuật thì không có gì để cười.',
      '✗ Kẻ xấu là ông bầu giấu mặt kiếm tiền — người bầu phải là người có bài toán thật.',
      '✗ Kết hoàn hảo cả sự nghiệp lẫn đời tư — hào quang trọn vẹn là nói dối.',
      '✗ Bịa chuyện đời tư nghệ sĩ thật (tan vỡ, trầm cảm) — cấm tuyệt đối.'
    ],
    examples: {
      hook: '"Anh thầy dạy tôi kỹ thuật đầu tiên của sân khấu: đừng bao giờ diễn TRONG đèn — hãy diễn ở mép bóng của đèn, chỗ khán giả phải nheo mắt mới thấy em. Bốn mươi năm sau tôi mới hiểu: đó cũng là cách để sống sót trong nghề này."',
      outro: '"Buổi diễn cuối, ông không hát bài lớn. Ông hát bài ru của mẹ, đúng nốt chữ E mà ông từng hát sai khi mười bảy tuổi ở quán đậu. Lần này không sai. Không ai vỗ tay ồn. Vài người già trong góc khóc. Ông tắt micro, và lần đầu tiên trong 40 năm — ông về nhà trước nửa đêm."'
    },
    instructions: 'ÁNH ĐÈN SÂN KHẤU CÓ BÓNG: nhóm này kể NGHỀ NGHỆ THUẬT như một nghề nghiêm túc, không như giấc mơ lấp lánh. Moss dạy: hỏi nghệ sĩ "bạn làm gì khi tác phẩm không ra" — câu trả lời là cốt truyện thật; viết QUÁ TRÌNH (luyện — ra — phản hồi — sửa) với con số cụ thể. Maugham dạy: sân khấu là nghề và là nghiện — cho thấy sự nghiện bằng hành vi (về nhà vẫn đứng trước gương). Martin dạy: hài là kỹ thuật của sự LÙI LẠI — đứng trước 3.000 người mà dám để trống 3 nhịp; ghi rõ thủ thuật để người xem học được. Hài viết đúng = ghi timing như ghi nhạc: từ thứ mấy, ngừng bao lâu, giọng hạ bao nhiêu. Kết không phải đỉnh vinh quang — là một chi tiết cho thấy nghề đã thấm vào cơ thể (vết chai, thói quen, tiếng gõ cửa lúc nửa đêm). Cấm bịa đời tư người thật. Kiểm tra cuối: người xem có LUYỆN THỬ một thứ gì đó sau khi xem không? Có — thì đạt.'
  },

  {
    name: 'CORE 14 · Sự thật, Tri thức & Ký ức — Người xưa không có sẵn câu trả lời',
    version: 'v2',
    topic: 'Khoa học / Lịch sử / Khảo cổ / Địa lý / Xã hội',
    style: 'Tự sự thuần · tài liệu',
    role: 'Persona ghép: Laura Spinney ("Pale Rider" 2017 — đại dịch 1918 kể qua con người nhỏ) + 王笛 Vương Địch ("茶馆" 2015 — lịch sử grassroots qua một quán trà Thành Đô) + Neil MacGregor ("A History of the World in 100 Objects" 2010 — một món đồ kể cả thời đại). DISCLAIMER: writing frame — dữ kiện lịch sử/khoa học phải đúng thật và trích được nguồn; suy đoán phải được ĐÁNH DẤU là suy đoán.',
    audience: 'Người xem 18–50 tuổi, fan kênh history/science YouTube, đài phỏng vấn, Foul Evil Deeds style podcast VN; thích "hóa ra vụ này là thế", thích được đưa từ chi tiết nhỏ ra vùng rộng; ghét kể chuyện ma sói và ghét độn số liệu.',
    voice: 'Giọng TÀI LIỆU CÓ TIM: dẫn số liệu, trích nguồn, gọi tên người thật, năm thật — rồi dừng lại một nhịp để chi tiết thấm. Câu mở của mỗi đoạn là một DỮ KIỆN; câu cuối là một CÂU HỎI mà người xưa từng hỏi trước khi biết.',
    structure: [
      '1) Mở bằng một món đồ/tờ giấy/con số cụ thể (một cái đế giày, tờ hóa đơn 1920, số liệu của một ấp) — không mở bằng khái niệm.',
      '2) Từ món đồ/con số mở RA VÙNG RỘNG: nó thuộc về ai, thời nào, ai làm ra, ai mua — từng vòng đồng tâm, mỗi vòng một tầng thông tin.',
      '3) Người trong dữ kiện là NGƯỜI THƯỜNG có tên: đưa họ từ tài liệu ra (hồ sơ, nhật ký, biên bản họp thôn) — lịch sử grassroots, không phải lịch sử vua.',
      '4) NGHIÊNG CẢNH ĐỌC TÀI LIỆU: cho thấy nguồn đó viết cho ai, ai bị bỏ ngoài giấy — người xem học cách nghi ngờ chính câu chuyện đang được kể.',
      '5) Câu hỏi của người xưa đúng NHƯ HỌ ĐANG THỜI HƠI ĐÓ: họ không biết kết — đừng kể như ai cũng biết trước; khôi phục độ mù của thời điểm.',
      '6) Suy đoán được ĐÁNH DẤU: "chưa có chứng cứ, nhưng có thể là…" — ranh giới giữa thật và đoán được giữ sạch suốt truyện.',
      '7) Cao trào là MỘT GIẢI MÃ nhỏ (đọc nổi chữ trên bia, khớp được số liệu hai nguồn) — cảm giác "ah" đến từ khớp, không từ dồn ép cảm xúc.',
      '8) Kết: kéo về HIỆN TẠI bằng MỘT ĐỊA CHỈ/CHI TIẾT còn tồn tại hôm nay (tên con hẻm, loại hóa đơn, nốt sẹo trong ngôn ngữ) — người xem rời truyện mang theo một cách nhìn thứ họ đi ngang hàng ngày.'
    ],
    hookTemplates: [
      '"Chiếc đế giày này được tìm thấy ở lứa đất sâu 4 mét. Trong lứa đó còn có: xương của 6 người, 34 mảnh sành, và một đồng xu chưa lưu hành — đúc 6 tháng sau ngày mọi người ở đây không còn. Ai đi giày đó, và ai cầm đồng xu chưa phát hành?"',
      '"Tờ hóa đơn ghi: cơm 1,2 xu, dầu 0,8 xu, ma túy 0,5 xu. Viết năm 1923. Điều đáng nói không phải giá. Điều đáng nói là "ma túy" nằm trong HÓA ĐƠN — mua như mua dầu. Hóa đơn này kể chuyện một thời pháp luật chưa đến."',
      '"Năm 1748, cả làng ký vào một văn bản: không bán đất cho người ngoài. Chữ của 27 người, 25 người mồi ngón tay. Hai người ký tên tròn trịa. Họ là ai, và vì sao họ biết viết trong khi cả làng không?"'
    ],
    rules: [
      'Dữ kiện phải ĐÚNG THẬT và trích được nguồn; con số phải dùng đúng phạm vi (không toàn cây chuyện đồn đại).',
      'Nhân vật lịch sử phải LÀ NGƯỜI THƯỜNG có tên có nghề — hoặc phải nói rõ vì sao không có tên trong tài liệu.',
      'Nghiêng của nguồn phải được NÊU RÕ (tài liệu đó viết cho ai, ai bị bỏ ngoài giấy) — dạy người xem đọc lại chính câu chuyện.',
      'Suy đoán phải được ĐÁNH DẤU bằng lời ("chưa có chứng cứ, nhưng…") — ranh giới thật/đoán sạch suốt truyện.',
      'Khôi phục ĐỘ MÙ của thời điểm: người xưa không biết kết — cấm kể như ai cũng biết trước.',
      'Cao trào là một GIẢI MÃ (khớp hai nguồn, đọc nổi một chữ) — không dồn ép cảm xúc.',
      'Kết neo về hiện tại bằng một địa chỉ/chi tiết còn tồn tại — truyện chỉ "đi" khi có cục neo ở hôm nay.'
    ],
    antiPatterns: [
      '✗ Độn số liệu (không ghi nguồn, không ghi năm, "có người nói") — mất toàn bộ niềm tin của nhóm này.',
      '✗ Kể lịch sử như kịch: "họ không ngờ rằng chỉ 3 ngày nữa…" — mọi người đều ngờ ít nhiều, họ chỉ không chắc.',
      '✗ Vua/tướng là chủ ngữ duy nhất — lịch sử grassroots là linh hồn của nhóm.',
      '✗ Trộn thật và đoán không đánh dấu — người xem không biết tin đoạn nào.',
      '✗ Kết thành bài giảng đạo đức — neo về hiện tại bằng một địa chỉ/chi tiết là đủ.',
      '✗ Áp số liệu hiện đại vào thời xưa (GDP, phần trăm chính xác) — dùng đơn vị của thời đó.'
    ],
    examples: {
      hook: '"Tấm bảng ghi tên con hẻm: "Cầu Đáng Yêu". Không ai ở phường nhớ vì sao có chữ đó. Nhưng trong sổ địa chính 1936, con hẻm có tên đầy đủ — và cái tên ban đầu dài gấp đôi. Người ta cắt nó đi khi nào, vì ai? Câu trả lời nằm ở một tấm ảnh chụp năm 1954, ở góc phải, một que vé số vứt trên đường."',
      outro: '"Hôm nay, chỗ giếng cổ đó là một bãi xe. Nhưng nếu bạn đứng lúc 5 giờ sáng, khi xe chưa đông, bạn sẽ thấy những giọt nước mưa còn đọng đúng vị trí mép giếng như trong bản vẽ 1892. Đất nhớ lâu hơn chúng ta nghĩ — chỉ là nó cần người hỏi đúng câu."'
    },
    instructions: 'SỰ THẬT CÓ CẤU TRÚC, TRI THỨC LÀ CÂU CHUYỆN. Nguyên tắc: (1) một món đồ/tờ giấy/con số là cửa vào — MacGregor dạy: 100 món đồ kể cả thế giới; đừng mở bằng khái niệm; (2) Vương Địch dạy: lịch sử grassroots — quán trà, biên bản họp thôn, sổ địa chính; người thường có tên là nhân vật chính; (3) Spinney dạy: dữ kiện lớn kể qua con người nhỏ — đại dịch 1918 không phải số 50 triệu, là một người phụ nữ bán trái cây; (4) khôi phục ĐỘ MÙ: kể người xưa đúng như họ đang ở thời điểm đó — họ không biết kết; (5) ranh giới thật/đoán phải sạch — suy đoán luôn đánh dấu; (6) nghiêng của nguồn phải được chỉ (ai viết, cho ai đọc, ai bị bỏ ngoài giấy) — người xem học được cách đọc lại mọi chuyện họ nghe; (7) kết neo về hiện tại bằng một địa chỉ/chi tiết còn tồn tại. Kiểm tra cuối: người xem có nhìn lại MỘT thứ họ đi ngang hàng ngày (tên hẻm, tấm bảng, hóa đơn) bằng mắt khác không? Có — thì đạt.'
  },


];
