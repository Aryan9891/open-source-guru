/** Every route of the web app. Import this instead of writing paths by hand. */
export const ROUTES = {
  home: "/",
  docs: "/docs",
  signIn: "/sign-in",
  onboarding: "/onboarding",
  /** Pages behind sign-in. */
  dashboard: {
    feed: "/dashboard",
    subscriptions: "/dashboard/subscriptions",
    settings: "/dashboard/settings",
    apiKeys: "/dashboard/api-keys",
  },
} as const;
