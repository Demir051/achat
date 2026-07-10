import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { BOT_TYPES } from "../lib/bots.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const serverAdminRouter = Router({ mergeParams: true });
serverAdminRouter.use(requireAuth);

async function getMember(userId: string, serverId: string) {
  return prisma.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    include: { memberRoles: { include: { role: true } } },
  });
}

function isOwner(member: { role: string } | null, serverOwnerId: string, userId: string) {
  return serverOwnerId === userId || member?.role === "OWNER";
}

// Sunucu ayarları
serverAdminRouter.patch("/settings", async (req: AuthRequest, res) => {
  const serverId = req.params.id!;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) return res.status(404).json({ error: "Sunucu bulunamadı" });
  if (server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  const schema = z.object({
    name: z.string().min(2).max(40).optional(),
    description: z.string().max(500).optional(),
    iconColor: z.string().optional(),
    welcomeEnabled: z.boolean().optional(),
    joinAnnouncements: z.boolean().optional(),
    locked: z.boolean().optional(),
    welcomeChannelId: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz ayarlar" });

  const updated = await prisma.server.update({
    where: { id: serverId },
    data: parsed.data,
  });
  res.json({ server: updated });
});

// Roller
serverAdminRouter.get("/roles", async (req: AuthRequest, res) => {
  const serverId = req.params.id!;
  const member = await getMember(req.userId!, serverId);
  if (!member) return res.status(403).json({ error: "Üye değilsin" });

  const roles = await prisma.role.findMany({
    where: { serverId },
    orderBy: { position: "asc" },
  });
  res.json({ roles });
});

serverAdminRouter.post("/roles", async (req: AuthRequest, res) => {
  const serverId = req.params.id!;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  const schema = z.object({
    name: z.string().min(1).max(32),
    color: z.string().default("#99aab5"),
    mentionable: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz rol" });

  const count = await prisma.role.count({ where: { serverId } });
  const role = await prisma.role.create({
    data: { ...parsed.data, serverId, position: count },
  });
  res.status(201).json({ role });
});

serverAdminRouter.patch("/roles/:roleId", async (req: AuthRequest, res) => {
  const { id: serverId, roleId } = req.params;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  const schema = z.object({
    name: z.string().min(1).max(32).optional(),
    color: z.string().optional(),
    mentionable: z.boolean().optional(),
    position: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz rol" });

  const role = await prisma.role.update({ where: { id: roleId }, data: parsed.data });
  res.json({ role });
});

serverAdminRouter.delete("/roles/:roleId", async (req: AuthRequest, res) => {
  const { id: serverId, roleId } = req.params;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  await prisma.role.delete({ where: { id: roleId } });
  res.json({ ok: true });
});

// Üye rol atama
serverAdminRouter.put("/members/:userId/roles", async (req: AuthRequest, res) => {
  const { id: serverId, userId } = req.params;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  const schema = z.object({ roleIds: z.array(z.string()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz rol listesi" });

  const member = await prisma.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
  });
  if (!member) return res.status(404).json({ error: "Üye bulunamadı" });

  await prisma.memberRole.deleteMany({ where: { memberId: member.id } });
  if (parsed.data.roleIds.length) {
    await prisma.memberRole.createMany({
      data: parsed.data.roleIds.map((roleId) => ({ memberId: member.id, roleId })),
    });
  }

  const roles = await prisma.memberRole.findMany({
    where: { memberId: member.id },
    include: { role: true },
  });
  res.json({ roles: roles.map((r) => r.role) });
});

serverAdminRouter.delete("/members/:userId", async (req: AuthRequest, res) => {
  const { id: serverId, userId } = req.params;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });
  if (userId === server.ownerId) return res.status(400).json({ error: "Sahip atılamaz" });

  await prisma.member.deleteMany({ where: { userId, serverId } });
  res.json({ ok: true });
});

// Botlar
serverAdminRouter.get("/bots", async (req: AuthRequest, res) => {
  const serverId = req.params.id!;
  const member = await getMember(req.userId!, serverId);
  if (!member) return res.status(403).json({ error: "Üye değilsin" });

  const bots = await prisma.serverBot.findMany({ where: { serverId } });
  res.json({ bots, available: Object.values(BOT_TYPES) });
});

serverAdminRouter.post("/bots", async (req: AuthRequest, res) => {
  const serverId = req.params.id!;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  const schema = z.object({
    type: z.string(),
    name: z.string().min(1).max(40).optional(),
    enabled: z.boolean().default(true),
    config: z.record(z.unknown()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz bot" });

  const def = BOT_TYPES[parsed.data.type as keyof typeof BOT_TYPES];
  if (!def) return res.status(400).json({ error: "Bilinmeyen bot tipi" });

  const bot = await prisma.serverBot.create({
    data: {
      serverId,
      type: parsed.data.type,
      name: parsed.data.name ?? def.name,
      enabled: parsed.data.enabled,
      config: JSON.stringify(parsed.data.config ?? def.defaultConfig),
    },
  });
  res.status(201).json({ bot });
});

serverAdminRouter.patch("/bots/:botId", async (req: AuthRequest, res) => {
  const { id: serverId, botId } = req.params;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  const schema = z.object({
    name: z.string().min(1).max(40).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz bot" });

  const data: { name?: string; enabled?: boolean; config?: string } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.config) data.config = JSON.stringify(parsed.data.config);

  const bot = await prisma.serverBot.update({ where: { id: botId }, data });
  res.json({ bot });
});

serverAdminRouter.delete("/bots/:botId", async (req: AuthRequest, res) => {
  const { id: serverId, botId } = req.params;
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server || server.ownerId !== req.userId) return res.status(403).json({ error: "Sadece sunucu sahibi" });

  await prisma.serverBot.delete({ where: { id: botId } });
  res.json({ ok: true });
});

// Üye detayı
serverAdminRouter.get("/members/:userId", async (req: AuthRequest, res) => {
  const { id: serverId, userId } = req.params;
  const member = await getMember(req.userId!, serverId);
  if (!member) return res.status(403).json({ error: "Üye değilsin" });

  const target = await prisma.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    include: {
      user: { select: { id: true, username: true, avatarColor: true, bio: true, statusMessage: true, createdAt: true } },
      memberRoles: { include: { role: true } },
    },
  });
  if (!target) return res.status(404).json({ error: "Üye bulunamadı" });

  res.json({
    member: {
      ...target.user,
      role: target.role,
      joinedAt: target.joinedAt,
      roles: target.memberRoles.map((r) => r.role),
    },
  });
});
