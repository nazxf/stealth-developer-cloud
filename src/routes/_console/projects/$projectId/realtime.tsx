import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/realtime")({
  component: lazyRouteComponent(() => import("@/vite/realtime-route")),
});
