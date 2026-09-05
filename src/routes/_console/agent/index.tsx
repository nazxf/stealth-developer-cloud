import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/agent/")({
  component: lazyRouteComponent(() => import("@/vite/agent-route")),
});
