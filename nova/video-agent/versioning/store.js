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
    return { videoSpecs: this._count('video-spec'), qa: this._count('qa') };
  }
}

module.exports = { VersionStore };
