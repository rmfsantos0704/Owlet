// Fill in every [bracketed] value, then have a lawyer review both documents before you launch.
// While any bracket is left, the Terms and Privacy pages show a visible "draft" banner.
export const LEGAL = {
  appName: "Owlet",
  operator: "[Your full name or company name]",
  contactEmail: "[your support email address]",
  address: "[City, Country]",
  governingLaw: "[the laws of the Republic of the Philippines]",
  hostingProviders: "[your hosting providers, e.g. Render and Vercel]",
  emailProvider: "[your email delivery provider]",
  backupDays: "[number of]",
  // keep termsVersion identical to TERMS_VERSION in the server's authController.ts
  termsVersion: "2026-10-21",
  lastUpdated: "October 21, 2026",
} as const;

export const hasPlaceholders = Object.values(LEGAL).some((v) => v.includes("["));