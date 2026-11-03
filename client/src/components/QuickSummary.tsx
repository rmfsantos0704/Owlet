import { useMemo, useState } from "react";
import { Check, ListChecks, Plus } from "lucide-react";
import { keySentences, keyTerms } from "../utils/textAnalysis";

type Props = {
  text: string;
  tags: string[];
  canEdit: boolean;
  onAddTag: (tag: string) => Promise<unknown> | void;
};

const SIZES = [3, 5, 8, 12, 16] as const;
const MAX_TAGS = 20; // same limit as the server

export default function QuickSummary({ text, tags, canEdit, onAddTag }: Props) {
  const [size, setSize] = useState<number>(12);
  const [adding, setAdding] = useState("");

  const sentences = useMemo(() => keySentences(text, size), [text, size]);
  const terms = useMemo(() => keyTerms(text, 10), [text]);

  async function add(term: string) {
    if (adding) return;
    setAdding(term);
    try {
      await onAddTag(term);
    } finally {
      setAdding("");
    }
  }

  const full = tags.length >= MAX_TAGS;

  return (
    <section className="rounded-2xl bg-brand p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
            <ListChecks className="size-5" />
          </div>
          <h2 className="font-semibold">Quick summary</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1" role="group" aria-label="Number of sentences">
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSize(n)}
              aria-pressed={size === n}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                size === n ? "bg-white text-brand" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-blue-100/60">
        Key sentences picked from the text, in the order they appear. Nothing here is written by AI.
      </p>

      {sentences.length ? (
        <ol className="mt-4 space-y-3">
          {sentences.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/90">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-cyan-300">
                {i + 1}
              </span>
              <span className="min-w-0 break-words">{s}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-blue-100/70">There isn't enough full-sentence text in this clip to pick from.</p>
      )}

      {terms.length > 0 && (
        <>
          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
            Key terms{canEdit ? " · click one to add it as a tag" : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {terms.map((t) => {
              const has = tags.includes(t);
              const chip = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium";
              if (has) {
                return (
                  <span key={t} className={`${chip} bg-emerald-400/20 text-emerald-200`}>
                    <Check className="size-3" /> {t}
                  </span>
                );
              }
              if (!canEdit || full) {
                return (
                  <span key={t} className={`${chip} bg-white/10 text-blue-100`}>
                    {t}
                  </span>
                );
              }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => add(t)}
                  disabled={!!adding}
                  className={`${chip} bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-60`}
                >
                  <Plus className="size-3" /> {t}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}