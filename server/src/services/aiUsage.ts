import { AiUsage } from "../models/AiUsage.js";

const DEFAULT_DAILY_LIMIT = 2;

export function aiDailyUserLimit() {
  const configured = Number(process.env.AI_USER_DAILY_LIMIT);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT;
}

function currentUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

export class AiQuotaExceededError extends Error {
  constructor() {
    super("Daily AI allowance reached.");
    this.name = "AiQuotaExceededError";
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function aiAvailableForUser(userId: string): Promise<boolean> {
  const usage = await AiUsage.findOne({ userId, day: currentUtcDay() }).select("generations").lean();
  return (usage?.generations ?? 0) < aiDailyUserLimit();
}

export async function reserveAiGeneration(userId: string): Promise<void> {
  const day = currentUtcDay();
  const query = { userId, day, generations: { $lt: aiDailyUserLimit() } };
  const updated = await AiUsage.findOneAndUpdate(query, { $inc: { generations: 1 } }, { new: true });
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
    { new: true }
  );
  if (!retried) throw new AiQuotaExceededError();
}
