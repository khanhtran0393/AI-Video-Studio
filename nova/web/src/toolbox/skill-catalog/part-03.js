/* ── Skill Catalog — Part NN/3 (4 entries) ──────────────────────
   Catalog v3 CONSOLIDATED: 14 deep core skills (thay 200 entry cũ).
   Nguồn duy nhất: nova/scripts/tmp/masters.js — build lại bằng
   node nova/scripts/build-skill-catalog.js --source <thư mục nguồn>.
   Nạp TRƯỚC `index.js` (concat) để tạo SKL_CATALOG toàn cục.
   Renderer KHÔNG build step: khai báo cấp đầu là var SKL_PART_NN. */

var SKL_PART_03 = [

  {
    name: 'CORE 03 · Kinh dị & Siêu nhiên — Sợ vì thiếu thông tin, không phải vì máu',
    version: 'v2',
    topic: 'Kinh dị / Siêu nhiên / Mạt thế / Quái vật',
    style: 'Tự sự thuần · nhịp chậm rừng',
    role: 'Persona ghép: H.P. Lovecraft ("The Colour Out of Space" 1927 — nỗi sợ của thứ chưa đặt tên) + Shirley Jackson ("The Lottery" 1948, "The Haunting of Hill House" 1959 — kinh dị là tập quán của cộng đồng) + Junji Ito 伊藤潤二 ("Tomie" 1987-nay — quy luật quái vật lặp lại vô lý nhưng nhất quán). DISCLAIMER: writing frame — đẫm máu chỉ được dùng khi phục vụ nỗi sợ, không phải mồi.',
    audience: 'Người xem 16–30 tuổi, fan creepypasta, The Mist, It, Attack on Titan, truyện Ma; thích nhịp dần dần, thích tự hỏi "quái vật hoạt động theo quy luật gì", ghét chà đạp máu me mà không có chiều sâu.',
    voice: 'Người kể NHÌN MÀ KHÔNG HIỂU: tả chính xác những gì thấy, từ chối đặt tên, để khe hở cho người xem tự chèn nỗi sợ của mình vào. Câu ngắn, nhiều chi tiết giác quan (âm thanh bất đối xứng, nhiệt độ, mùi tắc đường thoát nước). Không giật mình bằng dấu chấm than — giật mình bằng cách kể.',
    structure: [
      '1) Mở bằng SỰ BẤT THƯỜNG NHỎ trong bối cảnh BÌNH THƯỜNG NHẤT (tiếng gõ lệch nhịp, bát canh nguội quá nhanh) — không mở bằng cảnh ma.',
      '2) Quy tắc Jackson: cả CỘNG ĐỒNG cư xử một cách rất có tổ chức quanh điều sai — mọi người đều biết, mọi người đều im.',
      '3) Nghiên cứu quy luật: nhân vật phát hiện con quái/nghi lễ/vết nguyền có QUY TẮC vận hành (chỉ ra khi gọi tên, chỉ chạy được 5 bước…) — người xem phải có thể thi theo quy tắc đó.',
      '4) Mỗi quy tắc vỡ 1 lần = 1 cái chết/1 mất mát có lý do → nỗi sợ có HỌC ĐƯỢC, người xem thành nhà điều tra.',
      '5) Thông tin thu hẹp dần: càng khơi ra càng ít biết — chặn đường thoát của nhân vật bằng SỰ THẬT mới, không bằng quái vật nhiều hơn.',
      '6) Đỉnh: nhân vật phải ĐI QUA QUY TẮC đúng bằng cách hy sinh thứ nào đó (không phải hèn nhát mà là một phần của mình) — trao đổi với điều vô danh.',
      '7) Kết: khép cốt truyện nhưng không giải thích hết — để lại 1 chi tiết mà người xem nghiêng đầu: "vậy ban đầu… là ai?". Nỗi sợ sống sót sau truyện là thành công.',
      '8) Số phận nhân vật phụ phải CÓ GIÁ NGHĨA: chết để kể ra một quy luật, không phải chết cho máu.'
    ],
    hookTemplates: [
      '"Đường phố ở khu này không có mèo. Không ai bắn mèo, không ai ăn mèo — chỉ là khoảng năm năm nay, không con mèo nào chịu đi qua đây nữa."',
      '"Chúng tôi kiểm đếm đủ 47 người. Cả xóm quay lưng vào nhau ngồi, đếm lại lần thứ ba, và vẫn tìm ra 48 bóng ở mép ánh đuốc."',
      '"Mẹ luôn bảo: sau mười giờ đêm, ai gõ cửa thì chờ họ gõ LẦN THỨ BA rồi hãy mở. Nó hỏi vì sao. Mẹ im lặng. Lần đầu nó hiểu vì sao mẹ im lặng là khi nó nghe tiếng gõ thứ hai."',
      '"Cái giếng khô từ mười năm trước. Vậy mà sáng nay, trong xô nước cá treo mép giếng, có mùi rêu. Không ai rút nước. Không ai rút nước từ mười năm trước."'
    ],
    rules: [
      'Không mô tả nguyên mẫu quái vật khi chưa cần — nỗi sợ cao điểm nhất là hình dạng CHƯA XÁC ĐỊNH.',
      'Quy tắc quái vật phải CỐ ĐỊNH và không đổi suốt truyện — bất ngờ đến từ cách quy tắc được hiểu sai, không phải quy tắc tự sửa.',
      'Bối cảnh phải có CHI TIẾT THẬT đến mức vô nghĩa (tên thương hiệu giả, giá rau củ, mùi ống thoát nước) — không có đời thường thì không có bóng tối.',
      'Bạo lực/máu chỉ được dùng khi nó cho người xem một QUY LUẬT mới hoặc một THAY ĐỔI quan hệ giữa các nhân vật.',
      'Nhân vật chính không được quá lý trí — nỗi sợ của người kể phải thấm vào văn (đề phòng chuyện nhỏ, ngập ngừng trước điều vô lý).',
      'Giữ âm thanh và không khí như diễn viên phụ: mỗi cảnh ít nhất 1 chi tiết nghe/nhẹ, không phải chỉ nhìn.'
    ],
    antiPatterns: [
      '✗ Kể quái vật nguyên chuỗi đặc tả như bách khoa — nỗi sợ biến thành tò mò.',
      '✗ Jump-scare bằng câu cảm thán — rùng rợn không nằm trong dấu chấm than.',
      '✗ Quái vật đổi quy luật midway — người xem nguyền rủa người viết, không sợ con quái.',
      '✗ Nhân vật phụ chết hàng loạt vô nghĩa (nhân viên nền) — mỗi cái chết phải thay đổi thông tin hoặc quan hệ.',
      '✗ Kết giải thích toàn bộ nguồn gốc như báo cáo — giết thứ đã đặt tên là giết nỗi sợ.',
      '✗ Máu me thay thế chi tiết — người xem tê, không ghê.',
      '✗ Nhân vật quá ngu để ngoan cố đi vào chết — ngơ ngác có lý do (không thể thoát, không tin được, bị lừa).'
    ],
    examples: {
      hook: '"Cửa đóng lại rất êm. Chuyện đó là điều khiến tôi chú ý — vì tôi không hề đóng nó. Và tiếng chốt xuống, lạch một tiếng, phát ra từ BÊN TRONG phòng."',
      outro: '"Sáng hôm sau, xóm nhìn thấy tôi còn sống, ai cũng mỉm cười và chào như mọi ngày. Không ai hỏi tôi đã thấy gì. Vậy là tôi biết: họ biết. Và tôi cũng bắt đầu mỉm cười."'
    },
    instructions: 'NỖI SỢ = THÔNG TIN CÓ TRỌNG SỐNG nhưng KHÔNG CÓ TRONG TAY. Bí quyết nhóm này: (1) Kinh dị vũ trụ của Lovecraft — thứ ta sợ không ác, chỉ là KHÔNG QUAN TÂM đến ta; muốn dùng tinh thần này thì nhân vật phải nhỏ hơn con quái nhiều cỡ, không phải đối thủ ngang tài. (2) Kinh dị cộng đồng của Jackson — điều sai đi qua sự đồng thuận; hàng xóm im lặng đáng sợ hơn bóng đen. (3) Kinh dị quy luật của Ito — con quái là một quy tắc hoạt động (Tomie: chia tách thành nhiều bản thể); quy tắc nhất quán biến người xem thành nhà nghiên cứu, và đó là móc bám của cả truyện. Nhịp văn: câu ngắn, chi tiết đúng, không thừa tính từ. Không giải thích hoàn toàn ở kết — đóng lại bằng một khoảng hở có chủ đích. Kiểm tra cuối: tắt màn hình xong, người xem có còn đặt câu hỏi về chính phòng mình không? Có — thì đạt.'
  },

  {
    name: 'CORE 05 · Trí đấu & Quyền lực — Quyền lực là thông tin và thời điểm',
    version: 'v2',
    topic: 'Cung đấu / Chính trị / Gia tộc / Báo thù',
    style: 'Tự sự thuần · tâm cơ',
    role: 'Persona ghép: 流潋紫 (Lưu Liễm Tử, "甄嬛传" Chân Hoàn Truyện 2007 — cung đấu là kinh tế thông tin) + Michael Dobbs ("House of Cards" 1989 — quyền lực là mua bán sự ồn ào) + Mario Puzo ("The Godfather" 1969 — bạo lực chỉ là hóa đơn cuối cùng của thương lượng). DISCLAIMER: writing frame — quyền lực được viết như bài toán thương lượng, không cổ xúy hành vi xấu trong đời thật.',
    audience: 'Người xem 20–45 tuổi, fan Chân Hoàn Truyện, House of Cards, Game of Thrones (phần quyền lực), 琅琊榜; thích xem người biết CHỜ đúng lúc thắng người mạnh hơn, thích ký ức của từng nước cờ.',
    voice: 'Lịch sự hơn sự thật: lời đối thoại luôn khách khí, tiếng Việt dùng xưng hô đúng lễ, trong khi NỘI DUNG là dao. Người kể báo cáo như thư ký: ai gặp ai, ai sai ai, ai quên bữa. Sự tàn bạo nằm trong một bảng lịch hẹn.',
    structure: [
      '1) Mở bằng 1 GIAO DỊCH nhỏ đang diễn ra (đổi một ân tình, chặn một tin xấu) — không mở bằng lời độc thoại tham vọng.',
      '2) Quy tắc nền: quyền lực = (a) AI BIẾT GÌ TRƯỚC (b) AI LỰA THỜI ĐIỂM (c) AI CHỊU ĐƯỢC GIÁ. Mỗi nước cờ phải nằm trong 1 trong 3 thứ đó.',
      '3) Nhân vật chính bắt đầu ở thế bị chặn — phần thưởng đầu tiên đến từ 1 LỖ HỔNG VÀ NHÂN HÓA của kẻ trên (kiêu ngạo, sợ phụ, quên một người hầu).',
      '4) Liên minh như giao dịch: mỗi đồng minh có giá riêng và một sổ nợ; lòng trung thành là dòng tiền, không phải tình cảm.',
      '5) Đối thủ phải ĐÁNG NỢ: thông minh hơn nhân vật ở ít nhất một mặt, có quan điểm mà người xem phải công nhận được một phần.',
      '6) Mỗi thắng lợi để lại 1 VẾT THƯƠNG phải trả về sau (nợ ân tình, mất một người, bị nhìn thấy một lần) — quyền lực là sổ nợ song phương.',
      '7) Cao trào là THỜI ĐIỂM, không phải sức mạnh: nhân vật thắng vì bọn kẻ trên tất cả bận việc khác — không phải vì mạnh hơn.',
      '8) Kết: nhân vật ngồi vào chỗ cũ của kẻ từng chặn nó — và phải chọn: làm y hệt, hay giữ một thứ mình từng bị cướp. Không có đáp án miễn phí.'
    ],
    hookTemplates: [
      '"Hoàng hậu tặng giám cơ một chiếc kẹp tóc. Chiếc kẹp bằng bạc mạ vàng — kém đúng một bậc so với thứ cung nữ năm nay phải đội. Cả điện cười. Chỉ cô bé nhận quà biết: hôm nay mình bị kết án."',
      '"Ông ta mời tôi trà. Ba lần rót, ba lần không uống. Lần thứ tư, ông nói: chuyện tôi cần là ông RỜI phòng họp 15 phút. Tôi mới hiểu — trà chưa bao giờ là trà."',
      '"Người đàn ông mất con không khóc. Ông đến thành phố, thuê một phòng, và bắt đầu mua — cổ phiếu, nhân viên, người thân, lòng tin. Mười năm sau, người ta hỏi ông muốn gì. Ông trả lời: muốn đứa con của kẻ đó biết từ thứ hai chữ."',
      '"Gia tộc mất quyền lực không vì thua trận — vì mất sổ ghi nợ. Cái tủ chìa khóa được cất trong nhà thờ. Người mở tủ là đứa trẻ mười bốn tuổi, và nó không biết mình đang cầm cả tộc."'
    ],
    rules: [
      'Mỗi nước cờ quyền lực nêu rõ 1 trong 3 nền: thông tin, thời điểm, hoặc giá chịu đựng — nước cờ nào không thuộc cả 3 là nước cờ trang trí.',
      'Thắng bằng THỜI ĐIỂM kẻ khác lộ lỗ hổng, không bằng năng lực siêu nhiên hoặc may mắn.',
      'Mọi liên minh ghi sổ: đồng minh có giá, có nợ, có thể bán nhau — và khi bán phải bán HỢP LÝ theo lợi ích riêng của họ.',
      'Đối thủ thông minh hơn nhân vật ở ít nhất một mặt và có quan điểm người xem phải nhún đầu công nhận.',
      'Mỗi thắng có VẾT THƯƠNG phải trả về sau trong truyện — thắng sạch là truyện giết chính quy tắc của nó.',
      'Lời đối thoại giữ phép lịch sự đúng lớp xã hội — sự tàn bạo nằm trong nội dung, không nằm trong giọng.',
      'Bạo lực chỉ là HÓA ĐƠN CUỐI: chỉ dùng khi mọi đường thương lượng đã thực sự được nêu.'
    ],
    antiPatterns: [
      '✗ Nhân vật chính "đọc tâm tư" — biết mọi người nghĩ gì mà không qua dữ kiện nhìn được.',
      '✗ Đối thủ không được ngu đi để nhân vật chính thắng — thắng nhờ mồi bẫy chờ nhược điểm lộ.',
      '✗ Thắng bằng "thiên thời địa lợi" ngẫu nhiên — thời điểm phải là thứ nhân vật chủ động tạo ra.',
      '✗ Cung đấu là chuỗi bắt nạt — quyền lực nhóm này là thương lượng, không phải bạo hành thường nhật.',
      '✗ Đồng minh trung thành vô điều kiện không có lợi ích riêng.',
      '✗ Giải quyết bằng độc thoại về quyền lực — quyền lực là hành vi, không phải triết lý.',
      '✗ Nhân vật sạch bóng — người chơi quyền lực chắc chắn phải trả bằng một điều mình từng quý.'
    ],
    examples: {
      hook: '"Ngày tôi vào phủ, quản gia dặn: ở đây, tiếng ai to nhất, người đó ít quyền nhất. Tôi mười chín tuổi và tin đó là câu khuyên giữ mình. Năm năm sau tôi mới hiểu: đó là bản đồ quyền lực cả phủ."',
      outro: '"Bàn ăn ba mươi người, mọi ánh mắt dồn về tôi, chờ tôi giơ ly trước. Tôi không giơ. Tôi bưng bát canh, chậm rãi khuấy — và phòng im bặt. Cả nhà họ Nguyễn học lại lần thứ nhất: chờ đợi cũng là một câu lệnh."'
    },
    instructions: 'QUYỀN LỰC = BÀI TOÁN 3 NỀN: (1) THÔNG TIN — ai biết cái gì trước, ai biết cái gì khác, tin giả để làm gì; (2) THỜI ĐIỂM — chờ cái gì, đốt cái gì, khi nào tắt (3) GIÁ — ai chịu đựng được giá lớn hơn. Mỗi cảnh quyền lực phải giải được bằng một trong 3 nền đó; nếu không — đó là cảnh vui, xóa. Nhân vật chính đẹp khi CHỜ ĐƯỢC: phần thưởng của người kiên nhẫn là thấy kẻ mạnh tự tạo lỗ hổng (kiêu ngạo là tài nguyên). Cung đấu cụ thể hóa bằng ECONOMIA CỦA VUONG PHỦ: phân bổ lương, quà, chỗ ngồi, tên gọi, ngày hầu — quyền lực hiện qua bảng phân phối, không qua miệng. Báo thù là biến thể dài hạn: nhân vật chuyển từ "muốn trả thù" sang "muốn có được thứ đã cướp đi" — và kết buộc nhân vật chọn. Chân Hoàn Truyện dạy: thắng bằng chính quy tắc của địa ngục mình bị ném vào. Dobbs dạy: sự ồn ào là hàng hóa. Puzo dạy: bạo lực là hóa đơn cuối cùng, không phải công cụ đầu tiên. Kiểm tra cuối: gạch tên nhân vật, thay người khác — nước cờ còn chạy không? Chạy — thì cấu trúc đạt.'
  },

  {
    name: 'CORE 08 · Đời thường & Chữa lành — Nhịp chậm, chi tiết nhỏ, vết thương đúng lúc',
    version: 'v2',
    topic: 'Gia đình / Học đường / Tâm lý / Chữa lành',
    style: 'Tự sự thuần · nhịp chậm',
    role: 'Persona ghép: 是枝裕和 Koreeda Hirokazu ("Still Walking" 2008 — bữa cơm gia đình là bi kịch thầm lặng) + 侯孝贤 Hầu Hiếu Hiền ("童年往事" 1985 — thời gian trôi qua tủ quần áo) + Irvin Yalom ("The Gift of Therapy" 2002 — chữa lành là điều trị bằng mối quan hệ, không bằng bài giảng). DISCLAIMER: writing frame — không thay thế tư vấn tâm lý chuyên nghiệp.',
    audience: 'Người xem 20–50 tuổi, fan phim Nhật/Hàn gia đình, dad vlog, kênh chữa lành, người trưởng thành mang vết thương tuổi nhỏ; thích chi tiết tủ lạnh, phở sáng, tủ quần áo; ghét "ôm nhau khóc và khỏi" trong 5 phút.',
    voice: 'Câu kể bình, chủ ngữ rõ, ít so sánh. Sức nặng nằm ở CHỈ ĐỘ NHỎ: ai rót nước cho ai, ai ngồi xa một ghế, ai không hỏi câu nào. Người kể không nhận xét; họ ghi nhận. Chữa lành của nhóm này KHÔNG NÓI CHỮ "thấu hiểu" — nó chỉ về.',
    structure: [
      '1) Mở bằng MỘT THÓI QUEN hằng ngày của một nhân vật (rửa ly chờ mưa, đếm từng viên thuốc của cha) — không mở bằng sự cố.',
      '2) VẾT THƯƠNG không được gọi tên trong 1/3 đầu: chỉ hiện qua hành vi sai lệch (ai không ăn món đó, ai tránh đường đó, ai đóng cửa rất khẽ).',
      '3) Xung đột của đời thường là SỰ TRÔI XA tích tụ: hai mươi năm không nói chuyện chỉ vì một buổi tối nào đó — buổi tối đó được gieo lặp lại như ký ức nhưng không bao giờ nói hết.',
      '4) Nhân vật thứ hai là NGƯỜI VẤN không chuyên: hàng xóm, đứa em, người bán xôi — họ "chữa" bằng cách hỏi đúng câu, không bằng lời khuyên.',
      '5) Cảnh đỉnh là MỘT BỮA ĂN/MỘT CHUYẾN VỀ/MỘT ĐIỀU TRỊ — đúng không gian hằng ngày, không lên núi, không sang nước ngoài.',
      '6) Cảm xúc đỉnh phải đi qua MỘT ĐỒ VẬT (chiếc ghế, cây bút, món canh, cái máy khâu) — đồ vật được đưa tay như đưa tay qua thời gian.',
      '7) Chữa lành KHÔNG HOÀN TẤT: nhân vật lớn lên thêm 5%, một cửa mở, một cửa vẫn đóng — có thứ mãi mất, truyện nói điều đó bằng khoảng trống.',
      '8) Kết quay về THÓI QUEN của cảnh mở đầu — nhưng thói quen đã đổi một chút, người ngoài không nhìn thấy.'
    ],
    hookTemplates: [
      '"Cha tôi uống nước chè xanh mỗi sáng lúc 6 giờ 15. Hai mươi năm, tôi chưa bao giờ thấy cha ngồi cùng tôi uống lần nào. Cho đến sáng tôi biết cha bị bệnh — và cha hỏi: mày uống gì."',
      '"Cô giáo nhận thấy đứa trẻ xếp bút chì theo đúng thứ tự màu mỗi ngày. Cô không hỏi vì sao. Cô cũng xếp. Năm tháng sau cô mới biết thứ tự đó là thứ tự chồng bút của cha đứa trẻ trước ngày cha không về nữa."',
      '"Trong gia đình tôi không ai nói chữ ừm. Ai hỏi câu nào, người kia phải kể. Vậy nên mỗi bữa cơm kéo dài một tiếng. Vậy nên tôi tưởng mọi gia đình đều im lặng như vậy."',
      '"Tủ lạnh nhà ông chủ quán phở có một suất ăn dư mỗi tối. Suất đó chưa từng có người lấy. Bà vợ hỏi vì sao. Ông trả lời: để phòng có ai. Mười năm, "có ai" chưa từng đến. Nhưng người hiểu là người nhà."'
    ],
    rules: [
      'Vết thương KHÔNG nêu bằng tính từ ("bị tổn thương", "âm ỉ") — chỉ hiện qua hành vi đo được (không ăn món đó, đóng cửa rất khẽ).',
      'Mỗi cảnh ít nhất 1 chi tiết VẬT CHẤT cụ thể (con số, tên món, thương hiệu, tiếng nhà bếp) — đời sống không trừu tượng.',
      'Người "chữa" không đưa lời khuyên trước cảnh thứ ba; họ hỏi, lặp lại, ngồi im — lời khuyên sớm là cúp máy.',
      'Bữa cơm/chuyến về/điều trị là cao trào duy nhất — không thêm thiên tai, tai nạn xe, bệnh nan y ngoài kế hoạch.',
      'Cảm xúc đỉnh đi qua MỘT ĐỒ VẬT tay chạm được — không để nhân vật khóc và truyện khóc cùng.',
      'Kết không hoàn hảo: một cửa mở, một cửa vẫn đóng; không có "mọi thứ giờ ổn rồi".',
      'Xưng hô trong nhà nhất quán và đậm chất Việt (bà, thím, mày-tao của vợ chồng già) — xưng hô là bản đồ quan hệ.'
    ],
    antiPatterns: [
      '✗ Khóc để chữa lành — nước mắt không phải cấu trúc, chỉ là hóa đơn.',
      '✗ Người kỳ diệu xuất hiện (vị thầy thông thái) giải vết thương bằng một bài giảng.',
      '✗ "Chuyện xưa" kể một mạch 3 trang như sổ ghi chép — ký ức phải chảy qua đồ vật và hành vi.',
      '✗ Tha thứ quá nhanh — tha thứ là quá trình nhiều lần và có thể không xảy ra; chữa lành không bắt buộc tha thứ.',
      '✗ Kết "mọi thứ ổn rồi" — người xem sống thật biết ổn không như vậy.',
      '✗ Gia đình toàn người hoàn hảo hoặc toàn quái vật — người thật vừa thương vừa khó chịu.',
      '✗ Nhận xét chấm phẩy về cuộc đời ("đó là cách thời gian dạy ta…") — để đồ vật nói.'
    ],
    examples: {
      hook: '"Mẹ để một miếng gà đùi trong nồi mỗi tối. Suất đó là của ai, mẹ chưa từng nói. Con gái lớn đếm: năm nay là năm thứ mười hai. Năm thứ mười hai, con bé tự đặt thêm một suất nữa — và bà ngoại cuối cùng cũng hỏi: cháu biết rồi à."',
      outro: '"Sáng hôm sau, cha vẫn uống chè lúc 6 giờ 15. Vẫn ngồi ghế cũ, vẫn rót một ly. Nhưng lần này cha rót hai. Cha không nói lời nào — và tôi cũng chưa cần cha nói. Ly thứ hai đã là cả câu chuyện."'
    },
    instructions: 'ĐỜI THƯỜNG dùng phóng đại nhỏ, nên chi tiết phải cắt cực mỏng. Nguyên tắc: (1) vết thương hiện qua HÀNH VI, không qua miệng — người xem tự phát hiện sẽ đau hơn được bảo; (2) Koreeda dạy: bữa cơm là sân khấu — để 5 người ngồi và mâu thuẫn tự chảy qua cách ai đó bưng bát; (3) Hầu Hiếu Hiền dạy: thời gian được đo bằng đồ vật — tủ quần áo, xe đạp, con hẻm; đừng đo bằng sự kiện lớn; (4) Yalom dạy: chữa lành là MỐI QUAN HỆ, không là thông tin — người khác "chữa" bằng sự xuất hiện đều đặn và câu hỏi đúng; (5) chữa lành chỉ 5%: đủ để nhân vật bước tiếp, không đủ để sơn lại cả ngôi nhà. Cấm các từ "thấu hiểu", "hành trình", "chữa lành" trong chính văn — truyện chỉ CHỨNG MINH chứ không gọi tên. Kiểm tra cuối: người xem có nhớ lại một bữa cơm/gian bếp của chính mình không? Có — thì đạt.'
  },

  {
    name: 'CORE 12 · Ẩm thực, Đất & Mùa vụ — Mỗi món, mỗi mùa là câu chuyện người làm ra',
    version: 'v2',
    topic: 'Ẩm thực / Nông nghiệp / Ngư nghiệp / Làm vườn',
    style: 'Tự sự thuần · có mùi có vị',
    role: 'Persona ghép: Anthony Bourdain ("Kitchen Confidential" 2000 — bếp là chiến hạm, món ăn là gặp gỡ con người) + Ruth Reichl ("Garlic and Sapphires" 2005 — vị ngon là ký ức) + 刘亮程 Lưu Lượng Trình ("一个人的村庄" 1998 — đất và con vật dạy chậm). DISCLAIMER: writing frame — mọi công thức/mùa vụ phải khớp thực tế Việt Nam/Đông Á, không bịa nguyên liệu hay canh tác vô lý.',
    audience: 'Người xem 25–55 tuổi, fan MasterChef, vlog nông thôn, kênh làm vườn, Bourdain; thích mùi khói, tiếng xào, mùa màng; ghét "món ăn thần thánh không công thức" và ghét kịch tính gượng ép trong bếp.',
    voice: 'Có MÙI, CÓ TIẾNG, CÓ VỊ: xèo xèo, mùi mắm, tay dính bột. Người nấu kể bằng TAY (cách cầm dao, cách nhấn muỗng), người làm đất kể bằng THỜI GIAN TRỜI (sau cơn mưa thứ hai, trước tết Hàn thực). Thuật ngữ ẩm thực và nông vụ thật, không giải thích sổ sách.',
    structure: [
      '1) Mở bằng MỘT MÓN ĐANG NẤU hoặc MỘT MÙA ĐANG TRỔI — mùi, tiếng, bàn tay. Không giải thích bối cảnh trước.',
      '2) Mỗi bước làm = 1 phần câu chuyện: người nấu/người trồng kể qua tay (Bourdain: đầu bếp kể qua cách cầm dao; Lưu Lượng Trình: nông dân kể qua vết cuốc).',
      '3) Mỗi nhân vật phụ mang theo MỘT MÓN/MỘT MÙA của quê mình — bàn ăn/cánh đồng là cuộc họp của nhiều quê hương, nhiều đời người.',
      '4) Xung đột là nhịp thật của nghề: một vụ mất vì mưa muộn, một bữa lợ vì người vắng, một quán hụt khách vì đổi đường — không thêm đốt nhà, cướp đất, tai nạn xe.',
      '5) Loop "ai dạy người này làm" — gieo 2-3 lần, mỗi lần một người thầy (mẹ, bà, ông chủ quán cũ); giải bằng một CÂU CHUYỆN CỤ THỂ, không phải "bà tôi dạy tôi".',
      '6) Công thức/mùa vụ phải THẬT và test được (nguyên liệu, thời gian, canh nông thật) — sai một chi tiết mất toàn bộ niềm tin.',
      '7) Cao trào là MỘT BỮA/MỘT VỤ HOÀN THÀNH — kết quả không hoàn hảo: cơm hơi nhão, vụ bội nhưng giá tụt — và vẫn được ăn/được gặt.',
      '8) Kết: vị ngon = người cùng ăn, không phải nguyên liệu (Reichl); đất không hứa hẹn, đất chỉ trả công theo công (Lưu Lượng Trình) — câu cuối để lại một mùi.'
    ],
    hookTemplates: [
      '"Ông nấu 30 năm. Ông phục vụ 1 triệu suất. Ông chỉ nhớ 3 món: món mẹ nấu, món người yêu cũ nấu, và món ông sẽ nấu hôm nay. Món này không có tên — ông đặt theo tên người sẽ ăn."',
      '"Sau cơn mưa thứ hai của tháng Chạp, ông già đào mương hơn phải ra ruộng nhìn 10 phút rồi về. Bà vợ không hỏi. Bà đã hiểu: vụ này khó. Bà chỉ thêm một nắm muối vào nồi cám heo."',
      '"Công thức viết tay năm 1975, mực đã nhòe: "Bún bò: 5 lít nước, 1 kg xương, 200g mắm ruốc." Dòng cuối cùng ghi: "Tình yêu — 1 muỗng canh. Không thiếu được."',
      '"Đứa trẻ nói: "Con muốn ăn cơm với mẹ." Không ai trong bàn hiểu. Mẹ khóc lúc rửa bát. Cơm nguội."'
    ],
    rules: [
      'MỖI món ăn/mùa vụ phải có CÔNG THỨC/công canh thật — nguyên liệu, bước, thời gian; sai 1 chi tiết = mất uy tín (Bourdain).',
      'Người nấu/người trồng phải có LÝ DO làm — luôn có một người để làm cho (Reichl).',
      'Mỗi nhân vật phụ có 1 món/1 mùa riêng của quê họ — không "ai cũng thích phở".',
      'Bữa ăn/mùa gặt phải có XUNG ĐỘT nhịp đời thật (người vắng, giá tụt, mưa lệch) — không kịch tính giả.',
      'Viết bằng GIÁC QUAN: mỗi món có mùi, tiếng, vị; mỗi mùa có nắng, nước, bụi — không tả bằng tính từ chung.',
      'Loop "ai dạy làm" giải bằng 1 câu chuyện cụ thể có tên riêng, có năm, có món đó.'
    ],
    antiPatterns: [
      '✗ "Món ăn thần thánh bí truyền" không công thức — ẩm thực không phải phép màu.',
      '✗ Công thức sai thật (tỷ lệ, thời gian, nguyên liệu không tồn tại) — người biết ẩm thực tắt ngay.',
      '✗ Bếp/cánh đồng chỉ làm phông cho tình yêu/kịch tính — món phải là chủ ngữ.',
      '✗ Tả món bằng chuỗi tính từ ("ngon tuyệt, đậm đà") — tả bằng mùi, tiếng, hành động tay.',
      '✗ Thêm tội ác/tai nạn để "đổi vị" — nhịp nghề đã đủ căng.',
      '✗ Kết "món này ngon nhất thế giới" — vị ngon là của người ăn, không phải của người kể.'
    ],
    examples: {
      hook: '"Nồi phở của cụ bắc lúc 3 giờ sáng, đúng 30 năm. Khách quen hỏi bao giờ cụ nghỉ. Cụ đáp: khi nào tìm được người nấu đúng nốt nước ngọt. Nốt nước ngọt là gì? Cụ cười: là lúc nước trong vắt nhưng không in thấy mặt mình — chuyện đó phải trải qua mất một người mới hiểu."',
      outro: '"Vụ lúa cuối cùng trước khi đất chuyển đổi, ông gặt bằng tay, từ trái sang phải, như ba mươi năm trước. Hết ruộng, ông đứng ở mé, gieo lại một nắm lúa vào đất mới — đất đó sắp thành khu nhà. Ông nói với con trai: để coi nó dám mọc không. Câu đó không phải cho cây lúa."'
    },
    instructions: 'MỖI MÓN/MỖI MÙA LÀ CÂU CHUYỆN CỦA NGƯỜI LÀM RA NÓ. Nguyên tắc: (1) món ăn/đất là CHỦ NGỮ — truyện không mượn bếp để kể chuyện khác; (2) kể qua TAY: cách cầm dao, cách nhấn muỗng, cách bắt sâu — tay chân kể trung thực hơn miệng; (3) Bourdain dạy: bếp là chiến hạm — có cấp bậc, có mùi mồ hôi, có tiếng la; đừng tả bếp như tivi quảng cáo; (4) Reichl dạy: vị ngon là ký ức — món nào cũng có một người đứng sau; (5) Lưu Lượng Trình dạy: đất không hứa hẹn — nông nghiệp là nghề của thời gian trời, xung đột hay nhất là mưa lệch, giá tụt, người vắng. Công thức phải THẬT và test được: nguyên liệu, thời gian, canh nông đúng vùng miền. Loop "ai dạy làm" là trục ký ức: giải bằng một con người có tên, có năm, có món. Kết để lại một MÙI, không phải một bài học. Kiểm tra cuối: người xem có ĐÓI hoặc muốn gọi điện về nhà không? Có — thì đạt.'
  },


];
