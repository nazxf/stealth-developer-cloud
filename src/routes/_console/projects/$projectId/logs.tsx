import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/logs")({
  component: lazyRouteComponent(() => import("@/features/logs/logs-route")),
});
