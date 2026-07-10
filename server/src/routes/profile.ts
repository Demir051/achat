import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const publicProfile = {
  id: true,
  username: true,
  email: true,
  avatarColor: true,
  bio: true,
  theme: true,
  micDeviceId: true,
  speakerDeviceId: true,
  statusMessage: true,
  createdAt: true,
} as const;

profileRouter.get("/me", async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: publicProfile,
  });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  res.json({ user });
});

const updateSchema = z.object({
  username: z.string().min(2).max(24).optional(),
  bio: z.string().max(200).optional(),
  theme: z.string().max(40).optional(),
  micDeviceId: z.string().max(200).optional(),
  speakerDeviceId: z.string().max(200).optional(),
  statusMessage: z.string().max(100).optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

profileRouter.patch("/me", async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz bilgiler" });

  if (parsed.data.username) {
    const taken = await prisma.user.findFirst({
      where: { username: parsed.data.username, NOT: { id: req.userId } },
    });
    if (taken) return res.status(409).json({ error: "Bu kullanıcı adı alınmış" });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
    select: publicProfile,
  });
  res.json({ user });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(72),
});

profileRouter.patch("/me/password", async (req: AuthRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Geçersiz şifre bilgisi" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!ok) return res.status(401).json({ error: "Mevcut şifre hatalı" });

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  res.json({ ok: true });
});
