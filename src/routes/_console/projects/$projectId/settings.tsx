import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/settings")({
  component: lazyRouteComponent(() => import("@/features/project-settings/settings-route")),
});
