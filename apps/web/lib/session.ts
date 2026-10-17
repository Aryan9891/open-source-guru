import { cookies } from "next/headers";

/** The signed-in user, as returned by the API's GET /v1/me. */
export interface CurrentUser {
  id: string;
  login: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  digestHour: number;
  streakPeriod: "week" | "day";
  profilePublic: boolean;
  streakReminders: boolean;
  goalEmails: boolean;
  /** Admins can open the admin dashboard. */
  role: "user" | "admin";
}

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Server only. Reads the session by forwarding the browser's cookies to the API, so session
 * logic lives in one place (Better Auth, in the API). Returns null when nobody is signed in.
 *
 * Reads request cookies: with Cache Components, call it from a component inside <Suspense>.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const response = await fetch(`${apiInternalUrl}/v1/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Reading the session failed (HTTP ${response.status})`);
  return (await response.json()) as CurrentUser;
}
