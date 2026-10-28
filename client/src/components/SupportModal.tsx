import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Loader2, Send } from "lucide-react";
import Modal from "./Modal";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const TOPICS = ["Something isn't working", "Question about using Owlet", "Account or sign-in", "Feature idea", "Other"];
const MIN_CHARS = 10; // keep in step with the server (supportController.ts)
const MAX_CHARS = 4000;

const field = "field w-full";

// The "Email support" form. It sends the message to the Owlet support inbox through the server,
// with the person's account email as the reply address, so nobody's mail app needs to open.
export default function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState(""); // honeypot: invisible to people, bots tend to fill it in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const openedAt = useRef(Date.now());

  // note when the form was opened, so the server can tell an instant bot submit from a person typing
  useEffect(() => {
    if (open) openedAt.current = Date.now();
  }, [open]);

  function close() {
    if (busy) return; // don't lose the request while it's in flight
    onClose();
    // reset after the close animation would have finished, so a reopened form starts clean
    setTimeout(() => {
      setSent(false);
      setError("");
      setMessage("");
      setTrap("");
      setTopic(TOPICS[0]);
    }, 150);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || message.trim().length < MIN_CHARS) return;
    setBusy(true);
    setError("");
    try {
      await api("/support", {
        method: "POST",
        body: {
          topic,
          message: message.trim(),
          page: window.location.pathname,
          browser: navigator.userAgent,
          website: trap,
          elapsedMs: Date.now() - openedAt.current,
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="Message sent"
        footer={
          <button type="button" onClick={close} autoFocus className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77]">
            Done
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-5" />
          </span>
          <p>
            Thanks. We'll reply to <span className="font-semibold text-slate-800">{user?.email}</span>.
          </p>
        </div>
      </Modal>
    );
  }

  const length = message.trim().length;
  const tooShort = length < MIN_CHARS;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Contact support"
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="support-form"
            disabled={busy || tooShort}
            aria-busy={busy}
            className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? "Sending…" : "Send message"}
          </button>
        </>
      }
    >
      <form id="support-form" onSubmit={submit} className="space-y-4" aria-busy={busy} autoComplete="off">
        {/* the fields lock while sending so nothing changes under the request */}
        <fieldset disabled={busy} className="space-y-4">
          <p>Tell us what you were doing and what happened. We'll reply to your account email.</p>
          <div>
            <label htmlFor="support-topic" className="mb-1.5 block text-xs font-semibold text-slate-700">
              What's this about?
            </label>
            <select id="support-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="support-message" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Message
            </label>
            <textarea
              id="support-message"
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_CHARS}
              rows={6}
              placeholder="What were you trying to do, and what happened instead?"
              aria-describedby="support-hint"
              className={`${field} resize-y`}
            />
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
              <span id="support-hint" className={tooShort ? "text-slate-500" : "flex items-center gap-1 text-emerald-600"}>
                {tooShort ? (
                  `Write at least ${MIN_CHARS} characters to send (${MIN_CHARS - length} more)`
                ) : (
                  <>
                    <Check className="size-3" /> Ready to send
                  </>
                )}
              </span>
              <span className="text-slate-400">
                {message.length}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* honeypot: off-screen and skipped by keyboard and screen readers, so real people never touch it */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="support-website">Website</label>
            <input
              id="support-website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>
        </fieldset>
        <p className="text-xs text-slate-400">
          We also send your account email and the page you're on, to help us find the problem.
        </p>
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <Loader2 className="size-4 animate-spin" />
            Sending your message…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}