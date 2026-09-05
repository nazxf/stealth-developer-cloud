import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";
import { ProjectCreateForm } from "./project-create-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProjectCreateForm", () => {
  it("normalizes a project name before creating it", async () => {
    const createProject = vi.spyOn(browserAPI, "createProject").mockResolvedValue({
      project: { id: "project-1", organization_id: "organization-1", name: "my-project", created_at: "2026-09-05T00:00:00Z" },
    });
    const onCreated = vi.fn();

    render(<ProjectCreateForm organizationID="organization-1" onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: " My-Project " } });
    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(createProject).toHaveBeenCalledWith("organization-1", { name: "my-project" });
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("");
  });

  it("rejects an invalid project name before making a request", async () => {
    const createProject = vi.spyOn(browserAPI, "createProject");

    render(<ProjectCreateForm organizationID="organization-1" />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "not valid" } });
    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Use 2–63 lowercase letters, numbers, or hyphens.");
    expect(createProject).not.toHaveBeenCalled();
  });

  it("shows a safe API error", async () => {
    vi.spyOn(browserAPI, "createProject").mockRejectedValue(new BrowserAPIError(409, "conflict", "A project with that name already exists."));

    render(<ProjectCreateForm organizationID="organization-1" />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "my-project" } });
    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect((await screen.findByRole("alert")).textContent).toBe("A project with that name already exists.");
  });
});
