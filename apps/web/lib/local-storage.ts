// Browser-only localStorage helpers. Every access is guarded: storage can be blocked
// (private mode, quota, disabled site data), and callers must work without it.

import { z } from "zod";
import type { CurrentUser } from "@/lib/session";

// The last user read from /api/v1/me, so a reload shows the signed-in UI without waiting for
// the request. Only a hint: the session is still checked after load, and a 401 clears it.
export const USER_STORAGE_KEY = "osg:current-user:v1";

// Stored data can be stale or edited by hand, so it's checked before use. `satisfies` fails the
// build if this drifts from `CurrentUser`.
const cachedUserSchema = z.object({
  id: z.string(),
  login: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  timezone: z.string(),
  digestHour: z.number().int(),
  streakPeriod: z.enum(["week", "day"]),
  profilePublic: z.boolean(),
  streakReminders: z.boolean(),
  goalEmails: z.boolean(),
  // Users cached before roles existed; the API's answer replaces it right after load.
  role: z.enum(["user", "admin"]).default("user"),
}) satisfies z.ZodType<CurrentUser>;

export function readCachedUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = cachedUserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Saves the user, or removes it when `user` is null. */
export function writeCachedUser(user: CurrentUser | null): void {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Storage is blocked: auth still works, just without the hint.
  }
}
