import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { loginRegisterLimiter } from "../middleware/rateLimit.js";

export const authRouter = Router();

const userSelect = {
  id: true,
  username: true,
  email: true,
  avatarColor: true,
  bio: true,
  theme: true,
  micDeviceId: true,
  speakerDeviceId: true,
  statusMessage: true,
} as const;
const COLORS = ["#5865F2", "#EB459E", "#57F287", "#FEE75C", "#ED4245", "#3BA55D", "#FAA61A", "#9B59B6"];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const registerSchema = z.object({
  username: z.string().min(2).max(24),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/register", loginRegisterLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geçersiz bilgiler", details: parsed.error.flatten() });
  }
  const { username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return res.status(409).json({ error: "Bu kullanıcı adı veya e-posta zaten kayıtlı" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashed, avatarColor: randomColor() },
  });

  const token = signToken({ userId: user.id, username: user.username });
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: userSelect });
  res.status(201).json({ token, user: profile });
});

authRouter.post("/login", loginRegisterLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geçersiz bilgiler" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "E-posta veya şifre hatalı" });
  }

  const token = signToken({ userId: user.id, username: user.username });
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: userSelect });
  res.json({ token, user: profile });
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: userSelect,
  });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  res.json({ user });
});
