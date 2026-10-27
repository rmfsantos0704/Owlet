import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// Shared rate limiters. Import the one you need in a route file.
//
// IP-keyed limiters (for routes without a login) use the default key, which is the client IP.
// That only works if Express knows about your proxy: in app.ts, set app.set("trust proxy", 1)
// when you deploy behind Render, Railway, Nginx, etc. Otherwise every request shares the proxy's IP.
//
// User-keyed limiters are for routes behind requireAuth. They key on res.locals.userId, so a shared
// school or office IP doesn't lock everyone out.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const byUser = (_req: Request, res: Response) => String(res.locals.userId);

function make(windowMs: number, limit: number, perUser: boolean, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(perUser ? { keyGenerator: byUser } : {}),
    message: { error: message },
  });
}

const tooMany = "Too many requests. Please wait a bit and try again.";

// ---- login-less routes (by IP) ----
export const loginLimiter = make(15 * MIN, 10, false, "Too many login attempts. Try again in a few minutes.");
export const registerLimiter = make(HOUR, 5, false, "Too many sign-ups from this network. Try again later.");
export const emailActionLimiter = make(HOUR, 10, false, tooMany); // forgot-password, resend-verification
export const resetPasswordLimiter = make(15 * MIN, 10, false, tooMany);

// ---- account changes: each one checks the current password, so cap guessing ----
export const accountSensitiveLimiter = make(15 * MIN, 5, true, "Too many attempts. Try again in a few minutes.");

// ---- AI-backed routes: every call costs money and quota ----
export const clipLimiter = make(MIN, 30, true, "You're clipping too fast. Wait a minute.");
export const clipDailyLimiter = make(DAY, 300, true, "Daily clip limit reached. Try again tomorrow.");
export const importLimiter = make(MIN, 10, true, "Too many imports. Wait a minute.");
export const importDailyLimiter = make(DAY, 100, true, "Daily import limit reached. Try again tomorrow.");

// ---- sharing ----
export const inviteMinuteLimiter = make(MIN, 20, true, tooMany);
export const inviteHourlyLimiter = make(HOUR, 30, true, "You've sent a lot of invitations. Try again in an hour.");
export const joinLinkManageLimiter = make(HOUR, 20, true, tooMany); // create / revoke
export const joinLinkUseLimiter = make(15 * MIN, 30, true, tooMany); // preview + join, stops token guessing

// ---- loose baseline for ordinary writes (highlights, comments, tags, create collection) ----
export const writeLimiter = make(MIN, 120, true, tooMany);
