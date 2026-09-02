import { cookies } from "next/headers";

const upstream = process.env.STEALTH_API_URL ?? "http://127.0.0.1:8080";
const cookieName = process.env.STEALTH_SESSION_COOKIE_NAME ?? "stealth_session";
const probeTimeoutMs = 5_000;

type Probe = {
  status: "healthy" | "degraded" | "down";
  http_status: number | null;
  message: string;
};

type ErrorEnvelope = { error?: { message?: string } };

/**
 * Authenticated, low-cardinality health data for the operator console.
 *
 * Prometheus remains an internal scrape endpoint; the browser never receives
 * raw metrics. This route only relays the public liveness/readiness contract
 * after proving that the caller owns a Console session.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) {
    return Response.json({ error: { code: "unauthorized", message: "Console session required" } }, { status: 401 });
  }

  const headers = { cookie: `${cookieName}=${token}` };
  const account = await probe("/v1/account", headers);
  if (account.http_status === 401) {
    return Response.json({ error: { code: "unauthorized", message: "Console session is invalid" } }, { status: 401 });
  }
  if (account.http_status === null) {
    return Response.json({ error: { code: "upstream_unavailable", message: "Stealth API is unavailable" } }, { status: 503 });
  }

  const [liveness, readiness] = await Promise.all([
    probe("/healthz", headers),
    probe("/readyz", headers),
  ]);

  return Response.json({
    checked_at: new Date().toISOString(),
    services: {
      api: liveness,
      platform: readiness,
    },
  });
}

async function probe(path: string, headers: HeadersInit): Promise<Probe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), probeTimeoutMs);
  try {
    const response = await fetch(new URL(path, upstream), {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as ErrorEnvelope | { status?: string } | null;
    if (response.ok) {
      return { status: "healthy", http_status: response.status, message: "Responding" };
    }
    return {
      status: response.status >= 500 ? "down" : "degraded",
      http_status: response.status,
      message: payload && "error" in payload && payload.error?.message ? payload.error.message : "Probe returned an error",
    };
  } catch {
    return { status: "down", http_status: null, message: "Probe timed out or the API is unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
