/* ── flow-cft/index — compose ./login + ./chrome; hợp đồng 6 tên của .plain gốc không đổi. ── */
const { addAccountViaCFT, cancelAdd } = require('./login');
const { cftIsPinned, findCft, findChrome, ensureChrome } = require('./chrome');
module.exports = { addAccountViaCFT, cancelAdd, findChrome, findCft, ensureChrome, cftIsPinned };
