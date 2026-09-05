import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerStealthClient } from "./server";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server SDK build-log boundary", () => {
  it("reads Site build logs with an encoded project path and cursor", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          logs: [
            {
              id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e11",
              deployment_id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e12",
              site_id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e13",
              project_id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e14",
              sequence: 4,
              level: "info",
              message: "build completed",
              created_at: "2026-09-05T00:00:01Z",
            },
          ],
          pagination: { limit: 10, next_cursor: null },
        }),
        { status: 200 },
      ),
    );
    const client = createServerStealthClient({
      endpoint: "https://api.example.test/control",
      projectID: "project/one",
      apiKey: "sk_test_read",
    });

    const result = await client.sites.deployments.logs("site/one", "deployment one", { limit: 10, after: 3 });

    expect(result.logs[0]?.sequence).toBe(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/control/v1/projects/project%2Fone/sites/site%2Fone/deployments/deployment%20one/logs?limit=10&after=3",
    );
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get("accept")).toBe("application/json");
    expect((init?.headers as Headers).get("x-stealth-key")).toBe("sk_test_read");
  });

  it("reads Function build logs without inventing a cursor when none is supplied", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ logs: [], pagination: { limit: 50, next_cursor: null } }), { status: 200 }),
    );
    const client = createServerStealthClient({
      endpoint: "https://api.example.test",
      projectID: "project-1",
      apiKey: "sk_test_read",
    });

    await client.functions.deployments.logs("function/one", "deployment/one");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/v1/projects/project-1/functions/function%2Fone/deployments/deployment%2Fone/logs",
    );
  });

  it("posts atomic database row transactions with the server key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rows: [], deleted_ids: ["row-1"], count: 1 }), { status: 200 }),
    );
    const client = createServerStealthClient({
      endpoint: "https://api.example.test",
      projectID: "project-1",
      apiKey: "sk_test_write",
    });

    const result = await client.databases.rows.transaction("database/one", "table/one", {
      operations: [{ action: "delete", id: "row-1" }],
    });

    expect(result.deleted_ids).toEqual(["row-1"]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/v1/projects/project-1/databases/database%2Fone/tables/table%2Fone/rows/transaction",
    );
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("x-stealth-key")).toBe("sk_test_write");
  });
});
