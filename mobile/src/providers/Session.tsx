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
  message,
  authenticatedUser,
  API_URL,
} from "../api/client";
import type { User } from "../api/types";
import { completeSignOut } from "../api/logout";
import { removeGoogleSecret } from "../api/auth-secrets";
type Session = {
  user: User | null;
  ready: boolean;
  expired: boolean;
  expiryId: number;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  completeSignIn: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [expired, setExpired] = useState(false),
    [expiryId, setExpiryId] = useState(0), [error, setError] = useState("");
  const refresh = async () => {
    setReady(false); setError("");
    try {
      const result = await request<{ user: User | null }>("/api/auth/me");
      setUser(result.user);
      if (!result.user) await clearSession();
    } catch (e) { setError(message(e)); }
    finally { setReady(true); }
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
      .catch(e => { if (active) setError(e instanceof ApiError ? message(e) : "Chưa khôi phục được phiên an toàn. Vui lòng thử lại."); })
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
        error,
        refresh,
        completeSignIn: async () => {
          setUser(await authenticatedUser()); setExpired(false); setError("");
        },
        signIn: async (email, password) => {
          setUser(await apiLogin(email, password));
          setExpired(false);
          setError("");
        },
        signOut: async () => {
          await completeSignOut(async () => {
            try { await post("/api/auth/logout", {}); }
            catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
          }, async () => {
            try { await clearSession(); }
            finally { await Promise.all([removeGoogleSecret(API_URL, "flow"), removeGoogleSecret(API_URL, "profile")]); }
          }, () => { setUser(null); setExpired(false); });
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
