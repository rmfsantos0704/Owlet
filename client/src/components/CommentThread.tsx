import { useState, type FormEvent } from "react";
import type { Comment, Highlight } from "../types";

type Props = {
  comments: Comment[];
  highlights: Highlight[];
  readOnly?: boolean;
  onAdd: (text: string, highlightId?: string) => Promise<void>;
  onDelete: (id: string) => void;
};

export default function CommentThread({ comments, highlights, readOnly, onAdd, onDelete }: Props) {
  const [text, setText] = useState("");
  const [hid, setHid] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onAdd(text.trim(), hid || undefined);
      setText("");
      setHid("");
    } finally {
      setBusy(false);
    }
  }

  const snippet = (id?: string) => highlights.find((h) => h._id === id)?.text.slice(0, 80);

  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {snippet(c.highlightId) && (
            <p className="mb-1.5 border-l-2 border-blue-300 pl-2 text-xs italic text-slate-500">{snippet(c.highlightId)}…</p>
          )}
          <p className="text-slate-700">{c.text}</p>
          <div className="mt-1.5 flex gap-3 text-[11px] text-slate-400">
            <span>
              {c.authorEmail ?? "Someone"} · {new Date(c.createdAt).toLocaleString()}
            </span>
            {!readOnly && (
              <button onClick={() => onDelete(c._id)} className="font-medium underline">Delete</button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <form onSubmit={submit} className="space-y-2 pt-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="field"
          />
          <div className="flex gap-2">
            <select value={hid} onChange={(e) => setHid(e.target.value)} className="field min-w-0 flex-1">
              <option value="">Not linked to a highlight</option>
              {highlights.map((h) => (
                <option key={h._id} value={h._id}>{h.text.slice(0, 50)}</option>
              ))}
            </select>
            <button disabled={busy} className="btn-primary">Comment</button>
          </div>
        </form>
      )}
    </div>
  );
}