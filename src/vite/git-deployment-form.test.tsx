import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";
import { GitDeploymentForm, type GitDeployableResource } from "./git-deployment-form";

const siteResponse = {
  id: "site-1",
  project_id: "project-1",
  name: "marketing-site",
  framework: "static" as const,
  enabled: true,
  status: "active" as const,
  artifact_quota_bytes: 1_000_000,
  artifact_used_bytes: 0,
  artifact_reserved_bytes: 0,
  active_deployment_id: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};

const deploymentResponse = {
  id: "deployment-1",
  version: 1,
  source: "git",
  source_name: "https://github.com/acme/site",
  status: "queued",
  build_status: "queued",
  error_message: null,
  created_at: "2026-09-05T00:00:00Z",
  activated_at: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GitDeploymentForm", () => {
  it("creates a normalized site and queues a Git deployment", async () => {
    const createSite = vi.spyOn(browserAPI, "createProjectSite").mockResolvedValue({ site: siteResponse });
    const createDeployment = vi.spyOn(browserAPI, "createProjectSiteGitDeployment").mockResolvedValue({ deployment: deploymentResponse });
    const onClose = vi.fn();

    render(<GitDeploymentForm projectId="project-1" resources={[]} canManage onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("New site name"), { target: { value: " Marketing-Site " } });
    fireEvent.change(screen.getByLabelText("Repository URL"), { target: { value: " https://github.com/acme/site " } });
    fireEvent.click(screen.getByRole("button", { name: "Create deployment" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(createSite).toHaveBeenCalledWith("project-1", { name: "marketing-site" });
    expect(createDeployment).toHaveBeenCalledWith("project-1", "site-1", {
      repository: "https://github.com/acme/site",
      ref: "main",
      build_runtime: "node-22",
      build_command: "npm run build",
      output_directory: "dist",
      activate: true,
    });
  });

  it("rejects an invalid new site name before making API requests", async () => {
    const createSite = vi.spyOn(browserAPI, "createProjectSite");
    const createDeployment = vi.spyOn(browserAPI, "createProjectSiteGitDeployment");

    render(<GitDeploymentForm projectId="project-1" resources={[]} canManage onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("New site name"), { target: { value: "bad site" } });
    fireEvent.change(screen.getByLabelText("Repository URL"), { target: { value: "https://github.com/acme/site" } });
    fireEvent.click(screen.getByRole("button", { name: "Create deployment" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Site name must use 2–63 lowercase letters, numbers, or hyphens.");
    expect(createSite).not.toHaveBeenCalled();
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("deploys to an existing site without creating another site", async () => {
    const createSite = vi.spyOn(browserAPI, "createProjectSite");
    const createDeployment = vi.spyOn(browserAPI, "createProjectSiteGitDeployment").mockResolvedValue({ deployment: deploymentResponse });
    const onClose = vi.fn();
    const resources: GitDeployableResource[] = [{ id: "site-1", name: "marketing-site", type: "site", activeDeploymentID: null }];

    render(<GitDeploymentForm projectId="project-1" resources={resources} canManage onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Repository URL"), { target: { value: "https://github.com/acme/site" } });
    fireEvent.click(screen.getByRole("button", { name: "Create deployment" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(createSite).not.toHaveBeenCalled();
    expect(createDeployment).toHaveBeenCalledWith("project-1", "site-1", expect.objectContaining({ repository: "https://github.com/acme/site" }));
  });

  it("renders a safe API error when site creation fails", async () => {
    vi.spyOn(browserAPI, "createProjectSite").mockRejectedValue(new BrowserAPIError(409, "conflict", "That site name is already in use."));

    render(<GitDeploymentForm projectId="project-1" resources={[]} canManage onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("New site name"), { target: { value: "marketing-site" } });
    fireEvent.change(screen.getByLabelText("Repository URL"), { target: { value: "https://github.com/acme/site" } });
    fireEvent.click(screen.getByRole("button", { name: "Create deployment" }));

    expect((await screen.findByRole("alert")).textContent).toBe("That site name is already in use.");
  });
});
