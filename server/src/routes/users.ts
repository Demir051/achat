import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const userRouter = Router();
userRouter.use(requireAuth);

const publicUser = { id: true, username: true, avatarColor: true } as const;

// Kullanıcı adına göre ara
userRouter.get("/search", async (req: AuthRequest, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: { username: { contains: q }, NOT: { id: req.userId } },
    select: publicUser,
    take: 10,
  });
  res.json({ users });
});

// Arkadaş listesi + bekleyen istekler
userRouter.get("/friends", async (req: AuthRequest, res) => {
  const uid = req.userId!;
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: uid }, { addresseeId: uid }] },
    include: {
      requester: { select: publicUser },
      addressee: { select: publicUser },
    },
  });

  const friends = friendships
    .filter((f) => f.status === "ACCEPTED")
    .map((f) => (f.requesterId === uid ? f.addressee : f.requester));

  const incoming = friendships
    .filter((f) => f.status === "PENDING" && f.addresseeId === uid)
    .map((f) => ({ friendshipId: f.id, user: f.requester }));

  const outgoing = friendships
    .filter((f) => f.status === "PENDING" && f.requesterId === uid)
    .map((f) => ({ friendshipId: f.id, user: f.addressee }));

  res.json({ friends, incoming, outgoing });
});

// Arkadaşlık isteği gönder
userRouter.post("/friends/request", async (req: AuthRequest, res) => {
  const schema = z.object({ username: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Kullanıcı adı gerekli" });

  const target = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!target) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  if (target.id === req.userId) return res.status(400).json({ error: "Kendinize istek gönderemezsiniz" });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: req.userId!, addresseeId: target.id },
        { requesterId: target.id, addresseeId: req.userId! },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: "Zaten bir istek veya arkadaşlık mevcut" });

  await prisma.friendship.create({
    data: { requesterId: req.userId!, addresseeId: target.id, status: "PENDING" },
  });
  res.status(201).json({ ok: true });
});

// İsteği kabul et
userRouter.post("/friends/:friendshipId/accept", async (req: AuthRequest, res) => {
  const fr = await prisma.friendship.findUnique({ where: { id: req.params.friendshipId } });
  if (!fr || fr.addresseeId !== req.userId) return res.status(404).json({ error: "İstek bulunamadı" });

  await prisma.friendship.update({
    where: { id: fr.id },
    data: { status: "ACCEPTED" },
  });
  res.json({ ok: true });
});

// İsteği reddet / arkadaşlığı sil
userRouter.delete("/friends/:friendshipId", async (req: AuthRequest, res) => {
  const fr = await prisma.friendship.findUnique({ where: { id: req.params.friendshipId } });
  if (!fr || (fr.addresseeId !== req.userId && fr.requesterId !== req.userId)) {
    return res.status(404).json({ error: "İstek bulunamadı" });
  }
  await prisma.friendship.delete({ where: { id: fr.id } });
  res.json({ ok: true });
});
