import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { useAction } from "../../hooks/useAction";
import { setLoginNotice } from "../../utils/notice";
import type { OwnedWorkspace } from "../../types/account";
import SectionCard, { Note, Spinner } from "./SectionCard";

export default function DeleteAccountCard({ workspaces }: { workspaces: OwnedWorkspace[] }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({}); // "" | "delete" | "transfer:<userId>"
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const action = useAction();

  const shared = workspaces.filter((w) => w.members.length > 0);
  const solo = workspaces.filter((w) => w.members.length === 0);
  const undecided = shared.filter((w) => !choices[w.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (undecided.length > 0 || !password || !understood) return;

    const decisions: Record<string, { action: "delete" } | { action: "transfer"; to: string }> = {};
    for (const w of shared) {
      const c = choices[w.id];
      decisions[w.id] = c === "delete" ? { action: "delete" } : { action: "transfer", to: c.replace("transfer:", "") };
    }
    const ok = await action.run(async () => {
      await api("/account/delete", { method: "POST", body: { password, workspaces: decisions } });
    });
    if (ok) {
      setLoginNotice("Your account was deleted. We're sorry to see you go.");
      logout();
    }
  }

  return (
    <SectionCard
      danger
      title="Delete account"
      description="Permanently delete your account and personal data. This can't be undone."
    >
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-danger">
          Delete my account…
        </button>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">What will happen</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your account, profile, and login are deleted immediately, and every device is signed out.</li>
              {solo.length > 0 ? (
                <li>
                  These workspaces and all their clips are deleted (nobody else is in them):{" "}
                  <span className="font-semibold text-slate-800">{solo.map((w) => w.name).join(", ")}</span>.
                </li>
              ) : null}
              <li>
                Clips and comments you added to workspaces owned by other people stay there, without your name or
                email.
              </li>
              <li>You're removed from every workspace you were a member of.</li>
            </ul>
          </div>

          {shared.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">
                You own shared workspaces. Choose what happens to each one:
              </p>
              {shared.map((w) => (
                <div key={w.id} className="rounded-xl border border-slate-200 p-3">
                  <label htmlFor={`ws-${w.id}`} className="text-sm font-semibold text-slate-800">
                    {w.name} <span className="font-normal text-slate-400">· {w.members.length} {w.members.length === 1 ? "member" : "members"}</span>
                  </label>
                  <select
                    id={`ws-${w.id}`}
                    value={choices[w.id] ?? ""}
                    onChange={(e) => setChoices((c) => ({ ...c, [w.id]: e.target.value }))}
                    className="field mt-2"
                  >
                    <option value="" disabled>Choose what happens…</option>
                    {w.members.map((m) => (
                      <option key={m.userId} value={`transfer:${m.userId}`}>
                        Transfer to {m.email} ({m.role})
                      </option>
                    ))}
                    <option value="delete">Delete this workspace and all its clips</option>
                  </select>
                  {attempted && !choices[w.id] ? <p className="mt-1.5 text-xs font-medium text-red-600">Choose an option.</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <label htmlFor="delete-password" className="eyebrow mb-1.5 block">Confirm with your password</label>
            <input id="delete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="field" />
            {attempted && !password ? <p className="mt-1.5 text-xs font-medium text-red-600">Enter your password.</p> : null}
          </div>

          <label className="flex items-start gap-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 size-4 rounded border-slate-300" />
            <span>I understand this is permanent and can't be undone.</span>
          </label>
          {attempted && !understood ? <p className="-mt-3 text-xs font-medium text-red-600">Tick the box to continue.</p> : null}

          {action.error ? <Note kind="error">{action.error}</Note> : null}

          <div className="flex flex-wrap gap-2">
            <button disabled={action.busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
              {action.busy ? <><Spinner /> Deleting…</> : "Permanently delete my account"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
              Keep my account
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}