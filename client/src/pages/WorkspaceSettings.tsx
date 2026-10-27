import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, FlaskConical, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useWorkspaces } from "../context/WorkspaceContext";
import type { AiSettings, ResearchItem, SentInvitation, WorkspaceDetail } from "../types";

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

type TestResult = { summary: string; paraphrase: string; tags: string[]; source: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function WorkspaceSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reload } = useWorkspaces();
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ai, setAi] = useState<AiSettings>({ format: "paragraph", length: "medium", instructions: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");

  const [clips, setClips] = useState<{ id: string; title: string }[]>([]);
  const [testItem, setTestItem] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [sent, setSent] = useState<SentInvitation[]>([]);

  const fetchWs = useCallback(
    () => api<{ workspace: WorkspaceDetail }>(`/workspaces/${id}`).then((r) => r.workspace),
    [id]
  );

  useEffect(() => {
    setWs(null);
    setSaved(false);
    setTestResult(null);
    setTestError("");
    setTestItem("");
    fetchWs()
      .then((w) => {
        setWs(w);
        setName(w.name);
        setDescription(w.description);
        setAi(w.aiSettings);
      })
      .catch((e) => setError(e.message));
  }, [fetchWs]);

  // the owner can test on one of this workspace's own clips
  const wsRole = ws?.role;
  useEffect(() => {
    if (wsRole !== "owner") return;
    api<{ items: ResearchItem[] }>(`/research?workspaceId=${id}`)
      .then((r) =>
        setClips(r.items.map((i) => ({ id: i._id, title: i.source.title || i.source.fileName || "Untitled" })))
      )
      .catch(() => {});
  }, [id, wsRole]);

  // invitations the owner sent that nobody has answered yet
  const fetchSent = useCallback(
    () =>
      api<{ invitations: SentInvitation[] }>(`/workspaces/${id}/invitations`)
        .then((r) => setSent(r.invitations))
        .catch(() => {}),
    [id]
  );
  useEffect(() => {
    if (wsRole === "owner") void fetchSent();
    else setSent([]);
  }, [wsRole, fetchSent]);

  // for the smaller actions (members, delete): shows a short notice or an error
  async function run(fn: () => Promise<unknown>, ok = "") {
    try {
      await fn();
      setError("");
      setNotice(ok);
      setTimeout(() => setNotice(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const refresh = async () => {
    setWs(await fetchWs());
    await reload();
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      // keep the spinner up for at least 0.4s so the save is always visible
      await Promise.all([
        (async () => {
          await api(`/workspaces/${id}`, { method: "PATCH", body: { name, description, aiSettings: ai } });
          await refresh();
        })(),
        wait(400),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (testing) return;
    setTesting(true);
    setTestError("");
    try {
      const [r] = await Promise.all([
        api<TestResult>(`/workspaces/${id}/test-ai`, {
          method: "POST",
          body: { aiSettings: ai, itemId: testItem || undefined },
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

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/workspaces/${id}/members`, { method: "POST", body: { email, role } });
      setEmail("");
      await fetchSent();
    }, "Invitation sent");
  };

  const cancelInvite = (invId: string) =>
    run(async () => {
      await api(`/workspaces/${id}/invitations/${invId}`, { method: "DELETE" });
      await fetchSent();
    }, "Invitation cancelled");

  const changeRole = (uid: string, r: string) =>
    run(async () => {
      await api(`/workspaces/${id}/members/${uid}`, { method: "PATCH", body: { role: r } });
      await refresh();
    }, "Role updated");

  const removeMember = (uid: string, leaving: boolean) => {
    if (!confirm(leaving ? "Leave this workspace?" : "Remove this member?")) return;
    run(async () => {
      await api(`/workspaces/${id}/members/${uid}`, { method: "DELETE" });
      if (leaving) {
        await reload();
        navigate("/");
      } else {
        await refresh();
      }
    });
  };

  const deleteWorkspace = () => {
    if (!confirm("Delete this workspace and ALL its clips? This can't be undone.")) return;
    run(async () => {
      await api(`/workspaces/${id}`, { method: "DELETE" });
      await reload();
      navigate("/");
    });
  };

  if (!ws) return <p className={error ? "text-red-600" : "text-slate-400"}>{error || "Loading…"}</p>;

  const isOwner = ws.role === "owner";
  const me = user?.email.toLowerCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand">
        <ChevronLeft className="size-4" /> Back to {ws.name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Workspace settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isOwner
            ? "You own this workspace."
            : `You're a${ws.role === "editor" ? "n" : ""} ${ws.role} here. Only the owner can change settings.`}
        </p>
      </div>
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <form onSubmit={save} className="space-y-6">
        <fieldset disabled={!isOwner || saving} className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold text-ink">General</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Workspace name" className="field" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} placeholder="Description (optional)" className="field" />
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <h2 className="font-semibold text-ink">AI summaries</h2>
              <p className="mt-1 text-xs text-slate-400">
                Applies to clips added after you save. For older clips, open one and click Regenerate.
              </p>
            </div>
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

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Custom instructions</label>
              <textarea
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

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FlaskConical className="size-4 text-blue-600" /> Test these settings
              </div>
              <p className="text-xs text-slate-500">
                Uses the choices above, even before you save. Nothing is saved or changed.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select value={testItem} onChange={(e) => setTestItem(e.target.value)} className="field min-w-0 flex-1">
                  <option value="">Built-in sample article</option>
                  {clips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title.slice(0, 70)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={runTest} disabled={testing} className="btn-secondary min-w-32">
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
                    Tested on {testResult.source}. Happy with it? Click Save changes below.
                  </p>
                </div>
              )}
            </div>
          </section>
        </fieldset>

        {isOwner && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`btn-primary min-w-40 transition-colors ${saved ? "!bg-emerald-600" : ""}`}
            >
              {saving ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <Check className="size-4" /> Saved
                </>
              ) : (
                "Save changes"
              )}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        )}
      </form>

      {!isOwner && error && <p className="text-sm text-red-600">{error}</p>}

      <section className="card p-5">
        <h2 className="font-semibold text-ink">Members</h2>
        <p className="mt-1 text-xs text-slate-400">Editors can add and change clips. Viewers can read, search, and export.</p>
        <ul className="mt-4 divide-y divide-slate-100">
          <li className="flex items-center justify-between gap-2 py-2.5 text-sm">
            <span className="min-w-0 truncate">{ws.owner.email}</span>
            <span className="chip">Owner</span>
          </li>
          {ws.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{m.email}</span>
              {isOwner ? (
                <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} className="field !w-auto !py-1 !text-xs">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className="chip capitalize">{m.role}</span>
              )}
              {(isOwner || m.email.toLowerCase() === me) && (
                <button
                  onClick={() => removeMember(m.userId, m.email.toLowerCase() === me)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  {m.email.toLowerCase() === me ? "Leave" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && sent.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow mb-1">Waiting for an answer</div>
            <ul className="divide-y divide-slate-100">
              {sent.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{s.email}</span>
                  <span className="chip capitalize">{s.role}</span>
                  <button onClick={() => cancelInvite(s.id)} className="text-xs font-medium text-red-600 hover:underline">
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isOwner && (
          <>
            <form onSubmit={addMember} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email of an existing Owlet user" className="field flex-1" />
              <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="field sm:!w-32">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button className="btn-primary">Invite</button>
            </form>
            <p className="mt-1.5 text-[11px] text-slate-400">
              They join only after they accept. The invitation shows up in their Owlet and expires after 14 days.
            </p>
          </>
        )}
      </section>

      {isOwner && !ws.isDefault && (
        <section className="card border-red-200 p-5">
          <h2 className="font-semibold text-red-700">Danger zone</h2>
          <p className="mt-1 text-xs text-slate-500">Deleting a workspace permanently deletes every clip in it.</p>
          <button onClick={deleteWorkspace} className="btn-danger mt-3">
            <Trash2 className="size-4" /> Delete workspace
          </button>
        </section>
      )}
    </div>
  );
}