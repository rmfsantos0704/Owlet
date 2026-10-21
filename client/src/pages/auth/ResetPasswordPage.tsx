import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, LockKeyhole, TriangleAlert } from "lucide-react";
import { api } from "../../services/api";
import { passwordProblem } from "../../utils/password";
import AuthShell, { AuthCard, Banner } from "../../components/auth/AuthShell";
import AuthField from "../../components/auth/AuthField";
import PasswordStrength from "../../components/auth/PasswordStrength";
import { PrimaryButton } from "../../components/auth/AppButton";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const tokenLooksValid = /^[a-f0-9]{64}$/.test(token);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pwError = attempted ? passwordProblem(password) : undefined;
  const confirmError = attempted && confirm !== password ? "Passwords don't match." : undefined;
  const matches = confirm.length > 0 && confirm === password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setError("");
    if (passwordProblem(password) || confirm !== password) return;

    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password, confirmPassword: confirm } });
      navigate("/login", { replace: true, state: { notice: "Password updated. Log in with your new password." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const requestNew = (
    <Link to="/forgot-password" className="font-semibold text-blue-700 hover:underline">
      Request a new link
    </Link>
  );

  if (!tokenLooksValid) {
    return (
      <AuthShell>
        <AuthCard title="This link isn't valid" footer={requestNew}>
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <TriangleAlert className="size-6" />
          </div>
          <p className="text-sm leading-6 text-slate-600">
            The reset link is incomplete or has expired. Reset links work once and expire after 30 minutes.
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <AuthCard
          title="Choose a new password"
          subtitle="Pick something you haven't used elsewhere. You'll be signed out on all other devices."
          footer={requestNew}
        >
          <div className="space-y-4">
            <AuthField
              type="password"
              placeholder="New password (8+ characters)"
              icon={LockKeyhole}
              value={password}
              onChange={setPassword}
              error={pwError}
              autoComplete="new-password"
              maxLength={72}
              autoFocus
            />
            <PasswordStrength password={password} />
            <AuthField
              type="password"
              placeholder="Confirm new password"
              icon={LockKeyhole}
              value={confirm}
              onChange={setConfirm}
              error={confirmError}
              autoComplete="new-password"
              maxLength={72}
            />
            {matches && !confirmError ? (
              <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <Check className="size-3.5" /> Passwords match
              </p>
            ) : null}

            {error ? <Banner kind="error">{error}</Banner> : null}

            <PrimaryButton busy={busy} busyLabel="Saving…">
              Update password
            </PrimaryButton>
          </div>
        </AuthCard>
      </form>
    </AuthShell>
  );
}