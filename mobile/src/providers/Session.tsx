import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  login as apiLogin,
  post,
  request,
  restoreSession,
  onSessionExpired,
  ApiError,
} from "../api/client";
import type { User } from "../api/types";
import { completeSignOut } from "../api/logout";
type Session = {
  user: User | null;
  ready: boolean;
  expired: boolean;
  expiryId: number;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [expired, setExpired] = useState(false),
    [expiryId, setExpiryId] = useState(0);
  const refresh = async () => {
    const result = await request<{ user: User | null }>("/api/auth/me");
    setUser(result.user);
    if (!result.user) await clearSession();
  };
  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionExpired(() => {
      if (!active) return;
      setUser(null);
      setExpired(true);
      setExpiryId((id) => id + 1);
    });
    void restoreSession()
      .then((restored) =>
        restored
          ? request<{ user: User | null }>("/api/auth/me")
          : { user: null },
      )
      .then(async (result) => {
        if (active) setUser(result.user);
        if (!result.user) await clearSession();
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        ready,
        expired,
        expiryId,
        refresh,
        signIn: async (email, password) => {
          setUser(await apiLogin(email, password));
          setExpired(false);
        },
        signOut: async () => {
          await completeSignOut(async () => {
            try { await post("/api/auth/logout", {}); }
            catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
          }, clearSession, () => { setUser(null); setExpired(false); });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw Error("Session provider missing");
  return value;
}
