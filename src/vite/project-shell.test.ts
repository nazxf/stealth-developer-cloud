import { describe, expect, it } from "vitest";
import { projectNavigationPath } from "./project-shell";

describe("project navigation paths", () => {
  it("keeps overview and services on their dedicated routes", () => {
    expect(projectNavigationPath("__overview__")).toBe("/projects/$projectId");
    expect(projectNavigationPath("services")).toBe("/projects/$projectId/services");
  });

  it("maps known resources to explicit routes and preserves extensibility", () => {
    expect(projectNavigationPath("deployments")).toBe("/projects/$projectId/deployments");
    expect(projectNavigationPath("api-keys")).toBe("/projects/$projectId/api-keys");
    expect(projectNavigationPath("future-resource")).toBe("/projects/$projectId/$resource");
  });
});
