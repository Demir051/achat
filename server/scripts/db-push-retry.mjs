import { execSync } from "node:child_process";

const MAX_ATTEMPTS = 8;
const DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  return !!url && url.startsWith("postgresql");
}

export async function pushSchemaWithRetry() {
  if (!hasDatabaseUrl()) {
    console.error("DATABASE_URL tanımlı değil veya geçersiz.");
    console.error("Render → Environment → DATABASE_URL = Neon connection string (?sslmode=require)");
    process.exit(1);
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[db] prisma db push (deneme ${attempt}/${MAX_ATTEMPTS})…`);
      execSync("npx prisma db push --skip-generate", {
        stdio: "inherit",
        env: process.env,
      });
      console.log("[db] Şema güncellendi.");
      return;
    } catch {
      if (attempt === MAX_ATTEMPTS) {
        console.error("[db] Veritabanına bağlanılamadı (P1001). Kontrol listesi:");
        console.error("  1. Neon panelinde proje uyku modundaysa uyandır");
        console.error("  2. DATABASE_URL doğru mu? (?sslmode=require olmalı)");
        console.error("  3. DIRECT_URL = pooler olmayan Neon adresi (önerilir)");
        process.exit(1);
      }
      console.warn(`[db] Bağlantı başarısız, ${DELAY_MS / 1000}s sonra tekrar…`);
      await sleep(DELAY_MS);
    }
  }
}

if (process.argv[1]?.includes("db-push-retry")) {
  await pushSchemaWithRetry();
}
