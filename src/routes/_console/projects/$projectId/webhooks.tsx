import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/webhooks")({
  component: lazyRouteComponent(() => import("@/features/project-settings/webhooks-route")),
});
