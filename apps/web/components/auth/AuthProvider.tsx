"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { signOut as signOutRequest } from "@/lib/auth-client";
import { readCachedUser, USER_STORAGE_KEY, writeCachedUser } from "@/lib/local-storage";
import type { CurrentUser } from "@/lib/session";

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "signed-in"; user: CurrentUser }
  | { status: "signed-out"; user: null };

interface AuthContextValue {
  state: AuthState;
  /** Reads the session again, e.g. after changing settings. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch("/api/v1/me", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Reading the session failed (HTTP ${response.status})`);
  return (await response.json()) as CurrentUser;
}

/**
 * Knows who is signed in, in the browser. Pages stay static (prerendered); the session is read
 * once after load with GET /api/v1/me. Server components use `getCurrentUser()` instead.
 *
 * The last user is kept in localStorage and shown before the first paint after hydration, then
 * checked against the API (stale-while-revalidate). Signing out, here or in another tab, clears it.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      writeCachedUser(user);
      setState(user ? { status: "signed-in", user } : { status: "signed-out", user: null });
    } catch {
      // The API is unreachable: keep the cached user if there is one, else show signed-out.
      setState((current) =>
        current.status === "loading" ? { status: "signed-out", user: null } : current,
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
    writeCachedUser(null);
    setState({ status: "signed-out", user: null });
    router.refresh();
  }, [router]);

  // Before paint, so a returning user never sees the loading placeholder after hydration.
  useLayoutEffect(() => {
    const cached = readCachedUser();
    if (cached) setState({ status: "signed-in", user: cached });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keeps tabs in step: signing in or out in one updates the others.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== USER_STORAGE_KEY) return;
      const user = readCachedUser();
      setState(user ? { status: "signed-in", user } : { status: "signed-out", user: null });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <AuthContext value={{ state, refresh, signOut }}>{children}</AuthContext>;
}

/** The current auth state and actions. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
