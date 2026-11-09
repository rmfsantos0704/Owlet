import { AiUsage } from "../models/AiUsage.js";
import { User } from "../models/User.js";

const DEFAULT_DAILY_LIMIT = 2;

export function aiDailyUserLimit() {
  const configured = Number(process.env.AI_USER_DAILY_LIMIT);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT;
}

function currentUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

export type AiDailyUsage = {
  used: number;
  limit: number;
  remaining: number;
};

export class AiQuotaExceededError extends Error {
  constructor() {
    super("Daily AI allowance reached.");
    this.name = "AiQuotaExceededError";
  }
}

// thrown when the person turned AI features off in their account
export class AiOptedOutError extends Error {
  constructor() {
    super("AI features are turned off for this account.");
    this.name = "AiOptedOutError";
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

// true when this person turned AI features off in their account settings
export async function aiOptedOut(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select("aiOptOut").lean();
  return !!user?.aiOptOut;
}

export async function aiAvailableForUser(userId: string): Promise<boolean> {
  if (await aiOptedOut(userId)) return false;
  const usage = await aiDailyUsageForUser(userId);
  return usage.remaining > 0;
}

export async function aiDailyUsageForUser(userId: string): Promise<AiDailyUsage> {
  const usage = await AiUsage.findOne({ userId, day: currentUtcDay() }).select("generations").lean();
  const limit = aiDailyUserLimit();
  const used = usage?.generations ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function reserveAiGeneration(userId: string): Promise<void> {
  // every AI call passes through here, so this is where "AI off" is enforced for all of them
  if (await aiOptedOut(userId)) throw new AiOptedOutError();

  const day = currentUtcDay();
  const query = { userId, day, generations: { $lt: aiDailyUserLimit() } };
  const updated = await AiUsage.findOneAndUpdate(query, { $inc: { generations: 1 } }, { returnDocument: "after" });
  if (updated) return;

  try {
    await AiUsage.create({ userId, day, generations: 1 });
    return;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  const retried = await AiUsage.findOneAndUpdate(
    query,
    { $inc: { generations: 1 } },
    { returnDocument: "after" }
  );
  if (!retried) throw new AiQuotaExceededError();
}

// Gives back a reservation when the providers failed, so a failed attempt doesn't use up the daily allowance.
export async function refundAiGeneration(userId: string): Promise<void> {
  await AiUsage.updateOne({ userId, day: currentUtcDay(), generations: { $gt: 0 } }, { $inc: { generations: -1 } });
}