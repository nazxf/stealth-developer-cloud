import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: lazyRouteComponent(() => import("@/start/login-page"), "LoginPage"),
});
