import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { api } from "../services/api";
import type { AiSettings } from "../types";

const FORMATS: { value: AiSettings["format"]; label: string; hint: string }[] = [
  { value: "paragraph", label: "Paragraph", hint: "One short, flowing paragraph" },
  { value: "bullets", label: "Bullet points", hint: "Scannable key points" },
  { value: "academic", label: "Academic", hint: "Question, approach, findings, limitations" },
  { value: "simple", label: "Plain language", hint: "No jargon, easy to follow" },
];
const LENGTHS: { value: AiSettings["length"]; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "detailed", label: "Detailed" },
];

const PRESETS: { label: string; text: string }[] = [
  {
    label: "Literature review",
    text: 'Focus on the research question, methodology, sample size, and main findings. Mention limitations when the text states them. Use neutral academic wording. Use only information from the text and write "not stated" for anything missing.',
  },
  {
    label: "Study notes",
    text: "Write for a first-year student. Define each technical term in a few words the first time it appears. Highlight cause-and-effect relationships. Skip background history unless it is needed to understand the main point.",
  },
  {
    label: "Critical reading",
    text: "State the author's main claim, the evidence used to support it, and any assumptions or missing perspectives. Keep a neutral tone and do not add opinions of your own.",
  },
  {
    label: "News & policy",
    text: "Separate facts from claims and say who said what. Include dates, numbers, and places that appear in the text. Do not guess at anything the text does not state.",
  },
  {
    label: "Filipino",
    text: "Write the summary and key arguments in Filipino. Keep technical terms and proper names in English. Keep the tags in English.",
  },
];

const DEFAULTS: AiSettings = { format: "paragraph", length: "medium", instructions: "" };

type TestResult = { summary: string; paraphrase: string; tags: string[]; source: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Props = {
  open: boolean;
  onClose: () => void;
  /** The clip these settings belong to. */
  itemId: string;
  /** The clip's saved settings. Falls back to defaults when the clip has none yet. */
  settings?: AiSettings;
  /** Editors and owners can change a clip's settings. Everyone else sees them read-only. */
  canEdit: boolean;
  /** Saves the settings on the clip. Should throw on failure so the error shows here. */
  onSave: (settings: AiSettings) => Promise<void>;
  /** Saves the settings and rewrites the summary with them. Runs after the modal closes. */
  onRegenerate: (settings: AiSettings) => void | Promise<void>;
};

// The AI summary settings for one clip, opened from the AI summary card.
export default function AiSettingsModal({ open, onClose, itemId, settings, canEdit, onSave, onRegenerate }: Props) {
  const [ai, setAi] = useState<AiSettings>(DEFAULTS);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"save" | "regen" | null>(null);

  const [testSource, setTestSource] = useState<"clip" | "sample">("clip");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState("");

  // start from the clip's current settings each time the modal opens
  useEffect(() => {
    if (!open) return;
    setAi(settings ?? DEFAULTS);
    setError("");
    setTestResult(null);
    setTestError("");
    setTestSource("clip");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId]);

  function close() {
    if (saving) return; // don't lose the save while it's in flight
    onClose();
  }

  async function save(regenerate: boolean) {
    if (saving || !canEdit) return;
    setSaving(regenerate ? "regen" : "save");
    setError("");
    try {
      if (regenerate) {
        // the regenerate request saves the settings too, so only the spinner is needed here
        await wait(400);
      } else {
        await Promise.all([onSave(ai), wait(400)]); // keep the spinner up so the save is always visible
      }
      onClose();
      if (regenerate) void onRegenerate(ai);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the settings");
    } finally {
      setSaving(null);
    }
  }

  async function runTest() {
    if (testing) return;
    setTesting(true);
    setTestError("");
    try {
      const [r] = await Promise.all([
        api<TestResult>(`/research/${itemId}/test-ai`, {
          method: "POST",
          body: { aiSettings: ai, sample: testSource === "sample" },
        }),
        wait(400),
      ]);
      setTestResult(r);
    } catch (e) {
      setTestResult(null);
      setTestError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="AI summary settings"
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={close} disabled={!!saving} className="btn-secondary">
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button type="button" onClick={() => save(true)} disabled={!!saving} className="btn-secondary min-w-44">
              {saving === "regen" ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving === "regen" ? "Saving…" : "Save & regenerate"}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => save(false)} disabled={!!saving} className="btn-primary min-w-28">
              {saving === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving === "save" ? "Saving…" : "Save"}
            </button>
          )}
        </>
      }
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        <p className="text-xs text-slate-500">
          {canEdit
            ? "These apply to this clip only. Use Save & regenerate to rewrite the summary now, or Save and press Regenerate later."
            : "You can't change this clip's settings. You're seeing the current ones."}
        </p>

        <fieldset disabled={!canEdit || !!saving} className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-medium text-ink">Format</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <button
                  type="button"
                  key={f.value}
                  onClick={() => setAi({ ...ai, format: f.value })}
                  className={`rounded-xl border p-3 text-left transition ${
                    ai.format === f.value ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-ink">{f.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-ink">Length</div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 sm:w-fit">
              {LENGTHS.map((l) => (
                <button
                  type="button"
                  key={l.value}
                  onClick={() => setAi({ ...ai, length: l.value })}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium ${
                    ai.length === l.value ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ai-instructions" className="mb-1.5 block text-sm font-medium text-ink">
              Custom instructions
            </label>
            <textarea
              id="ai-instructions"
              value={ai.instructions}
              onChange={(e) => setAi({ ...ai, instructions: e.target.value })}
              maxLength={500}
              rows={4}
              placeholder='What should the AI focus on? e.g. "Focus on methodology and sample sizes. Write for a first-year student."'
              className="field"
            />
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Try an example:</span>
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => setAi({ ...ai, instructions: p.text })}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                >
                  {p.label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-slate-400">{ai.instructions.length}/500</span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Say what to focus on, include, or avoid. Use the format and length options above for structure.
            </p>
          </div>
        </fieldset>

        {canEdit && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FlaskConical className="size-4 text-blue-600" /> Test these settings
            </div>
            <p className="text-xs text-slate-500">
              Uses the choices above, even before you save. Nothing is saved or changed.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={testSource}
                onChange={(e) => setTestSource(e.target.value as "clip" | "sample")}
                disabled={testing}
                className="field min-w-0 flex-1"
              >
                <option value="clip">This clip</option>
                <option value="sample">Built-in sample article</option>
              </select>
              <button type="button" onClick={runTest} disabled={testing || !!saving} className="btn-secondary min-w-32">
                {testing ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    Testing…
                  </>
                ) : (
                  "Run test"
                )}
              </button>
            </div>
            {testError && <p className="text-sm text-red-600">{testError}</p>}
            {testResult && (
              <div className="space-y-3 rounded-xl border border-blue-100 bg-white p-4 text-sm">
                <div>
                  <div className="eyebrow mb-1">Summary</div>
                  <p className="whitespace-pre-line leading-relaxed text-slate-800">{testResult.summary}</p>
                </div>
                <div>
                  <div className="eyebrow mb-1">Key arguments</div>
                  <p className="leading-relaxed text-slate-700">{testResult.paraphrase}</p>
                </div>
                {testResult.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {testResult.tags.map((t) => (
                      <span key={t} className="chip">{t}</span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Tested on {testResult.source}. Happy with it? Click Save.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}