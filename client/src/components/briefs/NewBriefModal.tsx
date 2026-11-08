import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Modal from "../shared/Modal";
import { BRIEF_TEMPLATES } from "./Templates";
import type { Brief, BoardResponse, BriefTemplateId, ResearchItem } from "../../types";

const MAX_SOURCES = 8;
const DEFAULT_SOURCES = 6;

type Props = {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  /** Called with the new brief's id once it has been written. */
  onCreated: (id: string) => void;
};

export default function NewBriefModal({ open, onClose, collectionId, onCreated }: Props) {
  const { aiEnabled } = useAuth();
  const [template, setTemplate] = useState<BriefTemplateId>("literature_review");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [boardAvailable, setBoardAvailable] = useState(false);
  const [mainQuestion, setMainQuestion] = useState("");
  const [useBoard, setUseBoard] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  // start fresh every time it opens
  useEffect(() => {
    if (!open) return;
    setTemplate("literature_review");
    setTitle("");
    setQuestion("");
    setError("");
    setUseBoard(false);
    setBoardAvailable(false);
    setMainQuestion("");
    let cancelled = false;
    setLoading(true);
    api<{ items: ResearchItem[] }>(`/research?collectionId=${collectionId}`)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setPicked(r.items.slice(0, DEFAULT_SOURCES).map((i) => i._id));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load your sources"))
      .finally(() => !cancelled && setLoading(false));
    // the evidence board is optional: when it has cards (or a main question), offer to use it
    api<BoardResponse>(`/board/${collectionId}`)
      .then((b) => {
        if (cancelled) return;
        const main = b.questions.find((q) => q.kind === "main")?.text ?? "";
        setMainQuestion(main);
        setBoardAvailable(b.links.length > 0 || !!main);
        setUseBoard(b.links.length > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, collectionId]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_SOURCES ? prev : [...prev, id]));
  }

  async function create() {
    if (running || picked.length === 0 || !aiEnabled) return;
    setRunning(true);
    setError("");
    try {
      const r = await api<{ brief: Brief }>("/briefs", {
        method: "POST",
        body: { collectionId, template, itemIds: picked, title: title.trim() || undefined, question: question.trim() || undefined, useBoard },
      });
      onCreated(r.brief.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't write the brief");
      setRunning(false);
    }
  }

  // the window can't be closed while the AI is writing
  const close = () => {
    if (!running) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      hideClose={running}
      title="New research brief"
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={close} disabled={running} className="btn-secondary">Cancel</button>
          <button type="button" onClick={create} disabled={running || picked.length === 0 || !aiEnabled} className="btn-primary min-w-40">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {running ? "Writing…" : "Write the brief"}
          </button>
        </>
      }
    >
      {!aiEnabled && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          AI isn't available right now, so new briefs can't be written. You can still open and edit the ones you have.
        </p>
      )}

      <fieldset disabled={running} className="space-y-5">
        <div>
          <div className="mb-2 text-sm font-medium text-ink">Template</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BRIEF_TEMPLATES.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplate(t.id)}
                aria-pressed={template === t.id}
                className={`rounded-xl border p-3 text-left transition ${
                  template === t.id ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold text-ink">{t.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-500">
            Title <span className="font-normal text-slate-400">(optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="field mt-1" />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Research question <span className="font-normal text-slate-400">(optional)</span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={300}
              placeholder={useBoard && mainQuestion ? mainQuestion : "What should the brief answer?"}
              className="field mt-1"
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Sources</span>
            <span className="text-xs text-slate-400">{picked.length}/{MAX_SOURCES} selected</span>
          </div>
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">Clip some articles or import PDFs first.</p>
            ) : (
              items.map((item) => {
                const on = picked.includes(item._id);
                const blocked = !on && picked.length >= MAX_SOURCES;
                return (
                  <label
                    key={item._id}
                    className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs ${blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"} ${on ? "bg-slate-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={blocked}
                      onChange={() => toggle(item._id)}
                      className="mt-0.5 size-4 shrink-0 accent-[#102b5c]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block font-medium text-slate-800">{item.source?.title ?? "Untitled"}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {item.source?.domain ?? item.source?.fileName ?? "PDF"} · {item.highlights?.length ?? 0} highlight
                        {(item.highlights?.length ?? 0) === 1 ? "" : "s"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Your highlights and literature-matrix entries for these sources are included automatically.
          </p>
        </div>

        {boardAvailable && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <input type="checkbox" checked={useBoard} onChange={(e) => setUseBoard(e.target.checked)} className="mt-0.5 size-4 accent-[#102b5c]" />
            <span>
              <span className="block font-semibold text-slate-800">Use my evidence board</span>
              Tell the writer which evidence supports, challenges, or only gives background for your question.
            </span>
          </label>
        )}
      </fieldset>

      {running && (
        <p role="status" className="mt-4 text-xs text-slate-500">
          Writing your brief and checking every quote against your sources. This can take up to a minute.
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}