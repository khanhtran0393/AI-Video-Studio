/* ── Re-export khoá cho flow-shared. Mọi engine (flow-chrome / flow-native / renderer
   trong tương lai) require file này để lấy H1 + H3 + H5. Đồ thị require tuyến tính
   (file này chỉ require 3 sibling) → không vòng (Luật 5). */
const compress = require('./compress');
const faceLock = require('./face-lock');
const telemetry = require('./telemetry');

module.exports = {
  compressImageBase64: compress.compressImageBase64,
  MAX_LONG_EDGE: compress.MAX_LONG_EDGE,
  applyFaceLock: faceLock.applyFaceLock,
  buildRefRoleNote: faceLock.buildRefRoleNote,
  buildTelemetryBody: telemetry.buildTelemetryBody,
  fireTelemetry: telemetry.fireTelemetry,
  TELEMETRY_ENDPOINT: telemetry.ENDPOINT,
  TELEMETRY_APP_ID: telemetry.APP_ID,
};
