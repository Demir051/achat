import { createServer } from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { authRouter } from "./routes/auth.js";
import { serverRouter } from "./routes/servers.js";
import { messageRouter } from "./routes/messages.js";
import { userRouter } from "./routes/users.js";
import { dmRouter } from "./routes/dm.js";
import { profileRouter } from "./routes/profile.js";
import { loginRegisterLimiter, apiLimiter } from "./middleware/rateLimit.js";
import { initSocket } from "./socket/index.js";

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: env.isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: env.isProd ? env.clientOrigin : env.clientOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "64kb" }));
app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, name: "achat", version: "2.0" })
);

app.use("/api/auth", authRouter);
app.use("/api/servers", serverRouter);
app.use("/api/messages", messageRouter);
app.use("/api/users", userRouter);
app.use("/api/dm", dmRouter);
app.use("/api/profile", profileRouter);

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`⚡ achat sunucusu http://localhost:${env.port} üzerinde çalışıyor`);
});
