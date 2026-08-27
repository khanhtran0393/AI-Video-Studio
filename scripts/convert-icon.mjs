import { writeFileSync } from "node:fs";
import pngToIco from "png-to-ico";

const input = process.argv[2];
const output = process.argv[3];

try {
  const buf = await pngToIco(input);
  writeFileSync(output, buf);
  console.log(`OK: ${input} -> ${output} (${buf.length} bytes)`);
} catch (e) {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
}