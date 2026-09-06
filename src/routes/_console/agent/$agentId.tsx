import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/agent/$agentId")({
  component: lazyRouteComponent(() => import("@/features/agents/agent-detail-route")),
});
