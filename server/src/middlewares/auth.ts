import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  let payload: { id: string; iat: number };
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { id: string; iat: number };
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // one small lookup per request: deleted accounts and password changes take effect immediately
  const user = await User.findById(payload.id).select("passwordChangedAt sessionsRevokedAt emailVerified");
  if (!user) return res.status(401).json({ error: "Account not found" });
  if (user.emailVerified === false) return res.status(403).json({ error: "Please verify your email first" });

  // a password change or "sign out everywhere" ends every session issued before it
  const cutoff = Math.max(user.passwordChangedAt?.getTime() ?? 0, user.sessionsRevokedAt?.getTime() ?? 0);
  if (cutoff && Math.floor(cutoff / 1000) > payload.iat) {
    return res.status(401).json({ error: "You were signed out. Please log in again." });
  }

  res.locals.userId = payload.id;
  next();
}