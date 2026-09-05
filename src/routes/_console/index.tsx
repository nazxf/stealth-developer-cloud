import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/")({
  component: lazyRouteComponent(() => import("@/start/projects-page"), "ProjectsPage"),
});
