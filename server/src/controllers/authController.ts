import crypto from "node:crypto";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User, OCCUPATIONS } from "../models/User.js";
import { sendMail } from "../services/mailer.js";
import * as tpl from "../services/emailTemplates.js";

export const TERMS_VERSION = "2026-10-21"; // bump together with LEGAL.termsVersion on the client
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 60 * 1000;
const LINK_ERROR = "This link is invalid or has expired.";

// computed once; lets login take the same time whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync("owlet-timing-equalizer", 12);

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890",
  "11111111", "00000000", "qwertyui", "qwerty123", "qwertyuiop", "iloveyou", "letmein1", "welcome1",
  "admin123", "abc12345", "abcd1234", "monkey123", "football1", "baseball1", "sunshine1", "princess1",
]);

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const newToken = () => crypto.randomBytes(32).toString("hex");
export const fire = (p: Promise<unknown>) => void p.catch((err) => console.error("Auth email failed:", err));
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Please check your details and try again.";

export const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
export const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "That password is too common. Choose a different one.");
const tokenField = z.string().regex(/^[a-f0-9]{64}$/, LINK_ERROR);

export const ageField = z.coerce
  .number("Enter your age")
  .int("Enter your age as a whole number")
  .min(13, "You must be at least 13 to use Owlet")
  .max(120, "Enter a valid age");
export const occupationField = z.enum(OCCUPATIONS, "Choose what best describes you");

const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    age: ageField,
    occupation: occupationField,
    acceptTerms: z.any().refine((v) => v === true, "You need to agree to the Terms and Privacy Policy to continue"),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] })
  .refine((d) => d.password.toLowerCase() !== d.email, { message: "Your password can't be your email", path: ["password"] });

const emailOnlySchema = z.object({ email: emailField });
const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(1000) });
const tokenOnlySchema = z.object({ token: tokenField });
const resetSchema = z
  .object({ token: tokenField, password: passwordField, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export const signToken = (id: string) => jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

// Atomically takes this account's "one email per minute" slot. False means an email just went out.
export async function claimEmailSlot(userId: unknown) {
  const r = await User.updateOne(
    {
      _id: userId,
      $or: [{ lastEmailAt: null }, { lastEmailAt: { $lt: new Date(Date.now() - EMAIL_COOLDOWN_MS) } }],
    },
    { $set: { lastEmailAt: new Date() } }
  );
  return r.matchedCount === 1;
}

async function issueVerification(user: { _id: unknown; email: string }) {
  const token = newToken();
  await User.updateOne(
    { _id: user._id },
    { $set: { verifyTokenHash: sha256(token), verifyTokenExpires: new Date(Date.now() + VERIFY_TTL_MS) } }
  );
  await sendMail(tpl.verifyEmail(user.email, token));
}

async function issueReset(user: { _id: unknown; email: string }) {
  const token = newToken();
  await User.updateOne(
    { _id: user._id },
    { $set: { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + RESET_TTL_MS) } }
  );
  await sendMail(tpl.resetEmail(user.email, token));
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { email, password, age, occupation } = parsed.data;

  // Hash first, in every case, so response time doesn't reveal whether the email is already registered.
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });

  if (existing && existing.emailVerified !== false) {
    // A real account already uses this email: tell its owner by email, reveal nothing to the requester.
    if (await claimEmailSlot(existing._id)) fire(sendMail(tpl.alreadyRegisteredEmail(email)));
  } else if (existing) {
    // Never-verified registration: the newest submission wins, so nobody can pre-claim someone else's address.
    await User.updateOne(
      { _id: existing._id },
      { $set: { passwordHash, age, occupation, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() } }
    );
    if (await claimEmailSlot(existing._id)) fire(issueVerification(existing));
  } else {
    try {
      const user = await User.create({
        email, passwordHash, age, occupation,
        emailVerified: false,
        lastEmailAt: new Date(),
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(),
      });
      fire(issueVerification(user));
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err; // lost a race with a parallel signup: same answer
    }
  }

  // The same answer whatever happened above.
  res.status(202).json({ message: "Check your email to finish creating your account." });
}

export async function verifyEmail(req: Request, res: Response) {
  const parsed = tokenOnlySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: LINK_ERROR });

  // Safe to click twice (mail scanners often open links first), so the token stays valid until it expires.
  const user = await User.findOneAndUpdate(
    { verifyTokenHash: sha256(parsed.data.token), verifyTokenExpires: { $gt: new Date() } },
    { $set: { emailVerified: true } }
  );
  if (!user) return res.status(400).json({ error: LINK_ERROR });
  res.json({ ok: true });
}

export async function resendVerification(req: Request, res: Response) {
  const parsed = emailOnlySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });

  const user = await User.findOne({ email: parsed.data.email });
  if (user && user.emailVerified === false && (await claimEmailSlot(user._id))) fire(issueVerification(user));
  res.status(202).json({ message: "If that account needs verifying, we've sent a new link." });
}

export async function forgotPassword(req: Request, res: Response) {
  const parsed = emailOnlySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });

  const user = await User.findOne({ email: parsed.data.email });
  if (user && (await claimEmailSlot(user._id))) fire(issueReset(user));
  res.status(202).json({ message: "If an account exists for that email, we've sent a reset link." });
}

export async function resetPassword(req: Request, res: Response) {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { token, password } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 12);
  // One atomic step: only a valid, unexpired token matches, and it is consumed in the same operation.
  const user = await User.findOneAndUpdate(
    { resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } },
    {
      // opening the emailed link proves they own the inbox, so this also verifies the address
      $set: { passwordHash, passwordChangedAt: new Date(), emailVerified: true },
      $unset: { resetTokenHash: "", resetTokenExpires: "" },
    }
  );
  if (!user) return res.status(400).json({ error: LINK_ERROR });

  fire(sendMail(tpl.passwordChangedEmail(user.email)));
  res.json({ ok: true });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter your email and password" });
  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Incorrect email or password" });

  // Only someone who knows the password learns the account exists but isn't verified.
  if (user.emailVerified === false) {
    return res.status(403).json({ error: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email } });
}

export async function me(_req: Request, res: Response) {
  const user = await User.findById(res.locals.userId).select("email age occupation emailVerified createdAt");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      age: user.age,
      occupation: user.occupation,
      emailVerified: user.emailVerified !== false,
      createdAt: user.createdAt,
    },
  });
}