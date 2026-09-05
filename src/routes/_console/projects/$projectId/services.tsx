import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/services")({
  component: lazyRouteComponent(() => import("@/vite/services-route")),
});
