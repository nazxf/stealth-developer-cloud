import { afterEach, describe, expect, it, vi } from "vitest";
import { browserAPI } from "./browser-api";

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
        { status: 403 },
      ),
    );

    await expect(browserAPI.currentAccount()).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      message: "not allowed",
    });
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

    const listed = await browserAPI.projectDatabaseRows("project/one", "database one", "table/one", { limit: 50, order_by: "email", order_direction: "desc", filters: { email: "owner@example.test" } });
    expect(listed.rows[0]?.data.email).toBe("owner@example.test");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/rows?limit=50&order_by=email&order_direction=desc&filter.email=owner%40example.test");

    await browserAPI.updateProjectDatabaseRow("project/one", "database one", "table/one", "row/one", { data: { active: false } });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/v1/projects/project%2Fone/databases/database%20one/tables/table%2Fone/rows/row%2Fone");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ data: { active: false } }));
  });
});
