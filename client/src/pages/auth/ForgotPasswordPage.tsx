import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, MailCheck } from "lucide-react";
import { api } from "../../services/api";
import { useCooldown } from "../../hooks/useCooldown";
import AuthShell, { AuthCard, Banner } from "../../components/auth/AuthShell";
import AuthField from "../../components/auth/AuthField";
import { PrimaryButton, TextButton } from "../../components/auth/AppButton";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function send() {
    setError("");
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setSent(true);
      cooldown.start(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (emailValid) void send();
  }

  const back = (
    <Link to="/login" className="font-semibold text-blue-700 hover:underline">
      Back to log in
    </Link>
  );

  if (sent) {
    return (
      <AuthShell>
        <AuthCard title="Check your inbox" footer={back}>
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <MailCheck className="size-6" />
          </div>
          <p className="text-sm leading-6 text-slate-600">
            If an account exists for <span className="font-semibold text-slate-800">{email.trim()}</span>, we sent a link
            to reset its password. The link expires in 30 minutes and works once.
          </p>
          <p className="mt-2 text-xs text-slate-400">Can't find it? Check your spam folder.</p>
          {error ? (
            <div className="mt-3">
              <Banner kind="error">{error}</Banner>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TextButton onClick={send} disabled={busy || cooldown.left > 0}>
              {cooldown.left > 0 ? `Resend in ${cooldown.left}s` : "Resend link"}
            </TextButton>
            <TextButton onClick={() => setSent(false)}>Use a different email</TextButton>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <AuthCard
          title="Reset your password"
          subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
          footer={back}
        >
          <div className="space-y-4">
            <AuthField
              type="email"
              placeholder="Email address"
              icon={Mail}
              value={email}
              onChange={setEmail}
              error={attempted && !emailValid ? "Enter a valid email address." : undefined}
              autoComplete="email"
              inputMode="email"
              autoFocus
            />
            {error ? <Banner kind="error">{error}</Banner> : null}
            <PrimaryButton busy={busy} busyLabel="Sending…">
              Send reset link
            </PrimaryButton>
          </div>
        </AuthCard>
      </form>
    </AuthShell>
  );
}