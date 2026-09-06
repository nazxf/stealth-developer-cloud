import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.number(),
  next_cursor: z.string().nullable(),
});

export type PaginationOptions = { limit?: number; cursor?: string };

/**
 * Shared limit/cursor query-string builder for paginated Go API endpoints.
 * Callers append endpoint-specific parameters to the returned URLSearchParams.
 */
export function paginationParams(options: PaginationOptions = {}) {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  return params;
}

export function paginatedPath(path: string, query: string) {
  return query ? `${path}?${query}` : path;
}
