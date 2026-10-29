import { RefreshCw } from "lucide-react";
import Modal from "./Modal";
import type { AiSettings } from "../types";

const FORMAT_LABELS: Record<string, string> = {
  paragraph: "Paragraph",
  bullets: "Bullet points",
  academic: "Academic",
  simple: "Plain language",
};
const LENGTH_LABELS: Record<string, string> = { short: "Short", medium: "Medium", detailed: "Detailed" };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Runs the regeneration. The parent closes the modal. */
  onConfirm: () => void;
  /** Closes this modal and opens the AI summary settings. */
  onEditSettings: () => void;
  settings: AiSettings;
};

// Asks before replacing the AI summary, and shows which settings will be used.
export default function RegenerateModal({ open, onClose, onConfirm, onEditSettings, settings }: Props) {
  const instructions = settings.instructions.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Regenerate summary?"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} autoFocus className="btn-primary">
            <RefreshCw className="size-4" /> Regenerate
          </button>
        </>
      }
    >
      <p>The summary and key arguments will be replaced with new ones, written with this clip's AI settings:</p>

      <dl className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-ink">Format</dt>
          <dd>{FORMAT_LABELS[settings.format] ?? settings.format}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-ink">Length</dt>
          <dd>{LENGTH_LABELS[settings.length] ?? settings.length}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-semibold text-ink">Instructions</dt>
          <dd className="min-w-0 whitespace-pre-line break-words">
            {instructions ? instructions : <span className="text-slate-400">None</span>}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onEditSettings}
        className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
      >
        Change settings
      </button>
    </Modal>
  );
}