import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/")({
  component: lazyRouteComponent(() => import("@/features/projects/projects-page"), "ProjectsPage"),
});
