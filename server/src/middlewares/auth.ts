import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  let payload: jwt.JwtPayload;
  try {
    // only accept the algorithm tokens are signed with (signToken uses the default, HS256)
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET!, { algorithms: ["HS256"] });
    if (typeof decoded === "string") throw new Error("Unexpected token payload");
    payload = decoded;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const id = payload.id;
  const iat = payload.iat;
  if (typeof id !== "string" || !mongoose.isValidObjectId(id) || typeof iat !== "number") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // one small lookup per request: deleted accounts and password changes take effect immediately
  const user = await User.findById(id).select("passwordChangedAt sessionsRevokedAt emailVerified");
  if (!user) return res.status(401).json({ error: "Account not found" });
  if (user.emailVerified === false) return res.status(403).json({ error: "Please verify your email first" });

  // a password change or "sign out everywhere" ends every session issued before it
  const cutoff = Math.max(user.passwordChangedAt?.getTime() ?? 0, user.sessionsRevokedAt?.getTime() ?? 0);
  if (cutoff && Math.floor(cutoff / 1000) > iat) {
    return res.status(401).json({ error: "You were signed out. Please log in again." });
  }

  res.locals.userId = id;
  next();
}