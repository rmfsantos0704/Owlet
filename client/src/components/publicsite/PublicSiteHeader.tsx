import { Link, useLocation } from "react-router-dom";

const links = [
  { label: "About", to: "/about" },
  { label: "Extension", to: "/extension" },
  { label: "Log in", to: "/login" },
];

export default function PublicSiteHeader() {
  const { pathname } = useLocation();

  return (
    <header className="border-b border-slate-200/80 bg-white/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link to="/about" aria-label="Owlet home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <img src="/logo.png" alt="Owlet" className="h-10 w-auto object-contain" />
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
          {links.map(({ label, to }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                  active
                    ? "bg-blue-50 text-blue-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
