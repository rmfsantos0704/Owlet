export function getEnvironmentProblems(isProd: boolean): string[] {
  const problems: string[] = [];
  const need = (key: string, note = "") => {
    if (!process.env[key]) problems.push(`${key} is missing${note}`);
  };

  need("MONGODB_URI");
  need("JWT_SECRET");

  const aiOn = process.env.AI_ENABLED === "true";
  if (
    process.env.AI_USER_DAILY_LIMIT &&
    (!Number.isInteger(Number(process.env.AI_USER_DAILY_LIMIT)) || Number(process.env.AI_USER_DAILY_LIMIT) < 1)
  ) {
    problems.push("AI_USER_DAILY_LIMIT must be a positive whole number");
  }
  if (aiOn) {
    const providerKeys = [
      "GROQ_API_KEY",
      "GEMINI_API_KEY",
      "OPENROUTER_API_KEY",
    ];
    if (!providerKeys.some((key) => process.env[key])) {
      problems.push(`At least one AI provider key is required when AI_ENABLED=true (${providerKeys.join(", ")})`);
    }
    if (process.env.GEMINI_API_KEY) need("GEMINI_MODEL", " (required when GEMINI_API_KEY is set)");
    if (process.env.OPENROUTER_API_KEY) need("OPENROUTER_MODEL", " (required when OPENROUTER_API_KEY is set)");
    if (process.env.OPENROUTER_MODEL && !process.env.OPENROUTER_MODEL.endsWith(":free")) {
      problems.push("OPENROUTER_MODEL must use a :free model when AI_ENABLED=true");
    }
  }

  if (isProd) {
    for (const key of [
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASS",
      "MAIL_FROM",
      "SUPPORT_EMAIL",
      "CLIENT_URL",
      "TRUST_PROXY",
    ]) {
      need(key, " (required in production)");
    }
    if (process.env.CLIENT_URL && !process.env.CLIENT_URL.startsWith("https://")) {
      problems.push("CLIENT_URL must start with https:// in production");
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      problems.push("JWT_SECRET must be at least 32 characters in production");
    }
  }

  return problems;
}
