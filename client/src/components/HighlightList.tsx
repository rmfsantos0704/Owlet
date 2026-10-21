import type { Highlight } from "../types";
import { COLORS } from "../utils/colors";

type Props = { highlights: Highlight[]; onDelete: (id: string) => void; readOnly?: boolean };

export default function HighlightList({ highlights, onDelete, readOnly }: Props) {
  if (!highlights.length) {
    return (
      <p className="text-xs text-slate-400">
        {readOnly ? "No highlights yet." : 'No highlights yet. Open "Clipped text" and select a passage.'}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {highlights.map((h) => (
        <li key={h._id} className={`rounded-xl p-3 text-xs leading-relaxed text-slate-800 ${COLORS[h.color] ?? COLORS.yellow}`}>
          <p>{h.text}</p>
          {h.note && <p className="mt-1 italic text-slate-600">{h.note}</p>}
          {!readOnly && (
            <button onClick={() => onDelete(h._id)} className="mt-1.5 font-medium underline">Delete</button>
          )}
        </li>
      ))}
    </ul>
  );
}