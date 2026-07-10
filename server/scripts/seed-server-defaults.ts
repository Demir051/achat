import { getDefaultBots, getDefaultRoles } from "../src/lib/bots.js";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const servers = await prisma.server.findMany({
    include: { roles: true, bots: true, channels: { take: 1, orderBy: { position: "asc" } } },
  });

  for (const server of servers) {
    let updated = false;

    if (server.roles.length === 0) {
      await prisma.role.createMany({
        data: getDefaultRoles().map((r) => ({ ...r, serverId: server.id })),
      });
      console.log(`✓ ${server.name}: varsayılan roller eklendi`);
      updated = true;
    }

    if (server.bots.length === 0) {
      await prisma.serverBot.createMany({
        data: getDefaultBots().map((b) => ({ ...b, serverId: server.id })),
      });
      console.log(`✓ ${server.name}: varsayılan botlar eklendi`);
      updated = true;
    }

    if (!server.welcomeChannelId && server.channels[0]) {
      await prisma.server.update({
        where: { id: server.id },
        data: { welcomeChannelId: server.channels[0].id },
      });
      console.log(`✓ ${server.name}: karşılama kanalı ayarlandı`);
      updated = true;
    }

    if (!updated) {
      console.log(`— ${server.name}: zaten güncel`);
    }
  }

  console.log("\nTamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
