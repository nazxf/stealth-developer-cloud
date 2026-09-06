import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/api-keys")({
  component: lazyRouteComponent(() => import("@/features/project-settings/api-keys-route")),
});
