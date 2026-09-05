import { describe, expect, it } from "vitest";
import { deploymentIsInProgress, deploymentPollInterval, executionIsInProgress, executionPollInterval, operationPollIntervalMs } from "./polling";

describe("operation polling", () => {
  it("polls deployment work until both lifecycle states are terminal", () => {
    expect(deploymentIsInProgress({ status: "queued", build_status: "queued" })).toBe(true);
    expect(deploymentIsInProgress({ status: "ready", build_status: "succeeded" })).toBe(false);
    expect(deploymentPollInterval(undefined, true)).toBe(operationPollIntervalMs);
    expect(deploymentPollInterval({ deployments: [{ status: "failed", build_status: "failed" }] }, true)).toBe(false);
    expect(deploymentPollInterval({ deployments: [{ status: "building", build_status: "running" }] }, true)).toBe(operationPollIntervalMs);
  });

  it("polls executions only while accepted or running", () => {
    expect(executionIsInProgress({ status: "accepted" })).toBe(true);
    expect(executionIsInProgress({ status: "succeeded" })).toBe(false);
    expect(executionPollInterval({ executions: [{ status: "failed" }] }, true)).toBe(false);
    expect(executionPollInterval({ executions: [{ status: "running" }] }, true)).toBe(operationPollIntervalMs);
    expect(executionPollInterval({ executions: [{ status: "running" }] }, false)).toBe(false);
  });
});
