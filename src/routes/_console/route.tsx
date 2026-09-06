import { createFileRoute, redirect } from "@tanstack/react-router";
import { ConsoleLayout } from "@/start/console-layout";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Shared protected boundary for the console. This deliberately runs only in
 * the browser during the SPA-first phase: the Go API session cookie is not
 * available to a static shell. The Start client then renders the protected
 * file-based route hierarchy below this boundary.
 */
export const Route = createFileRoute("/_console")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;

    // Keep the sizeable Zod/API client out of the Start document entry. It is
    // needed only when a protected route is entered in the browser.
    const { BrowserAPIError, browserAPI } = await import("@/lib/browser-api");
    try {
      await queryClient.ensureQueryData({
        queryKey: queryKeys.account(),
        queryFn: browserAPI.currentAccount,
        retry: false,
      });
    } catch (error) {
      if (error instanceof BrowserAPIError && error.status === 401) {
        throw redirect({ to: "/login", replace: true });
      }
      // Keep the route mounted for transport/5xx failures. ConsoleLayout can
      // render the existing retry surface, matching the previous SPA shell,
      // instead of replacing it with Start's generic route error boundary.
    }
  },
  component: ConsoleRouteLayout,
});

function ConsoleRouteLayout() {
  return <ConsoleLayout />;
}
