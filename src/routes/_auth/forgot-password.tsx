import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: lazyRouteComponent(() => import("@/features/auth/auth-routes"), "ForgotPasswordRoute"),
});
