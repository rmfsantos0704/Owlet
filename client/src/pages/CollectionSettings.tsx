import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, Copy, Link2, Power, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import type { JoinLink, SentInvitation, collectionDetail } from "../types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CollectionSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reload, select } = useCollections();
  const dialog = useDialog();
  const [ws, setWs] = useState<collectionDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [sent, setSent] = useState<SentInvitation[]>([]);

  // join link form
  const [linkRole, setLinkRole] = useState<"editor" | "viewer">("viewer");
  const [linkDays, setLinkDays] = useState<1 | 7 | 30>(7);
  const [linkMax, setLinkMax] = useState<string>("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchWs = useCallback(async () => {
    const res = await api<{ Collection?: collectionDetail; collection?: collectionDetail }>(`/collections/${id}`);
    const detail = res.Collection || res.collection;
    if (!detail) throw new Error("Collection not found");
    return detail;
  }, [id]);

  useEffect(() => {
    setWs(null);
    setSaved(false);
    fetchWs()
      .then((w) => {
        setWs(w);
        setName(w.name ?? "");
        setDescription(w.description ?? "");
      })
      .catch((e) => setError(e.message));
  }, [fetchWs]);

  const wsRole = ws?.role;

  // invitations the owner sent that nobody has answered yet
  const fetchSent = useCallback(
    () =>
      api<{ invitations: SentInvitation[] }>(`/collections/${id}/invitations`)
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
          await api(`/collections/${id}`, { method: "PATCH", body: { name, description } });
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

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/collections/${id}/members`, { method: "POST", body: { email, role } });
      setEmail("");
      await fetchSent();
    }, "Invitation sent");
  };

  const cancelInvite = (invId: string) =>
    run(async () => {
      await api(`/collections/${id}/invitations/${invId}`, { method: "DELETE" });
      await fetchSent();
    }, "Invitation cancelled");

  const makeLink = async () => {
    if (linkBusy) return;
    if (ws?.joinLink) {
      const ok = await dialog.confirm({
        title: "Make a new link?",
        message: "The current link will stop working right away.",
        confirmLabel: "Make new link",
      });
      if (!ok) return;
    }
    setLinkBusy(true);
    await run(async () => {
      const r = await api<{ joinLink: JoinLink }>(`/collections/${id}/join-link`, {
        method: "POST",
        body: { role: linkRole, expiresInDays: linkDays, maxUses: linkMax ? Number(linkMax) : null },
      });
      setWs((w) => (w ? { ...w, joinLink: r.joinLink } : w));
    }, "Link created");
    setLinkBusy(false);
  };

  const revokeLink = async () => {
    const ok = await dialog.confirm({
      title: "Turn off the join link?",
      message: "Anyone who hasn't joined yet will no longer be able to.",
      confirmLabel: "Turn off link",
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      await api(`/collections/${id}/join-link`, { method: "DELETE" });
      setWs((w) => (w ? { ...w, joinLink: null } : w));
    }, "Link turned off");
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  const changeRole = (uid: string, r: string) =>
    run(async () => {
      await api(`/collections/${id}/members/${uid}`, { method: "PATCH", body: { role: r } });
      await refresh();
    }, "Role updated");

  const removeMember = async (uid: string, leaving: boolean) => {
    const ok = await dialog.confirm(
      leaving
        ? {
            title: "Leave this collection?",
            message: "You'll lose access until someone invites you again.",
            confirmLabel: "Leave",
            danger: true,
          }
        : {
            title: "Remove this member?",
            message: "They'll lose access to this collection.",
            confirmLabel: "Remove",
            danger: true,
          }
    );
    if (!ok) return;
    run(async () => {
      await api(`/collections/${id}/members/${uid}`, { method: "DELETE" });
      if (leaving) {
        await reload();
        navigate("/");
      } else {
        await refresh();
      }
    });
  };

  const deleteCollection = async () => {
    const ok = await dialog.confirm({
      title: "Delete this collection?",
      message: "Every clip, highlight and comment in it is permanently deleted. This can't be undone.",
      confirmLabel: "Delete collection",
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      await api(`/collections/${id}`, { method: "DELETE" });
      await reload();
      navigate("/");
    });
  };

  if (!ws) return <p className={error ? "text-red-600" : "text-slate-400"}>{error || "Loading…"}</p>;

  const isOwner = ws.role === "owner";
  const me = user?.email.toLowerCase();
  const linkActive =
    !!ws.joinLink && !ws.joinLink.expired && (ws.joinLink.maxUses === null || ws.joinLink.uses < ws.joinLink.maxUses);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* the library shows whichever collection is selected, so select this one before going back */}
      <Link
        to="/"
        onClick={() => id && select(id)}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand"
      >
        <ChevronLeft className="size-4" /> Back to {ws.name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Collection settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isOwner
            ? "You own this Collection."
            : `You're a${ws.role === "editor" ? "n" : ""} ${ws.role} here. Only the owner can change settings.`}
        </p>
      </div>
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <form onSubmit={save} className="space-y-6">
        <fieldset disabled={!isOwner || saving} className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold text-ink">General</h2>
            <div>
              <label htmlFor="collection-name" className="mb-1.5 block text-sm font-medium text-ink">
                Name
              </label>
              <input
                id="collection-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                placeholder="Collection name"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="collection-description" className="mb-1.5 block text-sm font-medium text-ink">
                Description <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="collection-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="What is this collection for?"
                className="field"
              />
            </div>
<p className="text-xs text-slate-400">
  AI summary settings are set per clip, in the AI summary card on each clip.
</p>
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
            <span className="min-w-0 truncate">{ws.owner?.email}</span>
            <span className="chip">Owner</span>
          </li>
          {ws.members?.map((m) => (
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
        <section className="card space-y-3 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <Link2 className="size-4 text-blue-600" /> Join link
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Anyone you send this link to can join after signing in and pressing Join. Nobody is added just by opening it.
            </p>
          </div>

          {linkActive && ws.joinLink ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/join/${ws.joinLink.token}`}
                  onFocus={(e) => e.currentTarget.select()}
                  className="field min-w-0 flex-1 !text-xs"
                />
                <button
                  type="button"
                  onClick={() => copyLink(`${window.location.origin}/join/${ws.joinLink!.token}`)}
                  className="btn-secondary"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Joins as <span className="font-medium capitalize">{ws.joinLink.role}</span> · expires{" "}
                {new Date(ws.joinLink.expiresAt).toLocaleDateString()} · {ws.joinLink.uses}
                {ws.joinLink.maxUses ? ` of ${ws.joinLink.maxUses}` : ""} joined
              </p>
            </div>
          ) : (
            ws.joinLink && (
              <p className="text-xs text-amber-600">
                The last link {ws.joinLink.expired ? "expired" : "reached its limit"}. Make a new one below.
              </p>
            )
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={linkRole} onChange={(e) => setLinkRole(e.target.value as "editor" | "viewer")} className="field sm:!w-36">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <select value={linkDays} onChange={(e) => setLinkDays(Number(e.target.value) as 1 | 7 | 30)} className="field sm:!w-40">
              <option value={1}>Expires in 1 day</option>
              <option value={7}>Expires in 7 days</option>
              <option value={30}>Expires in 30 days</option>
            </select>
            <select value={linkMax} onChange={(e) => setLinkMax(e.target.value)} className="field sm:!w-40">
              <option value="">Unlimited uses</option>
              <option value="1">1 use</option>
              <option value="5">5 uses</option>
              <option value="10">10 uses</option>
              <option value="25">25 uses</option>
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={makeLink} disabled={linkBusy} className="btn-primary flex-1 sm:flex-none">
                {ws.joinLink ? "Make new link" : "Create link"}
              </button>
              {linkActive && (
                <button
                  type="button"
                  onClick={revokeLink}
                  title="Turn off link"
                  aria-label="Turn off link"
                  className="btn-secondary !px-3 text-red-600 hover:!bg-red-50"
                >
                  <Power className="size-4" />
                </button>
              )}
            </div>
          </div>
          {linkRole === "editor" && (
            <p className="text-[11px] text-amber-600">
              Anyone with an editor link can add and change clips. Use a viewer link unless you trust everyone who might get it.
            </p>
          )}
        </section>
      )}

      {isOwner && !ws.isDefault && (
        <section className="card border-red-200 p-5">
          <h2 className="font-semibold text-red-700">Danger zone</h2>
          <p className="mt-1 text-xs text-slate-500">Deleting a Collection permanently deletes every clip in it.</p>
          <button onClick={deleteCollection} className="btn-danger mt-3">
            <Trash2 className="size-4" /> Delete Collection
          </button>
        </section>
      )}
    </div>
  );
}