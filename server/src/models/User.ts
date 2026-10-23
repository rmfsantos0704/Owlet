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

    // email change: the new address only replaces the old one after its owner clicks the emailed link
    pendingEmail: { type: String, lowercase: true, trim: true },
    emailChangeTokenHash: { type: String, select: false },
    emailChangeExpires: { type: Date, select: false },

    lastEmailAt: Date, // throttles every account email to one per minute
    passwordChangedAt: Date, // sessions issued before this stop working
    sessionsRevokedAt: Date, // "sign out everywhere": same effect

    termsVersion: String, // which version of the Terms/Privacy Policy they agreed to
    termsAcceptedAt: Date,
  },
  { timestamps: true }
);

export const User = model("User", userSchema);