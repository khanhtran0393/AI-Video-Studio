#!/usr/bin/env node
'use strict';
/**
 * Test nova/main/janitor.js bằng mock app object (không cần Electron).
 * Chạy: node nova/scripts/test-janitor.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  runStartupJanitor, runQuitJanitor, cleanUserDataTmp, cleanLegacyUserData, cleanDevJunk,
} = require('../main/janitor');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'janitor-test-'));

// Giả lập userData + appData như Electron: appData/<active userData>
const appData = path.join(root, 'appdata');
const active = path.join(appData, 'AI Video Studio Independent');
const legacy = path.join(appData, 'AI Video Studio');
const legacyFresh = path.join(appData, 'Nova Studio');           // "ấm" (mới sửa) → phải được tha
fs.mkdirSync(active, { recursive: true });
fs.mkdirSync(legacy, { recursive: true });
fs.mkdirSync(legacyFresh, { recursive: true });

const OLD = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);   // 8 ngày trước

// 1) File .tmp mồ côi cũ trong userData → xoá; file .tmp mới + .json → giữ.
fs.writeFileSync(path.join(active, 'nova-settings.json.123.999.tmp'), 'x');
fs.utimesSync(path.join(active, 'nova-settings.json.123.999.tmp'), OLD, OLD);
fs.writeFileSync(path.join(active, 'in-flight.tmp'), 'y');   // mới sinh (đang ghi) → giữ
fs.writeFileSync(path.join(active, 'nova-settings.json'), '{}');

// 2) userData legacy cũ (8 ngày) vs mới (0 ngày).
fs.writeFileSync(path.join(legacy, 'marker.txt'), 'old');
fs.utimesSync(legacy, OLD, OLD);
fs.writeFileSync(path.join(legacyFresh, 'marker.txt'), 'fresh');

const mockApp = {
  isPackaged: true,   // giả lập bản đóng gói → không quét dev junk
  getPath: (name) => (name === 'appData' ? appData : name === 'userData' ? active : null),
};

const stats = runStartupJanitor(mockApp, console);

assert.strictEqual(stats.userDataTmp.removed.length, 1, 'phải xoá đúng 1 file .tmp cũ');
assert.ok(fs.existsSync(path.join(active, 'in-flight.tmp')), 'file .tmp đang ghi phải được giữ');
assert.ok(fs.existsSync(path.join(active, 'nova-settings.json')), 'settings phải được giữ');
assert.strictEqual(stats.legacyUserData.length, 1, 'phải xoá đúng 1 userData legacy cũ');
assert.strictEqual(stats.legacyUserData[0], 'AI Video Studio');
assert.ok(!fs.existsSync(legacy), 'userData legacy cũ phải bị xoá');
assert.ok(fs.existsSync(legacyFresh), 'userData legacy còn "ấm" phải được tha');
assert.deepStrictEqual(stats.devJunk, [], 'bản packaged không quét dev junk');

// 3) Cờ tắt: AI_VIDEO_STUDIO_KEEP_LEGACY_USERDATA=1 → không xoá gì.
fs.mkdirSync(legacy, { recursive: true });
fs.writeFileSync(path.join(legacy, 'marker.txt'), 'old');
fs.utimesSync(legacy, OLD, OLD);
process.env.AI_VIDEO_STUDIO_KEEP_LEGACY_USERDATA = '1';
assert.strictEqual(cleanLegacyUserData(mockApp).length, 0, 'cờ tắt phải chặn xoá legacy');
delete process.env.AI_VIDEO_STUDIO_KEEP_LEGACY_USERDATA;
assert.strictEqual(cleanLegacyUserData(mockApp).length, 1, 'bỏ cờ phải xoá lại được');

// 4) Tên active nằm trong danh sách legacy → vẫn không bao giờ bị xoá.
const activeInList = { isPackaged: true, getPath: () => appData ? path.join(appData, 'AI Video Studio') : null };
activeInList.getPath = (n) => (n === 'appData' ? appData : path.join(appData, 'AI Video Studio'));
fs.mkdirSync(path.join(appData, 'AI Video Studio'), { recursive: true });
assert.strictEqual(cleanLegacyUserData(activeInList).length, 0, 'userData active không bao giờ bị xoá');

// 5) cleanDevJunk: chỉ khớp pattern, file mới thì giữ.
const devDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janitor-dev-'));
fs.writeFileSync(path.join(devDir, '.tmp-vb-err.log'), 'x');
fs.utimesSync(path.join(devDir, '.tmp-vb-err.log'), OLD, OLD);
fs.writeFileSync(path.join(devDir, 'npm-start123.log'), 'x');
fs.utimesSync(path.join(devDir, 'npm-start123.log'), OLD, OLD);
fs.writeFileSync(path.join(devDir, 'keep-me.js'), 'x');
assert.deepStrictEqual(cleanDevJunk([devDir]).sort(), ['.tmp-vb-err.log', 'npm-start123.log']);

// 5b) .tmp-cdp-* của smoke-cdp: thư mục .tmp-cdp-userdata cũ → xoá đệ quy; mới → giữ.
const cdpDir = path.join(devDir, '.tmp-cdp-userdata');
fs.mkdirSync(cdpDir, { recursive: true });
fs.writeFileSync(path.join(cdpDir, 'lockfile'), 'x');
fs.utimesSync(cdpDir, OLD, OLD);
fs.writeFileSync(path.join(devDir, '.tmp-cdp-test.out'), 'x');
fs.utimesSync(path.join(devDir, '.tmp-cdp-test.out'), OLD, OLD);
const cdpFresh = path.join(devDir, '.tmp-cdp-test2.out');
fs.writeFileSync(cdpFresh, 'x');   // mới sinh (smoke đang chạy) → giữ
assert.deepStrictEqual(cleanDevJunk([devDir]).sort(), ['.tmp-cdp-test.out', '.tmp-cdp-userdata']);
assert.ok(!fs.existsSync(cdpDir), '.tmp-cdp-userdata cũ phải bị xoá đệ quy');
assert.ok(fs.existsSync(cdpFresh), '.tmp-cdp-* mới phải được giữ');

// 6) runQuitJanitor an toàn khi userData không tồn tại.
const quit = runQuitJanitor({ getPath: () => path.join(root, 'khong-ton-tai') });
assert.deepStrictEqual(quit.removed, []);

// 7) cleanUserDataTmp với thư mục rỗng / lỗi path — không ném exception.
assert.deepStrictEqual(cleanUserDataTmp(path.join(root, 'nope')).removed, []);

fs.rmSync(root, { recursive: true, force: true });
fs.rmSync(devDir, { recursive: true, force: true });
console.log('janitor tests: PASS');
