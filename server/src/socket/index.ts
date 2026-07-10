import type { Server as HttpServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import { env } from "../lib/env.js";
import {
  areFriends,
  isChannelMember,
  isInVoiceRoom,
  isPeerInVoiceRoom,
  isServerMember,
  isVoiceChannel,
} from "../lib/socketAuth.js";
import { verifyToken } from "../lib/jwt.js";
import { processBotCommand } from "../lib/bots.js";
import { containsProfanity, filterProfanity } from "../lib/profanity.js";
import { createSystemMessage } from "../lib/serverMessages.js";
import { prisma } from "../lib/prisma.js";

interface VoiceParticipant {
  socketId: string;
  userId: string;
  username: string;
  avatarColor: string;
  muted: boolean;
  screenSharing: boolean;
}

const voiceRooms = new Map<string, Map<string, VoiceParticipant>>();
const onlineUsers = new Map<string, Set<string>>(); // userId -> socketIds
const msgRate = new Map<string, { count: number; reset: number }>();

interface SocketUser {
  id: string;
  username: string;
  avatarColor: string;
}

function getRoom(channelId: string) {
  let room = voiceRooms.get(channelId);
  if (!room) {
    room = new Map();
    voiceRooms.set(channelId, room);
  }
  return room;
}

function trackOnline(userId: string, socketId: string) {
  let set = onlineUsers.get(userId);
  if (!set) {
    set = new Set();
    onlineUsers.set(userId, set);
  }
  set.add(socketId);
}

function untrackOnline(userId: string, socketId: string) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

function isRateLimited(userId: string, max = 20, windowMs = 10_000) {
  const now = Date.now();
  let entry = msgRate.get(userId);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + windowMs };
    msgRate.set(userId, entry);
  }
  entry.count++;
  return entry.count > max;
}

const rosterTimers = new Map<string, ReturnType<typeof setTimeout>>();

let ioInstance: IOServer | null = null;

export function getIO() {
  return ioInstance;
}

export function initSocket(httpServer: HttpServer) {
  const io = new IOServer(httpServer, {
    cors: {
      origin: env.isProd ? env.clientOrigin : env.clientOrigins,
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  ioInstance = io;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, avatarColor: true },
    });
    if (!user) return next(new Error("unauthorized"));

    (socket.data as { user: SocketUser }).user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;
    trackOnline(user.id, socket.id);
    io.emit("presence:update", { userId: user.id, online: true });

    socket.join(`user:${user.id}`);

    socket.on("server:join", async (serverId: string) => {
      if (typeof serverId !== "string" || !(await isServerMember(user.id, serverId))) return;
      socket.join(`server:${serverId}`);
    });

    socket.on("server:leave", (serverId: string) => {
      if (typeof serverId === "string") socket.leave(`server:${serverId}`);
    });

    socket.on("channel:join", async (channelId: string) => {
      if (typeof channelId !== "string" || !(await isChannelMember(user.id, channelId))) return;
      socket.join(`channel:${channelId}`);
    });

    socket.on("channel:leave", (channelId: string) => {
      if (typeof channelId === "string") socket.leave(`channel:${channelId}`);
    });

    socket.on("channel:typing", async (payload: { channelId: string }) => {
      if (!payload?.channelId || !(await isChannelMember(user.id, payload.channelId))) return;
      socket.to(`channel:${payload.channelId}`).emit("channel:typing", {
        channelId: payload.channelId,
        userId: user.id,
        username: user.username,
      });
    });

    socket.on(
      "channel:message",
      async (payload: { channelId: string; content: string }, ack?: (m: unknown) => void) => {
        const content = payload.content?.trim();
        if (!content || content.length > 2000) {
          ack?.({ error: "Mesaj 1-2000 karakter olmalı" });
          return;
        }
        if (isRateLimited(user.id)) {
          ack?.({ error: "Çok hızlı mesaj gönderiyorsun" });
          return;
        }

        const channel = await prisma.channel.findUnique({ where: { id: payload.channelId } });
        if (!channel) return ack?.({ error: "Kanal bulunamadı" });
        const member = await prisma.member.findUnique({
          where: { userId_serverId: { userId: user.id, serverId: channel.serverId } },
        });
        if (!member) return ack?.({ error: "Erişim yok" });

        const server = await prisma.server.findUnique({
          where: { id: channel.serverId },
          include: { bots: true },
        });
        if (!server) return ack?.({ error: "Sunucu bulunamadı" });

        const profanityBot = server.bots.find((b) => b.type === "PROFANITY_FILTER" && b.enabled);
        let finalContent = content;
        if (profanityBot && containsProfanity(content)) {
          let mode = "filter";
          try {
            mode = JSON.parse(profanityBot.config).mode ?? "filter";
          } catch { /* ignore */ }
          if (mode === "block") {
            ack?.({ error: "Mesajın uygunsuz içerik barındırıyor (küfür filtresi)" });
            return;
          }
          finalContent = filterProfanity(content);
        }

        const message = await prisma.message.create({
          data: { content: finalContent, channelId: payload.channelId, authorId: user.id },
          include: { author: { select: { id: true, username: true, avatarColor: true } } },
        });

        io.to(`channel:${payload.channelId}`).emit("channel:message", message);
        ack?.(message);

        const botReply = processBotCommand(content);
        const funBots = server.bots.filter(
          (b) => b.enabled && ["DICE", "JOKE", "EIGHT_BALL"].includes(b.type),
        );
        if (botReply && funBots.length) {
          const bot = funBots[0];
          await createSystemMessage(payload.channelId, botReply, bot.name, io);
        }
      }
    );

    socket.on(
      "channel:message:edit",
      async (payload: { messageId: string; content: string }, ack?: (m: unknown) => void) => {
        const content = payload.content?.trim();
        if (!content || content.length > 2000) return ack?.({ error: "Geçersiz mesaj" });

        const message = await prisma.message.findUnique({
          where: { id: payload.messageId },
          include: { channel: true },
        });
        if (!message || message.deleted || message.system) return ack?.({ error: "Mesaj bulunamadı" });

        const member = await prisma.member.findUnique({
          where: { userId_serverId: { userId: user.id, serverId: message.channel.serverId } },
        });
        if (!member) return ack?.({ error: "Erişim yok" });

        const server = await prisma.server.findUnique({ where: { id: message.channel.serverId } });
        const canEdit =
          message.authorId === user.id ||
          server?.ownerId === user.id ||
          member.role === "OWNER";
        if (!canEdit) return ack?.({ error: "Düzenleme yetkin yok" });

        const updated = await prisma.message.update({
          where: { id: message.id },
          data: { content, editedAt: new Date() },
          include: { author: { select: { id: true, username: true, avatarColor: true } } },
        });
        io.to(`channel:${message.channelId}`).emit("channel:message:update", updated);
        ack?.(updated);
      },
    );

    socket.on("channel:message:delete", async (payload: { messageId: string }, ack?: (m: unknown) => void) => {
      const message = await prisma.message.findUnique({
        where: { id: payload.messageId },
        include: { channel: true },
      });
      if (!message || message.deleted) return ack?.({ error: "Mesaj bulunamadı" });

      const member = await prisma.member.findUnique({
        where: { userId_serverId: { userId: user.id, serverId: message.channel.serverId } },
      });
      if (!member) return ack?.({ error: "Erişim yok" });

      const server = await prisma.server.findUnique({ where: { id: message.channel.serverId } });
      const canDelete =
        message.authorId === user.id ||
        server?.ownerId === user.id ||
        member.role === "OWNER";
      if (!canDelete) return ack?.({ error: "Silme yetkin yok" });

      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { deleted: true, content: "" },
        include: { author: { select: { id: true, username: true, avatarColor: true } } },
      });
      io.to(`channel:${message.channelId}`).emit("channel:message:update", updated);
      ack?.(updated);
    });

    socket.on(
      "dm:message",
      async (payload: { receiverId: string; content: string }, ack?: (m: unknown) => void) => {
        const content = payload.content?.trim();
        if (!content || content.length > 2000) {
          ack?.({ error: "Mesaj 1-2000 karakter olmalı" });
          return;
        }
        if (isRateLimited(user.id)) {
          ack?.({ error: "Çok hızlı mesaj gönderiyorsun" });
          return;
        }
        if (!(await areFriends(user.id, payload.receiverId))) {
          ack?.({ error: "Sadece arkadaşlarına mesaj gönderebilirsin" });
          return;
        }

        const message = await prisma.directMessage.create({
          data: { content, senderId: user.id, receiverId: payload.receiverId },
          include: { sender: { select: { id: true, username: true, avatarColor: true } } },
        });

        io.to(`user:${payload.receiverId}`).emit("dm:message", message);
        io.to(`user:${user.id}`).emit("dm:message", message);
        ack?.(message);
      }
    );

    socket.on("voice:join", async (channelId: string) => {
      if (typeof channelId !== "string") return;
      if (!(await isChannelMember(user.id, channelId))) return;
      if (!(await isVoiceChannel(channelId))) return;

      const room = voiceRooms.get(channelId);
      if (room && room.size >= 10) {
        socket.emit("voice:error", { error: "Sesli oda dolu (max 10 kişi)" });
        return;
      }

      const prev = (socket.data as { voiceChannel?: string }).voiceChannel;
      if (prev && prev !== channelId) leaveVoice(socket, prev);

      const voiceRoom = getRoom(channelId);

      // Aynı kullanıcının eski/kopuk socket kayıtlarını temizle
      for (const [sid, p] of voiceRoom.entries()) {
        if (p.userId === user.id && sid !== socket.id) {
          voiceRoom.delete(sid);
        }
      }

      const existing = Array.from(voiceRoom.values()).filter((p) => p.userId !== user.id);
      socket.emit("voice:participants", { channelId, participants: existing });

      const participant: VoiceParticipant = {
        socketId: socket.id,
        userId: user.id,
        username: user.username,
        avatarColor: user.avatarColor,
        muted: false,
        screenSharing: false,
      };
      voiceRoom.set(socket.id, participant);
      socket.join(`voice:${channelId}`);
      (socket.data as { voiceChannel?: string }).voiceChannel = channelId;

      socket.to(`voice:${channelId}`).emit("voice:user-joined", { channelId, participant });
      scheduleRoster(channelId);
    });

    socket.on("voice:leave", (channelId: string) => {
      if (typeof channelId === "string") leaveVoice(socket, channelId);
    });

    socket.on(
      "voice:state",
      (payload: { channelId: string; muted?: boolean; screenSharing?: boolean }) => {
        const room = voiceRooms.get(payload.channelId);
        const p = room?.get(socket.id);
        if (!p) return;
        if (typeof payload.muted === "boolean") p.muted = payload.muted;
        if (typeof payload.screenSharing === "boolean") p.screenSharing = payload.screenSharing;
        io.to(`voice:${payload.channelId}`).emit("voice:state", {
          socketId: socket.id,
          userId: user.id,
          muted: p.muted,
          screenSharing: p.screenSharing,
        });
        scheduleRoster(payload.channelId);
      }
    );

    socket.on("webrtc:signal", (payload: { to: string; data: unknown }) => {
      const channelId = (socket.data as { voiceChannel?: string }).voiceChannel;
      if (!channelId || typeof payload.to !== "string") return;
      if (!isInVoiceRoom(socket, channelId, voiceRooms)) return;
      if (!isPeerInVoiceRoom(payload.to, channelId, voiceRooms)) return;
      io.to(payload.to).emit("webrtc:signal", { from: socket.id, data: payload.data });
    });

    socket.on("presence:query", () => {
      socket.emit("presence:list", { online: Array.from(onlineUsers.keys()) });
    });

    socket.on("disconnect", () => {
      const channelId = (socket.data as { voiceChannel?: string }).voiceChannel;
      if (channelId) leaveVoice(socket, channelId);
      const wentOffline = untrackOnline(user.id, socket.id);
      if (wentOffline) io.emit("presence:update", { userId: user.id, online: false });
    });
  });

  function leaveVoice(socket: Socket, channelId: string) {
    const room = voiceRooms.get(channelId);
    let removed = false;
    if (room?.has(socket.id)) {
      room.delete(socket.id);
      removed = true;
      if (room.size === 0) voiceRooms.delete(channelId);
    }
    socket.leave(`voice:${channelId}`);
    if ((socket.data as { voiceChannel?: string }).voiceChannel === channelId) {
      (socket.data as { voiceChannel?: string }).voiceChannel = undefined;
    }
    if (removed) {
      io.to(`voice:${channelId}`).emit("voice:user-left", { channelId, socketId: socket.id });
      scheduleRoster(channelId);
    }
  }

  function scheduleRoster(channelId: string) {
    const existing = rosterTimers.get(channelId);
    if (existing) clearTimeout(existing);
    rosterTimers.set(
      channelId,
      setTimeout(() => {
        rosterTimers.delete(channelId);
        broadcastVoiceRoster(channelId);
      }, 300)
    );
  }

  async function broadcastVoiceRoster(channelId: string) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return;
    const room = voiceRooms.get(channelId);
    const participants = room ? Array.from(room.values()) : [];
    io.to(`server:${channel.serverId}`).emit("voice:roster", { channelId, participants });
  }

  return io;
}
