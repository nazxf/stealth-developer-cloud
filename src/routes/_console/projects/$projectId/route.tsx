import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/projects/$projectId")({ component: ProjectRouteLayout });

function ProjectRouteLayout() {
  return <Outlet />;
}
