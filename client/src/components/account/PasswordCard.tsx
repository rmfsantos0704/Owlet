import { useState, type FormEvent } from "react";
import { api } from "../../services/api";
import { useAction } from "../../hooks/useAction";
import { passwordProblem } from "../../utils/password";
import PasswordStrength from "../auth/PasswordStrength";
import SectionCard, { Note, Spinner } from "./SectionCard";

export default function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const action = useAction();

  const problem = attempted ? passwordProblem(next) : undefined;
  const mismatch = attempted && confirm !== next ? "Passwords don't match." : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (!current || passwordProblem(next) || confirm !== next) return;
    const ok = await action.run(async () => {
      const r = await api<{ token: string }>("/account/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next, confirmPassword: confirm },
      });
      // the old token stopped working with the change, so keep this device signed in with the new one
      localStorage.setItem("token", r.token);
      return "Password updated. Every other device was signed out.";
    });
    if (ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setAttempted(false);
    }
  }

  return (
    <SectionCard title="Password" description="Changing it signs you out on every other device.">
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="current-password" className="eyebrow mb-1.5 block">Current password</label>
          <input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className="field" />
          {attempted && !current ? <p className="mt-1.5 text-xs font-medium text-red-600">Enter your current password.</p> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-password" className="eyebrow mb-1.5 block">New password</label>
            <input id="new-password" type="password" maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className="field" />
            {problem ? <p className="mt-1.5 text-xs font-medium text-red-600">{problem}</p> : null}
          </div>
          <div>
            <label htmlFor="confirm-password" className="eyebrow mb-1.5 block">Confirm new password</label>
            <input id="confirm-password" type="password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="field" />
            {mismatch ? <p className="mt-1.5 text-xs font-medium text-red-600">{mismatch}</p> : null}
          </div>
        </div>
        <PasswordStrength password={next} />
        {action.error ? <Note kind="error">{action.error}</Note> : null}
        {action.done ? <Note kind="success">{action.done}</Note> : null}
        <button disabled={action.busy} className="btn-primary">
          {action.busy ? <><Spinner /> Updating…</> : "Update password"}
        </button>
      </form>
    </SectionCard>
  );
}