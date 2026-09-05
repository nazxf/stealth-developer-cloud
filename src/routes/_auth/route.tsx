import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Public account flows remain outside the protected console hierarchy. */
export const Route = createFileRoute("/_auth")({
  component: AuthRouteLayout,
});

function AuthRouteLayout() {
  return <Outlet />;
}
