import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Archive, ChevronRight, Highlighter, MessageSquareText } from "lucide-react";

const WORKSPACE_LINKS = [
  { to: "/all", label: "All clips", icon: Archive },
  { to: "/highlights", label: "Highlights", icon: Highlighter },
  { to: "/comments", label: "Comments", icon: MessageSquareText },
];

const OPEN_KEY = "owlet.sidebar.workspaces";

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0"; // open unless it was closed on purpose
  } catch {
    return true;
  }
};
const writeOpen = (open: boolean) => {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* storage unavailable: the setting just won't persist */
  }
};

type Props = {
  /** Called after a link is clicked (the layout uses it to close the mobile drawer). */
  onNavigate?: () => void;
};

export default function WorkspaceMenu({ onNavigate }: Props) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(readOpen);

  const activeLink = WORKSPACE_LINKS.find((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));

  function toggle() {
    setOpen((v) => {
      writeOpen(!v);
      return !v;
    });
  }

  return (
    <nav className="shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="workspace-links"
        className="group mb-2 flex w-full items-center justify-between gap-2 px-3"
      >
        {/* same markup as the "Collections" heading so the text renders at the same size */}
        <span className="flex items-center gap-1.5">
          <ChevronRight
            className={`size-3 text-slate-400 transition-transform group-hover:text-slate-600 ${open ? "rotate-90" : ""}`}
          />
          <span className="eyebrow">Workspaces</span>
        </span>
        {/* when closed, still show where you are */}
        {!open && activeLink && (
          <span className="truncate text-[11px] font-semibold normal-case tracking-normal text-brand">
            {activeLink.label}
          </span>
        )}
      </button>

      {open && (
        <div id="workspace-links" className="space-y-0.5">
          {WORKSPACE_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
                }`
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}