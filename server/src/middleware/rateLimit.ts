import rateLimit from "express-rate-limit";
import { env } from "../lib/env.js";

export const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 15 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla giriş/kayıt denemesi. Biraz bekleyip tekrar dene." },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.isProd ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "İstek limiti aşıldı. Lütfen bekleyin." },
});
