import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";

const isProd = process.env.NODE_ENV === "production";

// collect every problem so they can all be fixed in one go
const problems: string[] = [];
const need = (key: string, note = "") => {
  if (!process.env[key]) problems.push(`${key} is missing${note}`);
};

need("MONGODB_URI");
need("JWT_SECRET");

if (isProd) {
  // a live site must send real email, know how many proxies sit in front of it, and use a strong signing key
  for (const key of [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "MAIL_FROM",
    "SUPPORT_EMAIL",
    "CLIENT_URL",
    "GROQ_API_KEY",
    "TRUST_PROXY",
  ]) {
    need(key, " (required in production)");
  }
  if (process.env.CLIENT_URL && !process.env.CLIENT_URL.startsWith("https://")) {
    problems.push("CLIENT_URL must start with https:// in production");
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters in production");
  }
} else {
  // not fatal in development, but worth knowing
  if (!process.env.SUPPORT_EMAIL || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Support form and emails won't send: set SUPPORT_EMAIL, SMTP_USER and SMTP_PASS in .env");
  }
  if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is not set: clips will save, but without AI summaries.");
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
  await connectDB();

  // Accounts created before email verification existed count as verified (they have no value yet).
  const { modifiedCount } = await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  if (modifiedCount) console.log(`Marked ${modifiedCount} existing account(s) as verified`);

  const server = app.listen(port, () => console.log(`API on http://localhost:${port}`));

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