import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { listingDraftStore } from "../api/listing-drafts";

export function useListingDraft(actor: string) {
  const store = useMemo(() => listingDraftStore(actor), [actor]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    const listener = AppState.addEventListener("change", next => {
      if (next !== "active") void store.save();
    });
    return () => { listener.remove(); void store.save(); };
  }, [store]);
  return { state, store };
}
