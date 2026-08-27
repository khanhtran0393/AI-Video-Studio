'use strict';

const assert = require('assert');
const { validateCommand, sanitizeArg } = require('../command-policy');

assert.strictEqual(validateCommand([]).reason, 'empty-command');
assert.strictEqual(validateCommand(['curl', 'http://example.com']).reason, 'executable-not-allowlisted:curl');
assert.strictEqual(validateCommand(['node', 'test.js']).allowed, true);
assert.strictEqual(validateCommand(['node', 'test.js', ';', 'rm', '-rf', '/']).reason, 'forbidden-pattern');
assert.strictEqual(validateCommand(['node', 'test.js', '&&', 'whoami']).reason, 'forbidden-subtoken');
assert.strictEqual(validateCommand(['node', '--eval', 'require("fs")']).reason, 'eval-disallowed');
assert.strictEqual(validateCommand(['node', 'a\0b.js']).reason, 'null-byte-argument');
assert.strictEqual(validateCommand(['git', 'log', '--oneline']).allowed, true);
assert.strictEqual(validateCommand(['git', 'push', '--force', 'origin', 'main']).allowed, true);
assert.strictEqual(validateCommand(['taskkill', '/f', '/im', 'node.exe']).reason, 'executable-not-allowlisted:taskkill');
assert.strictEqual(validateCommand(['node', 'script.js', 'rm', '-rf', '/']).reason, 'forbidden-pattern');

assert.strictEqual(sanitizeArg('a\nb\rc\0'), 'abc');

console.log('COMMAND-POLICY TEST: PASS');