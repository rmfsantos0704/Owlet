import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../services/api";
import { useCooldown } from "../../hooks/useCooldown";
import AuthShell, { AuthCard, Banner } from "../../components/auth/AuthShell";
import AuthField from "../../components/auth/AuthField";
import { PrimaryButton, TextButton } from "../../components/auth/AppButton";

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const cooldown = useCooldown();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setUnverified(false);
    setResent(false);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") setUnverified(true);
      else setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    try {
      await api("/auth/resend-verification", { method: "POST", body: { email: email.trim() } });
      setResent(true);
      cooldown.start(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <AuthCard
          title="Welcome back"
          subtitle="Log in to your Owlet library."
          footer={
            <>
              No account?{" "}
              <Link to="/register" className="font-semibold text-blue-700 hover:underline">
                Register
              </Link>
            </>
          }
        >
          <div className="space-y-4">
            {notice ? <Banner kind="success">{notice}</Banner> : null}

            <AuthField
              type="email"
              placeholder="Email address"
              icon={Mail}
              value={email}
              onChange={setEmail}
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
            />
            <AuthField
              type="password"
              placeholder="Password"
              icon={LockKeyhole}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline">
                Forgot password?
              </Link>
            </div>

            {error ? <Banner kind="error">{error}</Banner> : null}

            {unverified ? (
              <Banner kind="warning">
                <p className="font-semibold">Confirm your email to log in</p>
                <p className="mt-1">
                  We sent a confirmation link to <span className="font-semibold">{email.trim()}</span> when you signed
                  up. Check your inbox and spam folder.
                </p>
                <div className="mt-2 -ml-2">
                  <TextButton onClick={resend} disabled={cooldown.left > 0}>
                    {cooldown.left > 0 ? `Resend in ${cooldown.left}s` : resent ? "Send it again" : "Resend the email"}
                  </TextButton>
                </div>
                {resent ? <p className="text-xs">A new link is on its way.</p> : null}
              </Banner>
            ) : null}

            <PrimaryButton busy={busy} busyLabel="Logging in…">
              Log in
            </PrimaryButton>
          </div>
        </AuthCard>
      </form>
    </AuthShell>
  );
}