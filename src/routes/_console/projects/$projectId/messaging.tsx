import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/messaging")({
  component: lazyRouteComponent(() => import("@/features/messaging/messaging-route")),
});
