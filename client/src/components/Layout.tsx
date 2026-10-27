import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Archive, Folder, LogOut, Menu, Plus, Search, Users, X, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollections } from "../context/CollectionContext";
import InvitationsBanner from "./InvitationsBanner";
import NotificationsBell from "./NotificationsBell";

export default function Layout() {
  const { user, logout } = useAuth();
  const { collections = [], current, select, create } = useCollections();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const q = params.get("q") ?? "";
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const onCollectionPage = pathname === "/";

  function onSearch(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    navigate({ pathname: pathname === "/all" ? "/all" : "/", search: next.toString() }, { replace: true });
  }

  async function addCollection(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      await create(name);
      setNewName("");
      setAdding(false);
      navigate("/");
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create Collection");
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="Owlet" className="size-9 rounded-[23.4%] shadow-md shadow-blue-950/15" />
            <div>
              <div className="text-[15px] font-bold tracking-tight text-ink">Owlet</div>
              <div className="eyebrow tracking-[0.16em]">Research smarter</div>
            </div>
          </Link>
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(false)}>
            <X className="size-5" />
          </button>
        </div>

        <nav className="space-y-1">
          <div className="eyebrow mb-2 px-3">Workspaces</div>
          <NavLink
            to="/all"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
              }`
            }
          >
            <Archive className="size-4.5" strokeWidth={1.9} />
            All clips
          </NavLink>
        </nav>

        <nav className="mt-7 space-y-0.5">
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="eyebrow">Collections</span>
            <button onClick={() => setAdding((v) => !v)} className="text-slate-400 hover:text-brand" title="New Collection">
              <Plus className="size-3.5" />
            </button>
          </div>
          {adding && (
            <form onSubmit={addCollection} className="px-1 pb-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Collection name, then Enter"
                maxLength={80}
                className="field !py-1.5"
              />
            </form>
          )}
          {collections.map((w: any) => {
            const collectionId = w?.id || w?._id;
            const currentId = current?.id || current?.id;
            const active = onCollectionPage && currentId && currentId === collectionId;
            return (
              <button
                key={collectionId ?? Math.random()}
                onClick={() => {
                  if (collectionId) {
                    select(collectionId);
                    navigate("/");
                    setOpen(false);
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-slate-100 font-medium text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
                }`}
              >
                <Folder className={`size-4 ${active ? "text-blue-500" : "text-slate-400"}`} />
                <span className="min-w-0 flex-1 truncate text-left">{w?.name ?? "Untitled Collection"}</span>
                {(w?.memberCount ?? 0) > 1 && <Users className="size-3 text-slate-400" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-0.5 pt-6">
          <NavLink
            to="/account"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
              }`
            }
          >
            <UserRound className="size-4.5" strokeWidth={1.8} />
            Account
          </NavLink>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand"
          >
            <LogOut className="size-4.5" strokeWidth={1.8} />
            Log out
          </button>
        </div>
      </aside>

      {open && (
        <button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setOpen(false)}>
          <span className="sr-only">Close navigation</span>
        </button>
      )}

      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search clips, tags, or sources..."
              className="field pl-10"
            />
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <NotificationsBell />
            <Link to="/account" className="ml-auto flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-slate-100" title="Account settings">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#dbeafe] text-xs font-bold text-[#174ea6]">
                {initials}
              </div>
              <span className="hidden max-w-48 truncate text-xs font-semibold text-slate-700 sm:block">{user?.email}</span>
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:py-9">
          <InvitationsBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}