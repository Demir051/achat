import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET ortam değişkeni üretimde zorunludur");
}

const defaultOrigins = ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"];

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  clientOrigins: process.env.CLIENT_ORIGIN
    ? [process.env.CLIENT_ORIGIN]
    : defaultOrigins,
  isProd,
};
