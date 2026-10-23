import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { api } from "../../services/api";
import AuthShell, { AuthCard } from "../../components/auth/AuthShell";

const BAD_LINK = "This link is invalid or has expired.";

export default function ConfirmEmailChangePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const tokenLooksValid = /^[a-f0-9]{64}$/.test(token);

  const [state, setState] = useState<"loading" | "ok" | "error">(tokenLooksValid ? "loading" : "error");
  const [message, setMessage] = useState(tokenLooksValid ? "" : BAD_LINK);

  useEffect(() => {
    if (!tokenLooksValid) return;
    let cancelled = false;
    api("/auth/confirm-email-change", { method: "POST", body: { token } })
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

  if (state === "loading") {
    return (
      <AuthShell>
        <AuthCard title="Confirming your new email…">
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
        <AuthCard title="Email updated" subtitle="You were signed out on every device. Log in with your new email address.">
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-6" />
          </div>
          {/* a full page load on purpose: it clears the old session from this tab */}
          <a
            href="/login"
            onClick={() => localStorage.removeItem("token")}
            className="flex w-full items-center justify-center rounded-lg bg-[#102b5c] py-3.5 text-base font-bold text-white shadow-sm hover:bg-[#173b77]"
          >
            Log in
          </a>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title="We couldn't confirm that email"
        footer={
          <Link to="/login" className="font-semibold text-blue-700 hover:underline">
            Go to log in
          </Link>
        }
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <TriangleAlert className="size-6" />
        </div>
        <p className="text-sm leading-6 text-slate-600">{message}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Email-change links work once and expire after 1 hour. Log in and start the change again from your Account page.
        </p>
      </AuthCard>
    </AuthShell>
  );
}