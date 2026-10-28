import { useEffect, useState, type FormEvent } from "react";
import Modal from "./Modal";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import type { Collection } from "../types";

// Edit a collection's name and description from the sidebar menu. Only owners can save changes.
export default function EditCollectionModal({
  collection,
  open,
  onClose,
}: {
  collection: Collection;
  open: boolean;
  onClose: () => void;
}) {
  const { reload } = useCollections();
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // start from the saved values every time it opens
  useEffect(() => {
    if (!open) return;
    setName(collection.name);
    setDescription(collection.description ?? "");
    setError("");
  }, [open, collection.name, collection.description]);

  const trimmed = name.trim();
  const unchanged = trimmed === collection.name && description.trim() === (collection.description ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !trimmed || unchanged) return;
    setBusy(true);
    setError("");
    try {
      await api(`/collections/${collection.id}`, {
        method: "PATCH",
        body: { name: trimmed, description: description.trim() },
      });
      await reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit collection"
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-collection-form"
            disabled={busy || !trimmed || unchanged}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-collection-form" onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="edit-collection-name" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Name
          </label>
          <input
            id="edit-collection-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            maxLength={80}
            required
            className="field"
          />
        </div>
        <div>
          <label htmlFor="edit-collection-description" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="edit-collection-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="What is this collection for?"
            className="field resize-y"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">{description.length}/300</div>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}