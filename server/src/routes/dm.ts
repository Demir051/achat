import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { areFriends } from "../lib/socketAuth.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const dmRouter = Router();
dmRouter.use(requireAuth);

const publicUser = { id: true, username: true, avatarColor: true } as const;

dmRouter.get("/:otherUserId", async (req: AuthRequest, res) => {
  const uid = req.userId!;
  const other = req.params.otherUserId;

  if (!(await areFriends(uid, other))) {
    return res.status(403).json({ error: "Sadece arkadaşlarınla mesajlaşabilirsin" });
  }

  const before = req.query.before as string | undefined;
  const take = Math.min(Number(req.query.limit) || 50, 100);

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: uid, receiverId: other },
        { senderId: other, receiverId: uid },
      ],
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: { sender: { select: publicUser } },
    orderBy: { createdAt: "desc" },
    take,
  });

  res.json({ messages: messages.reverse(), hasMore: messages.length === take });
});
