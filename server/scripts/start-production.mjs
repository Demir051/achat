import { spawn } from "node:child_process";
import { pushSchemaWithRetry } from "./db-push-retry.mjs";

await pushSchemaWithRetry();

const child = spawn("node", ["dist/index.js"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
