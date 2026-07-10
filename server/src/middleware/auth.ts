import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Yetkilendirme gerekli" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum" });
  }

  req.userId = payload.userId;
  req.username = payload.username;
  next();
}
