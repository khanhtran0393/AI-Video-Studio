/* UI cho Agent Copilot */

let acHistory = [];
let acIsWaiting = false;
let acToolStatusEl = null;   // dòng trạng thái "em đang chạy tool gì" — cập nhật theo event từ main
let acTask = null;           // thẻ Task/Walkthrough của lượt chạy hiện tại (Antigravity-style)

// Nhận event stream từ main (kênh agentCopilot:event) — bơm vào thẻ Task trong luồng chat
function acOnAgentEvent(o) {
  if (!o || !o.type) return;
  if (o.type === 'done') { acTaskFinish(true); return; }
  if (o.type === 'approval_request') { acShowApprovalCard(o); return; }
  if (o.type === 'step') { acTaskStep(o.step, o.maxSteps); return; }
  if (o.type === 'tool_start') { acTaskToolStart(o.name, o.summary); return; }
  if (o.type === 'tool_end') { acTaskToolEnd(o.ok, o.summary || o.name); return; }
}

// Card cổng duyệt: hiện diff và chờ sếp bấm Duyệt/Từ chối (Antigravity-style).
// Không duyệt trong ~3 phút → main tự coi như từ chối (AC_APPROVAL_TIMEOUT chủ động xoá card).
// Nút ⚡ Tự động duyệt BẬT (localStorage 'ac_auto_approve') → chấp nhận ngay, diff vẫn hiện minh bạch.
function acApprovalLabelOf(tool) {
  if (tool === 'edit_file') return 'SỬA file';
  if (tool === 'write_file') return 'GHI ĐÈ file';
  if (tool === 'browser_click') return 'CLICK trên trang';
  if (tool === 'browser_type') return 'ĐÁNH VĂN BẢN vào trang';
  return tool || 'hành động';
}

function acShowApprovalCard(o) {
  const body = document.getElementById('acBody');
  if (!body || !o.id) return;
  acRemoveToolStatus();
  const auto = acAutoApproveEnabled();
  const label = acApprovalLabelOf(o.tool);
  const card = document.createElement('div');
  card.className = 'ac-msg system ac-approval';
  const title = document.createElement('div');
  title.textContent = `🛡 Sếp duyệt giúp em: ${label} "${o.path || ''}"`;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '6px';
  const pre = document.createElement('pre');
  pre.style.cssText = 'max-height:220px;overflow:auto;background:#1e1e1e;color:#d4d4d4;padding:8px;border-radius:6px;font-size:12px;white-space:pre-wrap;margin:0 0 8px 0;';
  pre.textContent = o.diff || '(không có diff)';
  const row = document.createElement('div');
  const btnOk = document.createElement('button');
  btnOk.textContent = '✓ Duyệt';
  btnOk.style.cssText = 'margin-right:8px;padding:4px 14px;cursor:pointer;';
  const btnNo = document.createElement('button');
  btnNo.textContent = '✗ Từ chối';
  btnNo.style.cssText = 'padding:4px 14px;cursor:pointer;';
  row.appendChild(btnOk);
  row.appendChild(btnNo);
  card.appendChild(title);
  card.appendChild(pre);
  card.appendChild(row);
  body.appendChild(card);
  body.scrollTop = body.scrollHeight;

  // Task card ghi nhận dòng "chờ duyệt" trước, settle sau (kể cả auto)
  acTaskApprovalPending(o.id, label, o.path || '');

  const settle = (approved) => {
    btnOk.disabled = true;
    btnNo.disabled = true;
    btnOk.style.opacity = '0.5';
    btnNo.style.opacity = '0.5';
    if (auto) title.textContent += ' — ⚡ TỰ ĐỘNG DUYỆT';
    else title.textContent += approved ? ' — ✓ ĐÃ DUYỆT' : ' — ✗ ĐÃ TỪ CHỐI';
    acTaskApprovalSettle(o.id, approved, auto);
    if (window.native && window.native.agentCopilotApprove) {
      window.native.agentCopilotApprove({ id: o.id, approved });
    }
  };
  btnOk.addEventListener('click', () => settle(true));
  btnNo.addEventListener('click', () => settle(false));
  if (auto) settle(true);   // ⚡ Tự động duyệt: chốt ngay, không chờ bấm
}

function acRemoveToolStatus() {
  if (acToolStatusEl && acToolStatusEl.isConnected) acToolStatusEl.remove();
  acToolStatusEl = null;
}

// ── Thẻ Task/Walkthrough (Antigravity-style) ──
// 1 thẻ / 1 lượt chạy, nằm ngay trong luồng chat: timeline từng tool (⟳ → ✓/✗),
// dòng duyệt (🛡 → ✓/✗/⚡), tiến độ "Bước N/M". Xong tự co lại — bấm header để mở lại.
function acTaskEnsure() {
  const body = document.getElementById('acBody');
  if (!body) return null;
  if (acTask && acTask.el && acTask.el.isConnected) return acTask;
  const el = document.createElement('div');
  el.className = 'ac-task';
  const header = document.createElement('div');
  header.className = 'ac-task-header';
  header.addEventListener('click', () => el.classList.toggle('collapsed'));
  const title = document.createElement('span');
  title.className = 'ac-task-title';
  title.textContent = '🧭 Nhiệm vụ';
  const prog = document.createElement('span');
  prog.className = 'ac-task-progress';
  const chev = document.createElement('span');
  chev.className = 'ac-task-chevron';
  chev.textContent = '▾';
  header.appendChild(title);
  header.appendChild(prog);
  header.appendChild(chev);
  const timeline = document.createElement('div');
  timeline.className = 'ac-task-timeline';
  el.appendChild(header);
  el.appendChild(timeline);
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  acTask = { el, timeline, prog, cur: null, approvals: {} };
  return acTask;
}

function acTaskScroll() {
  const body = document.getElementById('acBody');
  if (body) body.scrollTop = body.scrollHeight;
}

function acTaskRow(ico, text, cls) {
  const t = acTaskEnsure();
  if (!t) return null;
  const row = document.createElement('div');
  row.className = 'ac-task-row' + (cls ? ' ' + cls : '');
  const icoEl = document.createElement('span');
  icoEl.className = 'ac-task-ico';
  icoEl.textContent = ico;
  const txt = document.createElement('span');
  txt.textContent = text;
  row.appendChild(icoEl);
  row.appendChild(txt);
  t.timeline.appendChild(row);
  acTaskScroll();
  return { row, icoEl, txt };
}

function acTaskStep(n, max) {
  const t = acTaskEnsure();
  if (t) t.prog.textContent = `Bước ${n}/${max}`;
}

function acTaskToolStart(name, summary) {
  const t = acTaskEnsure();
  if (!t) return;
  t.cur = acTaskRow('◐', summary || name || 'đang chạy tool…', 'running');
  if (t.cur) t.cur.icoEl.classList.add('ac-task-spin');
}

function acTaskToolEnd(ok, summary) {
  const t = acTaskEnsure();
  if (!t) return;
  const h = t.cur || acTaskRow(ok ? '✓' : '✗', summary || (ok ? 'xong' : 'lỗi'), ok ? 'ok' : 'err');
  t.cur = null;
  if (!h) return;
  h.icoEl.classList.remove('ac-task-spin');
  h.icoEl.textContent = ok ? '✓' : '✗';
  if (summary) h.txt.textContent = summary;
  h.row.className = 'ac-task-row ' + (ok ? 'ok' : 'err');
  acTaskScroll();
}

function acTaskApprovalPending(id, label, path) {
  const t = acTaskEnsure();
  if (!t) return;
  const short = String(path || '').split(/[\\/]/).pop() || '';
  t.approvals[id] = acTaskRow('🛡', `Chờ duyệt: ${label}${short ? ' — ' + short : ''}`, 'approval');
}

function acTaskApprovalSettle(id, approved, auto) {
  const t = acTask;
  const h = (t && id) ? t.approvals[id] : null;
  if (!h) return;
  h.icoEl.textContent = auto ? '⚡' : (approved ? '✓' : '✗');
  h.txt.textContent += auto ? ' — TỰ ĐỘNG DUYỆT' : (approved ? ' — ĐÃ DUYỆT' : ' — TỪ CHỐI');
  h.row.className = 'ac-task-row approval ' + (approved ? (auto ? 'auto' : 'ok') : 'err');
  delete t.approvals[id];
  acTaskScroll();
}

function acTaskFinish(ok) {
  const t = acTask;
  if (!t || !t.el || !t.el.isConnected) return;
  if (t.cur) { t.cur.icoEl.classList.remove('ac-task-spin'); t.cur = null; }
  t.el.classList.add(ok ? 'done' : 'failed', 'collapsed');
  t.prog.textContent = ok ? '✓ Hoàn thành' : '✗ Thất bại';
}

// ── Nút ⚡ Tự động duyệt (localStorage 'ac_auto_approve', mặc định TẮT — an toàn trước) ──
function acAutoApproveEnabled() {
  return localStorage.getItem('ac_auto_approve') === '1';
}
function acReflectAutoApproveToggle() {
  const btn = document.getElementById('acAutoApproveToggle');
  if (!btn) return;
  btn.textContent = acAutoApproveEnabled() ? '⚡' : '⚡·';
  btn.style.opacity = acAutoApproveEnabled() ? '1' : '0.45';
  btn.title = acAutoApproveEnabled()
    ? 'Tự động duyệt đang BẬT — mọi approval_request được chấp nhận ngay (diff vẫn hiện trong chat). Bấm để TẮT.'
    : 'Tự động duyệt đang TẮT — sếp bấm Duyệt từng lần. Bấm để BẬT (agent tự chấp nhận mọi request).';
}
function acToggleAutoApprove() {
  localStorage.setItem('ac_auto_approve', acAutoApproveEnabled() ? '0' : '1');
  acReflectAutoApproveToggle();
  acAppendMsg(acAutoApproveEnabled()
    ? '⚡ Đã BẬT tự động duyệt: mọi request trong nhiệm vụ sẽ được chấp nhận ngay — diff vẫn hiện trong chat để sếp kiểm tra lại.'
    : '⚡ Đã TẮT tự động duyệt: em lại chờ sếp bấm Duyệt từng lần như cũ.', 'system');
}
acReflectAutoApproveToggle();

// Đăng ký nghe event ngay khi UI nạp (preload đã expose onAgentCopilotEvent)
if (typeof window !== 'undefined' && window.native && window.native.onAgentCopilotEvent) {
  window.native.onAgentCopilotEvent(acOnAgentEvent);
}

// Toggle cổng duyệt (localStorage 'ac_require_approval', mặc định BẬT) — phản chiếu lên nút 🛡
function acApprovalEnabled() {
  return localStorage.getItem('ac_require_approval') !== '0';
}
function acReflectApprovalToggle() {
  const btn = document.getElementById('acApprovalToggle');
  if (!btn) return;
  btn.textContent = acApprovalEnabled() ? '🛡' : '🛡·';
  btn.style.opacity = acApprovalEnabled() ? '1' : '0.45';
  btn.title = acApprovalEnabled()
    ? 'Cổng duyệt đang BẬT — bấm để tắt (agent sửa/ghi file không cần sếp duyệt)'
    : 'Cổng duyệt đang TẮT — bấm để bật (agent sửa/ghi file phải qua diff sếp duyệt)';
}
function acToggleApproval() {
  localStorage.setItem('ac_require_approval', acApprovalEnabled() ? '0' : '1');
  acReflectApprovalToggle();
  acAppendMsg(acApprovalEnabled()
    ? '🛡 Đã BẬT cổng duyệt: từ giờ em sửa/ghi đè file nào có sẵn đều đưa diff lên cho sếp bấm Duyệt trước.'
    : '🛡 Đã TẮT cổng duyệt: em sẽ sửa/ghi file thẳng (vẫn luôn tự lưu bản .bak trước khi ghi đè).', 'system');
}
acReflectApprovalToggle();

function acToggleWindow() {
  const win = document.getElementById('agentCopilotWindow');
  win.classList.toggle('active');
  if (win.classList.contains('active')) {
    setTimeout(() => { document.getElementById('acInput').focus(); }, 100);
  }
}

function acAutoGrow(el) {
  el.style.height = '24px';
  el.style.height = (el.scrollHeight) + 'px';
}

function acHandleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    acSendMessage();
  }
}

function acClearChat() {
  acHistory = [];
  acTask = null;
  const body = document.getElementById('acBody');
  body.innerHTML = `<div class="ac-msg agent">Lịch sử trò chuyện đã được xoá. Em có thể giúp gì tiếp cho sếp?</div>`;
}

function acAppendMsg(text, role, isHtml = false) {
  const body = document.getElementById('acBody');
  const div = document.createElement('div');
  div.className = `ac-msg ${role}`;
  if (isHtml) {
    div.innerHTML = text;
  } else {
    div.textContent = text;
  }
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  return div;
}

function acShowTyping() {
  const body = document.getElementById('acBody');
  const div = document.createElement('div');
  div.className = 'ac-msg agent ac-typing-indicator';
  div.innerHTML = `<div class="ac-typing"><span></span><span></span><span></span></div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  return div;
}

function acEscapeHtml(unsafe) {
  return (unsafe || '').replace(/[&<"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '"': return '&quot;';
      default: return '&#039;';
    }
  });
}

function acFormatMarkdown(text) {
  // Rất cơ bản: bọc code block `...` và ```...```
  let html = acEscapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

async function acSendMessage() {
  if (acIsWaiting) return;
  const input = document.getElementById('acInput');
  const text = input.value.trim();
  if (!text) return;
  
  input.value = '';
  input.style.height = '24px';
  
  // Render user message
  acAppendMsg(text, 'user');
  acHistory.push({ role: 'user', content: text });
  
  acIsWaiting = true;
  document.getElementById('acSendBtn').disabled = true;
  const typingEl = acShowTyping();
  
  try {
    // Thu thập cấu hình API hiện tại từ localStorage
    const provider = localStorage.getItem('api_provider') || 'anthropic';
    const model = localStorage.getItem('api_model') || '';
    const key = (localStorage.getItem('api_key') || '').split(/[\n,]+/)[0].trim();
    const baseUrl = localStorage.getItem('api_base_url') || '';
    
    if (!key && provider !== 'cli') {
      typingEl.remove();
      acAppendMsg("Sếp chưa nhập API Key. Vui lòng vào Cài đặt để thêm API Key nhé!", 'system');
      acIsWaiting = false;
      document.getElementById('acSendBtn').disabled = false;
      acHistory.pop();
      return;
    }
    
    const apiConfig = {
      provider, model, key, baseUrl,
      // Cổng duyệt Antigravity-style: mọi sửa/ghi đè file phải qua diff → sếp bấm Duyệt.
      // Toggle lưu localStorage 'ac_require_approval' (mặc định BẬT — an toàn trước).
      requireApproval: localStorage.getItem('ac_require_approval') !== '0',
    };
    
    // Gọi Main Process Agent Loop
    if (!window.native || !window.native.agentCopilotChat) {
      throw new Error("Kênh agentCopilotChat chưa được kích hoạt ở preload.js");
    }
    
    // Gửi lịch sử chat
    const response = await window.native.agentCopilotChat(acHistory, apiConfig);
    
    typingEl.remove();
    if (response.ok) {
      const reply = response.text;
      acAppendMsg(acFormatMarkdown(reply), 'agent', true);
      // Lưu TOÀN BỘ turn mới (assistant tool_calls + tool outputs + câu cuối) vào
      // lịch sử để turn sau agent còn nhớ mình đã chạy lệnh gì (context Agentic Loop).
      if (Array.isArray(response.contextTurns) && response.contextTurns.length) {
        acHistory.push(...response.contextTurns);
      } else {
        acHistory.push({ role: 'assistant', content: reply });
      }
    } else {
      acAppendMsg("Lỗi: " + response.error, 'system');
      acTaskFinish(false);
      acHistory.pop(); // Revert user message on error to allow retry
    }
    
  } catch (err) {
    typingEl.remove();
    acAppendMsg("Đã xảy ra lỗi: " + err.message, 'system');
    acTaskFinish(false);
    acHistory.pop();
  } finally {
    acRemoveToolStatus();   // dọn dòng trạng thái tool (phòng khi event 'done' chưa kịp tới)
    acIsWaiting = false;
    document.getElementById('acSendBtn').disabled = false;
    document.getElementById('acInput').focus();
  }
}
