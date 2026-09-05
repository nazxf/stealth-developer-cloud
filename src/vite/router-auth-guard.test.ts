import { describe, expect, it } from "vitest";
import { isPublicAuthPath, requiresConsoleSession } from "./router";

describe("console session route policy", () => {
  it("leaves authentication entry points public", () => {
    for (const path of ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/accept-invitation"]) {
      expect(isPublicAuthPath(path)).toBe(true);
      expect(requiresConsoleSession(path)).toBe(false);
    }
  });

  it("protects product and administrative routes", () => {
    for (const path of ["/", "/projects/project-1", "/projects/project-1/deployments", "/agent", "/admin"]) {
      expect(isPublicAuthPath(path)).toBe(false);
      expect(requiresConsoleSession(path)).toBe(true);
    }
  });
});
