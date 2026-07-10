import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = join(__dirname, "../public/ChatGPT Image 10 Tem 2026 19_13_50.png");
const logoOut = join(__dirname, "../public/logo.png");
const faviconOut = join(__dirname, "../public/favicon.png");

function removeNearWhite(data, threshold = 245) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }
  return data;
}

async function makeTransparentPng(inputPath, outputPath, resize = null) {
  let pipeline = sharp(inputPath).ensureAlpha();
  if (resize) pipeline = pipeline.resize(resize, resize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  removeNearWhite(data);

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);
}

await makeTransparentPng(input, logoOut);
await makeTransparentPng(input, faviconOut, 64);
console.log("Created logo.png and favicon.png with transparent background");
