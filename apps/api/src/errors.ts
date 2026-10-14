/** An error with an HTTP status and a stable machine-readable code, returned as JSON. */
export class ApiError extends Error {
  override name = "ApiError";
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found.`);
