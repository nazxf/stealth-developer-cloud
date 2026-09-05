import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

describe("TanStack Start route hierarchy", () => {
  it("keeps public authentication URLs stable", () => {
    const router = createRouter({ routeTree });
    expect(router.buildLocation({ to: "/login" }).pathname).toBe("/login");
    expect(router.buildLocation({ to: "/signup" }).pathname).toBe("/signup");
    expect(router.buildLocation({ to: "/forgot-password" }).pathname).toBe("/forgot-password");
  });

  it("keeps protected project URLs stable under the pathless console group", () => {
    const router = createRouter({ routeTree });
    expect(router.buildLocation({ to: "/projects/$projectId", params: { projectId: "project-1" } }).pathname).toBe("/projects/project-1");
    expect(router.buildLocation({ to: "/projects/$projectId/services", params: { projectId: "project-1" } }).pathname).toBe("/projects/project-1/services");
    expect(router.buildLocation({ to: "/admin" }).pathname).toBe("/admin");
    expect(router.buildLocation({ to: "/agent" }).pathname).toBe("/agent");
  });
});
