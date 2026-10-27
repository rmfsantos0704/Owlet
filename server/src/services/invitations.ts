// Limits that keep invitations from being used to spam people.
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // an unanswered invitation expires after 14 days
export const DECLINE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // after a decline, the same workspace can't re-invite for 7 days
export const MAX_PENDING_PER_WORKSPACE = 20; // open invitations one workspace can have at once
export const MAX_PENDING_PER_USER = 20; // open invitations one person can have waiting at once
export const MAX_MEMBERS = 50; // members + open invitations of a workspace
