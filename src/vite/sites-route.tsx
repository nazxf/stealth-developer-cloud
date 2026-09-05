import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CheckCircle2,
  ExternalLink,
  Globe2,
  GitBranch,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BrowserAPIError,
  browserAPI,
  type BrowserSite,
  type BrowserSiteDomain,
} from "@/lib/browser-api";
import { queryClient } from "./query-client";

type Runtime = "node-22" | "python-3.13" | "go-1.24";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-[var(--projects-muted)]">
      {label}
      {children}
    </label>
  );
}
function inputClass() {
  return "mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]";
}
function formatDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}
function statusClass(status: string) {
  if (["active", "ready", "verified"].includes(status))
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (["failed", "cancelled", "disabled"].includes(status))
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}
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
  return (
    <div
      role="alert"
      className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-danger)]"
    >
      {error instanceof Error ? error.message : "Unable to load sites."}
    </div>
  );
}

export default function SitesRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/sites" });
  const sitesQuery = useQuery({
    queryKey: ["project-sites", projectId],
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
  const deploymentsQuery = useQuery({
    queryKey: ["site-deployments", projectId, selectedID],
    queryFn: () =>
      browserAPI.projectSiteDeployments(projectId, selectedID, { limit: 50 }),
    enabled: Boolean(selectedID),
    refetchInterval: selectedID ? 2500 : false,
  });
  const domainsQuery = useQuery({
    queryKey: ["site-domains", projectId, selectedID],
    queryFn: () =>
      browserAPI.projectSiteDomains(projectId, selectedID, { limit: 50 }),
    enabled: Boolean(selectedID),
  });

  function report(reason: unknown, fallback: string) {
    setError(
      reason instanceof BrowserAPIError
        ? reason.message
        : reason instanceof Error
          ? reason.message
          : fallback,
    );
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
        queryKey: ["project-sites", projectId],
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
        queryKey: ["project-sites", projectId],
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
        queryKey: ["project-sites", projectId],
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
          queryKey: ["site-deployments", projectId, selected.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-sites", projectId],
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
        queryKey: ["site-deployments", projectId, selected.id],
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
          queryKey: ["site-deployments", projectId, selected.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-sites", projectId],
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
          queryKey: ["site-deployments", projectId, selected.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-sites", projectId],
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
        queryKey: ["site-domains", projectId, selected.id],
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
        queryKey: ["site-domains", projectId, selected.id],
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
        queryKey: ["site-domains", projectId, selected.id],
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

function CreateSiteDialog({
  pending,
  name,
  setName,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  name: string;
  setName: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vite-create-site-title"
        className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="vite-create-site-title"
              className="m-0 text-lg font-semibold"
            >
              Create site
            </h2>
            <p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">
              Static sites are published only from immutable deployments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create site dialog"
            className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="Name">
            <input
              required
              minLength={2}
              maxLength={63}
              pattern="[a-z0-9][a-z0-9-]{1,62}"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              className={inputClass()}
              placeholder="marketing"
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SiteWorkspace({
  selected,
  canManage,
  pending,
  name,
  setName,
  quota,
  setQuota,
  enabled,
  setEnabled,
  onSave,
  onDelete,
  source,
  setSource,
  sourceInputRef,
  activateUpload,
  setActivateUpload,
  buildCommand,
  setBuildCommand,
  buildRuntime,
  setBuildRuntime,
  outputDirectory,
  setOutputDirectory,
  onUpload,
  repository,
  setRepository,
  refValue,
  setRef,
  gitCommand,
  setGitCommand,
  gitRuntime,
  setGitRuntime,
  gitOutputDirectory,
  setGitOutputDirectory,
  activateGit,
  setActivateGit,
  onGitDeploy,
  deployments,
  deploymentsLoading,
  onActivate,
  onDeleteDeployment,
  domains,
  domainsLoading,
  hostname,
  setHostname,
  onAddDomain,
  onVerifyDomain,
  onDeleteDomain,
}: {
  selected: BrowserSite;
  canManage: boolean;
  pending: boolean;
  name: string;
  setName: (value: string) => void;
  quota: string;
  setQuota: (value: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  source: File | null;
  setSource: (value: File | null) => void;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  activateUpload: boolean;
  setActivateUpload: (value: boolean) => void;
  buildCommand: string;
  setBuildCommand: (value: string) => void;
  buildRuntime: Runtime;
  setBuildRuntime: (value: Runtime) => void;
  outputDirectory: string;
  setOutputDirectory: (value: string) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  repository: string;
  setRepository: (value: string) => void;
  refValue: string;
  setRef: (value: string) => void;
  gitCommand: string;
  setGitCommand: (value: string) => void;
  gitRuntime: Runtime;
  setGitRuntime: (value: Runtime) => void;
  gitOutputDirectory: string;
  setGitOutputDirectory: (value: string) => void;
  activateGit: boolean;
  setActivateGit: (value: boolean) => void;
  onGitDeploy: (event: FormEvent<HTMLFormElement>) => void;
  deployments: Array<{
    id: string;
    version: number;
    source: string;
    source_name?: string | null;
    status: string;
    build_status: string;
    error_message?: string | null;
    created_at: string;
  }>;
  deploymentsLoading: boolean;
  onActivate: (id: string) => void;
  onDeleteDeployment: (id: string) => void;
  domains: BrowserSiteDomain[];
  domainsLoading: boolean;
  hostname: string;
  setHostname: (value: string) => void;
  onAddDomain: (event: FormEvent<HTMLFormElement>) => void;
  onVerifyDomain: (id: string) => void;
  onDeleteDomain: (id: string) => void;
}) {
  return (
    <div>
      <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">
              site: {selected.id}
            </p>
            <h2 className="m-0 mt-1 text-2xl font-semibold">{selected.name}</h2>
            <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
              {formatBytes(selected.artifact_used_bytes)} of{" "}
              {formatBytes(selected.artifact_quota_bytes)} used ·{" "}
              {selected.active_deployment_id
                ? "published"
                : "no active release"}
            </p>
          </div>
          <a
            href={browserAPI.publicSiteURL(selected.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold"
          >
            <ExternalLink size={13} aria-hidden="true" />
            Open site
          </a>
        </div>
        {canManage ? (
          <form
            onSubmit={onSave}
            className="mt-5 grid gap-3 border-t border-[var(--projects-divider)] pt-5 md:grid-cols-3"
          >
            <Field label="Name">
              <input
                required
                minLength={2}
                maxLength={63}
                pattern="[a-z0-9][a-z0-9-]{1,62}"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={pending}
                className={inputClass()}
              />
            </Field>
            <Field label="Artifact quota bytes">
              <input
                type="number"
                min={
                  selected.artifact_used_bytes +
                  selected.artifact_reserved_bytes
                }
                value={quota}
                onChange={(event) => setQuota(event.target.value)}
                disabled={pending}
                className={inputClass()}
              />
            </Field>
            <div className="flex items-end gap-3 pb-1">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  disabled={pending}
                  className="accent-[var(--projects-accent)]"
                />
                Enabled
              </label>
              <button
                type="submit"
                disabled={pending}
                className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white"
              >
                <Save size={13} aria-hidden="true" />
                Save
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-200"
            >
              <Trash2 size={13} aria-hidden="true" />
              Delete site
            </button>
          </form>
        ) : null}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form
          onSubmit={onUpload}
          className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"
          noValidate
        >
          <div className="flex items-start gap-3">
            <Upload
              size={18}
              className="text-[var(--projects-accent)]"
              aria-hidden="true"
            />
            <div>
              <h3 className="m-0 text-lg font-semibold">Upload release</h3>
              <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
                Pre-built archives must include a root index.html.
              </p>
            </div>
          </div>
          <Field label="Source archive">
            <input
              ref={sourceInputRef}
              required
              type="file"
              accept=".zip,.tar,.gz,.tgz,application/zip,application/gzip"
              onChange={(event) => setSource(event.target.files?.[0] ?? null)}
              disabled={!canManage || pending}
              className="mt-4 block w-full text-xs text-[var(--projects-text)] file:mr-3 file:rounded file:border-0 file:bg-[var(--projects-accent-strong)] file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white"
            />
          </Field>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Build command (optional)">
              <input
                value={buildCommand}
                onChange={(event) => setBuildCommand(event.target.value)}
                disabled={!canManage || pending}
                placeholder="npm run build"
                className={inputClass()}
              />
            </Field>
            <Field label="Output directory">
              <input
                value={outputDirectory}
                onChange={(event) => setOutputDirectory(event.target.value)}
                disabled={!canManage || pending}
                className={inputClass()}
              />
            </Field>
            <Field label="Runtime">
              <select
                value={buildRuntime}
                onChange={(event) =>
                  setBuildRuntime(event.target.value as Runtime)
                }
                disabled={!canManage || pending}
                className={inputClass()}
              >
                <option value="node-22">Node 22</option>
                <option value="python-3.13">Python 3.13</option>
                <option value="go-1.24">Go 1.24</option>
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-xs">
              <input
                type="checkbox"
                checked={activateUpload}
                onChange={(event) => setActivateUpload(event.target.checked)}
                disabled={!canManage || pending}
                className="accent-[var(--projects-accent)]"
              />
              Activate release
            </label>
          </div>
          <button
            type="submit"
            disabled={!canManage || pending || !source}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Upload size={13} aria-hidden="true" />
            Deploy archive
          </button>
        </form>
        <form
          onSubmit={onGitDeploy}
          className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"
          noValidate
        >
          <div className="flex items-start gap-3">
            <GitBranch
              size={18}
              className="text-[var(--projects-accent)]"
              aria-hidden="true"
            />
            <div>
              <h3 className="m-0 text-lg font-semibold">Deploy from Git</h3>
              <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
                The backend fetches and builds a validated provider archive.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Field label="Repository URL">
              <input
                required
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                disabled={!canManage || pending}
                placeholder="https://github.com/acme/site"
                className={inputClass()}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Branch or tag">
                <input
                  value={refValue}
                  onChange={(event) => setRef(event.target.value)}
                  disabled={!canManage || pending}
                  className={inputClass()}
                />
              </Field>
              <Field label="Build command">
                <input
                  required
                  value={gitCommand}
                  onChange={(event) => setGitCommand(event.target.value)}
                  disabled={!canManage || pending}
                  className={inputClass()}
                />
              </Field>
              <Field label="Output directory">
                <input
                  value={gitOutputDirectory}
                  onChange={(event) =>
                    setGitOutputDirectory(event.target.value)
                  }
                  disabled={!canManage || pending}
                  className={inputClass()}
                />
              </Field>
              <Field label="Runtime">
                <select
                  value={gitRuntime}
                  onChange={(event) =>
                    setGitRuntime(event.target.value as Runtime)
                  }
                  disabled={!canManage || pending}
                  className={inputClass()}
                >
                  <option value="node-22">Node 22</option>
                  <option value="python-3.13">Python 3.13</option>
                  <option value="go-1.24">Go 1.24</option>
                </select>
              </Field>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={activateGit}
                onChange={(event) => setActivateGit(event.target.checked)}
                disabled={!canManage || pending}
                className="accent-[var(--projects-accent)]"
              />
              Activate after build
            </label>
          </div>
          <button
            type="submit"
            disabled={!canManage || pending}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            <GitBranch size={13} aria-hidden="true" />
            Create Git deployment
          </button>
        </form>
      </div>
      <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={18}
            className="text-[var(--projects-accent)]"
            aria-hidden="true"
          />
          <div>
            <h3 className="m-0 text-lg font-semibold">Deployment history</h3>
            <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
              Queued builds are refreshed while workers process them.
            </p>
          </div>
        </div>
        {deploymentsLoading ? (
          <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
            Loading deployment history…
          </p>
        ) : deployments.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]">
            <table className="w-full min-w-[720px] text-left text-xs">
              <caption className="sr-only">
                Deployments for {selected.name}
              </caption>
              <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Version
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Source
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Created
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--projects-divider)]">
                {deployments.map((deployment) => (
                  <tr key={deployment.id}>
                    <td className="px-3 py-3 font-mono text-[var(--projects-muted)]">
                      v{deployment.version}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 ${statusClass(deployment.status)}`}
                      >
                        {deployment.status}
                      </span>
                      {deployment.error_message ? (
                        <p
                          className="m-0 mt-1 max-w-[220px] truncate text-[var(--projects-danger)]"
                          title={deployment.error_message}
                        >
                          {deployment.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-3 py-3 text-[var(--projects-muted)]"
                      title={deployment.source_name ?? deployment.source}
                    >
                      {deployment.source_name ?? deployment.source}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[var(--projects-muted)]">
                      {formatDate(deployment.created_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canManage &&
                      deployment.status === "ready" &&
                      deployment.build_status === "succeeded" ? (
                        <button
                          type="button"
                          onClick={() => onActivate(deployment.id)}
                          disabled={pending}
                          className="mr-2 inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1 text-emerald-200"
                        >
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Activate
                        </button>
                      ) : null}
                      {canManage && deployment.status !== "active" ? (
                        <button
                          type="button"
                          onClick={() => onDeleteDeployment(deployment.id)}
                          disabled={pending}
                          className="inline-flex items-center rounded-lg border border-rose-500/30 p-1.5 text-rose-200"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 mt-5 rounded-lg border border-dashed border-[var(--projects-border)] p-10 text-center text-sm text-[var(--projects-muted)]">
            No deployments yet.
          </p>
        )}
      </div>
      <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
        <div className="flex items-start gap-3">
          <Globe2
            size={18}
            className="text-[var(--projects-accent)]"
            aria-hidden="true"
          />
          <div>
            <h3 className="m-0 text-lg font-semibold">Domains</h3>
            <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
              Publish the TXT record before asking the backend to verify
              ownership.
            </p>
          </div>
        </div>
        {canManage ? (
          <form
            onSubmit={onAddDomain}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <Field label="Hostname">
              <input
                required
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                disabled={pending}
                className={inputClass()}
                placeholder="app.example.com"
              />
            </Field>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white"
            >
              <Plus size={13} aria-hidden="true" />
              Add domain
            </button>
          </form>
        ) : null}
        {domainsLoading ? (
          <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
            Loading domains…
          </p>
        ) : domains.length ? (
          <div className="mt-4 space-y-2">
            {domains.map((domain) => (
              <article
                key={domain.id}
                className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="m-0 font-medium">{domain.hostname}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
                      {domain.status} · TLS {domain.tls_status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canManage && domain.status !== "verified" ? (
                      <button
                        type="button"
                        onClick={() => onVerifyDomain(domain.id)}
                        disabled={pending}
                        className="h-8 rounded-lg border border-[var(--projects-border)] px-2.5 text-xs"
                      >
                        Verify
                      </button>
                    ) : null}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => onDeleteDomain(domain.id)}
                        disabled={pending}
                        className="h-8 rounded-lg border border-rose-500/30 px-2.5 text-xs text-rose-200"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                {domain.status !== "verified" ? (
                  <p className="m-0 mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 font-mono text-[11px] text-amber-100">
                    TXT {domain.verification_record_name} ={" "}
                    {domain.verification_record_value}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="m-0 mt-5 rounded-lg border border-dashed border-[var(--projects-border)] p-10 text-center text-sm text-[var(--projects-muted)]">
            No custom domains configured.
          </p>
        )}
      </div>
    </div>
  );
}
