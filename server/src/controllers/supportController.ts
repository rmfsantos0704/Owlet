import { createHash } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { sendMail } from "../services/mailer.js";

const schema = z.object({
  topic: z.string().trim().min(1).max(80),
  message: z.string().trim().min(10).max(4000),
  page: z.string().max(300).optional(),
  browser: z.string().max(300).optional(),
  website: z.string().max(200).optional(), // honeypot: hidden in the form, so only bots fill it in
  elapsedMs: z.number().int().min(0).optional(), // how long the form was open before sending
});

// Spam guards (the route also limits each account to 5 messages an hour)
const MIN_FILL_MS = 2000; // a person can't open the form, write 10+ characters and send in under 2 seconds
const COOLDOWN_MS = 60 * 1000; // wait a minute between messages
const DUPLICATE_MS = 10 * 60 * 1000; // the same message can't be sent twice within 10 minutes
const MAX_LINKS = 2; // spam is mostly links

// In memory, so it resets on restart. That's fine for spam control; use Redis if you run several servers.
const lastSent = new Map<string, { at: number; hash: string }>();

function prune(now: number) {
  if (lastSent.size < 1000) return;
  for (const [key, v] of lastSent) if (now - v.at > DUPLICATE_MS) lastSent.delete(key);
}

// POST /support  { topic, message, page?, browser?, website?, elapsedMs? }
// Emails the Owlet support inbox. The person's account email is the Reply-To, so answering goes straight to them.
export async function sendSupport(req: Request, res: Response) {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Please write a message of at least 10 characters." });

  // Bots fill the hidden field or submit instantly. Say "sent" so they don't learn what tripped them; nothing is emailed.
  if (p.data.website || (p.data.elapsedMs !== undefined && p.data.elapsedMs < MIN_FILL_MS)) {
    return res.json({ ok: true });
  }

  const links = p.data.message.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > MAX_LINKS) {
    return res.status(400).json({ error: "Please remove some of the links from your message and try again." });
  }

  const me = await User.findById(res.locals.userId).select("email");
  if (!me) return res.status(401).json({ error: "Please log in again." });

  const now = Date.now();
  const key = String(me._id);
  const hash = createHash("sha256").update(p.data.message.toLowerCase().replace(/\s+/g, " ")).digest("hex");
  const prev = lastSent.get(key);
  if (prev && now - prev.at < COOLDOWN_MS) {
    return res.status(429).json({ error: "Please wait a minute before sending another message." });
  }
  if (prev && prev.hash === hash && now - prev.at < DUPLICATE_MS) {
    return res.status(429).json({ error: "You already sent this message. We'll reply as soon as we can." });
  }

  const to = process.env.SUPPORT_EMAIL;
  if (!to) {
    console.error("Support email isn't configured: set SUPPORT_EMAIL (and SMTP settings in production)");
    return res.status(503).json({ error: "Support email isn't available right now. Please try again later." });
  }

  const topic = p.data.topic.replace(/[\r\n]+/g, " "); // keeps a pasted newline out of the subject line
  try {
    await sendMail({
      to,
      replyTo: me.email,
      subject: `[Owlet support] ${topic}`,
      text: [
        p.data.message,
        "",
        "---",
        `From: ${me.email}`,
        `Account id: ${String(me._id)}`,
        `Page: ${p.data.page ?? "unknown"}`,
        `Browser: ${p.data.browser ?? "unknown"}`,
      ].join("\n"),
    });
    lastSent.set(key, { at: now, hash });
    prune(now);
    res.json({ ok: true });
  } catch (err) {
    console.error("Support email failed:", err);
    res.status(502).json({ error: "We couldn't send your message. Please try again in a few minutes." });
  }
}