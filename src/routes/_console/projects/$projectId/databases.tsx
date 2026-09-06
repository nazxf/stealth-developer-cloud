import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/databases")({
  component: lazyRouteComponent(() => import("@/features/databases/databases-route")),
});
