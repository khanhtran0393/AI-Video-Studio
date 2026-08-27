import { readFileSync, existsSync } from "node:fs";
import { PNG } from "pngjs";

const files = [
  "D:/AI Video Studio/build/icon.png",
  "D:/AI Video Studio/build/icon.ico",
  "D:/AI Video Studio/build/icon.ico.bak",
  "D:/AI Video Studio/build-project.old/build-resources/icon.png",
  "D:/AI Video Studio/build-project.old/build-resources/ai-video-studio.ico",
  "D:/AI Video Studio/nova/build/icon.png",
  "D:/AI Video Studio/nova/assets/logo.png",
  "D:/AI Video Studio/nova/web/logo.png",
  "D:/AI Video Studio/resources/app/build/icon.png",
];

for (const f of files) {
  if (!existsSync(f)) {
    console.log(f, "-> MISSING");
    continue;
  }
  const stats = { size: readFileSync(f).length };
  if (f.endsWith(".png")) {
    try {
      const png = PNG.sync.read(readFileSync(f));
      console.log(f, `-> ${png.width}x${png.height} (${stats.size} bytes)`);
    } catch (e) {
      console.log(f, `-> PNG parse error: ${e.message}`);
    }
  } else {
    console.log(f, `-> ICO ${stats.size} bytes`);
  }
}