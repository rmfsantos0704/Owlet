import { useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../services/api";
import { useDialog } from "../../context/DialogContext";
import type { QuestionSummary, ResearchQuestion, Strength } from "../../types";

const STRENGTH: Record<Strength, { label: string; tone: string }> = {
  none: { label: "No evidence yet", tone: "bg-slate-100 text-slate-600" },
  thin: { label: "Thin", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  moderate: { label: "Moderate", tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  strong: { label: "Strong", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

type Props = {
  collectionId: string;
  questions: ResearchQuestion[];
  summaries: QuestionSummary[];
  /** How many cards are in the Open questions column. */
  openCount: number;
  canEdit: boolean;
  /** The question the board is filtered to; "" = all evidence. */
  selected: string;
  onSelect: (id: string) => void;
  /** Called after any change, so the page reloads the board. */
  onChanged: () => void;
};

export default function QuestionsPanel({ collectionId, questions, summaries, openCount, canEdit, selected, onSelect, onChanged }: Props) {
  const dialog = useDialog();
  const [editing, setEditing] = useState<string | null>(null); // a question id, "main", or "new"
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const main = questions.find((q) => q.kind === "main");
  const supporting = questions.filter((q) => q.kind === "supporting");
  const summaryOf = (id: string) => summaries.find((s) => s.questionId === id);
  const covered = summaries.filter((s) => s.strength === "moderate" || s.strength === "strong").length;
  const gaps = summaries.filter((s) => s.strength === "none" || s.strength === "thin").length;
  const conflicts = summaries.filter((s) => s.conflict).length;

  function start(id: string, text = "") {
    setEditing(id);
    setDraft(text);
    setError("");
  }
  function stop() {
    setEditing(null);
    setDraft("");
    setError("");
  }

  async function run(fn: () => Promise<unknown>, fallback: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await fn();
      stop();
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveMain = () =>
    run(() => api(`/board/${collectionId}/main`, { method: "PUT", body: { text: draft } }), "Couldn't save the question");
  const saveEdit = (id: string) =>
    run(() => api(`/board/questions/${id}`, { method: "PATCH", body: { text: draft } }), "Couldn't save the question");
  const add = () =>
    run(() => api(`/board/${collectionId}/questions`, { method: "POST", body: { text: draft } }), "Couldn't add the question");

  async function remove(q: ResearchQuestion) {
    const ok = await dialog.confirm({
      title: "Delete this question?",
      message: "Evidence filed only under it is removed from the board. The highlights and sources stay in your library.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const done = await run(() => api(`/board/questions/${q.id}`, { method: "DELETE" }), "Couldn't delete the question");
    if (done && selected === q.id) onSelect("");
  }

  const form = (onSave: () => void, label: string) => (
    <div className="space-y-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={300}
        rows={2}
        aria-label={label}
        placeholder="Write it as a question you want your sources to answer"
        className="field resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">{draft.length}/300</span>
        <div className="flex gap-2">
          <button type="button" onClick={stop} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={onSave} disabled={busy || draft.trim().length < 3} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  const summaryLine = (id: string) => {
    const s = summaryOf(id);
    if (!s) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STRENGTH[s.strength].tone}`}>{STRENGTH[s.strength].label}</span>
        <span className="text-slate-500">
          {s.supports} supporting · {s.challenges} challenging · {s.sources} source{s.sources === 1 ? "" : "s"}
        </span>
        {s.conflict && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
            <AlertTriangle className="size-3" /> Conflicting evidence
          </span>
        )}
      </div>
    );
  };

  const stat = (value: number, label: string) => (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-lg font-semibold text-ink">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );

  return (
    <section className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-ink">Research questions</h2>
          <p className="mt-1 text-xs text-slate-400">Pick a question to see only the evidence filed under it.</p>
        </div>
        {selected && (
          <button type="button" onClick={() => onSelect("")} className="text-xs font-semibold text-blue-700 hover:underline">
            Show all evidence
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat(covered, "Well covered")}
        {stat(gaps, "Gaps to fill")}
        {stat(conflicts, "With conflicting evidence")}
        {stat(openCount, "Open questions")}
      </div>

      <div>
        <div className="eyebrow mb-1.5 text-blue-600">Main research question</div>
        {editing === "main" ? (
          form(saveMain, "Main research question")
        ) : main ? (
          <div className={`rounded-xl border p-4 ${selected === main.id ? "border-blue-300 bg-blue-50/60" : "border-slate-200"}`}>
            <div className="flex items-start gap-2">
              <button
                type="button"
                aria-pressed={selected === main.id}
                onClick={() => onSelect(selected === main.id ? "" : main.id)}
                className="min-w-0 flex-1 text-left text-base font-semibold leading-6 text-ink"
              >
                {main.text}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => start("main", main.text)}
                  aria-label="Edit the main question"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
            {summaryLine(main.id)}
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => start("main")}
            className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm font-medium text-slate-500 hover:border-blue-300 hover:text-blue-700"
          >
            Define the main question this collection is meant to answer
          </button>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-400">No main question yet.</p>
        )}
      </div>

      <div>
        <div className="eyebrow mb-1.5">Supporting questions</div>
        <ul className="space-y-2">
          {supporting.map((q) => (
            <li key={q.id}>
              {editing === q.id ? (
                form(() => saveEdit(q.id), "Supporting question")
              ) : (
                <div className={`rounded-xl border p-3 ${selected === q.id ? "border-blue-300 bg-blue-50/60" : "border-slate-200"}`}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-pressed={selected === q.id}
                      onClick={() => onSelect(selected === q.id ? "" : q.id)}
                      className="min-w-0 flex-1 text-left text-sm font-medium leading-5 text-slate-700"
                    >
                      {q.text}
                    </button>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => start(q.id, q.text)}
                          aria-label="Edit question"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(q)}
                          aria-label="Delete question"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  {summaryLine(q.id)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {supporting.length === 0 && editing !== "new" && (
          <p className="text-xs text-slate-400">Break the main question into smaller ones you can answer one source at a time.</p>
        )}
        {canEdit &&
          (editing === "new" ? (
            <div className="mt-2">{form(add, "New supporting question")}</div>
          ) : (
            <button
              type="button"
              onClick={() => start("new")}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              <Plus className="size-3.5" /> Add a supporting question
            </button>
          ))}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}