// Public profiles, read on the server from the API (no caching: turning a profile off is
// immediate).
import type { Stats } from "./contributions";
import type { GoalMetric, GoalPeriod, GoalRecurrence, GoalRepoScope } from "./goals";

export interface PublicGoal {
  id: string;
  metric: GoalMetric;
  target: number;
  recurrence: GoalRecurrence;
  endsOn: string | null;
  repoScope: GoalRepoScope;
  repo: { fullName: string; url: string } | null;
  current: GoalPeriod | null;
}

export interface PublicProfile {
  login: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  githubUrl: string;
  stats: Stats;
  goals: PublicGoal[];
}

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/** Server only. Null when the user doesn't exist or their profile is off. */
export async function fetchProfile(
  login: string,
  year: number | null,
): Promise<PublicProfile | null> {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return null;
  const query = year === null ? "" : `?year=${year}`;
  const response = await fetch(`${apiInternalUrl}/v1/public/profiles/${login}${query}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Reading the profile failed (HTTP ${response.status})`);
  return (await response.json()) as PublicProfile;
}
