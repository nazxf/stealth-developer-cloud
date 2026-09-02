import { NextRequest } from "next/server";
import { forwardHeaders, isAllowedStealthPath, relayHeaders } from "@/lib/stealth-bridge";

const upstream = process.env.STEALTH_API_URL ?? "http://127.0.0.1:8080";
const timeoutMs = 10_000;
const realtimeTimeoutMs = 5 * 60_000 + 30_000;
const uploadTimeoutMs = 5 * 60_000;
const requestBodyLimit = 1 * 1024 * 1024;
const defaultUploadFileSize = 50 * 1024 * 1024;
const defaultFunctionSourceSize = 25 * 1024 * 1024;
const defaultSiteArchiveSize = 50 * 1024 * 1024;
const multipartOverhead = 2 * 1024 * 1024;

function parseByteSize(raw: string | undefined, fallback: number) {
  if (!raw?.trim()) return fallback;
  const match = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(b|kib|mib|gib|tib)?$/i);
  if (!match) return fallback;
  const multiplier = { b: 1, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 }[(match[2] ?? "b").toLowerCase() as "b" | "kib" | "mib" | "gib" | "tib"];
  const value = Number(match[1]) * multiplier;
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function uploadLimit(kind: "storage" | "function" | "site") {
  const fallback = kind === "storage" ? defaultUploadFileSize : kind === "function" ? defaultFunctionSourceSize : defaultSiteArchiveSize;
  const configured = kind === "storage"
    ? parseByteSize(process.env.STEALTH_STORAGE_MAX_FILE_SIZE ?? process.env.STORAGE_MAX_FILE_SIZE, defaultUploadFileSize)
    : kind === "function"
      ? parseByteSize(process.env.STEALTH_FUNCTIONS_MAX_ARTIFACT_SIZE ?? process.env.FUNCTIONS_MAX_ARTIFACT_SIZE, defaultFunctionSourceSize)
      : parseByteSize(process.env.STEALTH_SITES_MAX_ARTIFACT_SIZE ?? process.env.SITES_MAX_ARTIFACT_SIZE, defaultSiteArchiveSize);
  return configured <= Number.MAX_SAFE_INTEGER - multipartOverhead ? configured + multipartOverhead : fallback + multipartOverhead;
}

function limitedBody(body: ReadableStream<Uint8Array> | null, limit: number, overflow: { value: boolean }) {
  if (!body) return body;
  let total = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > limit) {
        overflow.value = true;
        controller.error(new Error("request body exceeds upload limit"));
        return;
      }
      controller.enqueue(chunk);
    },
  }));
}

async function bridge(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!isAllowedStealthPath(path, request.method)) return Response.json({ error: { code: "not_found", message: "Route not found" } }, { status: 404 });
  const url = new URL(`/v1/${path.join("/")}`, upstream);
  url.search = request.nextUrl.search;
  const controller = new AbortController();
  const isRealtime = request.method === "GET" && path.at(-1) === "realtime";
  const uploadKind = request.method === "POST" && path.at(-1) === "files" ? "storage" : request.method === "POST" && path.at(-1) === "deployments" && path.includes("functions") ? "function" : request.method === "POST" && path.at(-1) === "deployments" && path.includes("sites") ? "site" : null;
  const isUpload = uploadKind !== null;
  const isBinaryDownload = request.method === "GET" && path.at(-1) === "download";
  const timer = setTimeout(() => controller.abort(), isRealtime ? realtimeTimeoutMs : isUpload || isBinaryDownload ? uploadTimeoutMs : timeoutMs);
  const overflow = { value: false };
  try {
    const headers = forwardHeaders(request.headers);
    let body: BodyInit | undefined;
    let duplex: "half" | undefined;
    if (!["GET", "HEAD"].includes(request.method)) {
      if (isUpload) {
        const limit = uploadLimit(uploadKind);
        if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > limit) {
          return Response.json({ error: { code: "payload_too_large", message: "request body exceeds the configured upload limit" } }, { status: 413 });
        }
        body = limitedBody(request.body, limit, overflow) as unknown as BodyInit;
        duplex = "half";
      } else {
        if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > requestBodyLimit) {
          return Response.json({ error: { code: "payload_too_large", message: "request body exceeds the configured limit" } }, { status: 413 });
        }
        body = limitedBody(request.body, requestBodyLimit, overflow) as unknown as BodyInit;
        duplex = "half";
      }
    }
    const response = await fetch(url, { method: request.method, headers, body, ...(duplex ? { duplex } : {}), cache: "no-store", signal: controller.signal } as RequestInit & { duplex?: "half" });
    const responseHeaders = relayHeaders(response.headers);
    const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : [];
    for (const value of setCookies) responseHeaders.append("set-cookie", value);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    if (overflow.value) return Response.json({ error: { code: "payload_too_large", message: `request body exceeds the configured ${isUpload ? "upload " : ""}limit` } }, { status: 413 });
    return Response.json({ error: { code: "upstream_unavailable", message: "Stealth API is unavailable" } }, { status: 503 });
  } finally { clearTimeout(timer); }
}
export const GET = bridge;
export const POST = bridge;
export const PATCH = bridge;
export const DELETE = bridge;
export const PUT = bridge;
