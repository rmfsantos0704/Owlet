import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Check, GraduationCap, LockKeyhole, Mail, MailCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { useCooldown } from "../../hooks/useCooldown";
import { OCCUPATIONS } from "../../utils/occupations";
import { passwordProblem } from "../../utils/password";
import AuthShell, { AuthCard, Banner } from "../../components/auth/AuthShell";
import AuthField from "../../components/auth/AuthField";
import AuthSelect from "../../components/auth/AuthSelect";
import PasswordStrength from "../../components/auth/PasswordStrength";
import { PrimaryButton, TextButton } from "../../components/auth/AppButton";

type Form = { email: string; occupation: string; age: string; password: string; confirm: string };
type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (!f.occupation) e.occupation = "Choose what best describes you.";

  const age = Number(f.age);
  if (!f.age.trim()) e.age = "Enter your age.";
  else if (!Number.isInteger(age)) e.age = "Use a whole number.";
  else if (age < 13) e.age = "You must be at least 13 to use Owlet.";
  else if (age > 120) e.age = "Enter a valid age.";

  const pw = passwordProblem(f.password, f.email);
  if (pw) e.password = pw;
  if (!f.confirm) e.confirm = "Re-enter your password.";
  else if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
  return e;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState<Form>({ email: "", occupation: "", age: "", password: "", confirm: "" });
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [resendNote, setResendNote] = useState("");
  const cooldown = useCooldown();

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = attempted ? validate(form) : {};
  const matches = form.confirm.length > 0 && form.confirm === form.password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setError("");
    if (Object.keys(validate(form)).length > 0) return;

    setBusy(true);
    try {
      const email = form.email.trim();
      await register({
        email,
        password: form.password,
        confirmPassword: form.confirm,
        age: Number(form.age),
        occupation: form.occupation,
      });
      setSentTo(email);
      cooldown.start(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResendNote("");
    try {
      await api("/auth/resend-verification", { method: "POST", body: { email: sentTo } });
      setResendNote("A new link is on its way.");
      cooldown.start(60);
    } catch (err) {
      setResendNote(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (sentTo) {
    return (
      <AuthShell>
        <AuthCard
          title="Check your email"
          footer={
            <Link to="/login" className="font-semibold text-blue-700 hover:underline">
              Back to log in
            </Link>
          }
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <MailCheck className="size-6" />
          </div>
          <p className="text-sm leading-6 text-slate-600">
            We sent a confirmation link to <span className="font-semibold text-slate-800">{sentTo}</span>. Open it to
            activate your account. The link expires in 24 hours.
          </p>
          <p className="mt-2 text-xs text-slate-400">Can't find it? Check your spam folder.</p>
          <div className="mt-4 flex items-center gap-2">
            <TextButton onClick={resend} disabled={cooldown.left > 0}>
              {cooldown.left > 0 ? `Resend in ${cooldown.left}s` : "Resend email"}
            </TextButton>
            {resendNote ? <span className="text-xs text-slate-500">{resendNote}</span> : null}
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <AuthCard
          title="Create your account"
          subtitle="Start clipping and organizing research."
          footer={
            <>
              Have an account?{" "}
              <Link to="/login" className="font-semibold text-blue-700 hover:underline">
                Log in
              </Link>
            </>
          }
        >
          <div className="space-y-4">
            <AuthField
              type="email"
              placeholder="Email address"
              icon={Mail}
              value={form.email}
              onChange={set("email")}
              error={errors.email}
              autoComplete="email"
              inputMode="email"
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_7.5rem]">
              <AuthSelect
                placeholder="I am a…"
                icon={GraduationCap}
                value={form.occupation}
                onChange={set("occupation")}
                options={OCCUPATIONS}
                error={errors.occupation}
              />
              <AuthField
                type="number"
                placeholder="Age"
                icon={CalendarDays}
                value={form.age}
                onChange={set("age")}
                error={errors.age}
                inputMode="numeric"
                min={13}
                max={120}
              />
            </div>
            <p className="-mt-2 text-xs text-slate-400">
              You must be 13 or older. Other Owlet users can't see your age or role.
            </p>

            <AuthField
              type="password"
              placeholder="Password (8+ characters)"
              icon={LockKeyhole}
              value={form.password}
              onChange={set("password")}
              error={errors.password}
              autoComplete="new-password"
              maxLength={72}
            />
            <PasswordStrength password={form.password} />
            <AuthField
              type="password"
              placeholder="Confirm password"
              icon={LockKeyhole}
              value={form.confirm}
              onChange={set("confirm")}
              error={errors.confirm}
              autoComplete="new-password"
              maxLength={72}
            />
            {matches && !errors.confirm ? (
              <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <Check className="size-3.5" /> Passwords match
              </p>
            ) : null}

            {error ? <Banner kind="error">{error}</Banner> : null}

            <PrimaryButton busy={busy} busyLabel="Creating account…">
              Create account
            </PrimaryButton>
          </div>
        </AuthCard>
      </form>
    </AuthShell>
  );
}