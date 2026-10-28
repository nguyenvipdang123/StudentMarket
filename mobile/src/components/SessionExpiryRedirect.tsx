import { useEffect, useRef } from "react";
import { router, usePathname, useRootNavigationState } from "expo-router";
import { useSession } from "../providers/Session";

/** Runs after the root navigator mounts and consumes each expiry event once. */
export function SessionExpiryRedirect() {
  const { ready, expired, expiryId } = useSession();
  const pathname = usePathname();
  const navigation = useRootNavigationState();
  const handled = useRef(0);
  useEffect(() => {
    if (!ready || !expired || !navigation?.key || expiryId <= handled.current)
      return;
    handled.current = expiryId;
    if (pathname !== "/login") router.push("/login");
  }, [ready, expired, expiryId, pathname, navigation?.key]);
  return null;
}
