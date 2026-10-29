import { useState } from "react";
import { ChevronRight, History, Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal";
import type { AiSession } from "../types";

export function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

// A saved title wins; older sessions without one fall back to the first line of the prompt.
export function sessionTitle(s: AiSession) {
  if (s.title?.trim()) return s.title.trim();
  const first = s.prompt.trim().split("\n")[0];
  if (!first) return s.mode;
  return first.length > 60 ? first.slice(0, 57) + "…" : first;
}

type Props = {
  sessions: AiSession[];
  activeId: string | null;
  /** Id of a session that was just created and hasn't been looked at yet. */
  newId: string | null;
  /** Called when the list is opened, so the parent can clear the "new" state. */
  onSeen: () => void;
  onOpen: (s: AiSession) => void;
  onRename: (s: AiSession) => void;
  onDelete: (s: AiSession) => void;
};

export default function RecentSessions({ sessions, activeId, newId, onSeen, onOpen, onRename, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  // Snapshot of the new session id taken when the modal opens, so its "New" tag
  // stays visible while the list is on screen even though the parent clears newId.
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const latest = sessions[0];

  function openModal() {
    setHighlightId(newId);
    setOpen(true);
    if (newId) onSeen();
  }

  function closeModal() {
    setOpen(false);
    setHighlightId(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="group w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition hover:border-violet-200 hover:bg-violet-50/30"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <History className="size-4" />
              {newId && (
                <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                </span>
              )}
            </span>
            <h2 className="font-semibold text-ink">Recent sessions</h2>
          </div>
          <div className="flex items-center gap-2">
            {newId && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">New</span>
            )}
            <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
              {sessions.length}
            </span>
            <ChevronRight className="size-4 text-slate-300 transition group-hover:text-violet-500" />
          </div>
        </div>
        <p className="mt-3 truncate text-xs leading-5 text-slate-400">
          {latest
            ? `Latest: ${sessionTitle(latest)}`
            : "Your analyses are saved here, so you can reopen a brief later."}
        </p>
      </button>

      <Modal open={open} onClose={closeModal} title="Recent sessions" maxWidth="max-w-lg">
        {sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No sessions yet. Run an analysis and it will be saved here.
          </p>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-1 rounded-xl border pr-1 transition ${
                  activeId === s.id ? "border-violet-200 bg-violet-50/50" : "border-transparent hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    closeModal();
                    onOpen(s);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block truncate text-sm font-semibold text-slate-700">{sessionTitle(s)}</span>
                      {highlightId === s.id && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          New
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {s.mode} · {s.sources.length} source{s.sources.length === 1 ? "" : "s"} · {ago(s.createdAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRename(s)}
                  title="Rename session"
                  aria-label="Rename session"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s)}
                  title="Delete session"
                  aria-label="Delete session"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}