import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/api-keys")({
  component: lazyRouteComponent(() => import("@/vite/api-keys-route")),
});
