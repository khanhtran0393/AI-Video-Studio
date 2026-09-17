'use strict';
/**
 * IPC gọi Agent Copilot — Vòng lặp tự động (Agentic Loop) cho trợ lý riêng.
 *
 * Chuẩn tool calling: OpenAI-compatible (quyết định 2026-09-17) — chạy với OpenAI,
 * Gemini (v1beta/openai), DeepSeek và mọi gateway /v1/chat/completions. Provider
 * KHÔNG tương thích bị từ chối lộ liễu (AC_PROVIDER_UNSUPPORTED) — không fallback
 * ngầm (Luật 10 AGENTS.md).
 */
const { ipcMain, app } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Ngân sách thời gian/kích thước — khai báo một nơi, không magic number rải rác ──
const LLM_TIMEOUT_MS = 240000;            // 1 lần gọi LLM (AbortController)
const TOOL_EXEC_TIMEOUT_MS = 120000;      // 1 lần run_command (exec timeout)
const READ_FILE_MAX_BYTES = 200 * 1024;   // read_file: từ chối file vượt mức này
const TOOL_OUTPUT_MAX_CHARS = 20000;      // cắt đầu ra tool gửi về LLM (có marker)
const AGENT_MAX_STEPS = 20;               // số vòng Agentic Loop tối đa
const WRITE_FILE_MAX_BYTES = 1024 * 1024; // write_file/edit_file: từ chối nội dung/file vượt mức này
const GREP_MAX_MATCHES = 80;              // grep_files: cắt số match gửi về LLM
const GREP_MAX_FILE_BYTES = 1024 * 1024;  // grep_files: bỏ qua file lớn hơn mức này
const LIST_DIR_MAX_ENTRIES = 500;         // list_dir: cắt số entry trả về
const BAK_SUFFIX = '.bak';                // hậu tố backup tự động trước khi ghi đè file có sẵn
const APPROVAL_TIMEOUT_MS = 180000;       // cổng duyệt: quá 3 phút không bấm → coi như TỪ CHỐI
const DIFF_MAX_LINES = 60;                // cắt diff gửi ra renderer (card duyệt không phình vô hạn)
const BROWSER_SHOT_SUBDIR = 'agent-copilot'; // thư mục con trong output/ lưu ảnh chụp browser
const WB_TASK_TIMEOUT_MS = 30 * 60000;    // tool whiteboard_pipeline: quá 30 phút renderer không trả kết quả → lỗi lộ liễu (gen ảnh Flow nhiều câu có thể lâu)
const SYSTEM_PROMPT_MAX_CHARS = 8000;     // trần systemPrompt override từ apiConfig (nhiệm vụ chuyên biệt, vd vision Whiteboard)

// System prompt mặc định của Copilot — tách ra để apiConfig.systemPrompt (nhiệm vụ
// chuyên biệt, vd Whiteboard Studio vision) có thể override toàn bộ, không ghép đè.
const DEFAULT_SYSTEM_PROMPT = `Bạn là Antigravity, một trợ lý lập trình/đạo diễn AI được tích hợp trực tiếp vào phần mềm AI Video Studio.
Bạn có quyền truy cập file, chạy lệnh, đọc hiểu dự án và duyệt web qua các tool: read_file, write_file, edit_file, list_dir, grep_files, run_command, get_app_state, browser_open, browser_read, browser_screenshot, browser_close, whiteboard_pipeline.
Khi yêu cầu cần nhiều bước, hãy TỰ gọi tool rồi mới trả lời — đừng hỏi lại người dùng nếu tự làm được.
Quy trình khuyến nghị: list_dir/grep_files để định vị → read_file để đọc → edit_file (thay đoạn, an toàn hơn) hoặc write_file để sửa → run_command để chạy lệnh kiểm chứng.
Browser đọc-only + hành động có duyệt: browser_open(url) → browser_read() để đọc nội dung → browser_screenshot() để chụp bằng chứng (lưu output/agent-copilot/) → browser_close() khi xong. Khi cần TƯƠNG TÁC với trang: browser_click({selector}) / browser_type({selector, text}) theo CSS selector — 2 tool này CÓ side-effect nên PHẢI qua CỔNG DUYỆT như sửa file: sếp xem mô tả hành động rồi bấm Duyệt; nhận AC_APPROVAL_DENIED thì đừng thử lại y hệt, hãy hỏi sếp.
Lưu ý: mọi lần sửa/ghi đè file có sẵn đều phải qua CỔNG DUYỆT — sếp xem diff rồi bấm Duyệt. Nếu nhận AC_APPROVAL_DENIED nghĩa là sếp đã từ chối: đừng thử lại y hệt, hãy hỏi sếp muốn thay đổi khác gì.
Luôn trả lời ngắn gọn, súc tích bằng tiếng Việt.`;

// grep_files: thư mục/file bỏ qua khi duyệt dự án (artifact, runtime binary, output)
const GREP_SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'output', 'logs', 'chrome-extension']);
const GREP_SKIP_SUFFIX = ['-bin'];
const GREP_SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.mp4', '.mp3', '.wav', '.ogg',
  '.webm', '.mov', '.avi', '.mkv', '.zip', '.7z', '.rar', '.exe', '.dll', '.node', '.woff',
  '.woff2', '.ttf', '.pdf', '.asar', '.srt', '.db', '.wasm', '.pyc', '.map',
]);

// Endpoint OpenAI-compatible — chỉ đặt MỘT nơi ở đây
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const GEMINI_CHAT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const DEEPSEEK_CHAT_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

// Model mặc định theo provider (chỉ dùng khi settings chưa có api_model)
const DEFAULT_MODEL_OF = {
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
};

function acError(code, message) {
  const e = new Error(`${code}: ${message}`);
  e.acCode = code;
  return e;
}

// ── Cổng duyệt (approval gate) cho write_file ghi đè / edit_file — Antigravity-style ──
// Main sinh diff, gửi event approval_request ra renderer; renderer bấm Duyệt/Từ chối
// qua kênh agentCopilot:approval. Timeout không bấm = TỪ CHỐI (không treo loop, Luật 10).
const pendingApprovals = new Map(); // id → resolveFn(approved)
let approvalSeq = 0;

// ── Tool whiteboard_pipeline: main ỦY NHIỆM renderer chạy pipeline Whiteboard ──
// Pattern giống cổng duyệt: emit event 'wb_task' ra renderer → panel Whiteboard
// Studio chạy bước tương ứng → trả kết quả qua kênh agentCopilot:wbResult.
// Timeout không trả = lỗi lộ liễu WB_TASK_TIMEOUT (không treo loop, Luật 10).
const pendingWbTasks = new Map(); // id → resolveFn(result)
let wbTaskSeq = 0;

// Diff theo dòng — LCS đầy đủ không cần thiết: cắt phần prefix/suffix chung,
// phần giữa là các dòng xoá/thêm, kèm 3 dòng ngữ cảnh mỗi bên. Deterministic.
function buildLineDiff(oldText, newText) {
  const a = String(oldText).split('\n');
  const b = String(newText).split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const lines = [];
  for (let i = Math.max(0, start - 3); i < start; i++) lines.push('  ' + a[i]);
  a.slice(start, endA).forEach((l) => lines.push('- ' + l));
  b.slice(start, endB).forEach((l) => lines.push('+ ' + l));
  for (let i = endA; i < Math.min(a.length, endA + 3); i++) lines.push('  ' + a[i]);
  if (lines.length > DIFF_MAX_LINES) {
    return lines.slice(0, DIFF_MAX_LINES).join('\n') + `\n[...diff cắt ở ${DIFF_MAX_LINES} dòng — bấm duyệt thì xem bản .bak để đối chiếu đầy đủ]`;
  }
  return lines.join('\n') || '(file không đổi)';
}

function capDiff(diffText) {
  const lines = String(diffText).split('\n');
  if (lines.length <= DIFF_MAX_LINES) return diffText;
  return lines.slice(0, DIFF_MAX_LINES).join('\n') + `\n[...diff cắt ở ${DIFF_MAX_LINES} dòng]`;
}

// ── Hàng rào an toàn write_file / run_command — scope chặt trong thư mục dự án ──
// (luật 10: chặn lộ liễu AC_*, không nuốt lỗi, không fallback)
const PROJECT_ROOT = path.resolve(
  app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd()
);

// Từ chối đường dẫn nằm ngoài thư mục dự án (chống path traversal qua ../ hay đường dẫn tuyệt đối)
function assertInsideProject(p, code, what) {
  const abs = path.resolve(String(p || ''));
  if (abs !== PROJECT_ROOT && !abs.startsWith(PROJECT_ROOT + path.sep)) {
    throw acError(code, `${what} "${abs}" nằm ngoài thư mục dự án (${PROJECT_ROOT}) — Copilot chỉ được thao tác bên trong dự án.`);
  }
  return abs;
}

// Blocklist lệnh phá huỷ hệ thống / tiến trình — khớp toàn chuỗi lệnh (kể cả sau & | ;)
const CMD_BLOCKED_PATTERNS = [
  { re: /\b(format|shutdown|logoff|diskpart|bcdedit|bootrec|vssadmin|cipher)\b/i, why: 'lệnh hệ thống phá huỷ/khởi động lại' },
  { re: /\b(taskkill|tskill|stop-process|stop-service|stop-computer|restart-computer)\b/i, why: 'kết thúc tiến trình/dịch vụ/máy' },
  { re: /\brm\s+(-[a-z]+\s+)*-[a-z]*[rf]/i, why: 'xoá đệ quy/ép buộc kiểu Unix (rm -r/-f)' },
  { re: /\b(rd|rmdir)\b[^&|;]*\/s/i, why: 'xoá thư mục đệ quy (rd /s)' },
  { re: /\b(del|erase)\b[^&|;]*\/s\b/i, why: 'xoá file đệ quy (del /s)' },
  { re: /\bremove-item\b[^&|;]*(-recurse|-force)/i, why: 'Remove-Item -Recurse/-Force' },
  { re: /\breg(\.exe)?\s+(add|delete|import|restore|save|unload)\b/i, why: 'sửa Windows Registry' },
  { re: /\bnet\s+(user|localgroup|stop|pause)\b/i, why: 'sửa user/dịch vụ hệ thống' },
  { re: /\bsc(\.exe)?\s+(delete|stop|config|failure)\b/i, why: 'sửa dịch vụ hệ thống' },
  { re: /\b(dd|mkfs)\b/i, why: 'ghi đĩa thô kiểu Unix' },
  { re: /\bset-executionpolicy\b/i, why: 'đổi chính sách thực thi PowerShell' },
];

function assertCommandAllowed(command) {
  const s = String(command || '');
  for (const blocked of CMD_BLOCKED_PATTERNS) {
    if (blocked.re.test(s)) {
      throw acError('AC_CMD_BLOCKED', `Lệnh bị chặn (${blocked.why}): "${s.slice(0, 200)}". Copilot không được chạy lệnh phá huỷ hệ thống/tiến trình.`);
    }
  }
}

function chatEndpointOf(baseUrl) {
  const clean = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(clean)) return clean;      // đã là endpoint đầy đủ
  if (/\/v\d+(beta)?$/.test(clean)) return `${clean}/chat/completions`; // đã có /v1, /v1beta… → chỉ nối phần lời gọi
  return `${clean}/v1/chat/completions`;                     // gốc domain → nối đủ
}

function resolveEndpoint(provider, baseUrl) {
  switch (provider) {
    case 'openai':
      return baseUrl ? chatEndpointOf(baseUrl) : OPENAI_CHAT_ENDPOINT;
    case 'gemini':
      return baseUrl ? chatEndpointOf(baseUrl) : GEMINI_CHAT_ENDPOINT;
    case 'deepseek':
      return baseUrl ? chatEndpointOf(baseUrl) : DEEPSEEK_CHAT_ENDPOINT;
    case 'openai-compatible':
      if (!baseUrl) throw acError('AC_NO_ENDPOINT', 'Provider "openai-compatible" yêu cầu Base URL (/v1/chat/completions) trong Cài đặt.');
      return chatEndpointOf(baseUrl);
    case 'anthropic':
      throw acError('AC_PROVIDER_UNSUPPORTED', 'Copilot dùng chuẩn OpenAI Tool Calling nên KHÔNG gọi Anthropic native được. Sếp chọn provider OpenAI/Gemini/DeepSeek, hoặc đặt Base URL gateway tương thích OpenAI trong Cài đặt nhé.');
    case 'cli':
      throw acError('AC_CLI_UNSUPPORTED', 'Provider "cli" (Claude/ChatGPT CLI bridge cục bộ) chưa hỗ trợ tool calling. Chọn OpenAI/Gemini/DeepSeek hoặc openai-compatible.');
    default:
      throw acError('AC_NO_ENDPOINT', `Provider "${provider}" không nhận diện được.`);
  }
}

// OpenAI Tool-calling schema cho Agent Copilot
const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Đọc nội dung một file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn tuyệt đối tới file" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Chạy lệnh terminal (cmd/PowerShell) trong thư mục dự án (tự chặn lệnh phá huỷ hệ thống/tiến trình). cwd phải nằm trong dự án.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Lệnh cần chạy" },
          cwd: { type: "string", description: "Thư mục hiện tại (tùy chọn, phải nằm trong thư mục dự án)" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Ghi nội dung vào file (chỉ cho phép file nằm trong thư mục dự án; tự tạo thư mục cha; ghi đè file có sẵn sẽ tự lưu bản .bak)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn tuyệt đối (phải nằm trong thư mục dự án)" },
          content: { type: "string", description: "Nội dung cần ghi (tối đa 1MB)" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Sửa file theo kiểu patch: tìm CHÍNH XÁC một đoạn oldString và thay bằng newString (an toàn hơn write_file với file lớn — không phải ghi lại toàn bộ). File cũ tự lưu .bak trước khi sửa.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn tuyệt đối (phải nằm trong thư mục dự án)" },
          oldString: { type: "string", description: "Đoạn text cũ cần thay — phải khớp CHÍNH XÁC và DUY NHẤT trong file (copy nguyên văn từ lần read_file)" },
          newString: { type: "string", description: "Đoạn text mới thay vào (chuỗi rỗng để xoá đoạn cũ)" }
        },
        required: ["path", "oldString", "newString"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "Liệt kê nội dung một thư mục (tên, loại, kích thước). Dùng để khám phá cấu trúc dự án trước khi đọc file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn thư mục (mặc định: thư mục dự án)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "grep_files",
      description: "Tìm kiếm bằng regex trong các file text của dự án (tự bỏ qua node_modules, build, output, file binary). Trả về file + dòng + nội dung khớp. Dùng để định vị code trước khi sửa.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex JS (vd: \"registerAgentCopilot|agentCopilot:chat\")" },
          glob: { type: "string", description: "Lọc đuôi file (tùy chọn, vd: \"*.js\" hoặc \".js|.json\")" },
          path: { type: "string", description: "Thư mục con để thu hẹp phạm vi (tùy chọn, phải nằm trong dự án)" },
          ignoreCase: { type: "boolean", description: "Bỏ qua hoa/thường (tùy chọn, mặc định false)" }
        },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_app_state",
      description: "Xem trạng thái ứng dụng AI Video Studio đang chạy: cổng server, cửa sổ, GPU policy, scheduler, thư mục output, và trạng thái job Video Agent (output/job.json) nếu có.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "whiteboard_pipeline",
      description: "Chạy pipeline Whiteboard Studio trong giao diện app (panel phải đang mở): nhận kịch bản → tự gen TTS (tab Giọng nói) nếu chưa có → khớp timing .SRT → AI sinh prompt + Flow sinh ảnh line-art theo từng câu → AI vision khoanh vùng + giờ vẽ → sẵn sàng xem trước. Cần đã cấu hình AI ở Cài đặt, đăng nhập Flow ở Tạo Ảnh Hàng Loạt và chọn giọng ở tab Giọng nói.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "'run_auto' = chạy trọn chuỗi 1→5 (mặc định)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_open",
      description: "Mở một URL trong browser ngầm của Copilot (cửa sổ ẩn, tái dùng cửa sổ đang có khi mở URL mới). Chỉ nhận http/https/file. Dùng để tra tài liệu, kiểm tra trang web.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL cần mở (http/https/file)" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_read",
      description: "Đọc nội dung trang đang mở trong browser Copilot: url, title và text hiển thị (innerText, tối đa ~15k ký tự). Chỉ ĐỌC — không đổi gì trên trang.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_screenshot",
      description: "Chụp ảnh PNG trang đang mở trong browser Copilot, lưu vào output/agent-copilot/ và trả về đường dẫn file. Dùng để sếp xem bằng chứng trực quan.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Tên gợi nhớ cho ảnh (tùy chọn, chỉ chữ/số/gạch)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_close",
      description: "Đóng browser ngầm của Copilot sau khi làm việc xong (dọn tài nguyên).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description: "Click một phần tử trên trang đang mở trong browser Copilot theo CSS selector. HÀNH ĐỘNG CÓ TÁC ĐỘNG (có thể điều hướng/submit form) — sẽ được đưa qua cổng duyệt: sếp phải bấm Duyệt thì mới thực thi. Sau click nên browser_read() để xem kết quả.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector của phần tử cần click (vd: \"#submit-btn\", \"a.more-info\")" }
        },
        required: ["selector"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browser_type",
      description: "Gõ text vào một ô nhập liệu trên trang đang mở trong browser Copilot theo CSS selector (tương thích React/Vue — tự bắn sự kiện input/change). HÀNH ĐỘNG CÓ TÁC ĐỘNG — sẽ được đưa qua cổng duyệt.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector của ô nhập (vd: \"#search-input\", \"textarea.comment\")" },
          text: { type: "string", description: "Nội dung cần gõ (tối đa 10k ký tự)" }
        },
        required: ["selector", "text"]
      }
    }
  }
];

// Cắt bớt đầu ra tool quá dài trước khi gửi về LLM — marker tường minh, không cắt ngầm
function capToolOutput(text) {
  const s = String(text || '');
  if (s.length <= TOOL_OUTPUT_MAX_CHARS) return s;
  return `${s.slice(0, TOOL_OUTPUT_MAX_CHARS)}\n[AC_TOOL_OUTPUT_TRUNCATED: đã cắt — tổng ${s.length} ký tự]`;
}

// Trích xuất trạng thái app từ state.js (+ job Video Agent nếu có) cho tool get_app_state
// (2026-09-17e: fs async — không còn chặn event loop main khi đĩa chậm)
async function collectAppState() {
  const state = require('../state');
  const appRoot = process.cwd();
  const summary = {
    appRoot,
    platform: process.platform,
    nodeVersion: process.versions.node,
    serverPort: state.serverPort,
    mainWindowOpen: !!(state.mainWindow && !state.mainWindow.isDestroyed()),
    isQuitting: !!state.isQuitting,
    gpuPolicy: state.gpuPolicy,
    scheduleCount: Array.isArray(state.schedules) ? state.schedules.length : 0,
    userDataDir: (() => { try { return app.getPath('userData'); } catch (_) { return ''; } })(),
    outputDir: path.join(appRoot, 'output'),
    videoAgentJob: null,
  };
  try {
    const job = JSON.parse(await fs.promises.readFile(path.join(appRoot, 'output', 'job.json'), 'utf8'));
    summary.videoAgentJob = { id: job.id, state: job.state, phase: job.phase, updatedAt: job.updatedAt };
  } catch (e) {
    // Degrade có chủ đích: chưa có/lỗi đọc job — khai báo thay vì im lặng (Luật 10)
    summary.videoAgentJob = { unavailable: true, reason: `AC_JOB_READ: ${e.code || e.message}` };
  }
  return JSON.stringify(summary, null, 2);
}

// Duyệt đệ quy thư mục cho grep_files — bỏ qua artifact/binary/ẩn, trả danh sách file text
// (2026-09-17e: fs async — readdir qua fs.promises, đệ quy await)
async function grepWalkFiles(dir, out) {
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    if (out.length >= 4000) return;   // trần duyệt phòng thủ
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Bỏ thư mục ẩn (.git, .kilo, .vscode…) + artifact + runtime binary + worktree agent
      if (ent.name.startsWith('.') || GREP_SKIP_DIRS.has(ent.name) || GREP_SKIP_SUFFIX.some((s) => ent.name.endsWith(s))) continue;
      if (/(^|[\\/])(worktrees|node_modules|remotion-browser|bundle)([\\/]|$)/.test(full)) continue;
      await grepWalkFiles(full, out);
    } else if (ent.isFile()) {
      if (GREP_SKIP_EXT.has(path.extname(ent.name).toLowerCase())) continue;
      out.push(full);
    }
  }
}

// Bộ điều khiển browser của Copilot — tạo LƯỜI lần đầu có tool browser_* được gọi.
// require('electron') nằm trong hàm (lazy) để test offline kịp gắn BrowserWindow giả
// vào electron stub trước khi dùng (pattern lazy-require, §4 Luật 5 AGENTS.md).
let browserController = null;
function ensureBrowserController() {
  if (browserController) return browserController;
  const { BrowserWindow } = require('electron');
  const { createBrowserController } = require('./agent-copilot-browser');
  browserController = createBrowserController({
    BrowserWindow,
    outputDir: path.join(PROJECT_ROOT, 'output', BROWSER_SHOT_SUBDIR),
    fs,
    path,
  });
  return browserController;
}

// Thực thi 1 tool cục bộ bằng Node.js — lỗi đều throw lộ liễu với mã AC_*
async function executeTool(name, args, ctx) {
  if (name === 'read_file') {
    const p = String(args.path || '');
    if (!p) throw acError('AC_BAD_TOOL_ARGS', 'read_file thiếu "path".');
    let stat;
    try { stat = await fs.promises.stat(p); } catch (e) { throw acError('AC_READ_FAILED', `"${p}": ${e.message}`); }
    if (!stat.isFile()) throw acError('AC_NOT_A_FILE', `"${p}" không phải file.`);
    if (stat.size > READ_FILE_MAX_BYTES) {
      throw acError('AC_FILE_TOO_LARGE', `File lớn ${stat.size} bytes vượt mức đọc ${READ_FILE_MAX_BYTES} bytes. Hãy dùng run_command đọc từng phần (vd: Get-Content -TotalCount 200).`);
    }
    return fs.promises.readFile(p, 'utf8');
  }
  // ── Cổng duyệt: khi apiConfig.requireApproval bật, mọi lần GHI ĐÈ file có sẵn
  // hoặc SỬA file đều phải qua diff preview → sếp bấm Duyệt. Từ chối/timeout →
  // AC_APPROVAL_DENIED bơm về model như kết quả tool (không fallback ngầm).
  const needsApproval = ctx && ctx.requireApproval === true;
  const requestApproval = async (toolName, filePath, oldText, newText) => {
    if (!needsApproval) return;
    if (!ctx.requestApproval) throw acError('AC_APPROVAL_UNAVAILABLE', 'Không có kênh duyệt (renderer offline?).');
    const approved = await ctx.requestApproval(toolName, filePath, oldText, newText);
    if (!approved) throw acError('AC_APPROVAL_DENIED', `Sếp ĐÃ TỪ CHỐI (hoặc hết ${Math.round(APPROVAL_TIMEOUT_MS / 1000)}s không duyệt) thay đổi ${toolName} vào "${filePath}". Đừng thử lại y hệt — hãy hỏi sếp muốn sửa gì khác.`);
  };

  if (name === 'write_file') {
    const p = String(args.path || '');
    if (!p || typeof args.content !== 'string') throw acError('AC_BAD_TOOL_ARGS', 'write_file cần "path" và "content" (string).');
    const abs = assertInsideProject(p, 'AC_WRITE_OUTSIDE_PROJECT', 'write_file');
    const contentBytes = Buffer.byteLength(args.content, 'utf8');
    if (contentBytes > WRITE_FILE_MAX_BYTES) {
      throw acError('AC_WRITE_TOO_LARGE', `Nội dung ghi ${contentBytes} bytes vượt mức cho phép ${WRITE_FILE_MAX_BYTES} bytes.`);
    }
    const exists = await fs.promises.access(abs).then(() => true, () => false);
    if (needsApproval && exists) {
      let oldText = '';
      try { oldText = await fs.promises.readFile(abs, 'utf8'); } catch (e) { throw acError('AC_WRITE_FAILED', `Đọc file cũ để tạo diff duyệt: ${e.message}`); }
      await requestApproval('write_file', abs, oldText, args.content);
    }
    try {
      let backedUp = '';
      if (await fs.promises.access(abs).then(() => true, () => false)) {
        await fs.promises.copyFile(abs, abs + BAK_SUFFIX);
        backedUp = ` (đã lưu bản ${BAK_SUFFIX})`;
      }
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, args.content, 'utf8');
      return `OK: đã ghi ${contentBytes} bytes vào ${abs}${backedUp}`;
    } catch (e) { throw acError('AC_WRITE_FAILED', `"${abs}": ${e.message}`); }
  }
  if (name === 'edit_file') {
    const p = String(args.path || '');
    const oldString = typeof args.oldString === 'string' ? args.oldString : null;
    const newString = typeof args.newString === 'string' ? args.newString : null;
    if (!p || oldString === null || newString === null || oldString.length === 0) {
      throw acError('AC_BAD_TOOL_ARGS', 'edit_file cần "path", "oldString" (chuỗi khác rỗng) và "newString" (string).');
    }
    const abs = assertInsideProject(p, 'AC_EDIT_OUTSIDE_PROJECT', 'edit_file');
    let stat;
    try { stat = await fs.promises.stat(abs); } catch (e) { throw acError('AC_EDIT_NOT_FOUND', `File "${abs}" không tồn tại — dùng write_file để tạo mới.`); }
    if (!stat.isFile()) throw acError('AC_EDIT_NOT_FOUND', `"${abs}" không phải file.`);
    if (stat.size > WRITE_FILE_MAX_BYTES) throw acError('AC_FILE_TOO_LARGE', `File lớn ${stat.size} bytes vượt mức sửa ${WRITE_FILE_MAX_BYTES} bytes.`);
    let content;
    try { content = await fs.promises.readFile(abs, 'utf8'); } catch (e) { throw acError('AC_EDIT_FAILED', `Đọc "${abs}": ${e.message}`); }
    const occurrences = content.split(oldString).length - 1;
    if (occurrences === 0) {
      throw acError('AC_EDIT_NOT_FOUND', `oldString không có trong "${abs}" (đúng từng ký tự?). Hãy read_file lại rồi copy nguyên văn đoạn cần sửa.`);
    }
    if (occurrences > 1) {
      throw acError('AC_EDIT_AMBIGUOUS', `oldString khớp ${occurrences} chỗ trong "${abs}" — không sửa mù. Hãy thêm ngữ cảnh xung quanh vào oldString cho DUY NHẤT.`);
    }
    const updated = content.replace(oldString, newString);
    await requestApproval('edit_file', abs, content, updated);
    try {
      await fs.promises.copyFile(abs, abs + BAK_SUFFIX);
      await fs.promises.writeFile(abs, updated, 'utf8');
    } catch (e) { throw acError('AC_EDIT_FAILED', `"${abs}": ${e.message}`); }
    return `OK: đã thay 1 chỗ trong ${abs} (bản cũ lưu ${abs + BAK_SUFFIX}). Thay đổi ${oldString.length} → ${newString.length} ký tự.`;
  }
  if (name === 'list_dir') {
    const dirPath = args.path ? String(args.path) : PROJECT_ROOT;
    let stat;
    try { stat = await fs.promises.stat(dirPath); } catch (e) { throw acError('AC_LIST_FAILED', `"${dirPath}": ${e.message}`); }
    if (!stat.isDirectory()) throw acError('AC_NOT_A_DIR', `"${dirPath}" không phải thư mục.`);
    let entries;
    try { entries = await fs.promises.readdir(dirPath, { withFileTypes: true }); } catch (e) { throw acError('AC_LIST_FAILED', `"${dirPath}": ${e.message}`); }
    const items = [];
    for (const ent of entries.slice(0, LIST_DIR_MAX_ENTRIES)) {
      let size = null;
      if (ent.isFile()) {
        try { size = (await fs.promises.stat(path.join(dirPath, ent.name))).size; } catch (_) { size = null; }
      }
      items.push(ent.isDirectory() ? `[dir]  ${ent.name}/` : `[file] ${ent.name}${size !== null ? ` (${size} bytes)` : ''}`);
    }
    const head = `Thư mục: ${path.resolve(dirPath)} — ${entries.length} entry${entries.length > LIST_DIR_MAX_ENTRIES ? ` (hiện ${LIST_DIR_MAX_ENTRIES} đầu tiên)` : ''}:`;
    return items.length ? `${head}\n${items.join('\n')}` : `${head}\n(thư mục rỗng)`;
  }
  if (name === 'grep_files') {
    const pattern = String(args.pattern || '');
    if (!pattern) throw acError('AC_BAD_TOOL_ARGS', 'grep_files thiếu "pattern".');
    let re;
    try { re = new RegExp(pattern, args.ignoreCase ? 'i' : ''); } catch (e) {
      throw acError('AC_GREP_BAD_PATTERN', `Regex "${pattern}" không hợp lệ: ${e.message}`);
    }
    let exts = null;
    if (args.glob) {
      // Chuyển glob đuôi file ("*.js", ".js", "**.js", ".js|.json") thành danh sách đuôi ".js"
      // — viết KHÔNG backslash để tránh lỗi escape khi chuỗi đi qua nhiều tầng.
      exts = String(args.glob).split(/[|,]/).map((s) => {
        let t = s.trim().toLowerCase();
        while (t.startsWith('*')) t = t.slice(1);
        if (!t.startsWith('.')) t = `.${t}`;
        return t;
      });
    }
    let root = PROJECT_ROOT;
    if (args.path) root = assertInsideProject(args.path, 'AC_GREP_OUTSIDE_PROJECT', 'path của grep_files');
    const files = [];
    await grepWalkFiles(root, files);
    const matches = [];
    let scanned = 0;
    for (const f of files) {
      if (exts && !exts.includes(path.extname(f).toLowerCase())) continue;
      let stat;
      try { stat = await fs.promises.stat(f); } catch (_) { continue; }
      if (stat.size > GREP_MAX_FILE_BYTES) continue;
      let content;
      try { content = await fs.promises.readFile(f, 'utf8'); } catch (_) { continue; }
      scanned++;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          matches.push(`${path.relative(PROJECT_ROOT, f).replace(/\\/g, '/')}:${i + 1}: ${lines[i].trim().slice(0, 300)}`);
          if (matches.length >= GREP_MAX_MATCHES) break;
        }
      }
      if (matches.length >= GREP_MAX_MATCHES) break;
    }
    const note = matches.length >= GREP_MAX_MATCHES ? `\n[AC_GREP_TRUNCATED: đạt trần ${GREP_MAX_MATCHES} match — thu hẹp pattern/path để xem tiếp]` : '';
    return `Tìm /${pattern}/${args.ignoreCase ? 'i' : ''} trong ${scanned} file${exts ? ` (đuôi: ${exts.join(',')})` : ''} — ${matches.length} match:\n${matches.join('\n') || '(không có match)'}${note}`;
  }
  if (name === 'run_command') {
    const command = String(args.command || '');
    if (!command) throw acError('AC_BAD_TOOL_ARGS', 'run_command thiếu "command".');
    assertCommandAllowed(command);
    let cwd = PROJECT_ROOT;
    if (args.cwd) {
      cwd = assertInsideProject(args.cwd, 'AC_CWD_OUTSIDE_PROJECT', 'cwd của run_command');
    }
    return new Promise((resolve) => {
      exec(command, {
        cwd,
        timeout: TOOL_EXEC_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      }, (err, stdout, stderr) => {
        if (err && (err.killed || err.signal)) {
          resolve(`AC_TIMEOUT: lệnh vượt ${Math.round(TOOL_EXEC_TIMEOUT_MS / 1000)}s nên bị huỷ. stdout: ${stdout || '(rỗng)'} | stderr: ${stderr || '(rỗng)'}`);
          return;
        }
        resolve(stdout || stderr || (err ? err.message : '(không có đầu ra)'));
      });
    });
  }
  if (name === 'get_app_state') return await collectAppState();
  if (name === 'browser_open' || name === 'browser_read' || name === 'browser_screenshot' || name === 'browser_close') {
    const bc = ensureBrowserController();
    if (name === 'browser_open') return bc.open(args.url);
    if (name === 'browser_read') return bc.read();
    if (name === 'browser_screenshot') return bc.screenshot(args.name);
    return bc.close();
  }
  if (name === 'browser_click' || name === 'browser_type') {
    const bc = ensureBrowserController();
    const selector = String(args.selector || '');
    // Mô tả trang + hành động cho thẻ duyệt — sếp phải biết đang click/gõ Ở ĐÂU trước khi Duyệt
    const page = await bc.describe();
    const actionText = name === 'browser_click'
      ? `→ click phần tử "${selector}"`
      : `→ gõ vào "${selector}" nội dung: "${String(args.text || '').slice(0, 200)}${String(args.text || '').length > 200 ? '…' : ''}"`;
    const actionDesc = `${actionText}\n  trên trang: "${page.title}"\n  (${page.url})\n  [HÀNH ĐỘNG CÓ TÁC ĐỘNG LÊN TRANG WEB — duyệt trước khi thực thi]`;
    await requestApproval(name, page.url, '', actionDesc);
    if (name === 'browser_click') return bc.click(selector);
    return bc.type(selector, String(args.text || ''));
  }
  if (name === 'whiteboard_pipeline') {
    if (!ctx || typeof ctx.requestWbTask !== 'function') {
      throw acError('AC_WB_UNAVAILABLE', 'Không có kênh ủy nhiệm Whiteboard (renderer offline hoặc panel Whiteboard Studio chưa mở).');
    }
    const command = String(args.command || 'run_auto');
    const r = await ctx.requestWbTask(command);
    if (!r || !r.ok) {
      throw acError('AC_WB_FAILED', (r && r.error) || 'Whiteboard Studio trả kết quả không rõ.');
    }
    return `Whiteboard Studio (${command}) xong:\n${r.summary || '(không có tóm tắt)'}`;
  }
  throw acError('AC_UNKNOWN_TOOL', `Tool "${name}" không tồn tại.`);
}

// Gọi LLM (OpenAI-compatible) với tools — có timeout, lỗi lộ liễu mã AC_*
async function callLLMWithTools(messages, apiConfig) {
  const { provider, model, key, baseUrl } = apiConfig || {};
  if (!provider) throw acError('AC_NO_CONFIG', 'Thiếu cấu hình API (apiConfig) từ renderer.');

  const url = resolveEndpoint(provider, baseUrl);
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const body = {
    model: model || DEFAULT_MODEL_OF[provider] || 'gpt-4o',
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
  };
  // Chế độ vision thuần (Whiteboard Studio khoanh vùng): apiConfig.disableTools →
  // gọi chat thường KHÔNG khai báo tools — model không thể tự đi khám phá file/lệnh,
  // chỉ nhìn ảnh + trả JSON. Tránh chi phí vòng lặp tool + hành vi agentic khó đoán.
  if (apiConfig && apiConfig.disableTools === true) { delete body.tools; delete body.tool_choice; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw acError('AC_TIMEOUT', `Gọi LLM (${url}) quá ${Math.round(LLM_TIMEOUT_MS / 1000)}s không phản hồi.`);
    }
    throw acError('AC_FETCH_FAILED', e && e.message ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw acError(`AC_HTTP_${response.status}`, (await response.text()).slice(0, 500));
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.choices) || !data.choices[0] || !data.choices[0].message) {
    throw acError('AC_BAD_RESPONSE', 'Phản hồi LLM thiếu choices[0].message — endpoint có thể không hỗ trợ tool calling.');
  }
  return data;
}

function registerAgentCopilotIpc() {
  // ── Kênh duyệt: renderer trả lời một approval_request (Duyệt/Từ chối) ──
  ipcMain.handle('agentCopilot:approval', (_e, payload) => {
    const id = payload && payload.id;
    const resolveFn = id ? pendingApprovals.get(id) : null;
    if (!resolveFn) return { ok: false, error: 'AC_APPROVAL_UNKNOWN_ID' };
    pendingApprovals.delete(id);
    resolveFn(!!payload.approved);
    return { ok: true };
  });

  // ── Kết quả ủy nhiệm whiteboard_pipeline: renderer trả lời event wb_task ──
  ipcMain.handle('agentCopilot:wbResult', (_e, payload) => {
    const id = payload && payload.id;
    const resolveFn = id ? pendingWbTasks.get(id) : null;
    if (!resolveFn) return { ok: false, error: 'AC_WB_TASK_UNKNOWN_ID' };
    pendingWbTasks.delete(id);
    resolveFn({
      ok: !!(payload && payload.ok),
      summary: (payload && payload.summary) || '',
      error: (payload && payload.error) || '',
    });
    return { ok: true };
  });

  ipcMain.handle('agentCopilot:chat', async (e, history, apiConfig) => {
    if (!Array.isArray(history) || history.length === 0) {
      return { ok: false, error: 'AC_NO_HISTORY: Lịch sử chat trống.' };
    }
    // Stream tiến trình tool ra renderer theo thời gian thực (kênh agentCopilot:event).
    // Guard sender: offline test gọi handler với e=null — không emit, không chết.
    const emit = (payload) => {
      try {
        if (e && e.sender && typeof e.sender.send === 'function' && !e.sender.isDestroyed()) {
          e.sender.send('agentCopilot:event', payload);
        }
      } catch (_) { /* sender đã chết giữa chừng — vòng lặp vẫn phải chạy tiếp */ }
    };
    const summarizeArgs = (name, a) => {
      const raw = a.path || a.url || a.command || a.pattern || a.selector || '';
      return `${name}(${String(raw).replace(/\s+/g, ' ').slice(0, 120)})`;
    };
    const currentMessages = [...history];
    const executedTools = [];
    let finalReply = '';

    // Cổng duyệt: chỉ bật khi UI gửi requireApproval === true. Timeout/từ chối → resolve(false).
    const requireApproval = !!(apiConfig && apiConfig.requireApproval === true);
    const requestApproval = (toolName, filePath, oldText, newText) => new Promise((resolve) => {
      const id = `appr_${Date.now().toString(36)}_${++approvalSeq}`;
      const timer = setTimeout(() => {
        pendingApprovals.delete(id);
        resolve(false);
      }, APPROVAL_TIMEOUT_MS);
      pendingApprovals.set(id, (approved) => {
        clearTimeout(timer);
        resolve(!!approved);
      });
      emit({ type: 'approval_request', id, tool: toolName, path: filePath, diff: capDiff(buildLineDiff(oldText, newText)) });
    });
    // Ủy nhiệm pipeline Whiteboard: emit event wb_task + chờ renderer trả qua
    // agentCopilot:wbResult. Timeout = lỗi lộ liễu WB_TASK_TIMEOUT (Luật 10).
    const requestWbTask = (command) => new Promise((resolve) => {
      const id = `wbtask_${Date.now().toString(36)}_${++wbTaskSeq}`;
      const timer = setTimeout(() => {
        pendingWbTasks.delete(id);
        resolve({ ok: false, error: `WB_TASK_TIMEOUT: Whiteboard Studio không trả kết quả sau ${Math.round(WB_TASK_TIMEOUT_MS / 60000)} phút (panel đang mở chưa?).` });
      }, WB_TASK_TIMEOUT_MS);
      pendingWbTasks.set(id, (result) => { clearTimeout(timer); resolve(result || { ok: false, error: 'WB_TASK_EMPTY' }); });
      emit({ type: 'wb_task', id, command: String(command || 'run_auto') });
    });
    const toolCtx = { requireApproval, requestApproval, requestWbTask };

    try {
      // System prompt: mặc định là Copilot Antigravity; apiConfig.systemPrompt cho phép
      // panel khác (Whiteboard Studio vision…) mượn kênh này cho nhiệm vụ chuyên biệt.
      const customPrompt = (apiConfig && typeof apiConfig.systemPrompt === 'string') ? apiConfig.systemPrompt.trim() : '';
      if (customPrompt.length > SYSTEM_PROMPT_MAX_CHARS) {
        return { ok: false, error: `AC_BAD_SYSTEM_PROMPT: systemPrompt dài ${customPrompt.length} ký tự vượt trần ${SYSTEM_PROMPT_MAX_CHARS}.` };
      }
      currentMessages.unshift({ role: 'system', content: customPrompt || DEFAULT_SYSTEM_PROMPT });
      // Mọi turn sinh trong loop nằm SAU điểm này — tin nhắn user KHÔNG lặp trong contextTurns
      const contextStart = currentMessages.length;

      // Agentic Loop (tối đa AGENT_MAX_STEPS vòng)
      for (let step = 0; step < AGENT_MAX_STEPS; step++) {
        emit({ type: 'step', step: step + 1, maxSteps: AGENT_MAX_STEPS });
        // Nhắc hội tụ: còn 2 bước cuối → bảo model chốt câu trả lời, đừng mở thêm việc mới
        if (step === AGENT_MAX_STEPS - 2) {
          currentMessages.push({ role: 'system', content: 'Bạn còn 2 bước. Hãy CHỐT câu trả lời cuối ngay bây giờ dựa trên dữ liệu đã có — không gọi thêm tool mới trừ khi bắt buộc.' });
        }
        const responseData = await callLLMWithTools(currentMessages, apiConfig);
        const message = responseData.choices[0].message;
        currentMessages.push(message);

        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
          // Thực thi từng tool rồi gắn tool_outputs cho vòng sau
          for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function && toolCall.function.name;
            executedTools.push(toolName);
            let toolResult = '';
            let args = {};
            try {
              args = JSON.parse((toolCall.function && toolCall.function.arguments) || '{}');
            } catch (err) {
              toolResult = `AC_BAD_TOOL_ARGS: arguments không parse được JSON — ${err.message}`;
            }
            emit({ type: 'tool_start', name: toolName, summary: summarizeArgs(toolName, args) });
            if (!toolResult) {
              try {
                toolResult = await executeTool(toolName, args, toolCtx);
                emit({ type: 'tool_end', name: toolName, ok: true, summary: summarizeArgs(toolName, args) });
              } catch (err) {
                toolResult = err && err.acCode ? err.message : `AC_TOOL_FAILED: ${err.message}`;
                emit({ type: 'tool_end', name: toolName, ok: false, summary: toolResult.slice(0, 160) });
              }
            } else {
              emit({ type: 'tool_end', name: toolName, ok: false, summary: toolResult.slice(0, 160) });
            }
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: capToolOutput(toolResult),
            });
          }
          continue;   // vòng sau cho model đọc kết quả tool
        }

        // Không còn tool_calls → câu trả lời cuối
        finalReply = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        emit({ type: 'done' });
        return { ok: true, text: finalReply, contextTurns: currentMessages.slice(contextStart), steps: executedTools };
      }

      // Hết ngân sách vòng lặp — trả kèm các turn đã chạy để UI lưu ngữ cảnh
      emit({ type: 'done' });
      return {
        ok: true,
        text: 'Em đang phải thực hiện quá nhiều thao tác nội bộ, xin lỗi sếp em tạm dừng ở đây nhé!',
        contextTurns: currentMessages.slice(contextStart),
        steps: executedTools,
      };
    } catch (err) {
      emit({ type: 'done' });
      return { ok: false, error: err.message, steps: executedTools };
    }
  });
}

module.exports = { registerAgentCopilotIpc };
