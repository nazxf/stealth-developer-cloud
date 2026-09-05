import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/auth")({
  component: lazyRouteComponent(() => import("@/vite/auth-route")),
});
