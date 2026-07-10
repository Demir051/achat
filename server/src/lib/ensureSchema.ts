import { execSync } from "node:child_process";

const MAX_ATTEMPTS = 8;
const DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureSchema() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_DB_PUSH === "1") return;

  const url = process.env.DATABASE_URL?.trim();
  if (!url?.startsWith("postgresql")) {
    console.error("[db] DATABASE_URL tanımlı değil veya geçersiz.");
    process.exit(1);
  }

  if (!process.env.DIRECT_URL?.trim()) {
    console.warn("[db] DIRECT_URL yok — pooler olmayan Neon adresini env olarak ekle.");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[db] prisma db push (deneme ${attempt}/${MAX_ATTEMPTS})…`);
      execSync("npx prisma db push --skip-generate", {
        stdio: "inherit",
        env: process.env,
      });
      console.log("[db] Veritabanı şeması hazır.");
      return;
    } catch {
      if (attempt === MAX_ATTEMPTS) {
        console.error("[db] Şema uygulanamadı. Kontrol et:");
        console.error("  - Neon projesi aktif mi?");
        console.error("  - DATABASE_URL (pooler) + DIRECT_URL (direct) doğru mu?");
        console.error("  - Her ikisinde ?sslmode=require var mı?");
        process.exit(1);
      }
      console.warn(`[db] Bağlantı başarısız, ${DELAY_MS / 1000}s sonra tekrar…`);
      await sleep(DELAY_MS);
    }
  }
}
