import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";

for (const key of ["MONGODB_URI", "JWT_SECRET"]) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

if (process.env.NODE_ENV === "production") {
  // a live site must be able to send real email and must have a strong signing key
  for (const key of ["SMTP_HOST", "MAIL_FROM", "CLIENT_URL"]) {
    if (!process.env[key]) throw new Error(`Missing env var in production: ${key}`);
  }
  if (process.env.JWT_SECRET!.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const port = process.env.PORT || 4000;

connectDB().then(async () => {
  // Accounts created before email verification existed count as verified (they have no value yet).
  const { modifiedCount } = await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  if (modifiedCount) console.log(`Marked ${modifiedCount} existing account(s) as verified`);

  app.listen(port, () => console.log(`API on http://localhost:${port}`));
});