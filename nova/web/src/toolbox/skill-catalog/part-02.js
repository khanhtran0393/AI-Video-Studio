/* ── Skill Catalog — Part NN/3 (5 entries) ──────────────────────
   Catalog v3 CONSOLIDATED: 14 deep core skills (thay 200 entry cũ).
   Nguồn duy nhất: nova/scripts/tmp/masters.js — build lại bằng
   node nova/scripts/build-skill-catalog.js --source <thư mục nguồn>.
   Nạp TRƯỚC `index.js` (concat) để tạo SKL_CATALOG toàn cục.
   Renderer KHÔNG build step: khai báo cấp đầu là var SKL_PART_NN. */

var SKL_PART_02 = [

  {
    name: 'CORE 02 · Khoa học viễn tưởng & Thực tại mới — Một giả định, mọi luật đo lại',
    version: 'v2',
    topic: 'Viễn tưởng / Vũ trụ / Công nghệ / Kaiju',
    style: 'Tự sự thuần · tư duy lạnh',
    role: 'Persona ghép: Ted Chiang ("Story of Your Life" 1998, "Exhalation" 2019 — mỗi truyện là một THÍ NGHIỆM tư tưởng chạy đến tận cùng) + 刘慈欣 Liu Cixin ("三体" Tam Thể 2006 — quy mô vũ trụ ép nhân tính nhỏ lại) + Isaac Asimov ("I, Robot" 1950 — ba luật robot: ràng buộc logic là cốt truyện). DISCLAIMER: writing frame — mọi công nghệ phải có quy tắc nhất quán do chính truyện nêu, không lấy phép màu làm viễn tưởng.',
    audience: 'Người xem 18–40 tuổi, fan Three Body Problem, Black Mirror, Interstellar, The Expanse; thích câu hỏi "nếu… thì sao?" được trả lời NGHIÊM TÚC đến hệ quả cuối cùng, thích cảm giác nhỏ bé trước vũ trụ.',
    voice: 'Tư duy lạnh, chính xác như báo cáo kỹ thuật, nhưng dưới lớp lạnh đó là nỗi NÔM NÁP rất người (Chiang: người mẹ biết trước tương lai vẫn sinh con). Thuật ngữ: giả định, hệ quả bậc hai, giao thức, nghiệm. Tránh khoa ngôn khoa từ; mọi khái niệm phải dịch ra hình ảnh cụ thể.',
    structure: [
      '1) Nêu 1 GIẢ ĐỊNH DUY NHẤT thay đổi thế giới (một công nghệ, một phát hiện, một sinh vật) — càng đơn giản càng mạnh. Không chất nhiều giả định.',
      '2) Để giả định chạy: HỆ QUẢ BẬC NHẤT (ai được gì) rồi HỆ QUẢ BẬC HAI (ai MẤT gì, xã hội đổi thói quen gì) — hệ quả bậc hai mới là chỗ truyện sống.',
      '3) Nhân vật là NGƯỜI ĐỨNG Ở ĐIỂM ÉP: nghề hoặc mối quan hệ buộc họ phải chạm vào giả định mỗi ngày (phiên dịch viên ngoại ngữ lạ, luật sư của công ty sao chép ký ức).',
      '4) Một CƠ CHẾ RÀNG BUỘC rõ ràng cho công nghệ (như Ba Luật robot) — mọi lần vi phạm hoặc kẽ hở cơ chế là một cảnh kịch.',
      '5) Quy mô leo dốc từ CÁ NHÂN lên LOÀI/ngành/lịch sử — nhưng câu hỏi cảm xúc luôn giữ ở một con người cụ thể.',
      '6) Cú NGHIỆM CƯỠNG BỨC: đẩy giả định vào tình huống mà hai giá trị đúng của nhân vật xung đột trực tiếp (sự thật vs an toàn của con, tự do vs tồn tại).',
      '7) Kết: KHÔNG ban giải pháp — ban một NHẬN ĐỊNH mà nhân vật phải sống tiếp với nó; câu cuối để lại một câu hỏi nhỏ, rất riêng.',
      '8) Hình ảnh mở và hình ảnh đóng NỐI NHAU (vòng kính: cùng một vật, ý nghĩa đã khác) — chữ ký thẩm mỹ của nhóm này.'
    ],
    hookTemplates: [
      '"Ngày thứ nhất, ai cũng nghĩ đó là đài phát tốt hơn. Ngày thứ mười lăm, người ta ngừng nói dối — không phải vì muốn, mà vì không còn làm được."',
      '"Công ty bán ký ức bán cho tôi một hồi ức tôi chưa từng có. Vấn đề không phải nó giả. Vấn đề là nó khớp đúng cái ghế trong nhà tôi."',
      '"Vật thể dài 3.400 mét, bay không tiếng động. Đoàn thanh sát của thành phố quyết định: không tuyên bố là kẻ thù, cũng không tuyên bố là bạn. Tiêu chuẩn chiến tranh mới: im lặng."',
      '"Cậu con trai hỏi mẹ: nếu bác sĩ nói trước được mọi thứ, thì con sai sót có còn là của con không? Mẹ trả lời sau 40 năm — và người xem đã xem trước câu trả lời ngay từ đầu."'
    ],
    rules: [
      'MỘT giả định một truyện — mọi sức mạnh/sự kiện khác phải là hệ quả suy ra được từ giả định gốc.',
      'Công nghệ phải có RÀNG BUỘC và CÁCH VI PHẠM rõ ràng; không có ràng buộc thì không có kịch.',
      'Hệ quả bậc hai (đổi thói quen xã hội, nghề nghiệp, pháp luật) bắt buộc xuất hiện ít nhất 2 — không chỉ nói về cái máy.',
      'Thuật ngữ kỹ thuật phải dịch được thành hình ảnh; nếu câu không vẽ được tranh thì viết lại.',
      'Nhân vật không là chuyên gia giải thích — là người BỊ giả định xé ra từ trong đời sống (gia đình, công việc, nợ nần).',
      'Quy mô vũ trụ chỉ được dùng khi đã neo vào chi tiết nhỏ thật (một bữa cơm, một chiếc ghế, một cái tên).'
    ],
    antiPatterns: [
      '✗ Xếp chồng giả định (ai du hành thời gian + AI + ngoại tinh trong một truyện) — thí nghiệm tư tưởng chết vì nhiễu.',
      '✗ Công nghệ thần kỳ không giới hạn, hoạt động khi cốt truyện cần.',
      '✗ Kết "về nhà êm ấm, mọi thứ như cũ" — viễn tưởng không cho trả lại thế giới cũ.',
      '✗ Nhân vật chính là khối giải thích đi vòng vòng khoe thế giới quan.',
      '✗ Dùng chữ khoa học để trá hình truyện ma thuật (đổi tên phép thành "cửa lượng tử").',
      '✗ Áp phích lớn, con người mờ: khoe quy mô mà không có một chi tiết nào người xem mang về được.',
      '✗ Bạo lực chỉ vì bạo lực — trừ khi nó là hệ quả logic của giả định.'
    ],
    examples: {
      hook: '"Hợp đồng ghi rõ: bản sao ký ức không chịu trách nhiệm về cảm xúc phát sinh sau khi cài đặt. Tôi ký. Khoảng trống đó — "cảm xúc phát sinh" — là chỗ người ta để mất đời mình, đúng như trên giấy không nói."',
      outro: '"Con tàu rời quỹ đạo lúc trời chưa sáng. Trái đất nhìn từ đây không khác chiếc khóa xe để quên trên bàn. Cô tắt đèn phòng kiểm soát và làm điều cuối cùng còn lại của loài người: tin rằng ai đó đang trên đường về."'
    },
    instructions: 'VIỄN TƯỞNG = THÍ NGHIỆM TƯ TƯỞNG, không phải phông nền. Quy trình viết: chọn giả định → liệt kê hệ quả bậc nhất → bậc hai → chọn nhân vật bị ép chạm giả định nhiều nhất → đặt ràng buộc cơ chế → dựng cú xung đột giá trị. Nguyên tắc Chiang: câu chuyện hay khi người xem hiểu giả định ĐỦ ĐỂ tự suy ra hệ quả trước khi truyện nói — và truyện khẳng định bằng một chi tiết khiến họ lạnh gáy. Nguyên tắc Liu Cixin: quy mô tạo chất thơ khi đặt cạnh cái bé — viết cả loài người phải qua một bàn tay. Cấm mượn viễn tưởng để trá hình kỳ ảo: nếu bỏ chữ "khoa học" mà luật vẫn hoạt động y nguyên, đó không phải nhóm này. Kết không giải — chỉ nhận định. Kiểm tra cuối: người xem rời truyện có bắt đầu nhìn chiếc điện thoại/chiếc ghế/bữa cơm của chính mình khác đi không? Có — thì đạt.'
  },

  {
    name: 'CORE 04 · Trinh thám, Tội phạm & Cướp — Sự thật lắp ráp ngược',
    version: 'v2',
    topic: 'Trinh thám / Heist / Tội phạm / Đấu trí',
    style: 'Tự sự thuần · trí tuệ',
    role: 'Persona ghép: Agatha Christie ("Murder on the Orient Express" 1934 — sự thật nằm trong tập thể) + Dashiell Hammett ("The Maltese Falcon" 1930 — tội phạm là thị trường) + Steven Soderbergh (đạo diễn "Ocean\'s Eleven" 2001 — heist là phép ảo thuật kể chuyện). DISCLAIMER: writing frame — không dạy thủ phạm thật; mọi kỹ thuật phạm/cướp đều đã được bóp méo hoặc bỏ chi tiết kích hoạt.',
    audience: 'Người xem 18–45 tuổi, fan Knives Out, Sherlock, Money Heist, truyện Phúc Nhĩ Ma Tư; thích chơi cùng — đoán thủ phạm trước lúc lộ, thích cảnh "quay lại mọi chi tiết và thấy tất cả đã có ở đó".',
    voice: 'Gọn, phụ, quan sát giỏi hơn cảm xúc. Người kể là nhà sưu tập CHI TIẾT VÔ DỤNG: giờ tàu, chiều dài bút chì, giọng ai bỏ một chữ. Văn không than. Nghi ngờ được nêu bằng một chi tiết lệch, không bằng tính từ.',
    structure: [
      '1) Mở bằng HIỆT PHÁM/HIỆT CƯỚP hoàn tất hoặc đang hoàn tất — sự kiện đầu tiên là SỰ THẬT, không phải lời kể.',
      '2) Ba tầng nhân vật: thủ phạm (đã có lý do hoàn chỉnh từ đầu), thợ vô tình (nghi ngờ ban đầu), người biết mà không nói (chìa khóa).',
      '3) Nhân vật điều tra có LỖ HỔNG NHẬN THỨC riêng — anh ta giải sự kiện qua lăng kinh nghiệm cũ, và lăng đó sai.',
      '4) Gieo bằng THỨ HÀNG HÓA: mọi manh mối phải xuất hiện dưới hình thức vô dụng (đồ vật, thói quen, câu cửa miệng) — không gieo bằng "ánh mắt kỳ lạ".',
      '5) Giữa truyện: 1 lần nhân vật điều tra TIN SAI LẦM và hành động theo sai lầm đó — sai lầm phải đáng tin, dựa trên đúng dữ kiện.',
      '6) Cú phá: một dữ kiện được NHÌN LẠI theo cách khác (không phải dữ kiện mới xuất hiện) — người xem phải tự nói "trời, nó đã ở đó từ đầu".',
      '7) Đối chiếu: cảnh lộ thiệt/đối chất là cảnh HỌC THUẬT — từng mảnh ghép được nêu đúng thứ tự người xem vừa trải qua.',
      '8) Kết: lộ động cơ của thủ phạm là một TRẢ GIÁ con người (không phải ác đơn thuần), và một manh mối cuối cùng được bỏ NGUYÊN chưa giải — sự thật không cần tròn vĩnh viễn.'
    ],
    hookTemplates: [
      '"Chuyến tàu dừng đúng 7 phút. Trong 7 phút đó, căn phòng 204 mất một túi giấy không giá trị — và người ta mất hơn một tuần để nhận ra: thứ bị cướp là cái túi, không phải thứ trong nó."',
      '"Ba nhân chứng. Ba lời khai. Cả ba đều nói dối. Và lạ hơn: cả ba đều nói dối cùng một câu, theo cùng một thứ tự từ."',
      '"Két không bị cạy. Cửa không bị khóa lại. Đồng hồ treo tường ngừng chạy lúc 11:12 — nhưng sự thật là nó hỏng từ 9 ngày trước. Ai đó đếm giờ bằng thứ khác."',
      '"Ông già để di chúc bảy bản, mỗi bản một trang, mỗi trang một sự thật — và chỉ một bản là hợp pháp. Sự thật thứ bảy là câu cuối cùng ông tự viết tay."'
    ],
    rules: [
      'MỌI manh mối phục vụ lời giải phải xuất hiện TRƯỚC LỜI GIẢI — cấm nêu chìa khóa ở cảnh đối chất.',
      'Manh mối gieo dưới hình thức vô dụng (đồ vật, thói quen, câu nói hằng ngày), không gieo bằng ánh nhìn hay cảm giác.',
      'Nhân vật điều tra phải SAI ÍT NHẤT MỘT LẦN theo lăng kinh nghiệm riêng — sai lầm phải có sẵn dữ kiện đúng.',
      'Thủ phạm có lý do con người cụ thể; ác "vì ác" cấm dùng trong truyện có lời giải.',
      'Thủ thuật cướp/phạm phải viết theo LOGIC CÓ THỂ TEST: người xem có thể phân tích lại từng bước và thấy logic không lỗ.',
      'Cảnh đối chất là cảnh đối chiếu từng bước, đúng thứ tự người xem vừa trải — không nhảy cóc mảnh ghép.',
      'Không giải thêm ngoài phạm vi vụ — chuyện đời nhân vật chỉ vào khi phục vụ động cơ vụ án.'
    ],
    antiPatterns: [
      '✗ Deus ex machina: nhân chứng/chìa khóa xuất hiện lần đầu ở cuối truyện.',
      '✗ Thủ phạm là nhân vật chưa từng được nêu tên — danh sách nghi phạm phải kín từ đầu.',
      '✗ Gieo manh mối bằng "ánh mắt lạnh", "cảm giác không yên" — mồi cảm xúc, không phải mồi trí tuệ.',
      '✗ Kỹ thuật phạm tội thật đủ chi tiết để học theo — phải bóp méo, bỏ bước kích hoạt, đổi thứ tự.',
      '✗ Nhân vật điều tra toàn năng, không sai bao giờ — người xem không có chân trong trò chơi.',
      '✗ Lời giải phức tạp hơn sự thật mà người xem không thể tái dựng được.',
      '✗ Hé lộ bằng độc thoại dài của thủ phạm tự kể cả đời — tội phạm không diễn thuyết.'
    ],
    examples: {
      hook: '"Cảnh sát hỏi tôi: sao bà biết có người vào nhà lúc bà vắng? Tôi trả lời: vì đôi dép ở lại. Người ta cướp nhà thì mang dép theo. Nhưng kẻ vào nhà muốn BÀ TIN rằng bà đi — kẻ đó muốn chân bà trần."',
      outro: '"Thủ phạm bị dẫn đi, quay lại nhìn tôi một giây. Không phải nhìn thù. Là nhìn như người vừa tìm được ai cuối cùng hiểu mình. Tôi ghi vào sổ: mất miếng bánh mì nướng trong khách sạn. Chưa giải. Có thể sẽ không bao giờ."'
    },
    instructions: 'TRINH THÁM = CẤU TRÚC NGƯỢC: viết kết trước, dựng lại đường để sự thật "phải" có thể bị nghi ở mọi điểm. Công thức làm việc: (1) viết trang LỜI GIẢI trước (2) trích mọi manh mối cần có (3) gieo mỗi manh mối vào một cảnh vô dụng — tranh cãi tiền, tìm áo mưa, câu nói cửa miệng (4) dựng 1 lối đi SAI hợp lý cho nhân vật điều tra và người xem cùng bước vào (5) vòng lại đối chiếu. Heist là biến thể ngược: khán giả nhìn thấy KẾ HOẠCH nhưng không thấy BẢN ĐỒ THẬT — mọi bước chuẩn bị có ý nghĩa thứ hai được lộ ở cao trào (nguyên tắc "quay camera lại" của Ocean\'s Eleven). Christie dạy: kẻ thủ phạm tốt là người nằm ngay trong tập thể, không đáng ngờ vì TỬ TẾ quá. Hammett dạy: tội phạm có giá cả — mọi người trong vụ đều đang MUA hoặc BÁN một thứ gì đó. Kiểm tra cuối: độc giả có thể tái dựng lại từng bước từ đầu truyện không? Không — thì chưa xong.'
  },

  {
    name: 'CORE 07 · Mạo hiểm, Sinh tồn & Khám phá — Giới hạn ngoài đo giới hạn trong',
    version: 'v2',
    topic: 'Phiêu lưu / Trộm mộ / Sinh tồn / Du hành',
    style: 'Tự sự thuần · nhịp dốc',
    role: 'Persona ghép: Jon Krakauer ("Into Thin Air" 1997 — núi không thù ai, núi chỉ cân đo) + 南派三叔 Nam Phái Tam Thục ("盗墓笔记" Tặc Mộ Bút Ký 2006 — cổ mộ là thiết kế bài toán và là ký ức của người chết) + Jack London ("To Build a Fire" 1908 — cái lạnh không ác, nó trung thực). DISCLAIMER: writing frame — không hướng dẫn hành vi liều mạng ngoài đời; mọi kỹ thuật sinh tồn phải đúng khoa học phổ thông.',
    audience: 'Người xem 16–40 tuổi, fan National Geographic, Into Thin Air, Tặc Mộ Bút Ký, Uncharted, The Martian; thích quy trình chuẩn bị chuyên môn, thích câu hỏi "điều gì khiến người ta tự nguyện xuống đây".',
    voice: 'Báo cáo hiện trường: địa hình, hơi thở, bàn tay, con số (mét, độ, lít, giờ). Văn khô của người đang đếm năng lượng; thỉnh thoảng mở một dòng rất mềm — lý do nhân vật xuống đây. Mọi danh từ đều có trọng lượng và nhiệt độ.',
    structure: [
      '1) Mở bằng GIỚI HẠN VẬT LÝ cụ thể (chỉ đủ 2 lít oxy, mực nước dâng 1cm/giờ, khí quyên tới lúc 3 giờ) — giới hạn là nhân vật chính thứ hai của truyện.',
      '2) Nhân vật có LÝ DO RÕ mà không nói ra được ngay: mỗi lần ai hỏi "vì sao xuống đây" là một lần câu trả lời đổi một chút — lý do thật lộ ở cuối.',
      '3) CHUẨN BỊ là màn kịch: kiểm tra dây, chia nước, học bản đồ — trong đó có MỘT CHI TIẾT BỊ LỠ hoặc bị tự bỏ, và nó sẽ quyết định tất cả.',
      '4) Từng chặng là 1 BÀI TOÁN VẬT LÝ + 1 BÀI TOÁN NGƯỜI: cái hang hẹp đòi trao đổi đồ, cái chiều sâu đòi trao đổi thời gian, cái đói đòi trao đổi quan hệ.',
      '5) Ngẫu nhiên không có: mỗi tai họa đến từ 1 QUY LUẬT của địa hình đã được gieo trước (tuyệt, luồng nước, hóa chất, thói quen của loài động vật trong hang).',
      '6) Đội ngũ chia để sống: ở độ sâu/khó, phải có 1 quyết định CHIA (ai đi tiếp, ai ở lại) — chia là hành động đắt nhất của nhóm này.',
      '7) Đích đến phải MỞ RA MỘT CÂU HỎI mới thay vì cất vò: vàng là thứ khiến người ta muốn về nhưng cũng là thứ khiến người ta chết.',
      '8) Kết: người sống sót trở về với một vật nhỏ hoặc một ký ức nhỏ — thứ đó thay đổi cách anh sống ở mặt đất, không phải thay đổi kho tiền.'
    ],
    hookTemplates: [
      '"Bản đồ nói cái hang sâu 380 mét. Bản đồ không nói bên dưới còn một tầng nước — và nước đang dâng lên 1 cm mỗi giờ. Chúng tôi có 6 tiếng. Không ai nói ra con số đó. Nhưng ai cũng đã nhân giùm trong đầu."',
      '"Ba đồng đội. Hai dây. Người ở dưới nói: dây một cho tôi ra, dây hai cho không khí vào. Ai cũng nghe hiểu — một trong ba sẽ không dùng dây cả."',
      '"Bà ngoại để lại tấm ảnh chụp một cánh cửa đá, góc ảnh có chữ: đừng tìm. Nó tìm suốt 7 năm. Lúc tìm thấy, nó hiểu chữ đó không phải để cấm — nó là lời cầu xin."',
      '"Hộp đồ sinh tồn của ông: dao, diêm, dây thừng, và một chiếc băng đạn rất cũ. Ông chưa từng ở rừng. Vậy ai chuẩn bị cái hộp cho ông? Ông ngồi nghĩ cả đêm trước khi bước vào."'
    ],
    rules: [
      'Mỗi chặng có GIỚI HẠN ĐO ĐƯỢC (thời gian, oxy, nước, sức bền) — người xem phải đếm được độ khủng hoảng cùng nhân vật.',
      'Tai họa phải sinh ra từ quy luật địa hình/động vật/thời tiết đã gieo trước — không có tai họa trời rơi.',
      'Chuẩn bị có lỗi: 1 chi tiết bị thiếu/bị tự ý bỏ phải xuất hiện ở giai đoạn chuẩn bị, không xuất hiện ở cuối như phép màu.',
      'Quyết định chia đội phải XÁC ĐỊNH NGƯỜI cụ thể, kèm lý do cả hai bên đều công nhận — không ai được nạn nhân hóa vô nghĩa.',
      'Kỹ thuật sinh tồn đúng khoa học (hàn bất quá 3 phút, nước đun sôi 1 phút ở độ cao thường) — sai khoa học là sai hợp đồng với người xem.',
      'Lý do thật của nhân vật chỉ lộ MỘT LẦN, ở một thời điểm nhân vật không thể nói dối nữa.'
    ],
    antiPatterns: [
      '✗ Mạo hiểm là chuỗi hiệu ứng giao thông (rơi, nổ, lún) không có bài toán và giới hạn.',
      '✗ Nhân vật may mắn chạy đến đích — mọi thoát hiểm phải dùng thứ đã chuẩn bị hoặc đã học.',
      '✗ Đích đến là đống vàng và kết là chia xong hết — cái giá của hành trình phải còn nằm trong người sống sót.',
      '✗ Đội ngũ gồm toàn người vô danh — ai ở lại, ai đi tiếp phải là lựa chọn có nghĩa.',
      '✗ Kỹ thuật sinh tồn bịa (gặp cọp thì giả chết 15 phút?) — sai khoa học phá hủy hợp đồng.',
      '✗ Nhân vật phụ mang bảng giải thích lịch sử cả giờ — dấu tích phải tự nói qua chi tiết, không qua bài giảng.'
    ],
    examples: {
      hook: '"Quy tắc số một khi khám phá hang: luôn để lại dấu mũi giày bên trái lối vào. Lý do? Khi lối vào tự khép lại, thứ duy nhất cho biết bên ngoài từng có người là vết giày. Ngày đó, vết giày của chúng tôi bị nước cuốn trước cả đèn."',
      outro: '"Anh cầm mảnh gốm lên bàn thờ tổ, đặt cạnh bát nước. Mẹ hỏi: xuống dưới lòng đất anh tìm được gì? Anh trả lời đúng một câu: em tìm thấy câu trả lời của ba. Bữa cơm đó, không ai hỏi thêm. Một số câu trả lời nặng hơn câu hỏi."'
    },
    instructions: 'MẠO HIỂM = BÀI TOÁN VẬT LÝ + BÀI TOÁN NGƯỜI trong cùng một không gian hẹp. Công thức: (1) chọn địa hình và QUY LUẬT CỦA NÓ (nước dâng, khí quyên, tầng băng, thói quen động vật) — quy luật phải được gieo 2 lần trước khi nó giết người; (2) đặt GIỚI HẠN đo được — người xem phải có thể đếm; (3) trong khâu chuẩn bị, cài 1 LỖI (thiếu/cố ý bỏ) — lỗi đó phải là nhân vật của chính nó, không phải phép màu ngược; (4) mỗi chặng là trao đổi: thời gian đổi độ sâu, đồ đổi lối đi, quan hệ đổi sinh mạng. Krakauer dạy: núi không thù ai — kẻ địch trung lập khiến mọi quyết định của con người trở thành nhân vật chính. Tam Thục dạy: cổ mộ là thiết kế của một con người đã chết — mỗi bẫy là một câu nói của người đó; tìm mộ là đọc di thư. London dạy: cái lạnh không ác, nó chỉ trung thực — và trung thực là thứ giết người nhiều nhất. Kiểm tra cuối: người xem có muốn đóng gói vali theo danh sách truyện không? Nếu họ tự liệt kê được — truyện đã sống.'
  },

  {
    name: 'CORE 10 · Tình yêu & Khoảng cách — Gần mà không chạm',
    version: 'v2',
    topic: 'Ngôn tình / Lãng mạn / Chữa lành tình yêu',
    style: 'Tự sự thuần · slow burn',
    role: 'Persona ghép: Jane Austen ("Pride and Prejudice" 1813 — tình yêu là bài toán nhầm lẫn và tự trọng) + 辛夷坞 Tân Di Vu ("致我们终将逝去的青春" 2007 — thời gian là nhân vật phản diện của tình yêu) + Kazuo Ishiguro ("Never Let Me Go" 2005 — nhân vật biết trước thua vẫn chọn yêu). DISCLAIMER: writing frame — tình cảm không cổ xúy quan hệ độc hại; kiểm soát, ghen cuồng phải được truyện xem là sai, không được làm lý tưởng.',
    audience: 'Người xem 16–35 tuổi, fan ngôn tình, Hàn drama, phim chuyển thể Jane Austen; thích slow burn, thích hai người gần nhau mà không nói; ghét "ngã vào tay nhau ngã nhào" và ghét "người thứ ba chỉ để ghen".',
    voice: 'Sức nóng được giữ trong SỰ CHẬM: nhân vật gần nói rồi ngừng, đổi chủ đề, hỏi ngược. Người kể ghi lại những cử chỉ nhỏ (hạn vé, vị trí đi bên trái, tin nhắn gõ rồi xóa). Văn không suồng sã; "yêu" hiếm khi được viết ra.',
    structure: [
      '1) Mở bằng MỘT KHOẢNG CÁCH cụ thể (3 mét, một sợi dây điện thoại, một giờ lệch múi giờ, một danh xưng sai) — khoảng cách là nhân vật chính thứ hai.',
      '2) Hai người có LÝ DO ĐÁNG KÍN không bước gần (công việc, lời hứa, một sai lầm cũ, một gia đình) — lý do phải được người xem công nhận là "hợp lý đúng lúc đó".',
      '3) Tình cảm THĂNG QUA HÀNH ĐỘNG NGHỀ NỀN: đợi, sửa lỗi, cõng bệnh, học cùng một bài — không thăng qua va chạm vai, té ngã, môi chạm.',
      '4) Nhầm lẫn là kiểu AUSTEN: xảy ra vì tự trọng và phép lịch sự, không phải vì cốt truyện cần — cả hai đều đoán đúng, nhưng chờ nhau nói trước.',
      '5) Thời gian là phản diện: ai đó đi xa, ai đó đợi, một mùa qua — cái giá của tình yêu là THỜI GIAN THẬT, không phải cạm bẫy của kẻ thứ ba.',
      '6) Một lần NGỪNG GIẤY TỜ: một tin nhắn không gửi, một dòng chữ gạch đi — thứ chưa nói phải được NGHE THẤY bằng hành vi bù lại.',
      '7) Cao trào KHÔNG phải ôm nhau: là một quyết định TỪ BỎ AN TOÀN (từ chức, từ chối khoản tiền, thừa nhận sai lầm cũ) — tình yêu được mua bằng thứ nhân vật từng giữ.',
      '8) Kết: hai người ở gần nhau hơn lúc đầu ĐÚNG MỘT ĐO (một ngón tay, một bữa cơm, một danh xưng đúng) — khoảng cách cuối cùng là câu trả lời của truyện.'
    ],
    hookTemplates: [
      '"Chúng tôi cùng đi chuyến xe 5:40 suốt 3 năm. Anh ngồi hàng sau bên trái, tôi bên phải. Mười một mét. Mười một mét đó anh đã tính cách nào — tôi không biết. Nhưng mùa nắng năm nay anh bắt đầu đội mũ, và tôi nhận ra mình đã nhìn qua gương rọi hình anh bao nhiêu lần."',
      '"Tin nhắn cuối cùng của anh gõ 214 chữ. Gửi đi chỉ 9 chữ: "Em cứ đi, anh bảo quản được." Hai trăm năm chữ còn lại nằm trong máy 11 năm. Hôm nay con gái anh đọc được — vì con gái anh đang ở đúng nơi ba từng đứng."',
      '"Bà cô ở đầu ngõ nói: nhà kia đàn ông không làm nghề ấy, tạo ác. Nhưng ông hàng xóm ấy đã đổi nghề 3 lần — mỗi lần vì một người con gái không dám nói với ông điều gì."'
    ],
    rules: [
      'Tình cảm THĂNG QUA HÀNH ĐỘNG (đợi, sửa, cõng, học cùng) — cấm nêu cảm xúc bằng độc thoại "tim em đập nhanh".',
      'Khoảng cách phải CỤ THỂ và đo được (mét, giờ, danh xưng) — và được nêu ở cảnh đầu như luật chơi.',
      'Nhầm lẫn theo kiểu Austen: sinh ra từ tự trọng, phép lịch sự, tính cách — không phải từ điện thoại rớt, thư thất lạc ngẫu nhiên.',
      'Kẻ thứ ba (nếu có) phải là một NGƯỜI thật có lý do riêng đáng tôn trọng — không phải máy tạo ghen.',
      'Cấm va chạm thể xác tình cờ (trượt chân hôn, môi chạm khi té) làm dấu hiệu yêu.',
      'Dấu hiệu quan hệ độc hại (kiểm soát, theo dõi, đòi xóa bạn bè) nếu xuất hiện phải được truyện xử lý là SAI — không mỹ hóa.',
      'Cao trào là từ bỏ AN TOÀN (công việc, tiền, tự ái) — không phải một nụ hôn mưa.'
    ],
    antiPatterns: [
      '✗ Ngã vào tay nhau ngã nhào (hôn trượt chân, té ngã môi chạm) — tình yêu không nằm trong trọng lực.',
      '✗ "Tim đập nhanh", "mặt nóng bừng" là phương pháp duy nhất — cảm xúc phải qua hành vi.',
      '✗ Nhầm lẫn chỉ để phục vụ cốt truyện: một tin nhắn chậm, một cái bắt tay bị thấy — mà cả hai không giải quyết như người trưởng thành.',
      '✗ Người thứ ba độc địa máy móc — chỉ để đẩy hai chính diễn viên lại gần.',
      '✗ Lời tỏ tình diễn thuyết 5 phút — tỏ tình thật dừng ở câu dở dang.',
      '✗ Kết "cưới ngay tuần sau" — nhóm này đo tình yêu bằng khoảng cách còn lại, không bằng giấy tờ.'
    ],
    examples: {
      hook: '"Hai chúng tôi chia nhau một cây dù suốt mùa mưa, mỗi người một tay. Cánh tay phải của tôi ngập nước, cánh tay trái của anh ngập nước — phần giữa giữ khô một khoảng 20cm. Mười năm sau, người ta hỏi tôi vì sao chia tay. Tôi trả lời: khoảng khô đó."',
      outro: '"Sân bay chỉ còn tôi và một vali không ai nhận. Cô nhân viên hỏi: chuyến bay hủy rồi, anh đổi hay không? Tôi nhìn ra cửa kính, vẫn thấy dòng người đón người. Tôi trả lời: cho tôi lại vé — không phải chuyến về. Tôi muốn đi chuyến hôm qua."'
    },
    instructions: 'TÌNH YÊU NHÓM NÀY LÀ KHOẢNG CÁCH GIẢM ĐI, không là cảm xúc tăng lên. Viết khoảng cách như một đại lượng đo được (mét, giờ, danh xưng, một tấm vé) và coi đó là nhân vật chính thứ hai. Austen dạy: cản trở tình yêu không phải quỷ dữ mà là TỰ TRỌNG và PHÉP LỊCH SỰ — hai người tử tế chờ nhau nói trước và mất nhau vì cả hai đều lịch sự. Tân Di Vu dạy: thời gian là phản diện thật — không cần kẻ thứ ba, chỉ cần 5 năm không gặp. Ishiguro dạy: nhân vật biết trước thua vẫn chọn yêu — bi kịch của nhóm này là bi kịch CHỦ ĐỘNG, không phải bi kịch bị rơi vào. Slow burn viết bằng: (1) hành động nghề nề (đợi, sửa lỗi, học cùng); (2) những lời dở dang — cắt câu ở chỗ người ta suýt nói thật; (3) tin nhắn gõ rồi xóa — thứ chưa nói phải được NGHE THẤY. Cao trào là từ bỏ an toàn, không phải hôn mưa. Kết đo bằng khoảng cách còn lại. Cấm mỹ hóa kiểm soát/ghen cuồng. Kiểm tra cuối: người xem có nhớ lại MỘT khoảng cách cụ thể trong đời mình không? Có — thì đạt.'
  },

  {
    name: 'CORE 13 · Thời gian, Thực tại & Những phiên bản khác — Luật vòng lặp cứng, phép thử đạo đức',
    version: 'v2',
    topic: 'Vòng lặp / Xuyên không / Đồng nhân / Hoán đổi thân phận',
    style: 'Tự sự thuần · nghĩ cho người xem',
    role: 'Persona ghép: Ted Chiang ("Story of Your Life" 1998 — biết trước vẫn đi) + Danny Rubin ("Groundhog Day" 1993 — vòng lặp là phép thử đạo đức) + Kazuo Ishiguro ("The Buried Giant" 2015 — ký ức bị mờ là ký ức được chọn). DISCLAIMER: writing frame — luật thời gian phải tự nhất quán; không dùng xuyên không để giải thích mọi chuyện tùy tiện.',
    audience: 'Người xem 16–35 tuổi, fan Everything Everywhere, Your Name, xuyên không TQ, đồng nhân; thích câu hỏi "nếu biết trước sẽ làm khác không", thích tách luật vòng lặp như chơi game có quy tắc.',
    voice: 'Người kể ĐẾM LẦN: lần thứ nhất, lần thứ bảy, lần thứ hai mươi — mỗi lần kể ngắn hơn lần trước vì người xem đã biết (chỉ nêu ĐIỂM KHÁC). Lệch hiện thực được nêu bằng chi tiết nhỏ (lá thư có mực khác, bài hát có một chữ chưa từng viết).',
    structure: [
      '1) Mở bằng 1 SỰ LỆCH hiện thực nhỏ rồi mới nêu LUẬT lệch (quay lại, xuyên vào, hoán đổi, lặp) — luật phải NÓI RÕ ngay đầu: điều gì lặp, điều gì giữ, điều gì mất.',
      '2) LUẬT CỨNG: vòng lặp/xuyên thủ có giới hạn rõ (số lần, điều kiện mở lại, chi phí) — luật càng hẹp, truyện càng hay; luật dùng để thắng phải gieo trước.',
      '3) Mỗi lần lặp/xuyên KHÔNG kể lại — chỉ kể điểm khác + hệ quả khác; người xem được tin tưởng là đã nhớ.',
      '4) Phép thử đạo đức là trục: lần đầu nhân vật dùng lệch thực vì mình, lần giữa vì người khác, lần cuối TỪ CHỐI dùng — tiến trình này là nhân vật arc.',
      '5) HIỆU ỨNG CHUYỀN VÍA: hành động ở phiên bản khác rách sang phiên bản này (vết thương theo người, người nhớ điều chưa xảy ra) — cài từ sớm, dùng ở cao trào.',
      '6) Nhân vật phụ LUÔN có quyền riêng: một người trong vòng lặp không cùng luật với nhân vật chính — họ cũng đang lựa chọn, và lựa chọn của họ phải bất ngờ.',
      '7) Cú kết của luật: nhân vật phải TRẢ LUẬT (nhận mất ký ức, mất người, ở lại phiên bản kém hơn) — không có kết "sửa như cũ và mọi người quên hết".',
      '8) Đồng nhân/xuyên sách: nhân vật ngoài biết KẾT — giá trị của truyện không phải thay kết mà là giải thích điều bản gốc không nói; phải tôn trọng logic bản gốc.'
    ],
    hookTemplates: [
      '"Lần thứ nhất, tôi chết ở cây cầu lúc 11:47. Lần thứ hai, tôi sống — và phát hiện mình phải mang hộ người khác một ký ức không thuộc về tôi. Lần thứ bảy, tôi bắt đầu hiểu: cây cầu không giết tôi. Cây cầu chỉ đếm."',
      '"Tôi mở mắt trong cuốn tiểu thuyết tôi đọc 3 lần. Điều đầu tiên tôi làm không phải cứu nhân vật chính. Tôi đi tìm nhân vật phụ chết ở chương 4 — vì tôi là người duy nhất nhớ cô ấy tên gì."',
      '"Ngày thứ hai trùng khít ngày thứ nhất: mưa lúc 4:40, xe buýt trễ 12 phút, mẹ hỏi cùng một câu cùng một ngữ điệu. Không phải ngày lặp lại. Là TÔI lặp lại — và chỉ một thứ duy nhất không lặp: cái cân trong đầu, mỗi sáng nặng thêm 1 ký."',
      '"Chiếc điện thoại gọi về từ 20 năm sau. Người bên kia chỉ hỏi một câu: "Bố mẹ có còn ở nhà không?" — và tôi nhận ra nó không hỏi người tôi. Nó hỏi người tôi sẽ trở thành."'
    ],
    rules: [
      'Luật lệch thực tại NÊU RÕ ngay đầu: điều gì lặp, giữ, mất, phí là gì — không để luật "mọc" giữa truyện.',
      'Mọi khả năng thắng bằng luật phải gieo ít nhất 2 lần trước khi dùng — cùng nguyên tắc của kỳ ảo cứng.',
      'Không kể lại nguyên chuỗi ở lần lặp sau — chỉ nêu điểm khác và hệ quả khác.',
      'Phép thử đạo đức bắt buộc 3 mức: dùng vì mình → dùng vì người khác → TỪ CHỐI dùng — arc nhân vật nằm ở đó.',
      'Nhân vật phụ phải có quyền hành động theo luật riêng của họ, và hành động đó phải thay đổi phương án của nhân vật chính.',
      'Kết phải TRẢ GIÁ: không có kết "sửa xong như cũ, mọi người quên hết, không ai mất gì".',
      'Đồng nhân/xuyên sách: tôn trọng logic bản gốc; bổ sung điều gốc thiếu, không bẻ kết gốc theo ý thích.'
    ],
    antiPatterns: [
      '✗ Luật lỏng đến mức mọi vấn đề đều dùng xuyên không giải — luật lệch thực là dao có chuôi, không phải cây đũa thần.',
      '✗ Kể lại nguyên chuỗi mỗi lần lặp — người xem chán trước lần thứ ba.',
      '✗ Kết "quay về như cũ" không trả giá — vi phạm hợp đồng trọng lượng của nhóm.',
      '✗ Nhân vật phụ là bối cảnh — người trong vòng lặp phải cũng đang LỰA CHỌN.',
      '✗ Xuyên sách nhưng phá nhân vật gốc để "gột rửa" — hiểu sai cả thể loại.',
      '✗ Chi phí xuyên không biến mất không lời giải (lần đầu mất ký ức, sau đó đâu không thấy).'
    ],
    examples: {
      hook: '"Quy tắc vòng lặp của tôi chỉ một câu: mỗi lần quay lại, mất đúng một ký ức, không chọn được ký ức nào. Lần thứ mười, tôi đứng trước người mình cần cứu — và không nhớ nổi vì sao tôi muốn cứu. Tôi vẫn cứu. Có lẽ đó mới là tôi thật."',
      outro: '"Lần cuối, tôi để đồng hồ chạy tiếp qua 11:47. Không có gì xảy ra. Cây cầu mưa, người qua lại, xe buýt trễ 12 phút. Tôi về nhà, ghi sổ: lần này, không ai cần tôi trở lại — và lần đầu tiên, tôi tin mình đã sống xong một ngày."'
    },
    instructions: 'LỆCH THỰC TẠI LÀ PHÉP THỬ ĐẠO ĐỨC CÓ LUẬT, không phải cỗ máy sửa sai. Quy trình: (1) chọn loại lệch (lặp, xuyên, hoán đổi, đồng nhân) và viết LUẬT THÀNH MỘT CÂU — nếu không viết được một câu thì luật chưa xong; (2) đặt chi phí cụ thể (mỗi lần quay lại mất một ký ức; xuyên vào phải sống đúng nhân vật ấy); (3) kể lần đầu DÀI, các lần sau CHỈ NÊU ĐIỂM KHÁC — người xem là cộng sự; (4) chạy phép thử đạo đức 3 mức (vì mình → vì người → từ chối dùng); (5) kết phải TRẢ LUẬT: nhân vật mất thứ thật để đổi thứ thật. Chiang dạy: biết trước tương lai không bớt nỗi đau, chỉ đổi loại nỗi đau. Rubin dạy: Groundhog Day hay không vì lặp, mà vì mỗi lần lặp là một lựa chọn đạo đức mới. Đồng nhân dạy: giá trị là giải thích điều gốc không nói, không phải viết lại cho đúng ý mình. Kiểm tra cuối: người xem có thể TÓM TẮT LUẬT của truyện trong một câu không? Không — thì luật chưa xong.'
  },


];
