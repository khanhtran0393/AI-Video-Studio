/* UI cho Agent Copilot */

let acHistory = [];
let acIsWaiting = false;

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
    
    const apiConfig = { provider, model, key, baseUrl };
    
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
      acHistory.push({ role: 'assistant', content: reply });
    } else {
      acAppendMsg("Lỗi: " + response.error, 'system');
      acHistory.pop(); // Revert user message on error to allow retry
    }
    
  } catch (err) {
    typingEl.remove();
    acAppendMsg("Đã xảy ra lỗi: " + err.message, 'system');
    acHistory.pop();
  } finally {
    acIsWaiting = false;
    document.getElementById('acSendBtn').disabled = false;
    document.getElementById('acInput').focus();
  }
}
