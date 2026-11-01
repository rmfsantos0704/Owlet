export function getEnvironmentProblems(isProd: boolean): string[] {
  const problems: string[] = [];
  const need = (key: string, note = "") => {
    if (!process.env[key]) problems.push(`${key} is missing${note}`);
  };

  need("MONGODB_URI");
  need("JWT_SECRET");

  const aiOn = process.env.AI_ENABLED === "true";
  if (aiOn) need("GROQ_API_KEY", " (required when AI_ENABLED=true)");

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
