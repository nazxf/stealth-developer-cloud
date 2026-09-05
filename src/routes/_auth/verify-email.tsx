import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/verify-email")({
  component: lazyRouteComponent(() => import("@/vite/auth-routes"), "VerifyEmailRoute"),
});
