import { Router } from "express";

import { nanoid } from "nanoid";

import { z } from "zod";

import { getDefaultBots, getDefaultRoles } from "../lib/bots.js";

import { handleMemberJoin } from "../lib/serverMessages.js";

import { prisma } from "../lib/prisma.js";

import { getIO } from "../socket/index.js";

import { requireAuth, type AuthRequest } from "../middleware/auth.js";

import { serverAdminRouter } from "./serverAdmin.js";



export const serverRouter = Router();

serverRouter.use(requireAuth);



const ICONS = ["#5865F2", "#EB459E", "#57F287", "#FAA61A", "#ED4245", "#9B59B6", "#1ABC9C"];

const randomIcon = () => ICONS[Math.floor(Math.random() * ICONS.length)];

serverRouter.get("/", async (req: AuthRequest, res) => {

  const memberships = await prisma.member.findMany({

    where: { userId: req.userId },

    include: { server: true },

    orderBy: { joinedAt: "asc" },

  });

  res.json({ servers: memberships.map((m) => m.server) });

});



serverRouter.post("/", async (req: AuthRequest, res) => {

  const schema = z.object({ name: z.string().min(2).max(40) });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Sunucu adı 2-40 karakter olmalı" });



  const server = await prisma.server.create({

    data: {

      name: parsed.data.name,

      iconColor: randomIcon(),

      inviteCode: nanoid(8),

      ownerId: req.userId!,

      members: { create: { userId: req.userId!, role: "OWNER" } },

      channels: {

        create: [

          { name: "genel", type: "TEXT", position: 0 },

          { name: "sohbet", type: "TEXT", position: 1 },

          { name: "Sesli Oda", type: "VOICE", position: 2 },

        ],

      },

      roles: { create: getDefaultRoles() },

      bots: { create: getDefaultBots() },

    },

    include: { channels: true },

  });



  const genel = server.channels.find((c) => c.name === "genel");

  if (genel) {

    await prisma.server.update({

      where: { id: server.id },

      data: { welcomeChannelId: genel.id },

    });

  }



  res.status(201).json({ server });

});



serverRouter.post("/join", async (req: AuthRequest, res) => {

  const schema = z.object({ inviteCode: z.string().min(1) });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Davet kodu gerekli" });



  const server = await prisma.server.findUnique({ where: { inviteCode: parsed.data.inviteCode.trim() } });

  if (!server) return res.status(404).json({ error: "Geçersiz davet kodu" });



  const already = await prisma.member.findUnique({

    where: { userId_serverId: { userId: req.userId!, serverId: server.id } },

  });

  if (already) return res.json({ server });



  const user = await prisma.user.findUnique({ where: { id: req.userId! } });

  const member = await prisma.member.create({

    data: { userId: req.userId!, serverId: server.id, role: "MEMBER" },

  });



  const everyoneRole = await prisma.role.findFirst({

    where: { serverId: server.id, name: "everyone" },

  });

  if (everyoneRole) {

    await prisma.memberRole.create({

      data: { memberId: member.id, roleId: everyoneRole.id },

    });

  }



  if (user) {

    await handleMemberJoin(server.id, user.id, user.username, getIO());

  }



  res.status(201).json({ server });

});



serverRouter.get("/:id", async (req: AuthRequest, res) => {

  const member = await prisma.member.findUnique({

    where: { userId_serverId: { userId: req.userId!, serverId: req.params.id } },

  });

  if (!member) return res.status(403).json({ error: "Bu sunucunun üyesi değilsiniz" });



  const server = await prisma.server.findUnique({

    where: { id: req.params.id },

    include: {

      channels: { orderBy: { position: "asc" } },

      roles: { orderBy: { position: "asc" } },

      bots: true,

      members: {

        include: {

          user: { select: { id: true, username: true, avatarColor: true, bio: true, statusMessage: true } },

          memberRoles: { include: { role: true } },

        },

      },

    },

  });

  if (!server) return res.status(404).json({ error: "Sunucu bulunamadı" });



  res.json({

    server: {

      id: server.id,

      name: server.name,

      iconColor: server.iconColor,

      description: server.description,

      inviteCode: server.inviteCode,

      ownerId: server.ownerId,

      welcomeEnabled: server.welcomeEnabled,

      joinAnnouncements: server.joinAnnouncements,

      welcomeChannelId: server.welcomeChannelId,

      channels: server.channels,

      roles: server.roles,

      bots: server.bots,

      members: server.members.map((m) => ({

        ...m.user,

        role: m.role,

        joinedAt: m.joinedAt,

        roles: m.memberRoles.map((mr) => mr.role),

      })),

    },

  });

});



serverRouter.post("/:id/channels", async (req: AuthRequest, res) => {

  const schema = z.object({

    name: z.string().min(1).max(40),

    type: z.enum(["TEXT", "VOICE"]),

  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Geçersiz kanal bilgisi" });



  const server = await prisma.server.findUnique({ where: { id: req.params.id } });

  if (!server) return res.status(404).json({ error: "Sunucu bulunamadı" });

  if (server.ownerId !== req.userId) {

    return res.status(403).json({ error: "Sadece sunucu sahibi kanal oluşturabilir" });

  }



  const count = await prisma.channel.count({ where: { serverId: server.id } });

  const channel = await prisma.channel.create({

    data: {

      name: parsed.data.name,

      type: parsed.data.type,

      position: count,

      serverId: server.id,

    },

  });

  res.status(201).json({ channel });

});



serverRouter.delete("/:id/leave", async (req: AuthRequest, res) => {

  const server = await prisma.server.findUnique({ where: { id: req.params.id } });

  if (!server) return res.status(404).json({ error: "Sunucu bulunamadı" });



  if (server.ownerId === req.userId) {

    await prisma.server.delete({ where: { id: server.id } });

    return res.json({ deleted: true });

  }



  await prisma.member.deleteMany({ where: { userId: req.userId!, serverId: server.id } });

  res.json({ left: true });

});

serverRouter.use("/:id", serverAdminRouter);


