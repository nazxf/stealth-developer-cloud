import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/admin/")({
  component: lazyRouteComponent(() => import("@/features/admin/admin-route")),
});
