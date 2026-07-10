/**
 * TMDB backdrop görsellerini indirir (dizi temaları).
 * Kaynak: themoviedb.org — yalnızca geliştirme / kişisel kullanım.
 */
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../client/public/wallpapers");

const WALLPAPERS: Record<string, string> = {
  "dark-series.jpg": "3jDXL4Xvj3AzDOF6UH1xeyHW8MH.jpg",
  "westeros.jpg": "2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg",
  "heisenberg.jpg": "tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  "hawkins.jpg": "56v2KjBlU4XaOv9rVYEQypROD7P.jpg",
  "nightcity.jpg": "q8eejQcg1bAqImEV8jh8RtBD4uH.jpg",
};

async function download(name: string, filePath: string) {
  const url = `https://media.themoviedb.org/t/p/original/${filePath}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${name}: HTTP ${res.status}`);
  const dest = path.join(OUT, name);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(dest));
  console.log(`✓ ${name}`);
}

await mkdir(OUT, { recursive: true });
for (const [name, filePath] of Object.entries(WALLPAPERS)) {
  await download(name, filePath);
}
console.log("Tüm dizi arka planları indirildi.");
