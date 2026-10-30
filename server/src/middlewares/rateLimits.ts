import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// Shared rate limiters. Import the one you need in a route file.
//
// The per-IP limits for the routes without a login (/api/auth/*) are in app.ts. That only works if Express
// knows about your proxy: set TRUST_PROXY=1 when you deploy behind Render, Railway, Nginx, etc.
// Otherwise every request shares the proxy's IP.
//
// User-keyed limiters are for routes behind requireAuth. They key on res.locals.userId, so a shared
// school or office IP doesn't lock everyone out. Never put one on a route without requireAuth.

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

// ---- login: failed attempts counted per email address, on top of the per-IP limit in app.ts ----
export const loginPerEmailLimiter = rateLimit({
  windowMs: HOUR,
  limit: 20,
  skipSuccessfulRequests: true, // only failed logins count
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "no-email";
  },
  message: { error: "Too many failed attempts for this account. Try again in an hour, or reset your password." },
});

// ---- account changes: each one checks the current password, so cap guessing ----
export const accountSensitiveLimiter = make(15 * MIN, 5, true, "Too many attempts. Try again in a few minutes.");

// ---- daily caps on routes that cost AI quota ----
export const clipDailyLimiter = make(DAY, 300, true, "Daily clip limit reached. Try again tomorrow.");
export const importDailyLimiter = make(DAY, 100, true, "Daily import limit reached. Try again tomorrow.");

// ---- AI routes on a clip or the workspace: regenerate, test, ask ----
export const aiMinuteLimiter = make(MIN, 10, true, "Too many AI requests. Wait a minute.");
export const aiDailyLimiter = make(DAY, 200, true, "Daily AI limit reached. Try again tomorrow.");

// ---- sharing ----
export const inviteMinuteLimiter = make(MIN, 20, true, tooMany);
export const inviteHourlyLimiter = make(HOUR, 30, true, "You've sent a lot of invitations. Try again in an hour.");
export const joinLinkManageLimiter = make(HOUR, 20, true, tooMany); // create / revoke
export const joinLinkUseLimiter = make(15 * MIN, 30, true, tooMany); // preview + join, stops token guessing

// ---- loose baseline for ordinary writes (highlights, comments, tags, create collection) ----
export const writeLimiter = make(MIN, 120, true, tooMany);