import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId/$resource")({
  component: lazyRouteComponent(() => import("@/start/projects-page"), "ProjectResourcePage"),
});
