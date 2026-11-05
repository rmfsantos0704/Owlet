import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Archive, ChevronRight, CircleHelp, Highlighter, MessageSquareText, Sparkles, Table } from "lucide-react";
import { openOnboardingAt } from "../utils/onboarding";

const WORKSPACE_LINKS = [
  { to: "/all", label: "All clips", icon: Archive },
  { to: "/highlights", label: "Highlights", icon: Highlighter },
  { to: "/comments", label: "Comments", icon: MessageSquareText },
  { to: "/matrix", label: "Literature matrix", icon: Table },
  { to: "/ai", label: "AI workspace", icon: Sparkles },
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
  tourActive?: boolean;
};

export default function WorkspaceMenu({ onNavigate, tourActive = false }: Props) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(readOpen);
  const expanded = open || tourActive;

  const activeLink = WORKSPACE_LINKS.find((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));

  function toggle() {
    setOpen((v) => {
      writeOpen(!v);
      return !v;
    });
  }

  return (
    <nav className="shrink-0" id="owlet-tour-workspaces" data-onboarding-target="workspaces">
      <div className="mb-2 flex items-center justify-between gap-2 px-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls="workspace-links"
          className="group flex min-w-0 flex-1 items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={`size-3 text-slate-400 transition-transform group-hover:text-slate-600 ${expanded ? "rotate-90" : ""}`}
            />
            <span className="eyebrow">Workspaces</span>
          </span>
          {!expanded && activeLink && (
            <span className="truncate text-[11px] font-semibold normal-case tracking-normal text-brand">
              {activeLink.label}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => openOnboardingAt(0)}
          title="About workspaces"
          aria-label="About workspaces"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div id="workspace-links" className="space-y-0.5">
          {WORKSPACE_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-brand"
                }`
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.9} />
              <span className="max-sm:sr-only">{label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}