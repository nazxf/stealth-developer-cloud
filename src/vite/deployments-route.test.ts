import { describe, expect, it } from "vitest";
import { normalizeDeployment, type DeployableResource } from "./deployments-route";

describe("deployment timeline normalization", () => {
  it("attaches resource identity and preserves build/source metadata", () => {
    const resource: DeployableResource = { id: "site-1", name: "marketing-site", type: "site", activeDeploymentID: "deployment-1" };
    expect(normalizeDeployment(resource, {
      id: "deployment-1",
      version: 4,
      source: "github",
      source_name: "https://github.com/acme/site",
      status: "active",
      build_status: "succeeded",
      error_message: null,
      created_at: "2026-09-05T00:00:00Z",
      activated_at: "2026-09-05T00:01:00Z",
    })).toEqual({
      id: "deployment-1",
      resourceID: "site-1",
      resourceName: "marketing-site",
      resourceType: "site",
      version: 4,
      source: "github",
      sourceName: "https://github.com/acme/site",
      status: "active",
      buildStatus: "succeeded",
      errorMessage: null,
      createdAt: "2026-09-05T00:00:00Z",
      activatedAt: "2026-09-05T00:01:00Z",
    });
  });

  it("normalizes optional API fields to stable nulls", () => {
    const resource: DeployableResource = { id: "function-1", name: "worker", type: "function", activeDeploymentID: null };
    const normalized = normalizeDeployment(resource, {
      id: "deployment-2",
      version: 1,
      source: "upload",
      status: "failed",
      build_status: "failed",
      created_at: "2026-09-05T00:00:00Z",
    });
    expect(normalized.sourceName).toBeNull();
    expect(normalized.errorMessage).toBeNull();
    expect(normalized.activatedAt).toBeNull();
  });
});
