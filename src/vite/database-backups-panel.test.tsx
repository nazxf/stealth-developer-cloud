import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserAPI, type BrowserDatabaseBackup } from "@/lib/browser-api";
import DatabaseBackupsPanel from "./database-backups-panel";

const backup: BrowserDatabaseBackup = {
  id: "backup-1",
  project_id: "project-1",
  database_id: "database-1",
  size_bytes: 2048,
  checksum_sha256: "a".repeat(64),
  created_at: "2026-09-05T00:00:00Z",
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={queryClient}><DatabaseBackupsPanel projectID="project-1" databaseID="database-1" canManage /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DatabaseBackupsPanel", () => {
  it("loads metadata and creates a logical backup", async () => {
    const list = vi.spyOn(browserAPI, "projectDatabaseBackups").mockResolvedValue({ backups: [backup], pagination: { limit: 100, next_cursor: null } });
    const create = vi.spyOn(browserAPI, "createProjectDatabaseBackup").mockResolvedValue({ backup });
    renderPanel();

    expect(await screen.findByText("backup-1")).toBeTruthy();
    expect(list).toHaveBeenCalledWith("project-1", "database-1", { limit: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Create backup" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("project-1", "database-1"));
    expect((await screen.findByRole("status")).textContent).toContain("created successfully");
  });

  it("requires confirmation before an atomic restore and deletes metadata", async () => {
    vi.spyOn(browserAPI, "projectDatabaseBackups").mockResolvedValue({ backups: [backup], pagination: { limit: 100, next_cursor: null } });
    const restore = vi.spyOn(browserAPI, "restoreProjectDatabaseBackup").mockResolvedValue({ backup_id: backup.id, result: { tables: 2, columns: 3, indexes: 1, rows: 4, relationships: 0 } });
    const remove = vi.spyOn(browserAPI, "deleteProjectDatabaseBackup").mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel();

    await screen.findByText("backup-1");
    fireEvent.click(screen.getByRole("button", { name: "Restore backup backup-1" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith("project-1", "database-1", "backup-1"));
    expect(confirm).toHaveBeenCalled();
    expect((await screen.findByRole("status")).textContent).toContain("2 tables, 4 rows, 1 indexes");

    fireEvent.click(screen.getByRole("button", { name: "Delete backup backup-1" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("project-1", "database-1", "backup-1"));
  });
});
