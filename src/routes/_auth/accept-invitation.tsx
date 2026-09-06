import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/accept-invitation")({
  component: lazyRouteComponent(() => import("@/features/auth/auth-routes"), "AcceptInvitationRoute"),
});
