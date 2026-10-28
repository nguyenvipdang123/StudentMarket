import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNetworkState } from "expo-network";
import { API_URL, post, request } from "../api/client";
import type { Catalog, Product } from "../api/types";
import { fetchCatalogue } from "../api/catalog";
import { createCatalogueStore } from "../state/catalogue";
import { createAccountStore } from "../state/account";
import { useSession } from "./Session";
type CatalogueStore = ReturnType<typeof createCatalogueStore>;
type AccountStore = ReturnType<typeof createAccountStore>;
const CatalogueContext = createContext<({ store: CatalogueStore; offline: boolean }) | null>(null);
const AccountContext = createContext<AccountStore | null>(null);
export function MarketProvider({ children }: { children: ReactNode }) {
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [store] = useState(() => createCatalogueStore(AsyncStorage, `sangtay.catalogue.v1:${API_URL}`, () => fetchCatalogue(path => request<Catalog>(path))));
  const { user } = useSession();
  useEffect(() => { void store.refresh(offline); }, [store, offline]);
  return <CatalogueContext.Provider value={{ store, offline }}>
    <AccountMarket actorId={user ? user.pgUserId || String(user.id) : undefined} offline={offline}>{children}</AccountMarket>
  </CatalogueContext.Provider>;
}
function AccountMarket({ children, actorId, offline }: { children: ReactNode; actorId?: string; offline: boolean }) {
  const store = useMemo(() => createAccountStore(AsyncStorage, `sangtay.account.v1:${API_URL}:${actorId}`, actorId, {
    read: async () => (await request<{ favorites: (Product & { productId: string })[] }>("/api/favorites")).favorites.map(p => ({ ...p, id: p.productId, description: p.description || "" })),
    toggle: async productId => (await post<{ isSaved: boolean }>("/api/favorites", { productId })).isSaved,
  }), [actorId]);
  useEffect(() => { store.activate(); return () => store.dispose(); }, [store]);
  useEffect(() => { void store.refresh(offline); }, [store, offline]);
  return <AccountContext.Provider value={store}>{children}</AccountContext.Provider>;
}
export function useCatalogue() {
  const ctx = useContext(CatalogueContext);
  if (!ctx) throw Error("Catalogue provider missing");
  const state = useSyncExternalStore(ctx.store.subscribe, ctx.store.getSnapshot, ctx.store.getSnapshot);
  const refresh = useCallback(() => ctx.store.refresh(ctx.offline), [ctx.store, ctx.offline]);
  return { ...state, offline: ctx.offline, refresh };
}
export function useAccountMarket() {
  const store = useContext(AccountContext);
  if (!store) throw Error("Account market provider missing");
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), store };
}
