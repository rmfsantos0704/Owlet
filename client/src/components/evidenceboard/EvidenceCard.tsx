import { Link } from "react-router-dom";
import { GripVertical, Trash2 } from "lucide-react";
import { styleFor } from "../../utils/colors";
import { COLUMNS } from "./Columns";
import type { EvidenceLink, ResearchQuestion, Stance } from "../../types";

const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

type Props = {
  link: EvidenceLink;
  questions: ResearchQuestion[];
  canEdit: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Something was dropped on this card: put it before this one. */
  onDropBefore: () => void;
  onMove: (stance: Stance) => void;
  onAssign: (questionId: string | null) => void;
  onRemove: () => void;
};

export default function EvidenceCard({
  link, questions, canEdit, dragging, onDragStart, onDragEnd, onDropBefore, onMove, onAssign, onRemove,
}: Props) {
  const evidence = link.evidence;
  const question = questions.find((q) => q.id === link.questionId);

  return (
    <article
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", link.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => canEdit && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropBefore();
      }}
      className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        {canEdit && <GripVertical aria-hidden="true" className="mt-0.5 size-4 shrink-0 cursor-grab text-slate-300" />}
        <div className="min-w-0 flex-1">
          {link.kind === "note" ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{link.note}</p>
          ) : link.kind === "highlight" ? (
            <div className={`rounded-r-lg border-l-4 p-2.5 ${styleFor(evidence?.color).bar}`}>
              <p className="break-words text-xs leading-5 text-slate-700">“{clip(evidence?.quote ?? "")}”</p>
            </div>
          ) : (
            <p className="text-sm font-semibold leading-5 text-ink">{evidence?.title}</p>
          )}

          {link.kind !== "note" && link.itemId && (
            <Link to={`/item/${link.itemId}`} className="mt-2 block truncate text-xs font-medium text-slate-500 hover:text-blue-700">
              {link.kind === "highlight" ? evidence?.title : (evidence?.origin ?? "Whole source")}
              {evidence?.page ? ` · p. ${evidence.page}` : ""}
            </Link>
          )}
          {evidence?.note && <p className="mt-1.5 whitespace-pre-line break-words text-xs text-slate-500">{evidence.note}</p>}
          {question && (
            <span className="chip mt-2 inline-block max-w-full truncate" title={question.text}>
              {question.text}
            </span>
          )}
        </div>
      </div>

      {canEdit && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-600">Edit</summary>
          <div className="mt-2 space-y-2">
            <label className="block text-slate-500">
              Move to
              <select value={link.stance} onChange={(e) => onMove(e.target.value as Stance)} className="field mt-1 !py-1.5 !text-xs">
                {COLUMNS.map((c) => (
                  <option key={c.stance} value={c.stance}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-slate-500">
              Question
              <select
                value={link.questionId ?? ""}
                onChange={(e) => onAssign(e.target.value || null)}
                className="field mt-1 !py-1.5 !text-xs"
              >
                <option value="">Not tied to a question</option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>{clip(q.text, 60)}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-red-600">
              <Trash2 className="size-3.5" /> Remove from board
            </button>
          </div>
        </details>
      )}
    </article>
  );
}