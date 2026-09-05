import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/reset-password")({
  component: lazyRouteComponent(() => import("@/vite/auth-routes"), "ResetPasswordRoute"),
});
