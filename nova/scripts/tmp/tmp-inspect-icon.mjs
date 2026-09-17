import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const data = readFileSync("D:/AI Video Studio/build/icon.png");
const png = PNG.sync.read(data);
console.log("width:", png.width, "height:", png.height);