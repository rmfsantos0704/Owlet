import { Link } from "react-router-dom";

export default function PublicSiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-400 sm:px-5">
      Owlet © 2026{" "}
      <span aria-hidden="true">·</span>{" "}
      <Link to="/privacy" className="hover:text-slate-600 hover:underline">
        Privacy
      </Link>{" "}
      <span aria-hidden="true">·</span>{" "}
      <Link to="/terms" className="hover:text-slate-600 hover:underline">
        Terms
      </Link>
    </footer>
  );
}
