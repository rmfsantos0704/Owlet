import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";

for (const key of ["MONGODB_URI", "JWT_SECRET"]) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

if (process.env.NODE_ENV === "production") {
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
    if (!process.env[key]) throw new Error(`Missing env var in production: ${key}`);
  }
  if (!process.env.CLIENT_URL!.startsWith("https://")) throw new Error("CLIENT_URL must start with https:// in production");
  if (process.env.JWT_SECRET!.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production");
} else if (!process.env.SUPPORT_EMAIL || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  // not fatal in development, but the Contact support form can't send without these
  console.warn("Support form won't send email: set SUPPORT_EMAIL, SMTP_USER and SMTP_PASS in .env");
}

const port = process.env.PORT || 4000;

connectDB().then(async () => {
  // Accounts created before email verification existed count as verified (they have no value yet).
  const { modifiedCount } = await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  if (modifiedCount) console.log(`Marked ${modifiedCount} existing account(s) as verified`);

  app.listen(port, () => console.log(`API on http://localhost:${port}`));
});