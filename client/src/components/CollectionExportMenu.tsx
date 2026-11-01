import { useEffect, useState } from "react";
import { ChevronDown, FileDown, FileText } from "lucide-react";
import { api } from "../services/api";

type Mode = "full" | "citations";
type Target = "pdf" | "docs";
type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback: (error: { type: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "";
const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";
let googleScriptPromise: Promise<void> | undefined;

const OPTIONS: { mode: Mode; title: string; hint: string }[] = [
  { mode: "full", title: "Full report", hint: "Highlights, comments, and citations, grouped by topic. Includes summaries where clips have them." },
  { mode: "citations", title: "Citations only", hint: "APA, MLA, and Chicago lists, grouped by topic" },
];

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.onload = () => {
        if (window.google?.accounts?.oauth2) resolve();
        else reject(new Error("Google sign-in did not load correctly"));
      };
      script.onerror = () => reject(new Error("Could not load Google sign-in"));
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

function requestGoogleAccessToken(): Promise<string> {
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth || !GOOGLE_CLIENT_ID) return Promise.reject(new Error("Google Docs export is not configured"));

  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || "Google authorization was not granted"));
        } else if (response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error("Google did not return an access token"));
        }
      },
      error_callback: (error) => reject(new Error(`Google authorization failed: ${error.type}`)),
    });
    client.requestAccessToken();
  });
}

async function googlePost<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const data = typeof result === "object" && result !== null ? result as Record<string, unknown> : null;
    const apiError = data?.error;
    const details = typeof apiError === "object" && apiError !== null ? apiError as Record<string, unknown> : null;
    throw new Error(typeof details?.message === "string" ? details.message : `Google Docs request failed (${response.status})`);
  }
  return result as T;
}

export default function CollectionExportMenu({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGoogleIdentity()
      .then(() => setGoogleReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load Google sign-in"));
  }, []);

  async function go(mode: Mode, target: Target) {
    setOpen(false);
    setBusy(true);
    setError("");
    setNotice("");
    setDocUrl("");
    const slug = collectionName.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "Collection";
    try {
      if (target === "pdf") {
        const r = await api<{ pdf: string }>(`/collections/${collectionId}/export-pdf?mode=${mode}`);
        const bytes = Uint8Array.from(atob(r.pdf), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}-${mode === "full" ? "report" : "citations"}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }

      const token = await requestGoogleAccessToken();
      const report = await api<{ text: string; truncated: boolean }>(
        `/collections/${encodeURIComponent(collectionId)}/export-docs?mode=${mode}`
      );
      const title = `${collectionName} - Owlet ${mode === "full" ? "report" : "citations"}`;
      const created = await googlePost<{ documentId?: string }>(
        "https://docs.googleapis.com/v1/documents",
        token,
        { title }
      );
      if (!created.documentId) throw new Error("Google created a document but did not return its ID");

      const createdUrl = `https://docs.google.com/document/d/${encodeURIComponent(created.documentId)}/edit`;
      setDocUrl(createdUrl);
      await googlePost(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
        token,
        { requests: [{ insertText: { location: { index: 1 }, text: report.text } }] }
      );
      if (report.truncated) setNotice("The report was shortened to fit Google Docs export limits.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} disabled={busy} className="btn-secondary">
        {busy ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            Exporting…
          </>
        ) : (
          <>
            <FileDown className="size-4" /> Export <ChevronDown className="size-3.5" />
          </>
        )}
      </button>

      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {OPTIONS.map((option) => (
              <div key={option.mode} className="rounded-lg px-2 py-2.5 hover:bg-slate-50">
                <div className="text-sm font-semibold text-ink">{option.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{option.hint}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void go(option.mode, "pdf")}
                    className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    <FileDown className="size-3.5" /> PDF
                  </button>
                  <button
                    onClick={() => void go(option.mode, "docs")}
                    disabled={!GOOGLE_CLIENT_ID || !googleReady}
                    title={!GOOGLE_CLIENT_ID ? "Set VITE_GOOGLE_CLIENT_ID to enable Google Docs export" : undefined}
                    className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText className="size-3.5" /> {googleReady ? "Google Docs" : GOOGLE_CLIENT_ID ? "Loading Google…" : "Google Docs"}
                  </button>
                </div>
              </div>
            ))}
            {!GOOGLE_CLIENT_ID && (
              <p className="px-2 py-2 text-xs text-slate-500">Google Docs export needs a Google OAuth client ID. See the setup guide.</p>
            )}
          </div>
        </>
      )}

      {(error || docUrl || notice) && (
        <div className={`absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border p-3 text-xs ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error ? (
            <>
              {error}{" "}
              <button onClick={() => setError("")} className="font-semibold underline">Dismiss</button>
              {docUrl && <a href={docUrl} target="_blank" rel="noreferrer" className="mt-1 block font-semibold underline">Open created Google Doc</a>}
            </>
          ) : (
            <>
              {notice && <p>{notice}</p>}
              {docUrl && <a href={docUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Open Google Doc</a>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
