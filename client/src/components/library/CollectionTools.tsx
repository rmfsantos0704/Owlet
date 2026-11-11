import { createPortal } from "react-dom";
import { NavLink, useOutletContext } from "react-router-dom";
import { FileText, LayoutGrid, Library as LibraryIcon, Settings, Table, type LucideIcon } from "lucide-react";
import { useCollections } from "../../context/CollectionContext";
import type { LayoutContext } from "../Layout";
import RecentActivity from "./RecentActivity";
import CollectionExportMenu from "./CollectionExportMenu";

// A button-styled link that highlights itself while its page is open (NavLink also sets aria-current="page").
function ToolLink({
  to,
  label,
  icon: Icon,
  showLabel = true,
  end = false,
  onClick,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  showLabel?: boolean;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={({ isActive }) => `btn-secondary !px-3 !py-2 ${isActive ? "!border-blue-200 !bg-blue-50 !text-brand" : ""}`}
    >
      <Icon className="size-4" />
      {showLabel && <span className="hidden 2xl:inline">{label}</span>}
    </NavLink>
  );
}

// The open collection's buttons in the top bar: Collection overview, Literature matrix, Research briefs, Evidence board,
// Recent activity, Export and Settings. Library, Literature matrix, Research briefs and Evidence board all render this,
// so the bar looks the same on each and the current page's button is highlighted. Renders into the layout's top-bar
// slot with a portal.
export default function CollectionTools({
  collection,
  canExport,
  reloadKey = 0,
}: {
  collection: { id: string; name: string };
  canExport: boolean;
  reloadKey?: number;
}) {
  const layout = useOutletContext<LayoutContext | undefined>();
  const headerActions = layout?.headerActions ?? null; // the spot in the top bar for this page's buttons
  const { select } = useCollections();
  if (!headerActions) return null;

  const base = `/Collection/${collection.id}`;
  return createPortal(
    <>
      {/* the overview (home page) shows the selected collection, so make this one the selected one first */}
      <ToolLink to="/" end label="Collection overview" icon={LibraryIcon} onClick={() => select(collection.id)} />
      <ToolLink to={`${base}/matrix`} label="Literature matrix" icon={Table} />
      <ToolLink to={`${base}/briefs`} label="Research briefs" icon={FileText} />
      <ToolLink to={`${base}/board`} label="Evidence board" icon={LayoutGrid} />
      <RecentActivity collectionId={collection.id} reloadKey={reloadKey} />
      {canExport && <CollectionExportMenu collectionId={collection.id} collectionName={collection.name} />}
      <ToolLink to={`${base}/settings`} label="Collection settings" icon={Settings} showLabel={false} />
    </>,
    headerActions
  );
}