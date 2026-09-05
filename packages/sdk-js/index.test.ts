import { describe, expect, it } from "vitest";
import { createStealthClient } from "./index";

describe("browser SDK Site URLs", () => {
  it("builds encoded immutable preview URLs", () => {
    const client = createStealthClient({
      endpoint: "https://api.example.test",
      projectID: "project/one",
    });

    expect(client.sites.previewURL("site/one", "deployment one", "assets/app.js")).toBe(
      "https://api.example.test/v1/sites/site%2Fone/deployments/deployment%20one/assets/app.js",
    );
  });

  it("rejects traversal segments in preview paths", () => {
    const client = createStealthClient({ endpoint: "https://api.example.test", projectID: "project-1" });
    expect(() => client.sites.previewURL("site-1", "deployment-1", "../secrets")).toThrow("traversal");
  });
});
