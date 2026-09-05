import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI, browserAPIErrorMessage } from "./browser-api";

const accountPayload = {
  account: {
    id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e01",
    email: "owner@example.test",
    email_verified: true,
    created_at: "2026-09-05T00:00:00Z",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("browser API boundary", () => {
  it("sends the HttpOnly session credential and validates the account response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(accountPayload), { status: 200 }));

    const result = await browserAPI.currentAccount();

    expect(result.account.email).toBe("owner@example.test");
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/account",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("keeps Site build-log cursors typed and URL encoded", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          logs: [
            {
              id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e02",
              deployment_id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e03",
              site_id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e04",
              project_id: "0199fca2-1e2d-7f10-8d9b-3b8b2f9a1e05",
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

    const result = await browserAPI.projectSiteBuildLogs(
      "project/one",
      "site one",
      "deployment/one",
      { limit: 10, after: 3 },
    );

    expect(result.logs[0]?.sequence).toBe(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/v1/projects/project%2Fone/sites/site%20one/deployments/deployment%2Fone/logs?limit=10&after=3",
    );
  });

  it("maps structured API failures to BrowserAPIError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "forbidden", message: "not allowed" } }),
        { status: 403, headers: { "X-Trace-ID": "trace-403" } },
      ),
    );

    await expect(browserAPI.currentAccount()).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      message: "not allowed",
      traceID: "trace-403",
    });
  });

  it("turns network failures into safe, typed errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch: internal socket details"));

    await expect(browserAPI.currentAccount()).rejects.toMatchObject({
      status: 0,
      code: "network_error",
      message: "Unable to reach Stealth. Check your connection and try again.",
    });
  });

  it("does not leak schema parser details when the API response is invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ account: { id: "not-an-email" } }), { status: 200, headers: { "X-Trace-ID": "trace-invalid" } }),
    );

    const error = await browserAPI.currentAccount().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(BrowserAPIError);
    expect(error).toMatchObject({ status: 502, code: "invalid_api_response", traceID: "trace-invalid" });
    expect((error as Error).message).toBe("Stealth returned an unexpected response. Try again shortly.");
    expect((error as Error).message).not.toContain("Zod");
    expect(browserAPIErrorMessage(error, "fallback")).toBe("Stealth returned an unexpected response. Try again shortly. (Reference: trace-invalid)");
  });

  it("translates generic HTTP failures and keeps unknown errors on the fallback", () => {
    expect(browserAPIErrorMessage(new BrowserAPIError(429, "rate_limited", "Stealth API request failed"), "fallback")).toBe("Too many requests. Try again shortly.");
    expect(browserAPIErrorMessage(new Error("internal parser details"), "Safe fallback")).toBe("Safe fallback");
  });

  it("keeps organization project listing pagination URL encoded", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          projects: [{ id: "project-1", organization_id: "org/one", name: "console", created_at: "2026-09-05T00:00:00Z" }],
          pagination: { limit: 20, next_cursor: null },
        }),
        { status: 200 },
      ),
    );

    const result = await browserAPI.projects("org/one", { limit: 20, cursor: "cursor one" });

    expect(result.projects[0]?.name).toBe("console");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/organizations/org%2Fone/projects?limit=20&cursor=cursor+one");
  });

  it("posts a project to the selected organization with JSON headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ project: { id: "project-2", organization_id: "org-1", name: "api", created_at: "2026-09-05T00:00:00Z" } }),
        { status: 201 },
      ),
    );

    const result = await browserAPI.createProject("org-1", { name: "api" });

    expect(result.project.id).toBe("project-2");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/organizations/org-1/projects");
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ name: "api" }));
  });

  it("reads and replaces a project service layout with typed coordinates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          layout: [
            {
              project_id: "project-1",
              resource_type: "function",
              resource_id: "function-1",
              x: 160,
              y: 48,
              updated_at: "2026-09-05T00:00:00Z",
            },
          ],
          can_manage: true,
        }),
        { status: 200 },
      ),
    );

    const saved = await browserAPI.replaceProjectServiceLayout("project/one", [
      { resource_type: "function", resource_id: "function-1", x: 160, y: 48 },
    ]);

    expect(saved.layout[0]?.x).toBe(160);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/service-layout");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(
      JSON.stringify({
        layout: [{ resource_type: "function", resource_id: "function-1", x: 160, y: 48 }],
      }),
    );
  });

  it("keeps database schema paths, JSON bodies, and typed responses aligned", async () => {
    const column = {
      id: "column-1",
      table_id: "table/one",
      key: "email",
      type: "varchar",
      required: true,
      varchar_size: 255,
      created_at: "2026-09-05T00:00:00Z",
      updated_at: "2026-09-05T00:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ columns: [column], pagination: { limit: 100, next_cursor: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ column }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const listed = await browserAPI.projectDatabaseColumns("project/one", "database one", "table/one", { limit: 100, cursor: "cursor one" });
    expect(listed.columns[0]?.key).toBe("email");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/columns?limit=100&cursor=cursor+one");

    await browserAPI.createProjectDatabaseColumn("project/one", "database one", "table/one", { key: "email", type: "varchar", required: true, varchar_size: 255, default: "guest@example.test" });
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ key: "email", type: "varchar", required: true, varchar_size: 255, default: "guest@example.test" }));
    await browserAPI.deleteProjectDatabaseColumn("project/one", "database one", "table/one", "column/one");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/columns/column%2Fone");
  });

  it("serializes database row filters and update requests", async () => {
    const row = {
      id: "row-1",
      table_id: "table-1",
      project_id: "project-1",
      data: { email: "owner@example.test", active: true },
      read_permissions: ["any"],
      update_permissions: ["users"],
      delete_permissions: ["users"],
      creator_project_user_id: null,
      created_at: "2026-09-05T00:00:00Z",
      updated_at: "2026-09-05T00:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [row], pagination: { limit: 50, next_cursor: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ row }), { status: 200 }));

    const listed = await browserAPI.projectDatabaseRows("project/one", "database one", "table/one", { limit: 50, order_by: "email", order_direction: "desc", search: "owner", search_column: "email", filters: { email: "owner@example.test" } });
    expect(listed.rows[0]?.data.email).toBe("owner@example.test");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/rows?limit=50&order_by=email&order_direction=desc&search=owner&search_column=email&filter.email=owner%40example.test");

    await browserAPI.updateProjectDatabaseRow("project/one", "database one", "table/one", "row/one", { data: { active: false } });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/rows/row%2Fone");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ data: { active: false } }));
  });

  it("keeps database export and atomic import paths typed", async () => {
    const row = {
      id: "row-exported",
      table_id: "table-1",
      project_id: "project-1",
      data: { email: "imported@example.test" },
      read_permissions: [],
      update_permissions: [],
      delete_permissions: [],
      creator_project_user_id: null,
      created_at: "2026-09-05T00:00:00Z",
      updated_at: "2026-09-05T00:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [row], count: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [row], count: 1 }), { status: 201 }));

    const exported = await browserAPI.projectDatabaseRowsExport("project/one", "database one", "table/one", { limit: 500 });
    expect(exported.count).toBe(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/export?format=json&limit=500");

    const imported = await browserAPI.importProjectDatabaseRows("project/one", "database one", "table/one", { rows: [{ data: { email: "imported@example.test" } }] });
    expect(imported.rows[0]?.id).toBe("row-exported");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/rows/import");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
  });

  it("keeps enforced database relationship paths typed", async () => {
    const relationship = {
      id: "relationship-1",
      project_id: "project-1",
      database_id: "database-1",
      source_table_id: "source-table-1",
      source_column_key: "parent_id",
      target_table_id: "target-table-1",
      type: "many_to_one",
      on_delete: "restrict",
      created_at: "2026-09-05T00:00:00Z",
      updated_at: "2026-09-05T00:00:00Z",
    } as const;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ relationships: [relationship], pagination: { limit: 20, next_cursor: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ relationship }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const listed = await browserAPI.projectDatabaseRelationships("project/one", "database one", { limit: 20 });
    expect(listed.relationships[0]?.source_column_key).toBe("parent_id");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/relationships?limit=20");
    await browserAPI.createProjectDatabaseRelationship("project/one", "database one", { source_table_id: "source-table-1", source_column_key: "parent_id", target_table_id: "target-table-1" });
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    await browserAPI.deleteProjectDatabaseRelationship("project/one", "database one", "relationship/one");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/relationships/relationship%2Fone");
  });

  it("keeps logical database backup actions typed and encoded", async () => {
    const backup = {
      id: "backup-1",
      project_id: "project-1",
      database_id: "database-1",
      size_bytes: 2048,
      checksum_sha256: "a".repeat(64),
      created_at: "2026-09-05T00:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ backups: [backup], pagination: { limit: 20, next_cursor: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ backup }), { status: 201 }))
      .mockResolvedValueOnce(new Response("{\"version\":1}", { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ backup_id: backup.id, result: { tables: 1, columns: 1, indexes: 0, rows: 1, relationships: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const listed = await browserAPI.projectDatabaseBackups("project/one", "database one", { limit: 20 });
    expect(listed.backups[0]?.checksum_sha256).toHaveLength(64);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/backups?limit=20");
    await browserAPI.createProjectDatabaseBackup("project/one", "database one", { max_rows: 500 });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/backups?max_rows=500");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    const downloaded = await browserAPI.downloadProjectDatabaseBackup("project/one", "database one", "backup/one");
    expect(await downloaded.text()).toContain("version");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/backups/backup%2Fone/download");
    const restored = await browserAPI.restoreProjectDatabaseBackup("project/one", "database one", "backup/one");
    expect(restored.result.rows).toBe(1);
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe("POST");
    await browserAPI.deleteProjectDatabaseBackup("project/one", "database one", "backup/one");
    expect(fetchMock.mock.calls[4]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/backups/backup%2Fone");
  });

  it("keeps atomic row transaction payloads on the transaction endpoint", async () => {
    const row = {
      id: "row-transaction",
      table_id: "table-1",
      project_id: "project-1",
      data: { state: "ready" },
      read_permissions: [],
      update_permissions: [],
      delete_permissions: [],
      creator_project_user_id: null,
      created_at: "2026-09-05T00:00:00Z",
      updated_at: "2026-09-05T00:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ rows: [row], deleted_ids: [], count: 1 }), { status: 200 }));
    const result = await browserAPI.transactProjectDatabaseRows("project/one", "database one", "table/one", {
      operations: [{ action: "create", id: "row-transaction", data: { state: "ready" } }],
    });
    expect(result.rows[0]?.id).toBe("row-transaction");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/rows/transaction");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });
});
