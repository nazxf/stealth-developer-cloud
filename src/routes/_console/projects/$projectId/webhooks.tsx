import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/webhooks")({
  component: lazyRouteComponent(() => import("@/vite/webhooks-route")),
});
