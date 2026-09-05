import { z } from "zod";

/**
 * Shared transport boundary for browser calls to the Go API.
 *
 * Domain clients should only provide a path, request init, and a Zod schema.
 * Keeping credential handling, error normalization, trace propagation, and
 * response validation here prevents every feature from reimplementing the
 * browser/API boundary differently.
 */
export class BrowserAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly traceID?: string,
  ) {
    super(message);
    this.name = "BrowserAPIError";
  }
}

const httpErrorMessages: Record<number, string> = {
  401: "Your Console session has expired. Sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This resource already exists or is already being processed.",
  422: "Some submitted values are invalid.",
  429: "Too many requests. Try again shortly.",
};

/** Turn errors crossing the browser/API boundary into safe, actionable copy. */
export function browserAPIErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof BrowserAPIError)) return fallback;
  const rawMessage = error.message.trim();
  const message = !rawMessage || rawMessage === "Stealth API request failed"
    ? httpErrorMessages[error.status] || (error.status >= 500 ? "Stealth is temporarily unavailable. Try again shortly." : fallback)
    : rawMessage;
  return error.traceID ? `${message} (Reference: ${error.traceID})` : message;
}

const configuredAPIOrigin = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

export function apiURL(path: string) {
  if (!configuredAPIOrigin) return path;
  return new URL(path, `${configuredAPIOrigin}/`).toString();
}

function responseTraceID(response: Response) {
  return response.headers.get("X-Trace-ID")?.trim() || undefined;
}

function invalidResponseError(traceID?: string) {
  return new BrowserAPIError(502, "invalid_api_response", "Stealth returned an unexpected response. Try again shortly.", traceID);
}

export async function fetchAPI(path: string, init: RequestInit = {}) {
  try {
    return await fetch(apiURL(path), {
      ...init,
      credentials: "include",
    });
  } catch {
    throw new BrowserAPIError(0, "network_error", "Unable to reach Stealth. Check your connection and try again.");
  }
}

export async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(typeof FormData !== "undefined" && init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetchAPI(path, { ...init, headers });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new BrowserAPIError(
      response.status,
      payload?.error?.code ?? "upstream_error",
      payload?.error?.message ?? "Stealth API request failed",
      responseTraceID(response),
    );
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => {
    throw invalidResponseError(responseTraceID(response));
  });
  try {
    return schema.parse(payload);
  } catch {
    throw invalidResponseError(responseTraceID(response));
  }
}

export async function download(path: string) {
  const response = await fetchAPI(path, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new BrowserAPIError(
      response.status,
      payload?.error?.code ?? "upstream_error",
      payload?.error?.message ?? "Stealth API request failed",
      responseTraceID(response),
    );
  }
  try {
    return await response.blob();
  } catch {
    throw invalidResponseError(responseTraceID(response));
  }
}
