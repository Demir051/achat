import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const messageRouter = Router();
messageRouter.use(requireAuth);

messageRouter.get("/channel/:channelId", async (req: AuthRequest, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
  if (!channel) return res.status(404).json({ error: "Kanal bulunamadı" });

  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: channel.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Erişim yok" });

  const before = req.query.before as string | undefined;
  const take = Math.min(Number(req.query.limit) || 50, 100);

  const messages = await prisma.message.findMany({
    where: {
      channelId: channel.id,
      deleted: false,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { author: { select: { id: true, username: true, avatarColor: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  res.json({ messages: messages.reverse(), hasMore: messages.length === take });
});

messageRouter.patch("/:id", async (req: AuthRequest, res) => {
  const schema = z.object({ content: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz mesaj" });

  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { channel: true },
  });
  if (!message || message.deleted || message.system) {
    return res.status(404).json({ error: "Mesaj bulunamadı" });
  }

  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: message.channel.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Erişim yok" });

  const server = await prisma.server.findUnique({ where: { id: message.channel.serverId } });
  const canEdit =
    message.authorId === req.userId ||
    server?.ownerId === req.userId ||
    member.role === "OWNER";

  if (!canEdit) return res.status(403).json({ error: "Düzenleme yetkin yok" });

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { content: parsed.data.content.trim(), editedAt: new Date() },
    include: { author: { select: { id: true, username: true, avatarColor: true } } },
  });

  res.json({ message: updated });
});

messageRouter.delete("/:id", async (req: AuthRequest, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { channel: true },
  });
  if (!message || message.deleted) return res.status(404).json({ error: "Mesaj bulunamadı" });

  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId: req.userId!, serverId: message.channel.serverId } },
  });
  if (!member) return res.status(403).json({ error: "Erişim yok" });

  const server = await prisma.server.findUnique({ where: { id: message.channel.serverId } });
  const canDelete =
    message.authorId === req.userId ||
    server?.ownerId === req.userId ||
    member.role === "OWNER";

  if (!canDelete) return res.status(403).json({ error: "Silme yetkin yok" });

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { deleted: true, content: "" },
    include: { author: { select: { id: true, username: true, avatarColor: true } } },
  });

  res.json({ message: updated });
});
