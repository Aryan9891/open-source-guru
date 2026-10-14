const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** Accepts `owner/name` or a GitHub URL, like the API does. Returns `owner/name`, or null. */
export function parseRepo(input: string): string | null {
  const path = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/\/+$/, "");
  const [owner, name] = path.split("/");
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name)) return null;
  return `${owner}/${name.replace(/\.git$/, "")}`;
}
