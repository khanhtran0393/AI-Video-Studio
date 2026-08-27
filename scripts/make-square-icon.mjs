import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

// Tạo PNG vuông từ PNG nguồn: scale logo vừa khung (giữ aspect ratio),
// canh giữa, nền trong suốt.
// Usage: node make-square-icon.mjs [input] [output] [targetSize]
const input = process.argv[2] || "D:/AI Video Studio/build/icon.png";
const output = process.argv[3] || "D:/AI Video Studio/build/icon-square.png";
const target = Number(process.argv[4] || 256);

const src = PNG.sync.read(readFileSync(input));
const scale = Math.min(target / src.width, target / src.height);
const dw = Math.max(1, Math.round(src.width * scale));
const dh = Math.max(1, Math.round(src.height * scale));
const ox = Math.floor((target - dw) / 2);
const oy = Math.floor((target - dh) / 2);

const dst = new PNG({ width: target, height: target });

// Bắt đầu bằng nền trong suốt.
dst.data.fill(0);

// Bilinear resize từ src vào vùng (ox, oy, dw, dh) của dst.
for (let y = 0; y < dh; y++) {
  for (let x = 0; x < dw; x++) {
    const sx = (x + 0.5) / scale - 0.5;
    const sy = (y + 0.5) / scale - 0.5;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;
    const cx0 = Math.max(0, Math.min(src.width - 1, x0));
    const cy0 = Math.max(0, Math.min(src.height - 1, y0));
    const x1 = Math.min(src.width - 1, x0 + 1);
    const y1 = Math.min(src.height - 1, y0 + 1);

    const di = ((oy + y) * target + (ox + x)) * 4;
    for (let c = 0; c < 4; c++) {
      const p00 = src.data[(cy0 * src.width + cx0) * 4 + c];
      const p10 = src.data[(cy0 * src.width + x1) * 4 + c];
      const p01 = src.data[(y1 * src.width + cx0) * 4 + c];
      const p11 = src.data[(y1 * src.width + x1) * 4 + c];
      const top = p00 + (p10 - p00) * fx;
      const bot = p01 + (p11 - p01) * fx;
      dst.data[di + c] = Math.round(top + (bot - top) * fy);
    }
  }
}

writeFileSync(output, PNG.sync.write(dst));
console.log(
  `OK: ${input} (${src.width}x${src.height}) -> ${output} (${target}x${target}), logo ${dw}x${dh} centered`
);