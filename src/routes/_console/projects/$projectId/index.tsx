import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/")({
  component: lazyRouteComponent(() => import("@/features/projects/projects-page"), "ProjectPage"),
});
