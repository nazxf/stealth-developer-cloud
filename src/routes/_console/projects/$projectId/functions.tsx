import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/functions")({
  component: lazyRouteComponent(() => import("@/features/functions/functions-page")),
});
