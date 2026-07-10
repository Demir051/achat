import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const username = process.argv[2] ?? "achat2";
const email = process.argv[3] ?? "achat2@achat.local";
const password = process.argv[4] ?? "demo1234";

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    console.log(`Hesap zaten var: ${existing.username} (${existing.email})`);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      avatarColor: "#7c6cff",
      theme: "midnight",
    },
  });

  console.log("Yeni hesap oluşturuldu:");
  console.log(`  Kullanıcı adı: ${user.username}`);
  console.log(`  E-posta:       ${user.email}`);
  console.log(`  Şifre:         ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
