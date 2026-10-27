import { Schema, model } from "mongoose";

// One document per (collection, invitee). Re-inviting the same person reuses it, so a person can never
// have more than one invitation to the same collection, and a decline can be remembered for a cooldown.
const invitationSchema = new Schema(
  {
    collectionId: { type: Schema.Types.ObjectId, ref: "collection", required: true },
    inviterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inviteeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["editor", "viewer"], required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    expiresAt: { type: Date, required: true },
    respondedAt: Date,
  },
  { timestamps: true }
);

invitationSchema.index({ collectionId: 1, inviteeId: 1 }, { unique: true });
invitationSchema.index({ inviteeId: 1, status: 1 });

export const Invitation = model("Invitation", invitationSchema);
