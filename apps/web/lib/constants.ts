/** Every route of the web app. Import this instead of writing paths by hand. */
export const ROUTES = {
  home: "/",
  docs: "/docs",
  signIn: "/sign-in",
  onboarding: "/onboarding",
  /** Public profiles. */
  profile: (login: string) => `/u/${login}`,
  /** Pages behind sign-in. */
  dashboard: {
    feed: "/dashboard",
    contributions: "/dashboard/contributions",
    goals: "/dashboard/goals",
    subscriptions: "/dashboard/subscriptions",
    settings: "/dashboard/settings",
    apiKeys: "/dashboard/api-keys",
  },
  /** Admins only; everyone else gets a 404. */
  admin: {
    overview: "/admin-dashboard",
    users: "/admin-dashboard/users",
    repositories: "/admin-dashboard/repositories",
    labels: "/admin-dashboard/labels",
  },
} as const;
