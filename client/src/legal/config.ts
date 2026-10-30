// Fill in every [bracketed] value, then have a lawyer review both documents before you launch.
// While any bracket is left, the Terms and Privacy pages show a visible "draft" banner.
export const LEGAL = {
  appName: "Owlet",
  operator: "Russel Matthew Santos",
  contactEmail: "owlet0704@gmail.com",
  address: "Bataan, Philippines",
  governingLaw: "the laws of the Republic of the Philippines",
  hostingProviders: "Render Vercel]",
  emailProvider: "Resend",
  backupDays: "30",
  // keep termsVersion identical to TERMS_VERSION in the server's authController.ts
  termsVersion: "2026-10-30",
  lastUpdated: "October 30, 2026",
} as const;

export const hasPlaceholders = Object.values(LEGAL).some((v) => v.includes("["));