import {
  CheckCircle2,
  ExternalLink,
  Globe2,
  GitBranch,
  Plus,
  Save,
  Terminal,
  Trash2,
  Upload,
} from "lucide-react";
import type { FormEvent, RefObject } from "react";
import {
  browserAPI,
  browserAPIErrorMessage,
  type BrowserSite,
  type BrowserSiteBuildLog,
  type BrowserSiteDomain,
} from "@/lib/api/browser-api";
import { Field, formatBytes, formatDate, inputClass, statusClass, type Runtime } from "./site-ui";

type SiteDeployment = {
  id: string;
  version: number;
  source: string;
  source_name?: string | null;
  status: string;
  build_status: string;
  error_message?: string | null;
  created_at: string;
};

export function SiteWorkspace({
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
  selectedDeploymentID,
  onSelectDeployment,
  buildLogs,
  buildLogsLoading,
  buildLogsError,
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
  deployments: SiteDeployment[];
  deploymentsLoading: boolean;
  selectedDeploymentID: string;
  onSelectDeployment: (deploymentID: string) => void;
  buildLogs: BrowserSiteBuildLog[];
  buildLogsLoading: boolean;
  buildLogsError: unknown;
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
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(deployment.id)}
                        aria-pressed={selectedDeploymentID === deployment.id}
                        aria-label={`View build logs for deployment ${deployment.id}`}
                        className={`rounded-md text-left ${selectedDeploymentID === deployment.id ? "ring-2 ring-[var(--projects-accent)]/50" : ""}`}
                      >
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`rounded-full border px-2 py-1 ${statusClass(deployment.status)}`}
                          >
                            {deployment.status}
                          </span>
                          {deployment.build_status !== deployment.status ? (
                            <span
                              className={`rounded-full border px-2 py-1 ${statusClass(deployment.build_status)}`}
                            >
                              build {deployment.build_status}
                            </span>
                          ) : null}
                        </div>
                        {deployment.error_message ? (
                          <p
                            className="m-0 mt-1 max-w-[220px] truncate text-[var(--projects-danger)]"
                            title={deployment.error_message}
                          >
                            {deployment.error_message}
                          </p>
                        ) : null}
                      </button>
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
                      {deployment.status === "ready" &&
                      deployment.build_status === "succeeded" ? (
                        <a
                          href={browserAPI.publicSiteDeploymentURL(
                            selected.id,
                            deployment.id,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="mr-2 inline-flex items-center gap-1 rounded-lg border border-[var(--projects-border)] px-2 py-1"
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                          Preview
                        </a>
                      ) : null}
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
        {selectedDeploymentID ? (
          <section className="mt-5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal
                  size={15}
                  className="text-[var(--projects-accent)]"
                  aria-hidden="true"
                />
                <h4 className="m-0 text-sm font-semibold">Build logs</h4>
              </div>
              <span className="font-mono text-[10px] text-[var(--projects-muted)]">
                deployment: {selectedDeploymentID}
              </span>
            </div>
            <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
              Secret-redacted lifecycle output emitted by the trusted Site build worker.
            </p>
            {buildLogsLoading ? (
              <p className="m-0 mt-4 text-xs text-[var(--projects-muted)]">
                Loading build logs…
              </p>
            ) : buildLogsError ? (
              <p role="alert" className="m-0 mt-4 text-xs text-rose-200">
                {browserAPIErrorMessage(buildLogsError, "Unable to load build logs.")}
              </p>
            ) : buildLogs.length ? (
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">
                {buildLogs.map((log) => (
                  <p
                    key={log.id}
                    className="m-0 border-b border-[var(--projects-divider)] py-1.5 font-mono text-[10px] leading-5 last:border-0"
                  >
                    <span
                      className={`mr-2 uppercase ${log.level === "error" ? "text-rose-200" : log.level === "warn" ? "text-amber-200" : "text-[var(--projects-accent)]"}`}
                    >
                      {log.level}
                    </span>
                    <span className="mr-2 text-[var(--projects-muted)]">
                      #{log.sequence}
                    </span>
                    {log.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="m-0 mt-4 rounded-lg border border-dashed border-[var(--projects-border)] p-6 text-center text-xs text-[var(--projects-muted)]">
                No build logs have been emitted for this deployment.
              </p>
            )}
          </section>
        ) : null}
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
