import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/settings")({
  component: lazyRouteComponent(() => import("@/vite/settings-route")),
});
