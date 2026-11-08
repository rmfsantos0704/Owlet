import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import Modal from "../shared/Modal";
import { styleFor } from "../../utils/colors";
import { COLUMNS } from "./Columns";
import type { EvidenceLink, ResearchItem, ResearchQuestion, Stance } from "../../types";

type Tab = "highlights" | "sources" | "note";

const clip = (s: string, n = 160) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
const LIMIT = 150; // rows shown at once; the search narrows the rest

type Props = {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  questions: ResearchQuestion[];
  links: EvidenceLink[];
  initialStance: Stance;
  initialQuestionId: string;
  /** Called after the cards are saved, so the board reloads. */
  onAdded: () => void;
};

export default function AddEvidenceModal({
  open, onClose, collectionId, questions, links, initialStance, initialQuestionId, onAdded,
}: Props) {
  const [tab, setTab] = useState<Tab>("highlights");
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stance, setStance] = useState<Stance>(initialStance);
  const [questionId, setQuestionId] = useState(initialQuestionId);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // start fresh every time it opens
  useEffect(() => {
    if (!open) return;
    setTab(initialStance === "open" ? "note" : "highlights");
    setSearch("");
    setPicked(new Set());
    setStance(initialStance);
    setQuestionId(initialQuestionId);
    setNoteText("");
    setError("");
  }, [open, initialStance, initialQuestionId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api<{ items: ResearchItem[] }>(`/research?collectionId=${collectionId}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load your sources"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, collectionId]);

  // what is already on the board for the chosen question, so it can't be added twice
  const onBoard = useMemo(
    () =>
      new Set(
        links
          .filter((l) => l.itemId && (l.questionId ?? "") === questionId)
          .map((l) => (l.kind === "highlight" ? `h:${l.itemId}:${l.highlightId}` : `c:${l.itemId}`))
      ),
    [links, questionId]
  );

  const needle = search.trim().toLowerCase();
  const highlightRows = useMemo(
    () =>
      items
        .flatMap((item) =>
          (item.highlights ?? []).map((h) => ({ key: `h:${item._id}:${h._id}`, item, h }))
        )
        .filter(({ item, h }) =>
          !needle ||
          h.text.toLowerCase().includes(needle) ||
          (h.note ?? "").toLowerCase().includes(needle) ||
          (item.source?.title ?? "").toLowerCase().includes(needle)
        ),
    [items, needle]
  );
  const sourceRows = useMemo(
    () =>
      items
        .map((item) => ({ key: `c:${item._id}`, item }))
        .filter(({ item }) => !needle || (item.source?.title ?? "").toLowerCase().includes(needle)),
    [items, needle]
  );

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (busy) return;
    const base = { stance, questionId: questionId || null };
    let list: object[] = [];
    if (tab === "note") {
      if (!noteText.trim()) return;
      list = [{ ...base, kind: "note", note: noteText.trim() }];
    } else {
      list = [...picked]
        .filter((key) => key.startsWith(tab === "highlights" ? "h:" : "c:"))
        .map((key) => {
          const [, itemId, highlightId] = key.split(":");
          return tab === "highlights" ? { ...base, kind: "highlight", itemId, highlightId } : { ...base, kind: "clip", itemId };
        });
    }
    if (!list.length) return;
    setBusy(true);
    setError("");
    try {
      await api(`/board/${collectionId}/links`, { method: "POST", body: { links: list } });
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add to the board");
    } finally {
      setBusy(false);
    }
  }

  const count = tab === "note" ? (noteText.trim() ? 1 : 0) : [...picked].filter((k) => k.startsWith(tab === "highlights" ? "h:" : "c:")).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to the board"
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={save} disabled={busy || count === 0} className="btn-primary">
            {busy ? "Adding…" : count > 1 ? `Add ${count} cards` : "Add card"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-500">
          Put it under
          <select value={stance} onChange={(e) => setStance(e.target.value as Stance)} className="field mt-1">
            {COLUMNS.map((c) => (
              <option key={c.stance} value={c.stance}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          For the question
          <select value={questionId} onChange={(e) => setQuestionId(e.target.value)} className="field mt-1">
            <option value="">Not tied to a question</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>{clip(q.text, 70)}</option>
            ))}
          </select>
        </label>
      </div>

      <div role="tablist" aria-label="What to add" className="mt-4 inline-flex gap-1 rounded-lg bg-slate-100 p-1">
        {([["highlights", "Highlights"], ["sources", "Whole sources"], ["note", "Note"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === key ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "note" ? (
        <div className="mt-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Write your own point, or something you still need to find out…"
            aria-label="Note"
            className="field"
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "highlights" ? "Search highlights, notes, or sources…" : "Search sources…"}
            aria-label="Search"
            className="field"
          />
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">Loading…</p>
            ) : (tab === "highlights" ? highlightRows : sourceRows).length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">
                {tab === "highlights" ? "No highlights found in this collection." : "No sources found in this collection."}
              </p>
            ) : tab === "highlights" ? (
              highlightRows.slice(0, LIMIT).map(({ key, item, h }) => {
                const already = onBoard.has(key);
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs ${already ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"} ${picked.has(key) ? "bg-slate-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(key)}
                      disabled={already}
                      onChange={() => toggle(key)}
                      className="mt-0.5 size-4 shrink-0 accent-[#102b5c]"
                    />
                    <span className={`mt-1 size-2.5 shrink-0 rounded-full ${styleFor(h.color).dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-slate-800">“{clip(h.text)}”</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                        {item.source?.title ?? "Untitled"}
                        {h.page ? ` · p. ${h.page}` : ""}
                        {already ? " · already on the board" : ""}
                      </span>
                    </span>
                  </label>
                );
              })
            ) : (
              sourceRows.slice(0, LIMIT).map(({ key, item }) => {
                const already = onBoard.has(key);
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs ${already ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"} ${picked.has(key) ? "bg-slate-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(key)}
                      disabled={already}
                      onChange={() => toggle(key)}
                      className="mt-0.5 size-4 shrink-0 accent-[#102b5c]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium text-slate-800">{item.source?.title ?? "Untitled"}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                        {item.source?.domain ?? item.source?.fileName ?? "PDF"}
                        {already ? " · already on the board" : ""}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-slate-400">{count} selected</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}