import { describe, expect, it } from "vitest";
import { buildServiceCanvasPositions, defaultServiceCanvasPosition, serviceCanvasKey, serviceCanvasLayout, type ServiceCanvasService } from "./service-canvas";

const services: ServiceCanvasService[] = [
  { id: "fn-1", kind: "function", name: "worker", status: "active", detail: "node-22", resource: "functions" },
  { id: "site-1", kind: "site", name: "web", status: "active", detail: "static", resource: "sites" },
  { id: "db-1", kind: "database", name: "main", status: "managed", detail: "PostgreSQL-compatible", resource: "databases" },
];

describe("service canvas layout", () => {
  it("uses deterministic positions only for resources without a saved position", () => {
    const positions = buildServiceCanvasPositions(services, [
      { project_id: "project-1", resource_type: "site", resource_id: "site-1", x: 440, y: 96, updated_at: "2026-09-05T00:00:00Z" },
    ]);

    expect(positions[serviceCanvasKey("function", "fn-1")]).toEqual(defaultServiceCanvasPosition(0));
    expect(positions[serviceCanvasKey("site", "site-1")]).toEqual({ x: 440, y: 96 });
  });

  it("serializes the current resource set for an atomic backend replacement", () => {
    const layout = serviceCanvasLayout(services, {
      "function:fn-1": { x: 128.4, y: 64.8 },
      "site:site-1": { x: 440, y: 96 },
    });

    expect(layout).toEqual([
      { resource_type: "function", resource_id: "fn-1", x: 128, y: 65 },
      { resource_type: "site", resource_id: "site-1", x: 440, y: 96 },
      { resource_type: "database", resource_id: "db-1", x: 0, y: 0 },
    ]);
  });
});
