// Browser-side calls to Better Auth, which the web app forwards to the API at /api/auth/*.

export interface SignInRedirects {
  /** Where returning users land. */
  callbackURL: string;
  /** Where people who just created their account land. */
  newUserCallbackURL: string;
  /** Where to come back when sign-in fails; Better Auth adds `?error=<code>`. */
  errorCallbackURL: string;
}

/** Starts "Sign in with GitHub": asks for the GitHub authorization URL, then goes there. */
export async function startGitHubSignIn(redirects: SignInRedirects): Promise<void> {
  const response = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "github", ...redirects }),
  });
  if (!response.ok) throw new Error(`Starting the sign-in failed (HTTP ${response.status})`);
  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new Error("The sign-in response had no GitHub URL");
  window.location.assign(url);
}

/** Signs out and clears the session cookie. */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}
