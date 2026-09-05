'use strict';
// §22 Versioning — mỗi Video Spec/QA một version, không overwrite bản tốt (§32.13), restore được.
const fs = require('fs');
const path = require('path');

class VersionStore {
  constructor(rootDir) {
    this.dir = path.join(rootDir, 'versions');
    fs.mkdirSync(this.dir, { recursive: true });
  }
  _count(prefix) {
    let max = 0;
    for (const f of fs.readdirSync(this.dir)) {
      const m = f.match(new RegExp('^' + prefix + '-v(\\d{3})\\.json$'));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max;
  }
  commitVideoSpec(spec) {
    const n = this._count('video-spec') + 1;
    const v = String(n).padStart(3, '0');
    fs.writeFileSync(path.join(this.dir, `video-spec-v${v}.json`), JSON.stringify(spec, null, 2));
    return n;
  }
  commitQA(report) {
    const n = this._count('qa');
    const v = String(n).padStart(3, '0');
    fs.writeFileSync(path.join(this.dir, `qa-v${v}.json`), JSON.stringify(report, null, 2));
    return n;
  }
  latestSpec() {
    const n = this._count('video-spec');
    if (!n) return null;
    return { version: n, spec: JSON.parse(fs.readFileSync(path.join(this.dir, `video-spec-v${String(n).padStart(3, '0')}.json`), 'utf8')) };
  }
  specAt(n) {
    const f = path.join(this.dir, `video-spec-v${String(n).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) return null;
    return { version: n, spec: JSON.parse(fs.readFileSync(f, 'utf8')) };
  }
  list() {
    // Trả về CẢ mảng versions (version + createdAt từ mtime file) cho UI dropdown,
    // lẫn số đếm cũ (videoSpecs/qa) để tương thích caller hiện có.
    const versions = [];
    let qa = 0;
    try {
      for (const f of fs.readdirSync(this.dir)) {
        const m = f.match(/^video-spec-v(\d{3})\.json$/);
        if (m) {
          const p = path.join(this.dir, f);
          let createdAt = '';
          try { createdAt = fs.statSync(p).mtime.toISOString(); } catch (_) {}
          versions.push({ version: parseInt(m[1], 10), createdAt, file: f });
        } else if (/^qa-v(\d{3})\.json$/.test(f)) qa++;
      }
    } catch (_) {} // dir chưa tạo / không đọc được → danh sách rỗng
    versions.sort((a, b) => a.version - b.version);
    return { versions, videoSpecs: versions.length, qa };
  }
}

module.exports = { VersionStore };
