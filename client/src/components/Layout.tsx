import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  CircleHelp,
  Folder,
  LogOut,
  Menu,
  Pin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import NotificationsBell from "./layout/NotificationsBell";
import CollectionMenu from "./layout/CollectionMenu";
import WorkspaceMenu from "./layout/WorkspaceMenu";
import AiUsageIndicator from "./layout/AiUsageIndicator";
import OnboardingModal from "./layout/OnboardingModal";
import { ONBOARDING_EVENT } from "../utils/onboarding";

// What the layout hands to the page it shows: the spot in the top bar where a page can put its own buttons
// (a page renders into it with a portal).
export type LayoutContext = { headerActions: HTMLElement | null };

// pages where the header search filters what's shown (everywhere else it jumps to the collection page)
const SEARCHABLE = ["/all", "/highlights", "/comments"];

// sidebar sizing + persistence
const MIN_W = 224;
const MAX_W = 420;
const DEFAULT_W = 240;
const COLLAPSE_AT = 150; // letting go with the edge dragged left of this x hides the sidebar
const WIDTH_KEY = "owlet.sidebar.width";
const COLLAPSED_KEY = "owlet.sidebar.collapsed";

// below this width the sidebar is a slide-in drawer (matches Tailwind's lg breakpoint)
const DRAWER_QUERY = "(max-width: 1023px)";
const isDrawerScreen = () => window.matchMedia(DRAWER_QUERY).matches;

const clamp = (n: number) => Math.min(MAX_W, Math.max(MIN_W, n));
const readStore = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting just won't persist */
  }
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { collections = [], current, select, create, pinned, archived } = useCollections();
  const navigate = useNavigate();
  const dialog = useDialog();
  const { pathname, search: locationSearch } = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false); // mobile drawer
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false); // phone only: the search bar stays collapsed until tapped
  const searchRef = useRef<HTMLInputElement>(null);
  const onboardingUser = user ? user.id ?? user.email.toLowerCase() : null;
  const onboardingKey = onboardingUser ? `owlet.onboarding.dismissed:${encodeURIComponent(onboardingUser)}` : null;
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => Boolean(onboardingKey && readStore(onboardingKey) !== "1")
  );
  const [onboardingStep, setOnboardingStep] = useState(0);

  // The tour points at the home page's top-bar tools, so opening it goes to "/" and closing it goes back
  // to the page the person was on. The latest location is kept in refs so the effect below only runs
  // when the tour opens or closes.
  const pathRef = useRef(pathname);
  const hereRef = useRef(pathname + locationSearch);
  pathRef.current = pathname;
  hereRef.current = pathname + locationSearch;
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    if (onboardingOpen) {
      if (returnTo.current === null && pathRef.current !== "/") {
        returnTo.current = hereRef.current;
        navigate("/");
      }
    } else if (returnTo.current !== null) {
      const back = returnTo.current;
      returnTo.current = null;
      // if they went somewhere else on purpose during the tour, leave them there
      if (pathRef.current === "/") navigate(back);
    }
  }, [onboardingOpen, navigate]);

  function closeOnboarding() {
    if (onboardingKey) {
      try {
        localStorage.setItem(onboardingKey, "1");
      } catch {
        // The tour can still be dismissed for this session if storage is unavailable.
      }
    }
    setOnboardingOpen(false);
  }

  // the tour asks for the drawer to be open on sidebar steps and closed on top-bar steps
  function handleSidebarNeeded(needed: boolean) {
    if (isDrawerScreen()) setOpen(needed);
  }

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const requestedStep = (event as CustomEvent<number>).detail;
      setOnboardingStep(Number.isInteger(requestedStep) ? Math.min(Math.max(requestedStep, 0), 2) : 0);
      setOnboardingOpen(true);
    };
    window.addEventListener(ONBOARDING_EVENT, handleOpen);
    return () => window.removeEventListener(ONBOARDING_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // desktop sidebar: draggable width, can be hidden, and peeks out when you hover the Owlet icon
  const [width, setWidth] = useState(() => {
    const saved = Number(readStore(WIDTH_KEY));
    return Number.isFinite(saved) && saved > 0 ? clamp(saved) : DEFAULT_W;
  });
  const [collapsed, setCollapsed] = useState(() => readStore(COLLAPSED_KEY) === "1");
  const [peek, setPeek] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [willHide, setWillHide] = useState(false); // edge is dragged far enough left that releasing will hide it
  const peekTimer = useRef<number | undefined>(undefined);
  const draggingRef = useRef(false);

  // while the tour runs, a hidden desktop sidebar peeks out; when the tour ends, the phone drawer closes again
  // (the modal opens/closes the drawer per step while the tour is running)
  useEffect(() => {
    if (!onboardingOpen) return;
    if (collapsed) setPeek(true);
    return () => {
      if (collapsed) setPeek(false);
      if (isDrawerScreen()) setOpen(false);
    };
  }, [onboardingOpen, collapsed]);

  useEffect(() => {
    if (!dragging) writeStore(WIDTH_KEY, String(width));
  }, [width, dragging]);

  useEffect(() => {
    writeStore(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => () => window.clearTimeout(peekTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // After clicking the icon to hide the sidebar, the floating icon appears right under the cursor and would
  // instantly "hover" it open again. Ignore hovers until the cursor has left that icon once.
  const suppressPeek = useRef(false);
  const showPeek = () => {
    if (suppressPeek.current) return;
    window.clearTimeout(peekTimer.current);
    setPeek(true);
  };
  const hidePeek = () => {
    window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => {
      if (!draggingRef.current) setPeek(false); // don't pull the sidebar away mid-drag
    }, 200);
  };
  // hide the sidebar (click on the Owlet icon while it's docked)
  const hide = (byMouse = false) => {
    suppressPeek.current = byMouse;
    window.clearTimeout(peekTimer.current);
    setPeek(false);
    setCollapsed(true);
  };
  // bring a hidden sidebar back (click on the Owlet icon)
  const dock = () => {
    window.clearTimeout(peekTimer.current);
    setPeek(false);
    setCollapsed(false);
  };

  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
  }
  function onResize(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setWidth(clamp(e.clientX)); // the sidebar sits at the left edge, so the pointer's x is its width
    setWillHide(e.clientX < COLLAPSE_AT);
  }
  function endResize(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    setDragging(false);
    setWillHide(false);
    if (e.type === "pointercancel") return;
    window.clearTimeout(peekTimer.current);
    setPeek(false);
    // dragged all the way to the left: hide it. Otherwise it's docked at the width it was dragged to
    // (this also re-docks a sidebar that was peeking).
    setCollapsed(e.clientX < COLLAPSE_AT);
  }
  function onResizeKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") setWidth((w) => clamp(w - 16));
    else if (e.key === "ArrowRight") setWidth((w) => clamp(w + 16));
  }

  const q = params.get("q") ?? "";
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const onCollectionPage = pathname === "/";
  const searchPlaceholder = pathname === "/highlights"
    ? "Search highlights, notes, or sources..."
    : pathname === "/comments"
      ? "Search comments, people, or sources..."
      : "Search clips, tags, or sources...";

  function onSearch(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    navigate({ pathname: SEARCHABLE.includes(pathname) ? pathname : "/", search: next.toString() }, { replace: true });
  }

  // phone: collapse the search bar again (this also clears the filter)
  function closeSearch() {
    setSearchOpen(false);
    if (q) onSearch("");
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
      void dialog.alert({ title: "Couldn't create the collection", message: err instanceof Error ? err.message : "Please try again." });
    }
  }

  // pinned collections first (the sort is stable, so the rest keep their order); archived ones sit under their own heading
  const visible = collections
    .filter((c: any) => !archived.includes(c.id))
    .sort((a: any, b: any) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));
  const archivedList = collections.filter((c: any) => archived.includes(c.id));

  const row = (w: any) => {
    const collectionId = w?.id || w?._id;
    const active = onCollectionPage && current?.id && current.id === collectionId;
    const isArchived = archived.includes(collectionId);
    return (
      <div key={collectionId ?? Math.random()} className="group relative">
        <button
          onClick={() => {
            if (collectionId) {
              select(collectionId);
              navigate("/");
              setOpen(false);
            }
          }}
          className={`flex w-full items-center gap-3 rounded-xl py-2 pl-3 pr-9 text-sm transition ${
            active
              ? "bg-slate-100 font-medium text-brand"
              : `${isArchived ? "text-slate-400" : "text-slate-600"} hover:bg-slate-100 hover:text-brand`
          }`}
        >
          <Folder className={`size-4 shrink-0 ${active ? "text-blue-500" : "text-slate-400"}`} />
          <span className="min-w-0 flex-1 truncate text-left">{w?.name ?? "Untitled Collection"}</span>
          {pinned.includes(collectionId) && <Pin className="size-3 shrink-0 text-slate-400" />}
          {(w?.memberCount ?? 0) > 1 && <Users className="size-3 shrink-0 text-slate-400" />}
        </button>
        {collectionId && <CollectionMenu collection={w} onNavigate={() => setOpen(false)} />}
      </div>
    );
  };

  // mobile: slide in/out with `open`. desktop (lg): docked unless hidden; a hidden sidebar floats in while peeking.
  const mobileShown = open ? "translate-x-0" : "-translate-x-full";
  const desktopShown = !collapsed || peek ? "lg:translate-x-0" : "lg:-translate-x-full";
  const floating = collapsed && peek ? "lg:shadow-2xl" : "";

  return (
    <div
      className={`min-h-screen min-w-0 overflow-x-clip bg-canvas text-slate-900 ${dragging ? "cursor-col-resize select-none" : ""}`}
      style={{ "--dock": collapsed ? "0px" : `${width}px` } as CSSProperties}
    >
      {/* the Owlet icon that stays behind when the sidebar is hidden: hover to peek, click to bring it back */}
      {collapsed && (
        <button
          type="button"
          onMouseEnter={showPeek}
          onMouseLeave={() => {
            suppressPeek.current = false;
            hidePeek();
          }}
          onClick={dock}
          title="Show sidebar"
          aria-label="Show sidebar"
          className="fixed left-6 top-3.5 z-50 hidden size-9 lg:block"
        >
          <img src="/logo.png" alt="" className="size-9 rounded-[23.4%] shadow-md shadow-blue-950/15" />
        </button>
      )}

      <aside
        style={{ width, maxWidth: "85vw", opacity: willHide ? 0.55 : 1 }}
        onMouseEnter={() => collapsed && showPeek()}
        onMouseLeave={() => collapsed && hidePeek()}
        className={`app-sidebar fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-slate-200 bg-white px-4 pb-5 pt-3.5 transition-transform duration-200 ${mobileShown} ${desktopShown} ${floating}`}
      >
        <div className="mb-9 flex shrink-0 items-center justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* desktop: the icon is the hide button. mobile: it goes home like the name does */}
            <button
              type="button"
              onClick={(e) => (collapsed ? dock() : hide(e.detail > 0))}
              title={collapsed ? "Keep sidebar open" : "Hide sidebar"}
              aria-label={collapsed ? "Keep sidebar open" : "Hide sidebar"}
              className="hidden shrink-0 lg:block"
            >
              <img src="/logo.png" alt="" className="size-9 rounded-[23.4%] shadow-md shadow-blue-950/15" />
            </button>
            <Link to="/" className="shrink-0 lg:hidden" onClick={() => setOpen(false)}>
              <img src="/logo.png" alt="Owlet" className="size-9 rounded-[23.4%] shadow-md shadow-blue-950/15" />
            </Link>
            <Link to="/" className="min-w-0" onClick={() => setOpen(false)}>
              <div className="truncate text-[15px] font-bold tracking-tight text-ink">Owlet</div>
              <div className="eyebrow truncate tracking-[0.16em]">Research smarter</div>
            </Link>
          </div>
          <button type="button" aria-label="Close navigation" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(false)}>
            <X className="size-5" />
          </button>
        </div>

        <WorkspaceMenu onNavigate={() => setOpen(false)} tourActive={onboardingOpen} />
        <nav className="mt-7 flex min-h-0 flex-1 flex-col">
          <div id="owlet-tour-collections" className="mb-2 flex shrink-0 items-center justify-between px-3" data-onboarding-target="collections">
            <span className="eyebrow">Collections</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setOnboardingStep(1);
                  setOnboardingOpen(true);
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand"
                title="About Collections"
                aria-label="About Collections"
              >
                <CircleHelp className="size-3.5" />
              </button>
              <button onClick={() => setAdding((v) => !v)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand" title="New Collection" aria-label="New Collection">
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
          {adding && (
            <form onSubmit={addCollection} className="shrink-0 px-1 pb-1">
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
          <div id="owlet-tour-collection-list" className="min-h-0 flex-1 overflow-y-auto pr-1" data-onboarding-target="collection-list">
            <div className="space-y-0.5">{visible.map(row)}</div>
            {archivedList.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  aria-expanded={showArchived}
                  className="eyebrow flex w-full items-center gap-1.5 px-3 py-1.5 hover:text-slate-600"
                >
                  <ChevronRight className={`size-3 transition-transform ${showArchived ? "rotate-90" : ""}`} />
                  Archived ({archivedList.length})
                </button>
                {showArchived && <div className="space-y-0.5">{archivedList.map(row)}</div>}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-3 shrink-0 space-y-0.5 border-t border-slate-200 pt-3">
          {/* Account, with Log out beside it */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/account"
              id="owlet-tour-account"
              title={user?.email ?? "Account"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
                }`
              }
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe] text-[10px] font-bold text-[#174ea6]">
                {initials}
              </span>
              <span className="truncate">Account</span>
            </NavLink>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
              className="shrink-0 rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand"
            >
              <LogOut className="size-4.5" strokeWidth={1.8} />
            </button>
          </div>
          <NavLink
            to="/help"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
              }`
            }
          >
            <CircleHelp className="size-4.5" strokeWidth={1.8} />
            Help &amp; support
          </NavLink>
        </div>

        {/* drag handle: drag left to hide the sidebar; drag it while peeking to dock it again */}
        {(!collapsed || peek) && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuenow={width}
            aria-valuemin={MIN_W}
            aria-valuemax={MAX_W}
            tabIndex={0}
            title="Drag to resize · drag fully left to hide"
            onPointerDown={startResize}
            onPointerMove={onResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={onResizeKey}
            onDoubleClick={() => setWidth(DEFAULT_W)}
            className={`absolute inset-y-0 right-0 z-10 hidden w-2 cursor-col-resize touch-none transition-colors hover:bg-blue-200/60 focus-visible:bg-blue-300/70 focus-visible:outline-none lg:block ${
              dragging ? "bg-blue-300/70" : ""
            }`}
          />
        )}
      </aside>

      {open && (
        <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setOpen(false)}>
          <span className="sr-only">Close navigation</span>
        </button>
      )}

      <main className={`min-h-screen min-w-0 lg:pl-[var(--dock)] ${dragging ? "" : "transition-[padding-left] duration-200"}`}>
        <header
          className={`app-header sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200/80 bg-white/90 px-3 py-2 backdrop-blur-xl sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-10 sm:py-0 ${
            collapsed ? "lg:pl-20" : ""
          }`}
        >
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* phone: search is just an icon until it's tapped (the dot shows a filter is active) */}
          {!searchOpen && (
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 sm:hidden"
            >
              <Search className="size-5" />
              {q && <span className="absolute right-2 top-2 size-2 rounded-full bg-blue-500" />}
            </button>
          )}

          {/* desktop: always visible. phone: only while open, filling the row */}
          <div className={`relative min-w-0 flex-1 sm:max-w-md ${searchOpen ? "" : "hidden sm:block"}`}>
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
              placeholder={searchPlaceholder}
              className="field pl-10 pr-10 sm:pr-4"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={closeSearch}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 sm:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* the open page puts its own buttons here (Import PDF, Literature matrix, ...).
              On phones they get their own row that scrolls sideways, so no icon is ever cut off.
              The top padding on phones leaves room for badges that overhang a button (e.g. Recent activity). */}
          <div
            ref={setHeaderActions}
            id="owlet-tour-collection-tools"
            className="order-last flex basis-full items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 empty:hidden sm:order-none sm:ml-auto sm:basis-auto sm:overflow-visible sm:pt-0 sm:pb-0"
          />

          <div className={`ml-auto shrink-0 items-center gap-1.5 sm:ml-0 sm:flex sm:gap-2.5 ${searchOpen ? "hidden" : "flex"}`}>
            <AiUsageIndicator compact />
            <NotificationsBell />
          </div>
        </header>

        <div className="app-content mx-auto max-w-5xl px-4 py-6 sm:px-10 sm:py-8 lg:py-10">
          <Outlet context={{ headerActions } satisfies LayoutContext} />
        </div>
      </main>
      <OnboardingModal
        key={onboardingStep}
        open={onboardingOpen}
        onClose={closeOnboarding}
        initialStep={onboardingStep}
        onSidebarNeeded={handleSidebarNeeded}
      />
    </div>
  );
}