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
});
