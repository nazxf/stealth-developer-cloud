import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/signup")({
  component: lazyRouteComponent(() => import("@/vite/auth-routes"), "SignupRoute"),
});
