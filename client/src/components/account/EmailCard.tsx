import { useState, type FormEvent } from "react";
import { api } from "../../services/api";
import { useAction } from "../../hooks/useAction";
import type { Account } from "../../types/account";
import SectionCard, { Note, Spinner } from "./SectionCard";

export default function EmailCard({ account, onChanged }: { account: Account; onChanged: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const send = useAction();
  const cancel = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await send.run(async () => {
      await api("/account/email", { method: "POST", body: { newEmail: newEmail.trim(), password } });
      return `We sent a confirmation link to ${newEmail.trim()}. Your email changes when you open it.`;
    });
    if (ok) {
      setNewEmail("");
      setPassword("");
      onChanged();
    }
  }

  async function cancelChange() {
    const ok = await cancel.run(async () => {
      await api("/account/email", { method: "DELETE" });
    });
    if (ok) onChanged();
  }

  return (
    <SectionCard
      title="Email address"
      description="We confirm a new address by sending a link to it, and warn your current address. You'll be signed out everywhere once it changes."
    >
      <p className="text-sm text-slate-600">
        Current email: <span className="font-semibold text-slate-800">{account.email}</span>
      </p>

      {account.pendingEmail ? (
        <div className="mt-3 space-y-2">
          <Note kind="info">
            Waiting for you to confirm <span className="font-semibold">{account.pendingEmail}</span>. Open the link we
            sent there (it expires after 1 hour).
          </Note>
          <button type="button" onClick={cancelChange} disabled={cancel.busy} className="btn-secondary">
            Cancel this change
          </button>
          {cancel.error ? <Note kind="error">{cancel.error}</Note> : null}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-email" className="eyebrow mb-1.5 block">New email</label>
            <input id="new-email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" className="field" />
          </div>
          <div>
            <label htmlFor="email-password" className="eyebrow mb-1.5 block">Current password</label>
            <input id="email-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="field" />
          </div>
        </div>
        {send.error ? <Note kind="error">{send.error}</Note> : null}
        {send.done ? <Note kind="success">{send.done}</Note> : null}
        <button disabled={send.busy} className="btn-secondary">
          {send.busy ? <><Spinner /> Sending…</> : "Send confirmation link"}
        </button>
      </form>
    </SectionCard>
  );
}