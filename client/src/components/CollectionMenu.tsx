import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Folder,
  LogOut,
  Merge,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Settings,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import EditCollectionModal from "./EditCollectionModal";
import type { Collection } from "../types";

const MENU_W = 224; // w-56
const ROW_H = 36;
const SUB_H = 34;

type Item = {
  key: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  group: 1 | 2;
  danger?: boolean;
  keepOpen?: boolean; // choosing it expands something instead of closing the menu
  run: () => void | Promise<void>;
};

// The three-dot menu beside a collection in the sidebar. It renders in a portal so the sidebar's
// scroll area never clips it. Pin and Archive are personal (they only change your own sidebar);
// Edit details, Merge and Delete are for owners; everyone else can Leave.
export default function CollectionMenu({ collection, onNavigate }: { collection: Collection; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const dialog = useDialog();
  const { collections, current, select, reload, pinned, archived, togglePin, toggleArchive } = useCollections();
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const id = collection.id;
  const owner = collection.role === "owner";
  const isPinned = pinned.includes(id);
  const isArchived = archived.includes(id);
  const removable = owner && !collection.isDefault;

  // collections this one could be merged into: ones you can add clips to
  const mergeTargets = collections.filter((c) => c.id !== id && c.role !== "viewer");

  async function attempt(fn: () => Promise<void>, fallback: string) {
    try {
      await fn();
    } catch (e) {
      await dialog.alert({ title: "Something went wrong", message: e instanceof Error ? e.message : fallback });
    }
  }

  // after a collection leaves the sidebar, move off it if it was the one being viewed
  function leaveIfCurrent(hidden: string) {
    if (current?.id !== hidden) return;
    const next = collections.find((c) => c.id !== hidden && !archived.includes(c.id));
    if (next) select(next.id);
    navigate("/");
    onNavigate?.();
  }

  function archive() {
    if (!isArchived && collections.filter((c) => !archived.includes(c.id)).length <= 1) {
      void dialog.alert({ title: "Can't archive this one", message: "Keep at least one collection unarchived." });
      return;
    }
    toggleArchive(id);
    if (!isArchived) leaveIfCurrent(id);
  }

  async function merge(target: Collection) {
    const others = (collection.memberCount ?? 1) - 1;
    const ok = await dialog.confirm({
      title: `Merge into "${target.name}"?`,
      message:
        `All the clips in "${collection.name}" move to "${target.name}" (clips already there are skipped). ` +
        `"${collection.name}" is then deleted` +
        (others > 0 ? `, and its ${others} other member${others === 1 ? "" : "s"} lose access to it` : "") +
        `.\n\nThis can't be undone.`,
      confirmLabel: "Merge",
      danger: true,
    });
    if (!ok) return;
    return attempt(async () => {
      const r = await api<{ moved: number; skipped: number }>(`/collections/${id}/merge`, {
        method: "POST",
        body: { targetId: target.id },
      });
      await reload();
      select(target.id);
      navigate("/");
      onNavigate?.();
      await dialog.alert({
        title: "Merge complete",
        message: `Moved ${r.moved} clip${r.moved === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped} already in "${target.name}"` : ""}.`,
      });
    }, "Could not merge the collections");
  }

  const items: Item[] = [
    {
      key: "pin",
      label: isPinned ? "Unpin" : "Pin",
      icon: isPinned ? PinOff : Pin,
      shortcut: "P",
      group: 1,
      run: () => togglePin(id),
    },
  ];

  if (removable) {
    items.push({
      key: "edit",
      label: "Edit details",
      icon: Pencil,
      shortcut: "E",
      group: 1,
      run: () => setEditing(true),
    });
    if (mergeTargets.length > 0) {
      items.push({
        key: "merge",
        label: "Merge into…",
        icon: Merge,
        shortcut: "M",
        group: 1,
        keepOpen: true,
        run: () => setMergeOpen((v) => !v),
      });
    }
  }

  items.push({
    key: "settings",
    label: "Settings & members",
    icon: Settings,
    shortcut: "S",
    group: 1,
    run: () => {
      navigate(`/Collection/${id}/settings`);
      onNavigate?.();
    },
  });

  if (!collection.isDefault) {
    items.push({
      key: "archive",
      label: isArchived ? "Unarchive" : "Archive",
      icon: isArchived ? ArchiveRestore : Archive,
      shortcut: "A",
      group: 2,
      run: archive,
    });
  }

  if (removable) {
    items.push({
      key: "delete",
      label: "Delete collection",
      icon: Trash2,
      shortcut: "D",
      group: 2,
      danger: true,
      run: async () => {
        const ok = await dialog.confirm({
          title: `Delete "${collection.name}"?`,
          message: "Its clips, highlights and comments are permanently removed for everyone. This can't be undone.",
          confirmLabel: "Delete collection",
          danger: true,
        });
        if (!ok) return;
        return attempt(async () => {
          await api(`/collections/${id}`, { method: "DELETE" });
          await reload();
          navigate("/");
          onNavigate?.();
        }, "Could not delete the collection");
      },
    });
  }

  if (!owner) {
    items.push({
      key: "leave",
      label: "Leave collection",
      icon: LogOut,
      shortcut: "L",
      group: 2,
      danger: true,
      run: async () => {
        const ok = await dialog.confirm({
          title: `Leave "${collection.name}"?`,
          message: "You'll lose access until someone invites you again.",
          confirmLabel: "Leave",
          danger: true,
        });
        if (!ok) return;
        return attempt(async () => {
          await api(`/collections/${id}/members/me`, { method: "DELETE" });
          await reload();
          navigate("/");
          onNavigate?.();
        }, "Could not leave the collection");
      },
    });
  }

  itemsRef.current = items;

  function toggle() {
    if (open) return setOpen(false);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const height = items.length * ROW_H + 16;
    const below = r.bottom + 4 + height <= window.innerHeight;
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height),
      left: Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8),
    });
    setMergeOpen(false);
    setOpen(true);
  }

  function choose(item: Item) {
    if (!item.keepOpen) setOpen(false);
    void item.run();
  }

  // close on outside click, Escape, resize or scroll; letters trigger the matching item
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const item = itemsRef.current.find((i) => i.shortcut === e.key.toUpperCase());
      if (!item) return;
      e.preventDefault();
      if (!item.keepOpen) setOpen(false);
      void item.run();
    };
    const onScroll = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return; // scrolling the menu itself is fine
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <EditCollectionModal collection={collection} open={editing} onClose={() => setEditing(false)} />
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-label={`Options for ${collection.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 ${
          open ? "bg-slate-200/70 text-slate-700 lg:opacity-100" : ""
        }`}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_W, maxHeight: `calc(100vh - ${pos.top}px - 8px)` }}
            className="fixed z-[60] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              const newGroup = i > 0 && items[i - 1].group !== item.group;
              return (
                <div key={item.key}>
                  {newGroup && <div className="my-1 h-px bg-slate-100" />}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => choose(item)}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium transition ${
                      item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.keepOpen ? (
                      <ChevronRight className={`size-3.5 text-slate-400 transition-transform ${mergeOpen ? "rotate-90" : ""}`} />
                    ) : (
                      item.shortcut && <span className="text-[11px] font-medium text-slate-400">{item.shortcut}</span>
                    )}
                  </button>
                  {item.key === "merge" && mergeOpen && (
                    <div className="mb-1 ml-3 max-h-48 overflow-y-auto border-l border-slate-100 pl-1.5">
                      {mergeTargets.map((t) => (
                        <button
                          key={t.id}
                          role="menuitem"
                          type="button"
                          style={{ height: SUB_H }}
                          onClick={() => {
                            setOpen(false);
                            void merge(t);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-slate-600 hover:bg-slate-100"
                        >
                          <Folder className="size-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}