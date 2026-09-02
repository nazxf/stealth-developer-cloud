"use client";

import { useEffect, useState } from "react";

export type AdminProbe = {
  status: "healthy" | "degraded" | "down";
  http_status: number | null;
  message: string;
};

export type AdminHealth = {
  checked_at: string;
  services: {
    api: AdminProbe;
    platform: AdminProbe;
  };
};

type HealthState = {
  data: AdminHealth | null;
  loading: boolean;
  error: string | null;
};

const initialState: HealthState = { data: null, loading: true, error: null };

/**
 * Polls the authenticated admin health proxy. The proxy exposes only
 * liveness/readiness; raw Prometheus data stays on the private network.
 */
export function useAdminHealth(intervalMs = 15_000): HealthState {
  const [state, setState] = useState<HealthState>(initialState);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    const load = async () => {
      try {
        const response = await fetch("/api/admin/health", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as AdminHealth | { error?: { message?: string } } | null;
        if (!response.ok) {
          throw new Error(payload && "error" in payload && payload.error?.message ? payload.error.message : "Unable to check platform health");
        }
        if (!payload || !("services" in payload)) throw new Error("Invalid health response");
        if (!disposed) setState({ data: payload, loading: false, error: null });
      } catch (error) {
        if (!disposed) {
          setState((previous) => ({
            data: previous.data,
            loading: false,
            error: error instanceof Error ? error.message : "Unable to check platform health",
          }));
        }
      } finally {
        if (!disposed) timer = window.setTimeout(load, intervalMs);
      }
    };

    void load();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [intervalMs]);

  return state;
}
