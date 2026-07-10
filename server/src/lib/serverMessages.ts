import type { Server as IOServer } from "socket.io";
import { prisma } from "./prisma.js";
import { BOT_TYPES } from "./bots.js";

export type MessagePayload = {
  id: string;
  content: string;
  channelId: string;
  authorId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  system: boolean;
  botLabel: string | null;
  author: { id: string; username: string; avatarColor: string } | null;
};

export async function createSystemMessage(
  channelId: string,
  content: string,
  botLabel: string,
  io?: IOServer | null,
): Promise<MessagePayload> {
  const message = await prisma.message.create({
    data: { content, channelId, system: true, botLabel, authorId: null },
    include: { author: { select: { id: true, username: true, avatarColor: true } } },
  });
  io?.to(`channel:${channelId}`).emit("channel:message", message);
  return message;
}

export async function handleMemberJoin(
  serverId: string,
  userId: string,
  username: string,
  io?: IOServer | null,
) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { channels: { where: { type: "TEXT" }, orderBy: { position: "asc" }, take: 1 }, bots: true },
  });
  if (!server) return;

  const channelId =
    server.welcomeChannelId ??
    server.channels[0]?.id;
  if (!channelId) return;

  if (server.joinAnnouncements) {
    await createSystemMessage(
      channelId,
      `📥 **${username}** sunucuya katıldı!`,
      "Sistem",
      io,
    );
  }

  const welcomeBot = server.bots.find((b) => b.type === "WELCOME" && b.enabled);
  if (server.welcomeEnabled && welcomeBot) {
    let template = BOT_TYPES.WELCOME.defaultConfig.message;
    try {
      const cfg = JSON.parse(welcomeBot.config);
      if (cfg.message) template = cfg.message;
    } catch { /* ignore */ }
    const msg = template.replace(/\{user\}/g, username);
    await createSystemMessage(channelId, msg, welcomeBot.name, io);
  }
}
