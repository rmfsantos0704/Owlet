import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";

// The person's own switch for AI features. It is on by default.
export default function AiCard() {
  const { aiOffByUser, setAiPreference } = useAuth();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = !aiOffByUser;

  async function change(enabled: boolean) {
    if (busy) return;
    if (!enabled) {
      const ok = await dialog.confirm({
        title: "Turn off AI features?",
        message:
          "Owlet will stop writing AI summaries, and the AI workspace, research briefs and concept search will be unavailable to you. " +
          "Your clips and comments are removed from the concept search index. Summaries and briefs you already have stay, and you can turn AI back on at any time.",
        confirmLabel: "Turn off AI",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      await setAiPreference(enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the setting. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">AI features</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use AI to summarize clips, answer questions across sources, write research briefs, and search by meaning.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Use AI features"
          disabled={busy}
          onClick={() => change(!on)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? "bg-brand" : "bg-slate-300"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        {on ? (
          <>
            <p className="font-semibold text-slate-700">AI is on.</p>
            <p className="mt-1">
              The text of clips you save, and the sources you pick for AI tools, is sent to AI providers to write summaries and briefs.
              Concept search also sends your clips, highlights, comments and matrix entries to Google to turn them into searchable vectors.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-slate-700">AI is off for your account.</p>
            <p className="mt-1">
              Nothing you save or write is sent to an AI provider. New clips get the plain Quick Summary instead. Everything else in Owlet works as before.
            </p>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}