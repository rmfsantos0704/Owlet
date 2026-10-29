import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { Invitation } from "../models/Invitation.js";
import { Activity, NotificationState } from "../models/Activity.js";
import { sendMail } from "../services/mailer.js";
import * as tpl from "../services/emailTemplates.js";
import {
  ageField, emailField, passwordField, signToken, sha256, newToken, fire, claimEmailSlot,
} from "./authController.js";

const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;
const LINK_ERROR = "This link is invalid or has expired.";
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Please check your details and try again.";

// Wrong *password* answers use 403, never 401: the dashboard treats any 401 as "session expired" and logs out.
const wrongPassword = (res: Response) =>
  res.status(403).json({ error: "Your current password is incorrect.", code: "WRONG_PASSWORD" });

async function loadUserWithPassword(res: Response, password: string) {
  const user = await User.findById(res.locals.userId);
  if (!user) {
    res.status(401).json({ error: "Account not found" });
    return null;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    wrongPassword(res);
    return null;
  }
  return user;
}

const passwordBody = z.string().min(1, "Enter your current password").max(1000);

// ---------- read ----------

export async function getAccount(_req: Request, res: Response) {
  const id = res.locals.userId;
  const user = await User.findById(id).select(
    "email age emailVerified pendingEmail createdAt termsVersion termsAcceptedAt"
  );
  if (!user) return res.status(404).json({ error: "User not found" });

  // shared collections need a decision before an account can be deleted, so the page needs their members
  const owned = await collection.find({ ownerId: id }).select("name isDefault members").lean();
  const memberIds = [...new Set(owned.flatMap((w) => w.members.map((m) => String(m.userId))))];
  const people = memberIds.length ? await User.find({ _id: { $in: memberIds } }).select("email").lean() : [];
  const emailOf = (uid: unknown) => people.find((p) => String(p._id) === String(uid))?.email ?? "unknown";

  res.json({
    account: {
      email: user.email,
      age: user.age,
      pendingEmail: user.pendingEmail ?? null,
      createdAt: user.createdAt,
      termsVersion: user.termsVersion ?? null,
    },
    ownedcollections: owned.map((w) => ({
      id: String(w._id),
      name: w.name,
      isDefault: !!w.isDefault,
      members: w.members.map((m) => ({ userId: String(m.userId), email: emailOf(m.userId), role: m.role })),
    })),
  });
}

// ---------- password ----------

export async function changePassword(req: Request, res: Response) {
  const p = z
    .object({ currentPassword: passwordBody, newPassword: passwordField, confirmPassword: z.string() })
    .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] })
    .refine((d) => d.newPassword !== d.currentPassword, {
      message: "Your new password must be different from the current one.",
      path: ["newPassword"],
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: firstError(p.error) });

  const user = await loadUserWithPassword(res, p.data.currentPassword);
  if (!user) return;

  const passwordHash = await bcrypt.hash(p.data.newPassword, 12);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash, passwordChangedAt: new Date() } });
  fire(sendMail(tpl.passwordChangedEmail(user.email)));

  // Every other session just ended, and so did this one's old token, so hand back a fresh one.
  res.json({ ok: true, token: signToken(user.id) });
}

// ---------- email ----------

export async function requestEmailChange(req: Request, res: Response) {
  const p = z.object({ newEmail: emailField, password: passwordBody }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: firstError(p.error) });
  const { newEmail } = p.data;

  const user = await loadUserWithPassword(res, p.data.password);
  if (!user) return;
  if (newEmail === user.email) return res.status(400).json({ error: "That's already your email address." });
  if (await User.findOne({ email: newEmail })) return res.status(409).json({ error: "That email is already in use." });
  if (!(await claimEmailSlot(user._id))) {
    return res.status(429).json({ error: "Please wait a minute before requesting another email." });
  }

  const token = newToken();
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        pendingEmail: newEmail,
        emailChangeTokenHash: sha256(token),
        emailChangeExpires: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
      },
    }
  );
  fire(sendMail(tpl.emailChangeEmail(newEmail, token)));
  fire(sendMail(tpl.emailChangeRequestedNotice(user.email, newEmail)));
  res.status(202).json({ pendingEmail: newEmail });
}

export async function cancelEmailChange(_req: Request, res: Response) {
  await User.updateOne(
    { _id: res.locals.userId },
    { $unset: { pendingEmail: "", emailChangeTokenHash: "", emailChangeExpires: "" } }
  );
  res.json({ ok: true });
}

// Public (the link may be opened in another browser): the token proves the new inbox is theirs.
export async function confirmEmailChange(req: Request, res: Response) {
  const p = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: LINK_ERROR });
  const hash = sha256(p.data.token);

  const user = await User.findOne({ emailChangeTokenHash: hash, emailChangeExpires: { $gt: new Date() } }).select(
    "email pendingEmail"
  );
  if (!user?.pendingEmail) return res.status(400).json({ error: LINK_ERROR });
  const oldEmail = user.email;
  const newEmail = user.pendingEmail;

  try {
    const r = await User.updateOne(
      { _id: user._id, emailChangeTokenHash: hash },
      {
        $set: { email: newEmail, emailVerified: true, sessionsRevokedAt: new Date() }, // every session ends
        $unset: { pendingEmail: "", emailChangeTokenHash: "", emailChangeExpires: "" },
      }
    );
    if (!r.matchedCount) return res.status(400).json({ error: LINK_ERROR });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return res.status(409).json({ error: "That email address is now used by another account." });
    }
    throw err;
  }

  fire(sendMail(tpl.emailChangedNotice(oldEmail, newEmail)));
  res.json({ ok: true });
}

// ---------- sessions ----------

export async function signOutEverywhere(_req: Request, res: Response) {
  await User.updateOne({ _id: res.locals.userId }, { $set: { sessionsRevokedAt: new Date() } });
  res.json({ ok: true });
}

// ---------- download my data ----------

export async function exportData(_req: Request, res: Response) {
  const id = String(res.locals.userId);
  const user = await User.findById(id).select(
    "email age emailVerified createdAt termsVersion termsAcceptedAt"
  );
  if (!user) return res.status(404).json({ error: "User not found" });

  const owned = await collection.find({ ownerId: id }).lean();
  const ownedIds = new Set(owned.map((w) => String(w._id)));
  const memberships = await collection.find({ "members.userId": id }).select("name members").lean();

  const everyone = [...new Set([...owned.flatMap((w) => w.members.map((m) => String(m.userId)))])];
  const people = everyone.length ? await User.find({ _id: { $in: everyone } }).select("email").lean() : [];
  const emailOf = (uid: unknown) => people.find((p) => String(p._id) === String(uid))?.email ?? "unknown";

  const ownedItems = ownedIds.size
    ? await ResearchItem.find({ collectionId: { $in: [...ownedIds] } }).limit(5000).lean()
    : [];
  const myClips = await ResearchItem.find({ userId: id }).select("collectionId source citations aiOutput tags createdAt").lean();
  const commented = await ResearchItem.find({ "comments.userId": id }).select("collectionId source.title comments").lean();

  const strip = <T extends Record<string, unknown>>(o: T) => {
    const { __v, ...rest } = o as T & { __v?: unknown };
    void __v;
    return rest;
  };

  res.json({
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      age: user.age,
      createdAt: user.createdAt,
      agreedToTermsVersion: user.termsVersion ?? null,
      agreedToTermsAt: user.termsAcceptedAt ?? null,
    },
    collectionsYouOwn: owned.map((w) => ({
      ...strip(w),
      members: w.members.map((m) => ({ email: emailOf(m.userId), role: m.role, addedAt: m.addedAt })),
      clips: ownedItems.filter((i) => String(i.collectionId) === String(w._id)).map(strip),
    })),
    collectionsYouBelongTo: memberships.map((w) => ({
      name: w.name,
      yourRole: w.members.find((m) => String(m.userId) === id)?.role,
    })),
    yourClipsInOtherscollections: myClips.filter((c) => !ownedIds.has(String(c.collectionId))).map(strip),
    yourCommentsInOtherscollections: commented
      .filter((c) => !ownedIds.has(String(c.collectionId)))
      .map((c) => ({
        clipTitle: c.source?.title,
        comments: c.comments.filter((m) => String(m.userId) === id).map((m) => ({ text: m.text, createdAt: m.createdAt })),
      })),
  });
}

// ---------- delete account ----------

const decisionSchema = z.union([
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("transfer"), to: z.string() }),
]);

export async function deleteAccount(req: Request, res: Response) {
  const p = z
    .object({ password: passwordBody, collections: z.record(z.string(), decisionSchema).default({}) })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: firstError(p.error) });

  const user = await loadUserWithPassword(res, p.data.password);
  if (!user) return;
  const id = String(user._id);

  // 1. Work out what happens to every collection this person owns BEFORE touching anything.
  const owned = await collection.find({ ownerId: id });
  const plan: { ws: (typeof owned)[number]; action: "delete" | "transfer"; to?: string }[] = [];
  const undecided: string[] = [];

  for (const ws of owned) {
    const memberIds = ws.members.map((m) => String(m.userId));
    const choice = p.data.collections[String(ws._id)];
    if (memberIds.length === 0) {
      plan.push({ ws, action: "delete" }); // nobody else is in it
    } else if (!choice) {
      undecided.push(ws.name);
    } else if (choice.action === "delete") {
      plan.push({ ws, action: "delete" });
    } else if (memberIds.includes(choice.to)) {
      plan.push({ ws, action: "transfer", to: choice.to });
    } else {
      return res.status(400).json({ error: `Choose a current member of "${ws.name}" to take it over.` });
    }
  }
  if (undecided.length) {
    return res.status(400).json({
      error: `Decide what happens to your shared collections: ${undecided.join(", ")}.`,
      code: "collection_DECISION_REQUIRED",
    });
  }

  // 2. Do the work. The account itself goes last, so a failure part-way can simply be retried.
  for (const step of plan) {
    if (step.action === "delete") {
      await ResearchItem.deleteMany({ collectionId: step.ws._id });
      await Invitation.deleteMany({ collectionId: step.ws._id });
      await Activity.deleteMany({ collectionId: step.ws._id });
      await collection.deleteOne({ _id: step.ws._id });
    } else {
      // isDefault off: the new owner may already have their own Personal collection (one per owner)
      await collection.updateOne(
        { _id: step.ws._id },
        { $set: { ownerId: step.to, isDefault: false }, $pull: { members: { userId: step.to } } }
      );
    }
  }
  await collection.updateMany({ "members.userId": id }, { $pull: { members: { userId: id } } });

  // What they added to collections owned by others stays with those collections, minus their identity.
  await ResearchItem.updateMany({ userId: id }, { $set: { userId: null } });
  await ResearchItem.updateMany(
    { "comments.userId": id },
    { $set: { "comments.$[c].userId": null, "comments.$[c].authorEmail": "Deleted user" } },
    { arrayFilters: [{ "c.userId": new mongoose.Types.ObjectId(id) }] }
  );

  // invitations sent to or by this person go with the account
  await Invitation.deleteMany({ $or: [{ inviteeId: id }, { inviterId: id }] });

  // their activity and notification state go with the account
  await Activity.deleteMany({ $or: [{ actorId: id }, { targetUserId: id }] });
  await NotificationState.deleteOne({ userId: id });

  await User.deleteOne({ _id: id });
  fire(sendMail(tpl.accountDeletedEmail(user.email)));
  res.json({ ok: true });
}