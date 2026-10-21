import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, LoaderCircle, Mail, TriangleAlert } from "lucide-react";
import { api } from "../../services/api";
import AuthShell, { AuthCard, Banner } from "../../components/auth/AuthShell";
import AuthField from "../../components/auth/AuthField";
import { PrimaryButton } from "../../components/auth/AppButton";

const BAD_LINK = "This link is invalid or has expired.";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const tokenLooksValid = /^[a-f0-9]{64}$/.test(token);

  const [state, setState] = useState<"loading" | "ok" | "error">(tokenLooksValid ? "loading" : "error");
  const [message, setMessage] = useState(tokenLooksValid ? "" : BAD_LINK);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendNote, setResendNote] = useState("");

  // Safe to run twice (React dev mode does): the server treats a repeated click as a success.
  useEffect(() => {
    if (!tokenLooksValid) return;
    let cancelled = false;
    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(() => {
        if (!cancelled) setState("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        setState("error");
        setMessage(err instanceof Error ? err.message : BAD_LINK);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tokenLooksValid]);

  async function resend(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setResendNote("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setResendNote("");
    try {
      await api("/auth/resend-verification", { method: "POST", body: { email: email.trim() } });
      setResendNote("If that account needs confirming, we've sent a new link.");
    } catch (err) {
      setResendNote(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const login = (
    <Link to="/login" className="font-semibold text-blue-700 hover:underline">
      Go to log in
    </Link>
  );

  if (state === "loading") {
    return (
      <AuthShell>
        <AuthCard title="Confirming your email…">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin text-blue-600" /> One moment.
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (state === "ok") {
    return (
      <AuthShell>
        <AuthCard title="Email confirmed" subtitle="Your account is ready.">
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-6" />
          </div>
          <Link
            to="/login"
            className="flex w-full items-center justify-center rounded-lg bg-[#102b5c] py-3.5 text-base font-bold text-white shadow-sm hover:bg-[#173b77]"
          >
            Log in
          </Link>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={resend} noValidate>
        <AuthCard title="We couldn't confirm your email" footer={login}>
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <TriangleAlert className="size-6" />
          </div>
          <p className="text-sm leading-6 text-slate-600">{message}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            If you already confirmed it, just log in. Otherwise, we can send you a new link.
          </p>
          <div className="mt-4 space-y-3">
            <AuthField
              type="email"
              placeholder="Email address"
              icon={Mail}
              value={email}
              onChange={setEmail}
              autoComplete="email"
              inputMode="email"
            />
            {resendNote ? <Banner kind="success">{resendNote}</Banner> : null}
            <PrimaryButton busy={busy} busyLabel="Sending…">
              Send a new link
            </PrimaryButton>
          </div>
        </AuthCard>
      </form>
    </AuthShell>
  );
}