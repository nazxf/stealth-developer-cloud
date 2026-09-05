import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/storage")({
  component: lazyRouteComponent(() => import("@/vite/storage-route")),
});
