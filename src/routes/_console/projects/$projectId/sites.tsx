import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/sites")({
  component: lazyRouteComponent(() => import("@/vite/sites-route")),
});
