import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailPlus } from "lucide-react";
import { useCollections } from "../context/CollectionContext";
import type { Invitation } from "../types";

const ROLE_TEXT = {
  editor: "an editor (can add and change clips)",
  viewer: "a viewer (can read, search, and export)",
} as const;

const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

// Shown above every page while the person has invitations waiting. Nothing changes until they choose.
export default function InvitationsBanner() {
  const { invitations, respondToInvitation } = useCollections();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  if (!invitations.length) return null;

  async function answer(inv: Invitation, accept: boolean) {
    if (busyId) return;
    setBusyId(inv.id);
    setError("");
    try {
      await respondToInvitation(inv.id, accept);
      if (accept) navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section aria-label="Collection invitations" className="mb-6 space-y-3">
      {invitations.map((inv) => (
        <div key={inv.id} className="card flex flex-col gap-3 border-blue-200 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-xl bg-white text-blue-600">
              <MailPlus className="size-4.5" strokeWidth={1.9} />
            </div>
            <div className="min-w-0 text-sm">
<p className="font-semibold text-ink">
  Join <span className="break-words">“{inv?.Collection?.name ?? "Collection"}”</span>?
</p>
              <p className="mt-0.5 text-slate-600">
                <span className="break-all font-medium">{inv.invitedBy}</span> invited you as {ROLE_TEXT[inv.role]}.
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                You won't be added unless you accept. Expires in {daysLeft(inv.expiresAt)} day
                {daysLeft(inv.expiresAt) === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
          <div className="flex flex-none gap-2">
            <button onClick={() => answer(inv, false)} disabled={!!busyId} className="btn-secondary">
              Decline
            </button>
            <button onClick={() => answer(inv, true)} disabled={!!busyId} className="btn-primary">
              {busyId === inv.id ? "Working…" : "Accept"}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
