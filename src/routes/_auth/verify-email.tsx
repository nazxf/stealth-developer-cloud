import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/verify-email")({
  component: lazyRouteComponent(() => import("@/features/auth/auth-routes"), "VerifyEmailRoute"),
});
