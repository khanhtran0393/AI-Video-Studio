'use strict';
/**
 * IPC gọi Agent Copilot — Vòng lặp tự động (Agentic Loop) cho trợ lý riêng.
 */
const { ipcMain } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

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
      description: "Chạy lệnh terminal (PowerShell)",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Lệnh cần chạy" },
          cwd: { type: "string", description: "Thư mục hiện tại (tùy chọn)" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Ghi nội dung vào file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn tuyệt đối" },
          content: { type: "string", description: "Nội dung cần ghi" }
        },
        required: ["path", "content"]
      }
    }
  }
];

// Helper để gọi API
async function callLLMWithTools(messages, apiConfig) {
  const { provider, model, key, baseUrl } = apiConfig;
  
  let endpoint = '';
  let headers = {
    'Content-Type': 'application/json'
  };
  let body = {
    messages,
    tools: TOOLS,
    tool_choice: "auto"
  };

  if (provider === 'openai') {
    endpoint = baseUrl || 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${key}`;
    body.model = model || 'gpt-4o';
  } else if (provider === 'anthropic') {
    endpoint = baseUrl || 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    body.model = model || 'claude-3-5-sonnet-20240620';
    // Anthropic API format requires mapping system message out, etc. 
    // To simplify, we rely on OpenAI compatibility layers if standard is needed.
    // However, if the user explicitly approved "OpenAI Tool-calling standards",
    // we should use OpenAI format. We assume the proxy/gateway is OpenAI compatible if they chose another provider,
    // or we only implement standard OpenAI request format for now.
    // For full Anthropic support, we'd need to map standard OpenAI format -> Anthropic format.
    // Let's stick to OpenAI format as requested in the plan: "using OpenAI Tool-calling standards".
  } else {
    // Default to OpenAI compatible format
    endpoint = baseUrl;
    headers['Authorization'] = `Bearer ${key}`;
    body.model = model;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

function registerAgentCopilotIpc() {
  ipcMain.handle('agentCopilot:chat', async (_e, history, apiConfig) => {
    let currentMessages = [...history];
    let isFinished = false;
    let finalReply = "";

    try {
      // System prompt for the Copilot
      currentMessages.unshift({
        role: "system",
        content: `Bạn là Antigravity, một trợ lý lập trình/đạo diễn AI được tích hợp trực tiếp vào phần mềm AI Video Studio.
Bạn có quyền truy cập file, chạy lệnh và đọc hiểu dự án.
Luôn trả lời ngắn gọn, súc tích bằng tiếng Việt.`
      });

      // Agentic Loop (max 5 vòng)
      for (let i = 0; i < 5; i++) {
        const responseData = await callLLMWithTools(currentMessages, apiConfig);
        const choice = responseData.choices[0];
        const message = choice.message;
        
        currentMessages.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
          // Thực thi tools
          for (const toolCall of message.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            let toolResult = "";
            
            try {
              if (toolCall.function.name === 'read_file') {
                toolResult = fs.readFileSync(args.path, 'utf8');
              } else if (toolCall.function.name === 'write_file') {
                fs.writeFileSync(args.path, args.content, 'utf8');
                toolResult = "Success";
              } else if (toolCall.function.name === 'run_command') {
                toolResult = await new Promise((resolve) => {
                  exec(args.command, { cwd: args.cwd || process.cwd() }, (err, stdout, stderr) => {
                    resolve(stdout || stderr || (err ? err.message : 'Success'));
                  });
                });
              }
            } catch (err) {
              toolResult = `Error: ${err.message}`;
            }

            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult
            });
          }
          // Loop continues to let model process tool results
        } else {
          // No more tool calls, we are done
          isFinished = true;
          finalReply = message.content;
          break;
        }
      }

      if (!isFinished) {
        finalReply = "Em đang phải thực hiện quá nhiều thao tác nội bộ, xin lỗi sếp em tạm dừng ở đây nhé!";
      }

      return { ok: true, text: finalReply };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { registerAgentCopilotIpc };
