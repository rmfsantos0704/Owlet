import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useWorkspaces } from "../context/WorkspaceContext";
import type { AiSettings, WorkspaceDetail } from "../types";

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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");

  const fetchWs = useCallback(
    () => api<{ workspace: WorkspaceDetail }>(`/workspaces/${id}`).then((r) => r.workspace),
    [id]
  );

  useEffect(() => {
    fetchWs()
      .then((w) => {
        setWs(w);
        setName(w.name);
        setDescription(w.description);
        setAi(w.aiSettings);
      })
      .catch((e) => setError(e.message));
  }, [fetchWs]);

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

  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/workspaces/${id}`, { method: "PATCH", body: { name, description, aiSettings: ai } });
      await refresh();
    }, "Saved");
  };

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/workspaces/${id}/members`, { method: "POST", body: { email, role } });
      setEmail("");
      await refresh();
    }, "Member added");
  };

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Workspace settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isOwner ? "You own this workspace." : `You're a${ws.role === "editor" ? "n" : ""} ${ws.role} here. Only the owner can change settings.`}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <form onSubmit={save} className="space-y-6">
        <fieldset disabled={!isOwner} className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold text-ink">General</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="Workspace name" className="field" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} placeholder="Description (optional)" className="field" />
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <h2 className="font-semibold text-ink">AI summaries</h2>
              <p className="mt-1 text-xs text-slate-400">Applies to clips added after you save. Existing summaries aren't changed.</p>
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
              <textarea
                value={ai.instructions}
                onChange={(e) => setAi({ ...ai, instructions: e.target.value })}
                maxLength={500}
                rows={3}
                placeholder='Custom instructions (optional), e.g. "Focus on methodology and sample sizes."'
                className="field"
              />
              <div className="mt-1 text-right text-[11px] text-slate-400">{ai.instructions.length}/500</div>
            </div>
          </section>
        </fieldset>
        {isOwner && <button className="btn-primary">Save changes</button>}
      </form>

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
        {isOwner && (
          <form onSubmit={addMember} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email of an existing Owlet user" className="field flex-1" />
            <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="field sm:!w-32">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button className="btn-primary">Add</button>
          </form>
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