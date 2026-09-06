import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Box, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  browserAPI,
  browserAPIErrorMessage,
} from "@/lib/api/browser-api";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { ErrorState as AsyncErrorState } from "@/components/error-state";
import { deploymentIsInProgress, deploymentPollInterval, operationPollIntervalMs } from "@/lib/polling";
import { CreateSiteDialog } from "./site-create-dialog";
import { SiteWorkspace } from "./site-workspace";
import { statusClass, type Runtime } from "./site-ui";

function LoadingState() {
  return (
    <div
      className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]"
      aria-live="polite"
    >
      Loading sites…
    </div>
  );
}
function ErrorState({ error }: { error: unknown }) {
  return <AsyncErrorState error={error} fallback="Unable to load sites." />;
}

export default function SitesPage() {
  const { projectId } = useParams({ from: "/_console/projects/$projectId/sites" });
  const sitesQuery = useQuery({
    queryKey: queryKeys.projectSites(projectId),
    queryFn: () => browserAPI.projectSites(projectId, { limit: 100 }),
  });
  const [selectedID, setSelectedID] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [quotaDraft, setQuotaDraft] = useState("");
  const [enabledDraft, setEnabledDraft] = useState(true);
  const [source, setSource] = useState<File | null>(null);
  const [activateUpload, setActivateUpload] = useState(true);
  const [buildCommand, setBuildCommand] = useState("");
  const [buildRuntime, setBuildRuntime] = useState<Runtime>("node-22");
  const [outputDirectory, setOutputDirectory] = useState(".");
  const [repository, setRepository] = useState("");
  const [ref, setRef] = useState("main");
  const [gitCommand, setGitCommand] = useState("npm run build");
  const [gitRuntime, setGitRuntime] = useState<Runtime>("node-22");
  const [gitOutputDirectory, setGitOutputDirectory] = useState("dist");
  const [activateGit, setActivateGit] = useState(true);
  const [hostname, setHostname] = useState("");
  const [selectedDeploymentID, setSelectedDeploymentID] = useState("");
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const sites = sitesQuery.data?.sites ?? [];
  const selected = sites.find((item) => item.id === selectedID) ?? null;
  const canManage = sitesQuery.data?.can_manage ?? false;
  useEffect(() => {
    if (!selectedID || !sites.some((item) => item.id === selectedID))
      setSelectedID(sites[0]?.id ?? "");
  }, [selectedID, sites]);
  useEffect(() => {
    if (!selected) return;
    setNameDraft(selected.name);
    setQuotaDraft(String(selected.artifact_quota_bytes));
    setEnabledDraft(selected.enabled);
  }, [selected]);
  useEffect(() => {
    setSelectedDeploymentID("");
  }, [selectedID]);
  const deploymentsQuery = useQuery({
    queryKey: queryKeys.siteDeployments(projectId, selectedID),
    queryFn: () =>
      browserAPI.projectSiteDeployments(projectId, selectedID, { limit: 50 }),
    enabled: Boolean(selectedID),
    refetchInterval: (query) => deploymentPollInterval(query.state.data, Boolean(selectedID)),
  });
  const selectedDeployment = deploymentsQuery.data?.deployments.find((deployment) => deployment.id === selectedDeploymentID);
  const deploymentLogsQuery = useQuery({
    queryKey: queryKeys.siteBuildLogs(projectId, selectedID, selectedDeploymentID),
    queryFn: () =>
      browserAPI.projectSiteBuildLogs(
        projectId,
        selectedID,
        selectedDeploymentID,
        { limit: 100 },
      ),
    enabled: Boolean(selectedID && selectedDeploymentID),
    refetchInterval: selectedDeploymentID && deploymentIsInProgress(selectedDeployment) ? operationPollIntervalMs : false,
  });
  const domainsQuery = useQuery({
    queryKey: queryKeys.siteDomains(projectId, selectedID),
    queryFn: () =>
      browserAPI.projectSiteDomains(projectId, selectedID, { limit: 50 }),
    enabled: Boolean(selectedID),
  });

  function report(reason: unknown, fallback: string) {
    setError(browserAPIErrorMessage(reason, fallback));
  }
  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || pending) return;
    const name = createName.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) {
      setError(
        "Site name must use 2–63 lowercase letters, numbers, or hyphens.",
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await browserAPI.createProjectSite(projectId, { name });
      setCreateName("");
      setCreateOpen(false);
      setSelectedID(result.site.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectSites(projectId),
      });
    } catch (reason) {
      report(reason, "The site could not be created.");
    } finally {
      setPending(false);
    }
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage || pending) return;
    const quota = Number(quotaDraft);
    if (
      !Number.isSafeInteger(quota) ||
      quota < selected.artifact_used_bytes + selected.artifact_reserved_bytes ||
      quota < 1
    ) {
      setError("Artifact quota must cover current usage and pending builds.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.updateProjectSite(projectId, selected.id, {
        name: nameDraft.trim(),
        enabled: enabledDraft,
        artifact_quota_bytes: quota,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectSites(projectId),
      });
    } catch (reason) {
      report(reason, "Site settings could not be saved.");
    } finally {
      setPending(false);
    }
  }
  async function deleteSite() {
    if (
      !selected ||
      !canManage ||
      pending ||
      !window.confirm(`Delete site “${selected.name}” and all deployments?`)
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectSite(projectId, selected.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectSites(projectId),
      });
      setSelectedID("");
    } catch (reason) {
      report(reason, "The site could not be deleted.");
    } finally {
      setPending(false);
    }
  }
  async function uploadDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !source || !canManage || pending) return;
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("source", source, source.name);
      form.append("activate", String(activateUpload));
      if (buildCommand.trim()) {
        form.append("build_runtime", buildRuntime);
        form.append("build_command", buildCommand.trim());
        form.append("output_directory", outputDirectory.trim() || ".");
      }
      await browserAPI.uploadProjectSiteDeployment(
        projectId,
        selected.id,
        form,
      );
      setSource(null);
      if (sourceInputRef.current) sourceInputRef.current.value = "";
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.siteDeployments(projectId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectSites(projectId),
        }),
      ]);
    } catch (reason) {
      report(reason, "The site deployment could not be uploaded.");
    } finally {
      setPending(false);
    }
  }
  async function createGitDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selected ||
      !canManage ||
      pending ||
      !repository.trim() ||
      !gitCommand.trim()
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.createProjectSiteGitDeployment(projectId, selected.id, {
        repository: repository.trim(),
        ref: ref.trim() || "main",
        build_runtime: gitRuntime,
        build_command: gitCommand.trim(),
        output_directory: gitOutputDirectory.trim() || ".",
        activate: activateGit,
      });
      setRepository("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.siteDeployments(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The Git deployment could not be created.");
    } finally {
      setPending(false);
    }
  }
  async function activateDeployment(deploymentID: string) {
    if (!selected || !canManage || pending) return;
    setPending(true);
    setError("");
    try {
      await browserAPI.activateProjectSiteDeployment(
        projectId,
        selected.id,
        deploymentID,
      );
      await Promise.all([
        queryClient.invalidateQueries({
        queryKey: queryKeys.siteDeployments(projectId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectSites(projectId),
        }),
      ]);
    } catch (reason) {
      report(reason, "The deployment could not be activated.");
    } finally {
      setPending(false);
    }
  }
  async function deleteDeployment(deploymentID: string) {
    if (
      !selected ||
      !canManage ||
      pending ||
      !window.confirm("Delete this site deployment?")
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectSiteDeployment(
        projectId,
        selected.id,
        deploymentID,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.siteDeployments(projectId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectSites(projectId),
        }),
      ]);
    } catch (reason) {
      report(reason, "The deployment could not be deleted.");
    } finally {
      setPending(false);
    }
  }
  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage || pending || !hostname.trim()) return;
    setPending(true);
    setError("");
    try {
      await browserAPI.createProjectSiteDomain(projectId, selected.id, {
        hostname: hostname.trim().toLowerCase(),
      });
      setHostname("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.siteDomains(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The domain could not be added.");
    } finally {
      setPending(false);
    }
  }
  async function verifyDomain(domainID: string) {
    if (!selected || !canManage || pending) return;
    setPending(true);
    setError("");
    try {
      await browserAPI.verifyProjectSiteDomain(
        projectId,
        selected.id,
        domainID,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.siteDomains(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The domain could not be verified.");
    } finally {
      setPending(false);
    }
  }
  async function deleteDomain(domainID: string) {
    if (
      !selected ||
      !canManage ||
      pending ||
      !window.confirm("Delete this domain binding?")
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectSiteDomain(
        projectId,
        selected.id,
        domainID,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.siteDomains(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The domain could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  if (sitesQuery.isPending) return <LoadingState />;
  if (sitesQuery.error) return <ErrorState error={sitesQuery.error} />;
  return (
    <section>
      <Link
        to="/projects/$projectId"
        params={{ projectId }}
        className="text-sm text-[var(--projects-accent)] hover:underline"
      >
        ← Project overview
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">
            Static hosting
          </p>
          <h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Sites
          </h1>
          <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--projects-muted)]">
            Immutable static releases with worker-backed builds, activation,
            quota enforcement, and DNS domain verification.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreateOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"
          >
            <Plus size={15} aria-hidden="true" />
            Create site
          </button>
        ) : null}
      </header>
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">
          <div className="flex items-center justify-between px-2 py-2">
            <h2 className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              Sites
            </h2>
            <span className="font-mono text-xs text-[var(--projects-muted)]">
              {sites.length}
            </span>
          </div>
          {sites.length ? (
            <div className="space-y-1">
              {sites.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedID(item.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${item.id === selectedID ? "bg-[var(--projects-control)] text-[var(--projects-text)]" : "text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"}`}
                >
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] ${statusClass(item.status)}`}
                  >
                    {item.status}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[180px] place-items-center p-4 text-center text-sm text-[var(--projects-muted)]">
              <Box size={26} className="mb-3" aria-hidden="true" />
              No sites yet.
            </div>
          )}
        </aside>
        <div className="min-w-0">
          {selected ? (
            <SiteWorkspace
              selected={selected}
              canManage={canManage}
              pending={pending}
              name={nameDraft}
              setName={setNameDraft}
              quota={quotaDraft}
              setQuota={setQuotaDraft}
              enabled={enabledDraft}
              setEnabled={setEnabledDraft}
              onSave={saveSettings}
              onDelete={deleteSite}
              source={source}
              setSource={setSource}
              sourceInputRef={sourceInputRef}
              activateUpload={activateUpload}
              setActivateUpload={setActivateUpload}
              buildCommand={buildCommand}
              setBuildCommand={setBuildCommand}
              buildRuntime={buildRuntime}
              setBuildRuntime={setBuildRuntime}
              outputDirectory={outputDirectory}
              setOutputDirectory={setOutputDirectory}
              onUpload={uploadDeployment}
              repository={repository}
              setRepository={setRepository}
              refValue={ref}
              setRef={setRef}
              gitCommand={gitCommand}
              setGitCommand={setGitCommand}
              gitRuntime={gitRuntime}
              setGitRuntime={setGitRuntime}
              gitOutputDirectory={gitOutputDirectory}
              setGitOutputDirectory={setGitOutputDirectory}
              activateGit={activateGit}
              setActivateGit={setActivateGit}
              onGitDeploy={createGitDeployment}
              deployments={deploymentsQuery.data?.deployments ?? []}
              deploymentsLoading={deploymentsQuery.isPending}
              selectedDeploymentID={selectedDeploymentID}
              onSelectDeployment={setSelectedDeploymentID}
              buildLogs={deploymentLogsQuery.data?.logs ?? []}
              buildLogsLoading={deploymentLogsQuery.isPending}
              buildLogsError={deploymentLogsQuery.error}
              onActivate={activateDeployment}
              onDeleteDeployment={deleteDeployment}
              domains={domainsQuery.data?.domains ?? []}
              domainsLoading={domainsQuery.isPending}
              hostname={hostname}
              setHostname={setHostname}
              onAddDomain={addDomain}
              onVerifyDomain={verifyDomain}
              onDeleteDomain={deleteDomain}
            />
          ) : (
            <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-8 text-center">
              <div>
                <Box
                  size={30}
                  className="mx-auto text-[var(--projects-muted)]"
                  aria-hidden="true"
                />
                <h2 className="m-0 mt-4 text-lg font-semibold">
                  Create a site to begin
                </h2>
                <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">
                  Upload a pre-built archive or deploy from Git.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {createOpen ? (
        <CreateSiteDialog
          pending={pending}
          name={createName}
          setName={setCreateName}
          onClose={() => setCreateOpen(false)}
          onSubmit={createSite}
        />
      ) : null}
    </section>
  );
}
