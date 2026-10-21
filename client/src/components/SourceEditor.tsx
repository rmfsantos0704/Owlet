import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";

type Source = { title?: string; author?: string; publishedDate?: string };
type Values = { title: string; author: string; publishedDate: string };

export default function SourceEditor({ source, onSave }: { source: Source; onSave: (v: Values) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<Values>({ title: "", author: "", publishedDate: "" });

  function start() {
    setV({ title: source.title ?? "", author: source.author ?? "", publishedDate: source.publishedDate ?? "" });
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.title.trim()) return;
    setBusy(true);
    try {
      await onSave({ title: v.title.trim(), author: v.author.trim(), publishedDate: v.publishedDate.trim() });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={start} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline">
        <Pencil className="size-3" /> Edit details
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
      <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Title" maxLength={500} required className="field" />
      <input value={v.author} onChange={(e) => setV({ ...v, author: e.target.value })} placeholder="Author (e.g. Jane Doe, or an organization)" maxLength={200} className="field" />
      <input value={v.publishedDate} onChange={(e) => setV({ ...v, publishedDate: e.target.value })} placeholder="Date (2023, 2023-03-05, or March 5, 2023)" maxLength={100} className="field" />
      <p className="text-[11px] text-slate-500">Saving rebuilds the APA, MLA, and Chicago citations.</p>
      <div className="flex gap-2">
        <button disabled={busy} className="btn-primary">Save</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}