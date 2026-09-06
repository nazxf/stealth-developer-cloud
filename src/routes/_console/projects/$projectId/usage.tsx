import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/usage")({
  component: lazyRouteComponent(() => import("@/features/usage/usage-route")),
});
