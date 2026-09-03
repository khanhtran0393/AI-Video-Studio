// Test callLlm (generateTopicKeywords) với NOVA_SETTINGS + mock OpenAI-compatible server.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = path.join(os.tmpdir(), 'wb-test-' + Date.now());
fs.mkdirSync(tmp, { recursive: true });
const settings = path.join(tmp, 'nova-settings.json');
fs.writeFileSync(settings, JSON.stringify({
  api_provider: 'openai',
  api_model: 'mock-model',
  api_key_openai: 'test-key',
}));

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    const auth = req.headers.authorization || '';
    const j = JSON.parse(body);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      choices: [{ message: { content: '{"keywords":["làm bánh","ủ bột men","nướng lò nóng"]}' } }],
      _seenModel: j.model, _seenAuth: auth,
    }));
  });
});

server.listen(0, '127.0.0.1', async () => {
  process.env.NOVA_SETTINGS = settings;
  const W = require('./prompt-worker.js');
  // openai provider dùng url gốc; mượn 'openai-compatible' + base_url trỏ về mock
  fs.writeFileSync(settings, JSON.stringify({
    api_provider: 'openai-compatible',
    api_base_url: 'http://127.0.0.1:' + server.address().port + '/v1',
    api_model: 'mock-model',
    api_key: 'test-key',
  }));
  delete require.cache[require.resolve('./prompt-worker.js')];
  const W2 = require('./prompt-worker.js');
  try {
    const out = await W2.generateTopicKeywords('making bread', 3, null);
    console.log('keywords:', JSON.stringify(out));
    console.log('LLM_OK');
  } catch (e) {
    console.error('LLM_FAIL:', e && e.message);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
});
