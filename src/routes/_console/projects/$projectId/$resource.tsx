import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/$resource")({
  component: lazyRouteComponent(() => import("@/features/projects/projects-page"), "ProjectResourcePage"),
});
