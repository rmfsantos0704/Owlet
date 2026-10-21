import { Schema, model } from "mongoose";

export const OCCUPATIONS = ["student", "teacher", "researcher", "professional", "other"] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    age: { type: Number, min: 13, max: 120 },
    occupation: { type: String, enum: OCCUPATIONS },

    // No schema default on purpose: accounts created before verification existed have no value
    // here and must keep working. Only an explicit `false` means "not verified yet".
    emailVerified: { type: Boolean },

    // only SHA-256 hashes of the emailed tokens are stored, and never returned by queries
    verifyTokenHash: { type: String, select: false },
    verifyTokenExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },

    lastEmailAt: Date, // throttles every account email to one per minute
    passwordChangedAt: Date, // sessions issued before this stop working
  },
  { timestamps: true }
);

export const User = model("User", userSchema);