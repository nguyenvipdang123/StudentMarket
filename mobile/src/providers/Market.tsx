import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNetworkState } from "expo-network";
import { AppState } from "react-native";
import { API_URL, post, request } from "../api/client";
import type { Catalog, Product } from "../api/types";
import { fetchCatalogue } from "../api/catalog";
import { createCatalogueStore } from "../state/catalogue";
import { createAccountStore } from "../state/account";
import { createPriceAlerts } from "../state/price-alerts";
import { localNotifications } from "../api/local-notifications";
import { createChatPoller } from "../api/chat-polling";
import { useSession } from "./Session";
type CatalogueStore = ReturnType<typeof createCatalogueStore>;
type AccountStore = ReturnType<typeof createAccountStore>;
const CatalogueContext = createContext<({ store: CatalogueStore; offline: boolean }) | null>(null);
const AccountContext = createContext<AccountStore | null>(null);
const PriceAlertsContext = createContext<ReturnType<typeof createPriceAlerts> | null>(null);
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
  const alerts = useMemo(() => createPriceAlerts(AsyncStorage, `sangtay.price-alerts.v1:${API_URL}:${actorId}`, `sangtay-price:${API_URL}:${actorId}:`, localNotifications), [actorId]);
  const store = useMemo(() => createAccountStore(AsyncStorage, `sangtay.account.v1:${API_URL}:${actorId}`, actorId, {
    read: async () => (await request<{ favorites: (Product & { productId: string })[] }>("/api/favorites")).favorites.map(p => ({ ...p, id: p.productId, description: p.description || "" })),
    toggle: async productId => (await post<{ isSaved: boolean }>("/api/favorites", { productId })).isSaved,
  }, alerts.notify), [actorId, alerts]);
  useEffect(() => { alerts.activate(); return () => alerts.dispose(); }, [alerts]);
  useEffect(() => { store.activate(); return () => store.dispose(); }, [store]);
  useEffect(() => {
    if (!actorId || offline) return;
    const poller = createChatPoller(async isCurrent => { if (isCurrent()) await store.refresh(); }, 60000);
    const update = (state: string | null | undefined) => { if (state === "active" || state == null) poller.resume(); else poller.pause(); };
    const subscription = AppState.addEventListener("change", update);
    update(AppState.currentState);
    return () => { poller.dispose(); subscription.remove(); };
  }, [actorId, store, offline]);
  return <PriceAlertsContext.Provider value={alerts}><AccountContext.Provider value={store}>{children}</AccountContext.Provider></PriceAlertsContext.Provider>;
}
export function useCatalogue() {
  const ctx = useContext(CatalogueContext);
  if (!ctx) throw Error("Catalogue provider missing");
  const state = useSyncExternalStore(ctx.store.subscribe, ctx.store.getSnapshot, ctx.store.getSnapshot);
  const refresh = useCallback(() => ctx.store.refresh(ctx.offline), [ctx.store, ctx.offline]);
  return { ...state, offline: ctx.offline, refresh };
}
export function useAccountMarket<T = ReturnType<AccountStore["getSnapshot"]>>(selector: (state: ReturnType<AccountStore["getSnapshot"]>) => T = state => state as T) {
  const store = useContext(AccountContext);
  if (!store) throw Error("Account market provider missing");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, selected: selector(state), store };
}
export function usePriceAlerts() {
  const store = useContext(PriceAlertsContext);
  if (!store) throw Error("Price alerts provider missing");
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), store };
}
