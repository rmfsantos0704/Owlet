import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { getEnvironmentProblems } from "./config/environment.js";
import { initializeApplication } from "./config/startup.js";

const isProd = process.env.NODE_ENV === "production";
const aiOn = process.env.AI_ENABLED === "true";
const problems = getEnvironmentProblems(isProd);

if (!isProd) {
  // not fatal in development, but worth knowing
  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!process.env.SUPPORT_EMAIL || (!process.env.RESEND_API_KEY && !smtpConfigured)) {
    console.warn("Support form and emails won't send: set SUPPORT_EMAIL and configure RESEND_API_KEY or SMTP settings in .env");
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn("JWT_SECRET is shorter than 32 characters. Production will refuse to start with it.");
  }
}

if (problems.length) {
  console.error("Can't start. Fix these environment variables:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const port = Number(process.env.PORT) || 4000;

async function main() {
  await initializeApplication();

  const server = app.listen(port, () => console.log(`API on http://localhost:${port}`));
  console.log(`AI features: ${aiOn ? "on" : "off"}`);

  // a host's proxy keeps connections open longer than Node's 5 second default, which causes random 502 errors
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // hosts send SIGTERM when they replace the server during a deploy: finish open requests, then exit
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // don't hang forever
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});