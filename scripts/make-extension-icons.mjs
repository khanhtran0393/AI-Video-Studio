import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

// Sinh icon Chrome Extension (16/48/128) cho đồng nhất với logo app.
// Nguồn: build/icon-square.png (256x256, đã được fit-center từ logo 2048x768
// qua scripts/make-square-icon.mjs). Dùng area-average (box filter) downscale
// để giữ chất lượng tốt hơn bilinear point-sampling khi giảm nhiều lần (vd 256->16).
//
// Usage: node make-extension-icons.mjs [srcSquarePng] [outDir]
//   srcSquarePng mặc định: D:/AI Video Studio/build/icon-square.png
//   outDir      mặc định: D:/AI Video Studio/nova/flow-extension

const srcPath = process.argv[2] || "D:/AI Video Studio/build/icon-square.png";
const outDir = (process.argv[3] || "D:/AI Video Studio/nova/flow-extension").replace(/\\/g, "/");
const sizes = [128, 48, 16];

const src = PNG.sync.read(readFileSync(srcPath));
const sw = src.width, sh = src.height;
if (sw !== sh) {
  console.warn(`[warn] nguồn không vuông (${sw}x${sh}); vẫn downscale về vuông.`);
}

// Area-average downscale: mỗi pixel đích = trung bình có trọng số của các pixel
// nguồn trong hộp tương ứng (hỗ trợ hộp lẻ, chất lượng cao khi downscale mạnh).
function downscale(src, tw, th) {
  const dst = new PNG({ width: tw, height: th });
  const sxRatio = sw / tw, syRatio = sh / th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const x0 = x * sxRatio, x1 = (x + 1) * sxRatio;
      const y0 = y * syRatio, y1 = (y + 1) * syRatio;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      const ix0 = Math.floor(x0), ix1 = Math.min(sw, Math.ceil(x1));
      const iy0 = Math.floor(y0), iy1 = Math.min(sh, Math.ceil(y1));
      for (let sy = iy0; sy < iy1; sy++) {
        const yOverlap = Math.min(sy + 1, y1) - Math.max(sy, y0);
        if (yOverlap <= 0) continue;
        for (let sx = ix0; sx < ix1; sx++) {
          const xOverlap = Math.min(sx + 1, x1) - Math.max(sx, x0);
          if (xOverlap <= 0) continue;
          const wgt = xOverlap * yOverlap;
          const si = (sy * sw + sx) * 4;
          r += src.data[si] * wgt;
          g += src.data[si + 1] * wgt;
          b += src.data[si + 2] * wgt;
          a += src.data[si + 3] * wgt;
          area += wgt;
        }
      }
      const di = (y * tw + x) * 4;
      dst.data[di]     = area > 0 ? Math.round(r / area) : 0;
      dst.data[di + 1] = area > 0 ? Math.round(g / area) : 0;
      dst.data[di + 2] = area > 0 ? Math.round(b / area) : 0;
      dst.data[di + 3] = area > 0 ? Math.round(a / area) : 0;
    }
  }
  return dst;
}

for (const s of sizes) {
  const out = downscale(src, s, s);
  const p = `${outDir}/icon${s}.png`;
  writeFileSync(p, PNG.sync.write(out));
  console.log(`OK ${p} -> ${s}x${s} (${out.data.length / 4} px)`);
}
console.log(`Done. source=${srcPath} (${sw}x${sh})`);
