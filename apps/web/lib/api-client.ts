// Browser-side calls to the API, which the web app forwards from /api/* (session cookie included).

/** An API error, with the API's machine-readable code and human-readable message. */
export class ApiRequestError extends Error {
  override name = "ApiRequestError";
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Calls `/api{path}` with an optional JSON body and returns the parsed JSON (or null for 204).
 * Throws an ApiRequestError carrying the API's message when the response isn't OK.
 */
export async function apiFetch<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? {} : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (response.status === 204) return null as T;

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null;
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload?.error ?? "error",
      payload?.message ?? "Something went wrong. Try again in a moment.",
    );
  }
  return payload as T;
}
