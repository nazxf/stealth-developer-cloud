import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: lazyRouteComponent(() => import("@/vite/auth-routes"), "ForgotPasswordRoute"),
});
