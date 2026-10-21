export function passwordStrength(pw: string) {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 8) return { score: 0, label: "Too short" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  let score = 1;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (classes >= 3) score++;
  score = Math.min(score, 4);
  return { score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][score] };
}

// the same rules the server enforces, so people see problems before submitting
export function passwordProblem(pw: string, email = ""): string | undefined {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 72) return "Use 72 characters or fewer.";
  if (email && pw.toLowerCase() === email.trim().toLowerCase()) return "Your password can't be your email.";
  return undefined;
}