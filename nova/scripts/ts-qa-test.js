/* Kiểm định HÀM THUẦN của QA sau-ghi Tạo Kịch Bản (tool-ts.js) — chạy node thuần.
Nạp nguyên văn `nova/web/src/toolbox/tool-ts.js` vào sandbox `vm` (không DOM, không
mạng) rồi test đúng hàng rào BẰNG CODE:
- `_tsQaHopLoi` (opts {lever, cta, tone, skill, lang, topic}) — CTA có tín hiệu ở
  500 ký tự cuối, đòn bẩy banned-opener ở 300 ký tự đầu, không tự sửa đầu ra.
- `_tsQaTone` — Tự sự thuần (cấm "các bạn", cần "tôi/mình"); Review góc nhìn thứ 3
  (cấm "bạn ơi", ngưỡng MẬT ĐỘ "tôi" > 6/300 từ — văn bản ngắn giữ trần 6 tuyệt
  đối); tone có thoại (cấm nhãn "X nói:").
- `_tsQaSkill` — chỉ Ngôi thứ 2 có tín hiệu cứng (cần "bạn" trong 400 ký tự đầu,
  cấm "tôi" >3); skill cấu trúc không bịa check.
- `_tsQaLang` — Tiếng Việt: lễ hội ngoại dày ≥3 khi chủ đề không phải về nó
  (REGRESSION: String.match KHÔNG cờ /g chỉ trả match đầu tiên — phải đếm qua
  _tsQaDemTu/split); English: cấm idiom Việt.
- `_tsQaGopChuong` — QA Novel theo từng chương, gộp cảnh báo trùng kèm số chương. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = path.join(__dirname, '..', 'web', 'src', 'toolbox', 'tool-ts.js');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'tool-ts.js' });

function go(expr, vars){ return vm.runInContext(expr, Object.assign(ctx, vars || {})); }
let pass = 0, fail = 0;
function kt(ten, dung, o, expectWarn){
  const qa = JSON.parse(go('JSON.stringify(_tsQaHopLoi(__t, __o))', { __t: dung, __o: o }));
  const ok = expectWarn ? qa.length > 0 : qa.length === 0;
  if (ok){ pass++; console.log('  OK  ' + ten); }
  else { fail++; console.log('  FAIL ' + ten + ' -> ' + JSON.stringify(qa)); }
}
function ktGop(ten, parts, o, expectChuong){
  const qa = JSON.parse(go('JSON.stringify(_tsQaGopChuong(__p, __o))', { __p: parts, __o: o }));
  const ok = expectChuong === null ? qa.length === 0
    : qa.length === 1 && qa[0].indexOf('Chương ' + expectChuong + ': ') === 0;
  if (ok){ pass++; console.log('  OK  ' + ten); }
  else { fail++; console.log('  FAIL ' + ten + ' -> ' + JSON.stringify(qa)); }
}
const dai = 'x'.repeat(400);
function bai(soTu, soToi){
  const w = [];
  for (let i = 0; i < soTu; i++) w.push('lang');
  for (let i = 0; i < soToi; i++) w[i * Math.floor(soTu / Math.max(soToi, 1)) % soTu] = 'tôi';
  const s = w.join(' ');
  if (s.split('tôi').length - 1 !== soToi) throw new Error('khởi tạo bài test sai (' + (s.split('tôi').length - 1) + ' != ' + soToi + ')');
  return s;
}
console.log('CTA / đòn bẩy:');
kt('CTA bật + kết có "đăng ký" -> sạch', 'bài viết thường. hãy đăng ký kênh nhé', { cta: true }, false);
kt('CTA bật + kết sạch -> cảnh báo', 'bài viết thường kết bình thường.', { cta: true }, true);
kt('Lever + mở đầu "Hãy tưởng tượng" -> cảnh báo', 'Hãy tưởng tượng bạn đang ở đó. ' + dai, { lever: 'dejavu' }, true);

console.log('Bút pháp:');
kt('Tự sự thuần + "các bạn" -> cảnh báo', 'chào các bạn nhé, tôi kể nhé', { tone: 'Tự sự thuần' }, true);
kt('Tự sự thuần + ngôi nhất đủ -> sạch', 'tôi đã đi rất xa hôm đó', { tone: 'Tự sự thuần' }, false);
kt('Tự sự thuần + không ngôi nhất -> cảnh báo', 'chuyện xảy ra ở làng kia', { tone: 'Tự sự thuần' }, true);
kt('Review góc 3 + "bạn ơi" -> cảnh báo', 'bạn ơi xem này, chuyện này thú vị', { tone: 'Review ở góc nhìn thứ 3' }, true);
kt('Review góc 3 + "tôi" dày -> cảnh báo', ('tôi nghĩ tôi làm tôi thấy tôi bảo tôi đi tôi về ').repeat(3), { tone: 'Review ở góc nhìn thứ 3' }, true);
kt('Review góc 3 + "tôi" ít -> sạch', 'tôi chỉ nhắc một lần cho dễ nghe, còn lại là phân tích.', { tone: 'Review ở góc nhìn thứ 3' }, false);
kt('Tone thoại + nhãn "Anh nói:" -> cảnh báo', 'Anh nói: chuyện này phải làm ngay', { tone: 'Tự sự - lời thoại của nhân vật' }, true);
kt('Tone thoại + thoại trong ngoặc -> sạch', 'đang đi thì nghe tiếng "chuyện này phải làm ngay" vang lên.', { tone: 'Tự sự - lời thoại của nhân vật' }, false);

console.log('Ngưỡng mật độ "tôi" (Review góc 3) — 6/300 từ, văn bản ngắn giữ trần 6 tuyệt đối:');
kt('3000 từ, 60 "tôi" (đúng 6/300) -> sạch', bai(3000, 60), { tone: 'Review ở góc nhìn thứ 3' }, false);
kt('3000 từ, 61 "tôi" (>6/300) -> cảnh báo', bai(3000, 61), { tone: 'Review ở góc nhìn thứ 3' }, true);
kt('200 từ, 5 "tôi" (văn bản ngắn, ≤6 tuyệt đối) -> sạch', bai(200, 5), { tone: 'Review ở góc nhìn thứ 3' }, false);
kt('200 từ, 7 "tôi" (văn bản ngắn, >6 tuyệt đối) -> cảnh báo', bai(200, 7), { tone: 'Review ở góc nhìn thứ 3' }, true);

console.log('Kỹ năng viết:');
kt('Ngôi thứ 2 + đầu bài không "bạn" -> cảnh báo', dai + ' diễn biến tiếp diễn biến tiếp', { skill: 'Ngôi thứ 2 đắm chìm (Second-person immersion)' }, true);
kt('Ngôi thứ 2 + đầu bài có "bạn" -> sạch', 'bạn đã từng thấy gì đó quen thuộc chưa? ' + dai, { skill: 'Ngôi thứ 2 đắm chìm (Second-person immersion)' }, false);
kt('Skill khác (3 hồi) -> không bịa check', 'câu chuyện ba hồi bình thường', { skill: 'Kể chuyện 3 hồi (Setup - Đối đầu - Giải quyết)' }, false);

console.log('Văn hoá bản địa:');
kt('Tiếng Việt + lễ hội ngoại dày, chủ đề khác -> cảnh báo', 'halloween thanksgiving black friday halloween', { lang: 'Tiếng Việt', topic: 'Kinh Dị' }, true);
kt('Tiếng Việt + chủ đề đúng là Halloween -> sạch', 'halloween halloween halloween', { lang: 'Tiếng Việt', topic: 'Halloween' }, false);
kt('English + idiom Việt -> cảnh báo', 'người ta hay nói ăn quả nhớ kẻ trồng cây mà', { lang: 'English', topic: 'Farm' }, true);

console.log('QA Novel theo chương (_tsQaGopChuong):');
ktGop('3 chương, chỉ chương 2 lệch -> "Chương 2"', ['tôi kể chuyện này', 'chào các bạn nhé, tôi kể', 'tôi kể tiếp vậy'], { tone: 'Tự sự thuần' }, '2');
ktGop('chương 1 và 3 lệch giống nhau -> gộp "Chương 1,3"', ['chào các bạn nhé, tôi kể', 'tôi kể chuyện này', 'các bạn nghe nhé, tôi kể'], { tone: 'Tự sự thuần' }, '1,3');
ktGop('cả 3 chương sạch -> rỗng', ['tôi kể a', 'tôi kể b', 'tôi kể c'], { tone: 'Tự sự thuần' }, null);
ktGop('tone/skill/lang đều không có -> rỗng, không crash', ['a', 'b'], {}, null);
go('_tsQaHopLoi("văn bản bất kỳ", { lever: true, cta: false })');
kt('QA Novel cấp toàn bài không crash khi thiếu tone/skill/lang', 'kết bình thường.', { cta: true }, true);

console.log('ts-qa: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);

