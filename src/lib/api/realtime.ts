import { fetchAPI } from "../api-core";

export const realtimeAPI = {
  openProjectRealtime: (projectID: string, options: { events?: string; cursor?: string; signal?: AbortSignal } = {}) => {
    const params = new URLSearchParams({ events: options.events || "*" });
    if (options.cursor) params.set("cursor", options.cursor);
    return fetchAPI(`/v1/projects/${encodeURIComponent(projectID)}/realtime?${params.toString()}`, {
      headers: { accept: "text/event-stream" },
      cache: "no-store",
      signal: options.signal,
    });
  },
};
