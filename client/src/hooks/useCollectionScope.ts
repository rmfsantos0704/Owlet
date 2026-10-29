import { useEffect, useState } from "react";
import { useCollections } from "../context/CollectionContext";

/**
 * Lets a page look at one collection or at all of them, independent of the sidebar's current collection.
 * It follows the current collection by default and resets to it whenever the current collection changes.
 */
export function useCollectionScope() {
  const { current, ready, collections } = useCollections();
  const [picked, setPicked] = useState("");

  useEffect(() => {
    setPicked("");
  }, [current?.id]);

  const list = collections ?? [];
  const scope = picked || current?.id || "all";
  const scopeCollection = scope === "all" ? undefined : (list.find((c) => c.id === scope) ?? current ?? undefined);
  const qs = scope === "all" ? "" : `?collectionId=${scope}`;
  const options = [{ value: "all", label: "All collections" }, ...list.map((c) => ({ value: c.id, label: c.name }))];

  return { ready, scope, setScope: setPicked, scopeCollection, qs, options };
}