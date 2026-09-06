import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/admin/$section")({
  component: lazyRouteComponent(() => import("@/features/admin/admin-route"), "AdminSectionRoute"),
});
