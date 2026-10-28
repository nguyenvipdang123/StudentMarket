import AsyncStorage from "@react-native-async-storage/async-storage";
import { createListingDraftStore, type ListingDraftStore } from "../state/listing-draft";
import { draftMedia } from "./listing-draft-files";
import { API_URL } from "./client";

// Reuse one queue per account across navigation/unmounts; two screens cannot race old writes.
const stores = new Map<string, ListingDraftStore>();
export function listingDraftStore(actor: string) {
  const scope = `${API_URL}:${actor}`;
  let store = stores.get(scope);
  if (!store) {
    store = createListingDraftStore(AsyncStorage, draftMedia(scope), scope);
    stores.set(scope, store);
  }
  return store;
}
