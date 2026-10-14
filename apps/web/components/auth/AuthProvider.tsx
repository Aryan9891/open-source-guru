"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";
import { signOut as signOutRequest } from "@/lib/auth-client";
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
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setState(user ? { status: "signed-in", user } : { status: "signed-out", user: null });
    } catch {
      // The API is unreachable: show the signed-out UI rather than nothing.
      setState({ status: "signed-out", user: null });
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
    setState({ status: "signed-out", user: null });
    router.refresh();
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <AuthContext value={{ state, refresh, signOut }}>{children}</AuthContext>;
}

/** The current auth state and actions. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
