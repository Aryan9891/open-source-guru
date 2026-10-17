// Types of the API's /v1/admin/* responses (admin dashboard).

export type UserRole = "user" | "admin";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FollowedLabel {
  name: string;
  subscriptions: number;
  users: number;
  repositories: number;
}

export interface AdminStats {
  users: {
    total: number;
    admins: number;
    publicProfiles: number;
    newLast7Days: number;
    newLast30Days: number;
  };
  signupsByDay: { date: string; count: number }[];
  repositories: {
    total: number;
    active: number;
    /** With subscriptions: polled for issues. */
    followed: number;
    /** Without subscriptions, stored to classify contributions. */
    fromContributions: number;
    openSource: number;
    withPollError: number;
  };
  subscriptions: { total: number; active: number };
  channels: { total: number; active: number };
  events: { total: number; last7Days: number };
  deliveries: Record<"pending" | "sent" | "failed" | "skipped", number>;
  contributions: number;
  activeGoals: number;
  apiKeys: number;
  topRepositories: { fullName: string; subscribers: number }[];
  topLabels: FollowedLabel[];
}

export interface AdminUser {
  id: string;
  login: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  profilePublic: boolean;
  subscriptions: number;
  createdAt: string;
}

/** Followed repositories are polled; the others only come from contribution syncs. */
export type RepositorySource = "followed" | "contributions";

export interface AdminRepository {
  id: string;
  fullName: string;
  url: string;
  status: "active" | "not_found" | "moved";
  isOpenSource: boolean | null;
  license: string | null;
  /** Users with a subscription to it. */
  followers: number;
  /** Users with contributions to it. */
  contributors: number;
  lastPolledAt: string | null;
  lastPollError: string | null;
  createdAt: string;
}
