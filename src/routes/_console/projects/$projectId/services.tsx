import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/services")({
  component: lazyRouteComponent(() => import("@/features/projects/services-route")),
});
