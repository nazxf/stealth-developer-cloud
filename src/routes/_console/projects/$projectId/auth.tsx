import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/auth")({
  component: lazyRouteComponent(() => import("@/features/project-settings/auth-route")),
});
