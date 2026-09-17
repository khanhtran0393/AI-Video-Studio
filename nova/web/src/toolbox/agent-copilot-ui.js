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
function acShowApprovalCard(o) {
  const body = document.getElementById('acBody');
  if (!body || !o.id) return;
  acRemoveToolStatus();
  const card = document.createElement('div');
  card.className = 'ac-msg system ac-approval';
  const title = document.createElement('div');
  title.textContent = `🛡 Sếp duyệt giúp em: ${o.tool === 'edit_file' ? 'SỬA file' : 'GHI ĐÈ file'} "${o.path || ''}"`;
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

  const settle = (approved) => {
    btnOk.disabled = true;
    btnNo.disabled = true;
    btnOk.style.opacity = btnOk.disabled ? '0.5' : '1';
    btnNo.style.opacity = btnNo.disabled ? '0.5' : '1';
    title.textContent += approved ? ' — ✓ ĐÃ DUYỆT' : ' — ✗ ĐÃ TỪ CHỐI';
    if (window.native && window.native.agentCopilotApprove) {
      window.native.agentCopilotApprove({ id: o.id, approved });
    }
  };
  btnOk.addEventListener('click', () => settle(true));
  btnNo.addEventListener('click', () => settle(false));
}

function acRemoveToolStatus() {
  if (acToolStatusEl && acToolStatusEl.isConnected) acToolStatusEl.remove();
  acToolStatusEl = null;
}

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
      acHistory.pop(); // Revert user message on error to allow retry
    }
    
  } catch (err) {
    typingEl.remove();
    acAppendMsg("Đã xảy ra lỗi: " + err.message, 'system');
    acHistory.pop();
  } finally {
    acRemoveToolStatus();   // dọn dòng trạng thái tool (phòng khi event 'done' chưa kịp tới)
    acIsWaiting = false;
    document.getElementById('acSendBtn').disabled = false;
    document.getElementById('acInput').focus();
  }
}
