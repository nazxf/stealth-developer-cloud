import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/admin/$section")({
  component: lazyRouteComponent(() => import("@/vite/admin-route"), "AdminSectionRoute"),
});
