import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";

describe("query key factories", () => {
  it("keeps collection prefixes compatible with targeted invalidation", () => {
    const projectID = "project-1";
    const functionID = "function-1";

    expect(queryKeys.projectFunctions(projectID)).toEqual(["project-functions", projectID]);
    expect(queryKeys.functionDeployments(projectID, functionID)).toEqual([
      "function-deployments",
      projectID,
      functionID,
    ]);
    expect(queryKeys.deployments(projectID)).toEqual(["deployments", projectID]);
    expect(queryKeys.deployment(projectID, "function", functionID).slice(0, 2)).toEqual(
      queryKeys.deployments(projectID),
    );
  });

  it("supports broad and targeted optional keys", () => {
    expect(queryKeys.projects()).toEqual(["projects"]);
    expect(queryKeys.projects("org-1")).toEqual(["projects", "org-1"]);
    expect(queryKeys.messagingDeliveries("project-1")).toEqual(["messaging-deliveries", "project-1"]);
    expect(queryKeys.messagingDeliveries("project-1", "message-1")).toEqual([
      "messaging-deliveries",
      "project-1",
      "message-1",
    ]);
  });
});
