/* TS — Engine prompt CHUYÊN BIỆT cho từng chức năng tab Tạo Kịch Bản.
   Mỗi chức năng (Bút Pháp, Văn Hoá, Đòn bẩy, Kỹ năng viết, CTA) có 1 engine
   riêng sinh khối chỉ dẫn khác biệt rõ rệt theo từng lựa chọn — thay vì các
   câu 1-dòng chung chung trước đây.
   Toàn bộ tiền tố _tsP* (không đụng tên cũ); diễn giải bút pháp _tsButPhapNote
   được TÁI ĐỊNH NGHĨA tại đây (giữ tên, thân chuyên biệt hơn) — utility/ts.js
   và tool-ts.js gọi theo tên, thứ tự nạp đã có utility/ts.js trước nên định
   nghĩa cuối cùng thắng (function declaration nạp lại = thắng). Đây là phá
   vỡ cố ý "1 nguồn duy nhất" Luật 3, đánh dấu [engine-override].
   Nạp SAU utility/ts.js, TRƯỚC tool-ts.js. */

/* ════════ 1. BÚT PHÁP KỂ CHUYỆN — 4 blueprint chi tiết ════════ */
/* Trước: 1 câu 1-dòng "narration / no dialogue / no direct address".
   Sau: 6 dòng mỗi bút pháp — ngôi kể, nhịp đoạn, giọng, luật thoại, điều cấm.
   → AI phân biệt được rõ "Review" với "Tự sự", "lời thoại" với "thuần". */
const _TS_BUT_PHAP = {
  'Tự sự thuần': {
    pov: 'first-person singular — trải nghiệm trực tiếp của người kể ("mình"/"tôi"/"tôi đã"...)',
    pace: 'dòng chảy liền mạch, đoạn 3-5 câu nối nhau bằng chuyển tiếp thời gian hoặc không gian',
    voice: 'giọng kể đời thường, tự nhiên như đang nói chuyện với người quen — không thơ mộng hoá',
    dialogue: 'CẤM: mọi thoại nhân vật, mọi trích dẫn lời ai đó, mọi xưng hô bạn/anh/chị trong vai nhân vật',
    address: 'CẤM: xưng hô khán giả ("các bạn", "bạn nghe đây")',
    close: 'kết bằng 1 câu khép lại — không để mở treo, không đạo lý, không "hy vọng các bạn thích"',
  },
  'Review ở góc nhìn thứ 3': {
    pov: 'third-person narrator — người xem ngoài cuộc, nhìn vào và nhận xét ("chuyện này...", "điều đáng nói ở đây là...")',
    pace: 'mạch phân tích: khẳng định → dẫn chứng → nhận xét → mở rộng; đoạn 2-4 câu, có liên từ phân tích ("tuy nhiên", "điểm đặc biệt", "thực ra")',
    voice: 'giọng bình luận viên giàu kinh nghiệm — tự tin, có quan điểm, không ngập ngừng',
    dialogue: 'CẤM: mọi thoại nhân vật, mọi trích dẫn lời trực tiếp từ nhân vật',
    address: 'CÓ THỂ xưng hô khán giả gián tiếp qua cấu trúc câu ("ai cũng từng...", "người ta hay nghĩ rằng...") — không gọi thẳng "bạn ơi"',
    close: 'kết bằng nhận xét tổng hợp — có thể đánh giá giá trị, mức độ đáng quan tâm, gợi mở xu hướng',
  },
  'Tự sự - lời thoại của nhân vật': {
    pov: 'first-person dẫn truyện — người kể xưng "tôi/mình", nhưng có thể lồng câu thoại của nhân vật khác vào dòng chảy',
    pace: 'đoạn 2-4 câu, xen kẽ: 1-2 câu kể → 1 câu thoại ngắn → 1-2 câu phản ứng/cảm nhận → tiếp tục',
    voice: 'giọng kể tự nhiên, khi chuyển sang thoại phải thay đổi nhịp (nhanh hơn, gọn hơn) để người nghe phân biệt',
    dialogue: 'CHO PHÉP thoại ngắn (1-2 câu) của nhân vật, đặt TRONG dấu ngoặc kép, KHÔNG có nhãn người nói ("Anh nói:", "Bà tôi đáp:") — KHÔNG để thoại chiếm quá 20% tổng bài',
    address: 'CẤM: gọi thẳng người xem; thoại phải của NHÂN VẬT trong truyện, không phải người xem',
    close: 'kết bằng 1 câu kể khép — không phải câu thoại cuối',
  },
  'Review - lời thoại': {
    pov: 'third-person reviewer — bình luận viên, có thể trích dẫn lời của nhân vật/đối tượng đang review làm minh chứng',
    pace: 'mạch review có cấu trúc: nhận định → trích thoại ngắn (nếu cần) → phân tích thoại đó → mở rộng',
    voice: 'giọng bình luận viên — khi dẫn thoại thì hạ giọng "bình thường" xuống (nhanh hơn, phẳng hơn) để phân biệt',
    dialogue: 'CHO PHÉP trích thoại 1-2 câu ngắn làm minh chứng — KHÔNG nhãn người nói, KHÔNG thoại dài, KHÔNG để thoại thành đoạn độc lập',
    address: 'CÓ THỂ mở/đóng đoạn bằng nhận xét bình luận ("thật ra", "điều thú vị là", "câu trả lời nằm ở chỗ")',
    close: 'kết bằng nhận xét của reviewer, KHÔNG kết bằng thoại nhân vật',
  },
};
function _tsButPhapNote(tone){
  const s = _TS_BUT_PHAP[tone] || _TS_BUT_PHAP['Tự sự thuần'];
  return `${s.pov}. ${s.pace}. ${s.voice}. ${s.dialogue}. ${s.address}. ${s.close}.`;
}

/* ════════ 2. VĂN HOÁ BẢN ĐỊA — blueprint theo ngôn ngữ ════════ */
/* Trước: 1 câu "idioms, sayings, customs, names, places".
   Sau: blueprint theo từng cụm ngôn ngữ — idiom quen thuộc, tên địa danh
   thân thuộc, hình ảnh đời thường, điều CẤM vì nhạy cảm văn hoá. */
const _TS_VAN_HOA = {
  'Tiếng Việt': {
    name: 'Vietnam', idio: 'thành ngữ Việt ("treo đầu dê bán thịt mèo"), tục ngữ 3-4 từ ("có công mài sắt...")',
    nameEx: 'An/Bình/Hương/Lan/Quang/Minh — Hà Nội, Sài Gòn, Đà Lạt, Hội An, Nha Trang, Phú Quốc',
    image: 'xe máy, bún phở, tết, lì xì, áo dài, nồi cơm điện, tivi, chung cư, khu phố cổ, chợ nổi',
    avoid: 'CẤM hình ảnh "Tây" thuần (Halloween, Thanksgiving, Black Friday); CẤM gọi nhau "anh/chị" bằng tiếng Anh; dùng "triệu" cho số tiền',
    sens: 'tránh chính trị đương đại, tôn giáo cụ thể; gia đình đa thế hệ là bình thường',
  },
  'English': {
    name: 'Anglosphere', idio: 'common sayings ("the elephant in the room", "cut to the chase"), US/UK idioms phổ biến',
    nameEx: 'John/Sarah, Mike, Emily, Chris — New York, London, LA, Chicago; gọi $ Mỹ, £ Anh, € EU',
    image: 'coffee shop, traffic jam, apartment, backyard BBQ, college, road trip, Thanksgiving (Mỹ) / Sunday roast (Anh)',
    avoid: 'CẤM translate Việt idiom thẳng ("ăn quả nhớ kẻ trồng cây"); CẤM "billion" nếu nghĩa "tỷ"',
    sens: 'tránh phân biệt chủng tộc, thuế, bầu cử cụ thể; "vacation" (Mỹ) vs "holiday" (Anh)',
  },
  'Français (Pháp)': {
    name: 'France', idio: '"il pleut des cordes", "avoir le cafard", "c\'est la cerise sur le gâteau"',
    nameEx: 'Pierre/Marie, Antoine/Camille — Paris, Lyon, Marseille, Bordeaux; arrondissement 1-20 cho Paris',
    image: 'baguette, vin, café terrace, marché, bistro, SNCF, métro, sac à main, goûter (bữa xế 4h)',
    avoid: 'CẤM "billion" cho "milliard" (1 tỷ); CẤM gộp Pháp với French-speaking Africa',
    sens: 'tránh chính trị Pháp cụ thể; biết 35h, août (kỳ nghỉ)',
  },
  'Deutsch (Đức)': {
    name: 'Germany/Austria', idio: '"Tomaten auf den Augen", "Da steppt der Bär", "Ich verstehe nur Bahnhof"',
    nameEx: 'Thomas/Anna, Lukas/Sophie — Berlin, München, Hamburg, Wien, Köln',
    image: 'Biergarten, Bratwurst, Autobahn, Bahn, Fußball (Bundesliga), Späti, Sonntagsruhe',
    avoid: 'CẤM "billion" cho "Milliarde"; phân biệt Đức vs Áo; dùng "Mio." thay "million"',
    sens: 'tránh chiến tranh lịch sử; tách Đức và Áo',
  },
  'Italiano (Ý)': {
    name: 'Italy', idio: '"In bocca al lupo", "Non vedo l\'ora", "Acqua in bocca"',
    nameEx: 'Marco/Giulia, Alessandro/Francesca — Roma, Milano, Napoli, Firenze',
    image: 'pasta/pizza, espresso, vespa, piazza, duomo, famiglia, passeggiata (đi dạo tối)',
    avoid: 'CẤM "milione" nghĩa "tỷ" (dùng "miliardo")',
    sens: 'tránh mafia/cosa nostra trừ khi chủ đề chính; CẤM kỳ thị',
  },
  'Português (Bồ Đào Nha)': {
    name: 'Portugal/Brazil', idio: '"Quem tem boca vai a Roma", "Pau que nasce torto..."',
    nameEx: 'João/Maria, Pedro/Ana — Lisboa, Porto (Bồ); São Paulo, Rio, Salvador (Brazil)',
    image: 'pastel de nata (Bồ), feijoada, samba, futebol, praia, café',
    avoid: 'CẤM nhầm Bồ Đào Nha vs Brazil; "ônibus" (Brazil) vs "autocarro" (Bồ)',
    sens: 'phân biệt Bồ Đào Nha châu Âu vs Brazil; tránh bất bình đẳng cụ thể ở Brazil nếu không phải chủ đề chính',
  },
  'Español (Tây Ban Nha)': {
    name: 'Hispanosphere', idio: '"No hay mal que por bien no venga", "Más vale tarde que nunca"',
    nameEx: 'José/María, Carlos/Ana — Madrid, Barcelona, Buenos Aires, México DF',
    image: 'siesta, tapas, fútbol, plaza mayor, mercado, familia, "sobremesa"',
    avoid: 'PHẢI phân biệt Tây Ban Nha (peninsular: vosotros) vs Mỹ Latin (ustedes); CẤM gộp Argentina/Mexico',
    sens: 'tránh chính trị Mỹ Latin; biết giờ ăn tối 21-22h ở Tây Ban Nha',
  },
  'Nederlands (Hà Lan)': {
    name: 'Netherlands/Belgium', idio: '"Helaas, pindakaas", "Dat is een doorn in het oog"',
    nameEx: 'Jan/Janssen, Pieter/Anna — Amsterdam, Rotterdam, Den Haag, Antwerpen',
    image: 'fiets (xe đạp), grachten (kênh), stroopwafel, hagelslag, stamppot',
    avoid: 'CẤM gộp Bỉ/Hà Lan; phân biệt Dutch (Hà Lan) vs Deutsch (Đức)',
    sens: 'tránh chính trị, đặc biệt nhập cư',
  },
  'Polski (Ba Lan)': {
    name: 'Poland', idio: '"Nie mój cyrk, nie moje małpy", "Twardy orzech do zgryzienia"',
    nameEx: 'Jan/Katarzyna, Piotr/Anna — Warszawa, Kraków, Gdańsk',
    image: 'pierogi, żurek, "sklep osiedlowy"',
    avoid: 'CẤM nhầm giới tính danh từ; phân biệt "milion" (triệu) vs "miliard" (tỷ)',
    sens: 'tránh chính trị lịch sử đương đại',
  },
  'Svenska (Thụy Điển)': {
    name: 'Sweden', idio: '"Att skjuta mygg med kanoner", "Finnas som smultron på en tuva"',
    nameEx: 'Erik/Anna, Lars/Maria — Stockholm, Göteborg, Malmö',
    image: 'fika (nghỉ uống cà phê), lagom (vừa đủ), IKEA, midsommar, bắc cực quang',
    avoid: 'phân biệt "miljon" (triệu) vs "miljard" (tỷ); tiếng Bắc Âu khác nhau (NO/DK/SE/FI)',
    sens: 'tránh chính trị, đặc biệt nhập cư',
  },
  'Dansk (Đan Mạch)': {
    name: 'Denmark', idio: '"Der er ingen ko på isen", "Hygge"',
    nameEx: 'Lars/Peter, Kirsten/Mette — København, Aarhus, Odense',
    image: 'cykel, smørrebrød, Lego, Hans Christian Andersen',
    avoid: 'CẤM gộp Na Uy/Thụy Điển',
    sens: 'tránh chính trị đương đại',
  },
  'Suomi (Phần Lan)': {
    name: 'Finland', idio: '"Hiljaa hyvää tulee", "Metsään meni"',
    nameEx: 'Jukka/Matti, Anna/Maria — Helsinki, Tampere, Turku',
    image: 'sauna, sisu (tinh thần kiên cường), Nokia, hồ, bắc cực quang',
    avoid: 'CẤM gộp Thụy Điển; tiếng Phần Lan KHÔNG thuộc nhóm Bắc Âu-Đức (thuộc Ural)',
    sens: 'tránh chính trị Nga/Phần Lan',
  },
  'Norsk (Na Uy)': {
    name: 'Norway', idio: '"Ingen kjede er sterkere enn sitt svakeste ledd"',
    nameEx: 'Ole/Kari, Lars/Anna — Oslo, Bergen, Tromsø, Stavanger',
    image: 'fjord, ski, olje (dầu), troll, bunad (trang phục dân tộc)',
    avoid: 'NA UY có 2 dạng chính (Bokmål/Nynorsk) — chỉ dùng Bokmål; phân biệt NO/SE/DK',
    sens: 'tránh chính trị đương đại, dầu mỏ',
  },
  'Русский (Nga)': {
    name: 'Russia', idio: '"Не всё то золото, что блестит", "Волка ноги кормят"',
    nameEx: 'Александр/Елена, Дмитрий/Анна — Москва, Санкт-Петербург, Новосибирск',
    image: 'самовар, дача, метро, шапка-ушанка',
    avoid: 'CẤM nhầm "ты" với "Вы" (Tiếng Việt chỉ có 1 "bạn"); phân biệt миллион/миллиард',
    sens: 'tránh chính trị đương đại, đặc biệt chiến tranh; biết thế hệ trẻ dùng tiếng Anh',
  },
  'Čeština (Séc)': {
    name: 'Czech', idio: '"Mít husí kůži", "Je to jiný šálek kávy"',
    nameEx: 'Jan/Novák, Petr/Anna — Praha, Brno, Ostrava',
    image: 'pivo (bia Séc), knedlíky, trdelník',
    avoid: 'CẤM gộp Séc vs Slovakia (rất giống nhưng từ khác)',
    sens: 'tránh chính trị đương đại',
  },
  'Magyar (Hungary)': {
    name: 'Hungary', idio: '"Két zsemle, egy pofon"',
    nameEx: 'László/Katalin, István/Anna — Budapest, Debrecen, Szeged',
    image: 'paprika, goulash, tokaji (rượu)',
    avoid: 'tiếng Hungary là FINNO-UGRIC (cùng họ với Phần Lan) — KHÔNG phải Slav; cấu trúc khác hẳn Nga/Ukraine',
    sens: 'tránh chính trị đương đại',
  },
  'Ελληνικά (Hy Lạp)': {
    name: 'Greece', idio: '"Τα μυαλά στα κάραβα", "Σιγά τα λάχανα"',
    nameEx: 'Γιώργος/Μαρία, Νίκος/Ελένη — Αθήνα, Θεσσαλονίκη, Κρήτη',
    image: 'souvlaki, moussaka, retsina (rượu), đảo, biển Aegean',
    avoid: 'CẤM gộp Hi Lạp cổ (mythology) với Hi Lạp đương đại; phân biệt ký tự đặc thù (Σ/σ/ς)',
    sens: 'tránh chính trị đương đại (Địa Trung Hải, Thổ Nhĩ Kỳ)',
  },
  '中文 (Trung Quốc)': {
    name: 'China/Taiwan', idio: '成语 ("画蛇添足", "对牛弹琴", "井底之蛙"), 网络流行语 "内卷"',
    nameEx: '王伟/李娜, 张老师 — 北京, 上海, 广州, 深圳, 台北',
    image: '外卖, 快递, 共享单车, 加班, 高考, 春运, 微信, 火锅',
    avoid: 'CẤM nhầm 简体 vs 繁体 khi viết; phân biệt "亿" (100 triệu) vs "万" (10 nghìn)',
    sens: 'tránh chính trị đương đại, Đài Loan, Tây Tạng, Tân Cương',
  },
  '日本語 (Nhật Bản)': {
    name: 'Japan', idio: '慣用句 ("猫の手も借りたい", "石の上にも三年")',
    nameEx: '田中さん/佐藤さん, 鈴木/高橋 — 東京, 大阪, 京都',
    image: '通勤ラッシュ, コンビニ, 寿司/ラーメン, 温泉, 新幹線, 終電',
    avoid: 'phân biệt 敬語 (kính ngữ); CẤM nhầm 1 億 (100 triệu) với 1万 (10 nghìn)',
    sens: 'tránh chính trị, đặc biệt chiến tranh; "空気を読む" (đọc không khí) — tế nhị',
  },
  '한국어 (Hàn Quốc)': {
    name: 'South Korea', idio: '속담 ("낮 말은 새가 듣고 밤 말은 쥐가 듣는다"), "눈치"',
    nameEx: '김민수/이지은, 박서준 — 서울, 부산, 제주도',
    image: 'K-pop, K-drama, 치킨/맥주 (chi-maek), 편의점, 카페, 학원',
    avoid: 'phân biệt Hàn Quốc vs Triều Tiên; 반말 vs 존댓말; "억" (100 triệu) vs "만" (10 nghìn)',
    sens: 'tránh chính trị, đặc biệt Triều Tiên',
  },
  'العربية (Ả Rập)': {
    name: 'Arab world', idio: 'أمثال ("الصبر مفتاح الفرج", "من جدّ وجد"), "يا أخي"',
    nameEx: 'محمد/فاطمة, أحمد/عائشة — القاهرة, دبي, الرياض, عمّان',
    image: 'قهوة عربية, تمر, سوق, مسجد, عشاء عائلي, رمضان, عيد الفطر',
    avoid: 'PHẢI RTL (phải sang trái) với Ả Rập chuẩn; phân biệt اللهجة (مصري/خليجي/شامي/مغربي); ألف vs مليون vs مليار',
    sens: 'CẤM chính trị đương đại, tôn giáo, cải cách xã hội cụ thể',
  },
  'Türkçe (Thổ Nhĩ Kỳ)': {
    name: 'Turkey', idio: 'atasözü ("Damlaya damlaya göl olur"), "Aman!"',
    nameEx: 'Mehmet/Ayşe, Ali/Fatma — İstanbul, Ankara, İzmir, Antalya',
    image: 'çay (trà), kebap, baklava, bosphorus, hamam',
    avoid: 'CẤM nhầm với Azerbaijan/Turkmenistan; "bin" vs "milyon" vs "milyar"',
    sens: 'tránh chính trị, đặc biệt Thổ-Kurd, Thổ-Armenia; cẩn trọng tôn giáo',
  },
  'हिन्दी (Hindi)': {
    name: 'India', idio: 'कहावत ("उल्टा चोर कोतवाल को डाँटे")',
    nameEx: 'राहुल/प्रिया, अमित/पूजा — दिल्ली, मुंबई, कोलकाता, बेंगलुरू',
    image: 'auto-rickshaw, चाय (chai), दिवाली, होली, train, सब्ज़ीवाला',
    avoid: 'PHÂN BIỆT Hindi (देवनागरी) vs Urdu (nastaliq); CẤM gộp Ấn Độ = 1 ngôn ngữ; "लाख" vs "करोड़" vs "अरब"',
    sens: 'tránh tôn giáo cụ thể, caste; cẩn trọng Bắc/Nam Ấn',
  },
  'Bahasa Indonesia': {
    name: 'Indonesia', idio: '"Ada uang, ada barang", "Sambil menyelam minum air"',
    nameEx: 'Budi/Siti, Andi/Dewi — Jakarta, Surabaya, Bandung, Bali',
    image: 'ojek (xe ôm), nasi goreng, warung, kaki lima, pasar, mudik (về quê lễ)',
    avoid: 'phân biệt Bahasa Indonesia vs Bahasa Melayu (Malaysia); "miliar" (tỷ) vs "juta" (triệu)',
    sens: 'tránh chính trị, tôn giáo; biết Indonesia đa đảo, đa tôn giáo',
  },
  'Bahasa Melayu (Malaysia)': {
    name: 'Malaysia', idio: '"Bulat air kerana pembetung, bulat manusia kerana muafakat"',
    nameEx: 'Ahmad/Siti, Lim/Wong — Kuala Lumpur, Penang, Johor Bahru',
    image: 'mamak, nasi lemak, teh tarik, MRT, kampung, hari raya, pasar malam',
    avoid: 'Malaysia vs Indonesia (gần giống — phân biệt vocabulary)',
    sens: 'tránh chính trị, đặc biệt quan hệ Singapore, Trung Quốc; 3 chủng tộc chính (Malay/Chinese/Indian)',
  },
  'ภาษาไทย (Thái Lan)': {
    name: 'Thailand', idio: 'สุภาษิต ("น้ำขึ้นให้รีบตัก", "ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น"), "ครับ/ค่ะ"',
    nameEx: 'สมชาย/สมหญิง — กรุงเทพฯ, เชียงใหม่, ภูเก็ต',
    image: 'ตลาดน้ำ, ส้มตำ, ตุ๊กตุ๊ก, 7-Eleven, วัด, มวยไทย',
    avoid: 'phân biệt ภาษาไทย chuẩn vs ภาคเหนือ/อีสาน/ใต้; "ล้าน" (triệu) vs "พันล้าน" (tỷ)',
    sens: 'tránh chính trị, lịch sử Cao Miên; cẩn trọng nhà vua/hoàng gia',
  },
  'Tagalog (Philippines)': {
    name: 'Philippines', idio: 'sawikain ("Mabuhay!", "Walang mahirap na gawa kung dinaan sa tiyaga"), "po/opo"',
    nameEx: 'Juan/Maria, Jose/Ana — Manila, Cebu, Davao',
    image: 'jeepney, tricycle, halo-halo, turo-turo, palengke, bahay kubo, ofw (lao động nước ngoài)',
    avoid: 'CẤM gộp Filipino/Tagalog; nhiều người code-switch Anh; "bilyon" (tỷ) vs "milyon" (triệu)',
    sens: 'tránh chính trị, đặc biệt tổng thống Duterte/Marcos; nhiều người theo Công giáo',
  },
};
function _tsPVanHoaSpec(lang){
  const s = _TS_VAN_HOA[lang];
  if (s){
    return `NATIVE CULTURE — ${lang}: use these specific cultural anchors — ${s.idio}. Name heroes, places and references a local viewer instantly recognizes: ${s.nameEx}. Everyday-life images: ${s.image}. ${s.avoid}. ${s.sens}. The goal is closeness — a viewer in ${s.name} feels "this was written for me", not translated.`;
  }
  return `NATIVE CULTURE — ${lang}: use local sayings, idioms, and proverbs common in ${lang} speakers; pick names, places, currency and everyday-life references a ${lang} native recognizes instantly (avoid generic Western defaults). Avoid untranslated calques; be aware of sensitive cultural/religious/political taboos in the ${lang}-speaking region.`;
}

/* ════════ 3. ĐÒN BẨY TÂM LÝ (déjà vu) — công thức 4 nhịp ════════ */
/* Trước: 1 câu "build opening around this lever, trigger déjà vu".
   Sau: 4 bước dựng mở đầu cụ thể (Anchor → Recognition → Detail → Pivot)
   từ nội dung đòn bẩy người dùng nhập. */
function _tsPLeverSpec(lever){
  const lv = String(lever || '').trim();
  if (!lv) return '';
  return `PSYCHOLOGICAL LEVER (opening hook — déjà vu effect): the user-supplied lever is "${lv}". Build the opening using these 4 beats — (1) ANCHOR: open with a sensory micro-detail a viewer has experienced themselves (the "you know that..." moment); (2) RECOGNITION: within 1-2 sentences the viewer should feel "wait, I have been here" — this is the déjà-vu trigger; (3) DETAIL: ground the anchor in 1 concrete, verifiable detail (sound, sight, temperature, time of day) — DO NOT make a fake-claim or vague mood; (4) PIVOT: by sentence 3, pivot from the everyday anchor into the topic — the hook is already locked by then. Subtle, honest, no exaggeration. The rest of the script can be normal narration — only the OPENING carries this lever.`;
}

/* ════════ 4. KỸ NĂNG VIẾT — 7 blueprint cấu trúc + 1 mặc định ════════ */
/* Trước: 1 câu "apply the X method consistently".
   Sau: blueprint cho từng phương thức — tỉ lệ hồi, kỹ thuật chuyển đoạn, cấm. */
const _TS_SKILL = {
  'Kể chuyện 3 hồi (Setup - Đối đầu - Giải quyết)': {
    shape: 'Script chia 3 phần theo tỉ lệ 25/50/25: Mở đầu (Setup) ~25% từ — giới thiệu trạng thái/thế giới, gieo hạt mâu thuẫn; Phần giữa (Confrontation) ~50% từ — đẩy mâu thuẫn lên cao qua 3-5 nhịp thử thách/escalation; Kết (Resolution) ~25% từ — khép lại, ghi nhận kết quả.',
    trans: 'Mỗi phần ngăn bằng 1 câu chuyển nhịp ("Thế nhưng...", "Đến lúc đó...", "Mọi thứ đã đổi khác khi..."). Tránh cắt cụt — phải có cầu nối ít nhất 1 câu.',
    close: 'Kết phải ghi nhận cụ thể kết quả hoặc bài học qua 1 chi tiết đã gieo từ đầu (payoff) — không kết kiểu "và đó là câu chuyện".',
    avoid: 'CẤM thay đổi nhân vật chính giữa script; CẤM giải quyết mâu thuẫn bằng "may mắn" ở 2 câu cuối.',
  },
  'Mở giữa chừng (In medias res)': {
    shape: 'Mở đầu GIỮA một sự kiện đang diễn ra (1 câu đầu = khoảnh khắc cao trào), KHÔNG giới thiệu bối cảnh. Toàn bộ 10-15% đầu tập trung vào 1 sự kiện. Phần còn lại mới lùi lại, dần lý giải "tại sao lại ở đây".',
    trans: 'Chuyển từ "in medias res" → "lùi lại" bằng câu dạng "Muốn hiểu vì sao... phải quay lại lúc..."',
    close: 'Kết có thể quay lại thời điểm mở đầu — lúc này người xem đã hiểu thêm 1 tầng nghĩa.',
    avoid: 'CẤM mở bằng giới thiệu nhân vật/bối cảnh; CẤM mở bằng câu hỏi tu từ ("Bạn có bao giờ..."); CẤM lùi lại quá sâu (mất mạch).',
  },
  'Điều tra - Phơi bày dần (Slow-burn reveal)': {
    shape: 'Mỗi đoạn phơi bày THÊM 1 mảnh thông tin; thứ tự sắp xếp theo logic "gây tò mò trước, giải thích sau". Toàn bài là 1 chuỗi micro-questions + micro-reveals liên tiếp, mỗi reveal mở ra 1-2 câu hỏi mới.',
    trans: 'Mỗi reveal nối tiếp bằng 1 liên từ như "Và đó mới chỉ là phần nổi...", "Nhưng câu chuyện chưa dừng ở đó...", "Điều ít ai chú ý là..."',
    close: 'Kết bằng reveal cuối cùng, có thể KHÉP VÒNG về 1 chi tiết ở đoạn mở đầu (call-back), tạo cảm giác "à, thì ra".',
    avoid: 'CẤM "spoil" quá sớm; CẤM phơi bày nhiều hơn 1 fact mới mỗi đoạn; CẤM dùng từ "bí ẩn", "bí mật" quá 1 lần.',
  },
  'Đếm ngược - Liệt kê (Countdown / Listicle)': {
    shape: 'Cấu trúc rõ ràng: "Lý do thứ 5:", "Lý do thứ 4:", ... "Và lý do quan trọng nhất là:". Mỗi mục 1 đoạn ngắn (60-120 từ). Tổng số mục phù hợp độ dài script (4 mục cho ~1500 từ, 6-7 mục cho ~3000 từ).',
    trans: 'Mỗi mục có 1 liên từ chuyển ("Tiếp theo...", "Quan trọng hơn...", "Và còn..."). Mục cuối phải dài hơn hoặc bất ngờ hơn các mục trước.',
    close: 'Kết bằng 1 câu nhấn mạnh mục cuối là quan trọng nhất; KHÔNG thêm mục mới sau kết.',
    avoid: 'CẤM liệt kê khô khan (mỗi mục 1 dòng); CẤM mục cuối cùng là phần yếu nhất; CẤM dùng "top X" kiểu bài SEO rẻ tiền.',
  },
  'Tương phản - Nghịch lý (đối lập trái chiều)': {
    shape: 'Mỗi đoạn đặt 2 thứ đối lập cạnh nhau: kỳ vọng vs thực tế, cũ vs mới, dễ vs khó, rẻ vs đắt. Sự kịch tính đến từ khoảng cách giữa 2 thứ, không phải từ sự kiện lớn.',
    trans: 'Mỗi đoạn có 1 cụm đối lập rõ ("Tưởng rẻ, hoá đắt", "Nghe dễ, làm mới thấy khó", "Hôm qua thế này, hôm nay thế kia").',
    close: 'Kết bằng 1 cụm đối lập cuối cùng — tốt nhất là lật ngược từ đầu ("Mọi người nghĩ... nhưng thực ra...").',
    avoid: 'CẤM đối lập cường điệu không có cơ sở; CẤM dùng 1 cặp đối lập 2 lần; CẤM kết bằng "ai cũng có thể làm được".',
  },
  'Gieo mầm - Thu hoạch (Foreshadow - Payoff)': {
    shape: 'Mỗi script đặt 2-3 "hạt" trong 30% đầu (1 chi tiết nhỏ, 1 con số, 1 câu thoại thoáng qua). Phần giữa để "hạt" nằm yên. Phần cuối (50-80% từ) "thu hoạch" — quay lại từng hạt, gắn nó vào kết quả.',
    trans: 'Các "hạt" đặt tự nhiên, KHÔNG nhấn mạnh ("À, một chi tiết nhỏ:..."). Khi "thu hoạch", liên kết bằng "Và chi tiết nhỏ lúc đầu...", "Câu trả lời nằm ở chính con số kia..."',
    close: 'Kết bằng việc "thu hoạch" hạt cuối cùng, có thể kèm 1 câu hỏi mở gieo cho phần tiếp theo (nếu có series).',
    avoid: 'CẤM "hạt" quá lộ liễu (người đọc đoán được ngay); CẤM "quên" thu hoạch 1 hạt nào; CẤM gieo quá 4 hạt (rối).',
  },
  'Ngôi thứ 2 đắm chìm (Second-person immersion)': {
    shape: 'Toàn bộ script dùng "bạn/bạn đã/bạn sẽ" — người đọc/bệnh xem là nhân vật chính. Mỗi đoạn phải có ít nhất 1 lần "bạn" xuất hiện. Không dùng "tôi", không kể chuyện người khác.',
    trans: 'Chuyển cảnh bằng "Bạn vừa...", "Bạn nhìn thấy...", "Bây giờ bạn đang..."',
    close: 'Kết bằng câu hướng về người xem ("Bạn sẽ làm gì tiếp theo?", "Và bạn, lựa chọn nào?").',
    avoid: 'CẤM "tôi", "cô ấy", "anh ấy"; CẤM kể chuyện người thứ 3; CẤM thụ động ("nó được làm").',
  },
};
function _tsPSkillSpec(skill){
  const s = _TS_SKILL[skill];
  if (!s){
    return skill
      ? `WRITING SKILL: the user picked "${skill}" — apply this method consistently: choose structure, pacing, transition style and ending shape that match the spirit of the method; if a beat would violate the method, drop or transform it rather than break the structure.`
      : '';
  }
  return `WRITING SKILL: apply the "${skill}" method consistently — STRUCTURE: ${s.shape} TRANSITIONS: ${s.trans} ENDING: ${s.close} AVOID: ${s.avoid}`;
}

/* ════════ 5. CTA — luật đơn nhất ════════ */
/* Trước: 1 câu "weave 1 natural CTA near the end, 1-2 sentences, warm, not salesy".
   Sau: blueprint chọn 1 hành động, gắn payoff, 3 mức phù hợp nội dung, 5 cấm. */
function _tsPCtaSpec(){
  return `CALL TO ACTION (CTA): pick exactly ONE action that fits the content best (like / subscribe / comment / watch next — DO NOT stack multiple). Place it 1-3 sentences before the end, woven into the narration so it feels like a natural last beat, not a "subscribe!" pop-up. The CTA should EARN its place — ideally echo a payoff from the script itself (e.g. if the script revealed a number, the CTA can invite the viewer to comment that number; if it told a story, the CTA can ask "which part did you recognize"). Length: 1-2 spoken sentences, warm, conversational, NO "nhấn like để ủng hộ kênh", NO URL, NO emoji. CẤM: cụm "các bạn nhớ like subscribe", cụm "ấn nút đăng ký bên dưới", giọng marketing, spam CTA, đặt CTA ở giữa script.`;
}








