import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/deployments")({
  component: lazyRouteComponent(() => import("@/vite/deployments-route")),
});
