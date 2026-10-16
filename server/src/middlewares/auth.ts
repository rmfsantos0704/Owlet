import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { id: string };
    res.locals.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}