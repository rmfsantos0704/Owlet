import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const signToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

export async function register(req: Request, res: Response) {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Valid email and 8+ char password required" });
  }
  const { email, password } = parsed.data;
  if (await User.findOne({ email })) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: signToken(user.id), user: { id: user.id, email: user.email } });
}

export async function login(req: Request, res: Response) {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });

  const user = await User.findOne({ email: parsed.data.email });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email } });
}

export async function me(_req: Request, res: Response) {
  const user = await User.findById(res.locals.userId).select("email createdAt");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
}