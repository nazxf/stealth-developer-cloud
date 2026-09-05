import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CheckCircle2,
  FileArchive,
  LoaderCircle,
  Play,
  Plus,
  Save,
  Settings2,
  Terminal,
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
  browserAPI,
  browserAPIErrorMessage,
  type BrowserFunction,
  type BrowserFunctionBuildLog,
  type BrowserFunctionRuntime,
  type BrowserFunctionExecutionLog,
  type BrowserFunctionVariable,
} from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";
import { ErrorState as AsyncErrorState } from "./error-state";
import { deploymentIsInProgress, deploymentPollInterval, executionIsInProgress, executionPollInterval, operationPollIntervalMs } from "./polling";

type Tab = "deployments" | "variables" | "executions" | "settings";
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "deployments", label: "Deployments" },
  { id: "variables", label: "Variables" },
  { id: "executions", label: "Executions" },
  { id: "settings", label: "Settings" },
];
const runtimes: Array<{ value: BrowserFunctionRuntime; label: string }> = [
  { value: "node-22", label: "Node.js 22" },
  { value: "python-3.13", label: "Python 3.13" },
  { value: "go-1.24", label: "Go 1.24" },
];

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
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}
function statusClass(status: string) {
  if (["active", "ready", "succeeded"].includes(status))
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (["failed", "cancelled"].includes(status))
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}
function parsePermissions(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function LoadingState() {
  return (
    <div
      className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]"
      aria-live="polite"
    >
      Loading functions…
    </div>
  );
}
function ErrorState({ error }: { error: unknown }) {
  return <AsyncErrorState error={error} fallback="Unable to load functions." />;
}
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

export default function FunctionsRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/functions" });
  const functionsQuery = useQuery({
    queryKey: queryKeys.projectFunctions(projectId),
    queryFn: () => browserAPI.projectFunctions(projectId, { limit: 100 }),
  });
  const [selectedID, setSelectedID] = useState("");
  const [tab, setTab] = useState<Tab>("deployments");
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRuntime, setCreateRuntime] =
    useState<BrowserFunctionRuntime>("node-22");
  const [source, setSource] = useState<File | null>(null);
  const [activateUpload, setActivateUpload] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [runtimeDraft, setRuntimeDraft] =
    useState<BrowserFunctionRuntime>("node-22");
  const [entrypointDraft, setEntrypointDraft] = useState("src/main.js");
  const [commandsDraft, setCommandsDraft] = useState("");
  const [timeoutDraft, setTimeoutDraft] = useState("15");
  const [quotaDraft, setQuotaDraft] = useState("");
  const [enabledDraft, setEnabledDraft] = useState(true);
  const [loggingDraft, setLoggingDraft] = useState(true);
  const [executeDraft, setExecuteDraft] = useState("");
  const [variableKey, setVariableKey] = useState("");
  const [variableValue, setVariableValue] = useState("");
  const [variableSecret, setVariableSecret] = useState(true);
  const [variableDescription, setVariableDescription] = useState("");
  const [executionTrigger, setExecutionTrigger] = useState("manual");
  const [executionInput, setExecutionInput] = useState("{}");
  const [selectedDeploymentID, setSelectedDeploymentID] = useState("");
  const [selectedExecutionID, setSelectedExecutionID] = useState("");
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const functions = functionsQuery.data?.functions ?? [];
  const selected = functions.find((item) => item.id === selectedID) ?? null;
  const canManage = functionsQuery.data?.can_manage ?? false;

  useEffect(() => {
    if (!selectedID || !functions.some((item) => item.id === selectedID))
      setSelectedID(functions[0]?.id ?? "");
  }, [functions, selectedID]);
  useEffect(() => {
    if (!selected) return;
    setNameDraft(selected.name);
    setRuntimeDraft(selected.runtime);
    setEntrypointDraft(selected.entrypoint);
    setCommandsDraft(selected.commands);
    setTimeoutDraft(String(selected.timeout_seconds));
    setQuotaDraft(String(selected.artifact_quota_bytes));
    setEnabledDraft(selected.enabled);
    setLoggingDraft(selected.logging);
    setExecuteDraft(selected.execute_permissions.join(", "));
  }, [selected]);
  useEffect(() => {
    setSelectedDeploymentID("");
    setSelectedExecutionID("");
  }, [selectedID]);

  const deploymentsQuery = useQuery({
    queryKey: queryKeys.functionDeployments(projectId, selectedID),
    queryFn: () =>
      browserAPI.projectFunctionDeployments(projectId, selectedID, {
        limit: 50,
      }),
    enabled: Boolean(selectedID),
    refetchInterval: (query) => deploymentPollInterval(query.state.data, tab === "deployments"),
  });
  const selectedDeployment = deploymentsQuery.data?.deployments.find((deployment) => deployment.id === selectedDeploymentID);
  const deploymentLogsQuery = useQuery({
    queryKey: queryKeys.functionBuildLogs(projectId, selectedID, selectedDeploymentID),
    queryFn: () => browserAPI.projectFunctionBuildLogs(projectId, selectedID, selectedDeploymentID, { limit: 100 }),
    enabled: Boolean(selectedID && selectedDeploymentID && tab === "deployments"),
    refetchInterval: tab === "deployments" && deploymentIsInProgress(selectedDeployment) ? operationPollIntervalMs : false,
  });
  const variablesQuery = useQuery({
    queryKey: queryKeys.functionVariables(projectId, selectedID),
    queryFn: () =>
      browserAPI.projectFunctionVariables(projectId, selectedID, {
        limit: 100,
      }),
    enabled: Boolean(selectedID),
    refetchInterval: false,
  });
  const executionsQuery = useQuery({
    queryKey: queryKeys.functionExecutions(projectId, selectedID),
    queryFn: () =>
      browserAPI.projectFunctionExecutions(projectId, selectedID, {
        limit: 50,
      }),
    enabled: Boolean(selectedID),
    refetchInterval: (query) => executionPollInterval(query.state.data, tab === "executions"),
  });
  const selectedExecution = executionsQuery.data?.executions.find((execution) => execution.id === selectedExecutionID);
  const executionLogsQuery = useQuery({
    queryKey: queryKeys.functionExecutionLogs(projectId, selectedID, selectedExecutionID),
    queryFn: () => browserAPI.projectFunctionExecutionLogs(projectId, selectedID, selectedExecutionID, { limit: 100 }),
    enabled: Boolean(selectedID && selectedExecutionID && tab === "executions"),
    refetchInterval: tab === "executions" && executionIsInProgress(selectedExecution) ? operationPollIntervalMs : false,
  });

  function report(reason: unknown, fallback: string) {
    setError(browserAPIErrorMessage(reason, fallback));
  }
  async function createFunction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await browserAPI.createProjectFunction(projectId, {
        name: createName.trim(),
        runtime: createRuntime,
        entrypoint: "src/main.js",
        commands: "",
        timeout_seconds: 15,
        enabled: true,
        logging: true,
        execute_permissions: [],
      });
      setCreateName("");
      setCreateOpen(false);
      setSelectedID(result.function.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectFunctions(projectId),
      });
    } catch (reason) {
      report(reason, "The function could not be created.");
    } finally {
      setPending(false);
    }
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage || pending) return;
    const timeout = Number(timeoutDraft);
    const quota = Number(quotaDraft);
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 900) {
      setError("Timeout must be between 1 and 900 seconds.");
      return;
    }
    if (
      !Number.isSafeInteger(quota) ||
      quota < selected.artifact_used_bytes ||
      quota < 1
    ) {
      setError("Artifact quota must cover current usage.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.updateProjectFunction(projectId, selected.id, {
        name: nameDraft.trim(),
        runtime: runtimeDraft,
        entrypoint: entrypointDraft.trim(),
        commands: commandsDraft.trim(),
        timeout_seconds: timeout,
        enabled: enabledDraft,
        logging: loggingDraft,
        execute_permissions: parsePermissions(executeDraft),
        artifact_quota_bytes: quota,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectFunctions(projectId),
      });
    } catch (reason) {
      report(reason, "Function settings could not be saved.");
    } finally {
      setPending(false);
    }
  }
  async function deleteFunction() {
    if (
      !selected ||
      !canManage ||
      pending ||
      !window.confirm(`Delete function “${selected.name}” and all deployments?`)
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectFunction(projectId, selected.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectFunctions(projectId),
      });
      setSelectedID("");
    } catch (reason) {
      report(reason, "The function could not be deleted.");
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
      await browserAPI.uploadProjectFunctionDeployment(
        projectId,
        selected.id,
        form,
      );
      setSource(null);
      if (sourceInputRef.current) sourceInputRef.current.value = "";
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.functionDeployments(projectId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectFunctions(projectId),
        }),
      ]);
    } catch (reason) {
      report(reason, "The function deployment could not be uploaded.");
    } finally {
      setPending(false);
    }
  }
  async function activateDeployment(deploymentID: string) {
    if (!selected || !canManage || pending) return;
    setPending(true);
    setError("");
    try {
      await browserAPI.activateProjectFunctionDeployment(
        projectId,
        selected.id,
        deploymentID,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.functionDeployments(projectId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectFunctions(projectId),
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
      !window.confirm("Delete this function deployment?")
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectFunctionDeployment(
        projectId,
        selected.id,
        deploymentID,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.functionDeployments(projectId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.projectFunctions(projectId),
        }),
      ]);
    } catch (reason) {
      report(reason, "The deployment could not be deleted.");
    } finally {
      setPending(false);
    }
  }
  async function createVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage || pending) return;
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableKey.trim()) ||
      !variableValue
    ) {
      setError("Use a valid variable key and a non-empty value.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.createProjectFunctionVariable(projectId, selected.id, {
        key: variableKey.trim(),
        kind: variableSecret ? "secret" : "variable",
        is_secret: variableSecret,
        value: variableValue,
        description: variableDescription.trim() || undefined,
      });
      setVariableKey("");
      setVariableValue("");
      setVariableDescription("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.functionVariables(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The variable could not be saved.");
    } finally {
      setPending(false);
    }
  }
  async function deleteVariable(variable: BrowserFunctionVariable) {
    if (
      !selected ||
      !canManage ||
      pending ||
      !window.confirm(`Delete variable “${variable.key}”?`)
    )
      return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectFunctionVariable(
        projectId,
        selected.id,
        variable.id,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.functionVariables(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The variable could not be deleted.");
    } finally {
      setPending(false);
    }
  }
  async function invokeFunction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    let input: unknown;
    try {
      input = JSON.parse(executionInput);
    } catch {
      setError("Execution input must be valid JSON.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.createProjectFunctionExecution(projectId, selected.id, {
        trigger: executionTrigger.trim() || "manual",
        input,
      });
      setExecutionInput("{}");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.functionExecutions(projectId, selected.id),
      });
    } catch (reason) {
      report(reason, "The function invocation could not be queued.");
    } finally {
      setPending(false);
    }
  }

  let detailPanel: ReactNode = null;
  if (selected) {
    if (tab === "deployments") {
      detailPanel = (
        <DeploymentsPanel
          selected={selected}
          canManage={canManage}
          pending={pending}
          source={source}
          setSource={setSource}
          sourceInputRef={sourceInputRef}
          activateUpload={activateUpload}
          setActivateUpload={setActivateUpload}
          deployments={deploymentsQuery.data?.deployments ?? []}
          loading={deploymentsQuery.isPending}
          selectedDeploymentID={selectedDeploymentID}
          onSelectDeployment={setSelectedDeploymentID}
          buildLogs={deploymentLogsQuery.data?.logs ?? []}
          buildLogsLoading={deploymentLogsQuery.isPending}
          buildLogsError={deploymentLogsQuery.error}
          onUpload={uploadDeployment}
          onActivate={activateDeployment}
          onDelete={deleteDeployment}
        />
      );
    } else if (tab === "variables") {
      detailPanel = (
        <VariablesPanel
          canManage={canManage}
          pending={pending}
          variables={variablesQuery.data?.variables ?? []}
          loading={variablesQuery.isPending}
          variableKey={variableKey}
          setVariableKey={setVariableKey}
          variableValue={variableValue}
          setVariableValue={setVariableValue}
          variableSecret={variableSecret}
          setVariableSecret={setVariableSecret}
          variableDescription={variableDescription}
          setVariableDescription={setVariableDescription}
          onCreate={createVariable}
          onDelete={deleteVariable}
        />
      );
    } else if (tab === "executions") {
      detailPanel = (
        <ExecutionsPanel
          pending={pending}
          executions={executionsQuery.data?.executions ?? []}
          selectedExecutionID={selectedExecutionID}
          onSelectExecution={setSelectedExecutionID}
          logs={executionLogsQuery.data?.logs ?? []}
          logsLoading={executionLogsQuery.isPending}
          logsError={executionLogsQuery.error}
          loading={executionsQuery.isPending}
          executionTrigger={executionTrigger}
          setExecutionTrigger={setExecutionTrigger}
          executionInput={executionInput}
          setExecutionInput={setExecutionInput}
          onInvoke={invokeFunction}
        />
      );
    } else {
      detailPanel = (
        <SettingsPanel
          selected={selected}
          canManage={canManage}
          pending={pending}
          name={nameDraft}
          setName={setNameDraft}
          runtime={runtimeDraft}
          setRuntime={setRuntimeDraft}
          entrypoint={entrypointDraft}
          setEntrypoint={setEntrypointDraft}
          commands={commandsDraft}
          setCommands={setCommandsDraft}
          timeout={timeoutDraft}
          setTimeout={setTimeoutDraft}
          quota={quotaDraft}
          setQuota={setQuotaDraft}
          enabled={enabledDraft}
          setEnabled={setEnabledDraft}
          logging={loggingDraft}
          setLogging={setLoggingDraft}
          executePermissions={executeDraft}
          setExecutePermissions={setExecuteDraft}
          onSave={saveSettings}
          onDelete={deleteFunction}
        />
      );
    }
  }
  if (functionsQuery.isPending) return <LoadingState />;
  if (functionsQuery.error) return <ErrorState error={functionsQuery.error} />;
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
            Compute platform
          </p>
          <h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Functions
          </h1>
          <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--projects-muted)]">
            Versioned serverless source, encrypted variables, queued executions,
            and worker-backed deployments.
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
            Create function
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
              Functions
            </h2>
            <span className="font-mono text-xs text-[var(--projects-muted)]">
              {functions.length}
            </span>
          </div>
          {functions.length ? (
            <div className="space-y-1">
              {functions.map((item) => (
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
              No functions yet.
            </div>
          )}
        </aside>
        <div className="min-w-0">
          {selected ? (
            <>
              <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">
                      function: {selected.id}
                    </p>
                    <h2 className="m-0 mt-1 text-2xl font-semibold">
                      {selected.name}
                    </h2>
                    <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
                      {selected.runtime} ·{" "}
                      {formatBytes(selected.artifact_used_bytes)} of{" "}
                      {formatBytes(selected.artifact_quota_bytes)} used
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-1 border-b border-[var(--projects-divider)]">
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`border-b-2 px-3 py-2 text-xs font-semibold ${tab === item.id ? "border-[var(--projects-accent)] text-[var(--projects-text)]" : "border-transparent text-[var(--projects-muted)]"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {detailPanel}
            </>
          ) : (
            <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-8 text-center">
              <div>
                <Box
                  size={30}
                  className="mx-auto text-[var(--projects-muted)]"
                  aria-hidden="true"
                />
                <h2 className="m-0 mt-4 text-lg font-semibold">
                  Create a function to begin
                </h2>
                <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">
                  Upload source after creating a function.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {createOpen ? (
        <CreateFunctionDialog
          pending={pending}
          name={createName}
          setName={setCreateName}
          runtime={createRuntime}
          setRuntime={setCreateRuntime}
          onClose={() => setCreateOpen(false)}
          onSubmit={createFunction}
        />
      ) : null}
    </section>
  );
}

function CreateFunctionDialog({
  pending,
  name,
  setName,
  runtime,
  setRuntime,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  name: string;
  setName: (value: string) => void;
  runtime: BrowserFunctionRuntime;
  setRuntime: (value: BrowserFunctionRuntime) => void;
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
        aria-labelledby="vite-create-function-title"
        className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="vite-create-function-title"
              className="m-0 text-lg font-semibold"
            >
              Create function
            </h2>
            <p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">
              Start with a worker runtime and deploy source next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create function dialog"
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
              placeholder="api-worker"
            />
          </Field>
          <Field label="Runtime">
            <select
              value={runtime}
              onChange={(event) =>
                setRuntime(event.target.value as BrowserFunctionRuntime)
              }
              disabled={pending}
              className={inputClass()}
            >
              {runtimes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
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

function DeploymentsPanel({
  selected,
  canManage,
  pending,
  source,
  setSource,
  sourceInputRef,
  activateUpload,
  setActivateUpload,
  deployments,
  loading,
  selectedDeploymentID,
  onSelectDeployment,
  buildLogs,
  buildLogsLoading,
  buildLogsError,
  onUpload,
  onActivate,
  onDelete,
}: {
  selected: BrowserFunction;
  canManage: boolean;
  pending: boolean;
  source: File | null;
  setSource: (value: File | null) => void;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  activateUpload: boolean;
  setActivateUpload: (value: boolean) => void;
  deployments: Array<{
    id: string;
    version: number;
    source: string;
    source_name?: string | null;
    status: string;
    build_status: string;
    error_message?: string | null;
    created_at: string;
    activated_at?: string | null;
  }>;
  loading: boolean;
  selectedDeploymentID: string;
  onSelectDeployment: (deploymentID: string) => void;
  buildLogs: BrowserFunctionBuildLog[];
  buildLogsLoading: boolean;
  buildLogsError: unknown;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start gap-3">
        <FileArchive
          size={19}
          className="mt-0.5 text-[var(--projects-muted)]"
          aria-hidden="true"
        />
        <div>
          <h3 className="m-0 text-lg font-semibold">Deployments</h3>
          <p className="m-0 mt-1 text-xs leading-5 text-[var(--projects-muted)]">
            Source archives are immutable. Workers build and activate one
            release at a time.
          </p>
        </div>
      </div>
      {canManage ? (
        <form
          onSubmit={onUpload}
          className="mt-4 grid gap-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          noValidate
        >
          <label className="text-xs text-[var(--projects-muted)]">
            Source archive
            <input
              ref={sourceInputRef}
              required
              type="file"
              name="source"
              accept=".zip,.tar,.gz,.tgz,application/zip,application/gzip"
              onChange={(event) => setSource(event.target.files?.[0] ?? null)}
              disabled={pending}
              className="mt-1 block w-full text-xs text-[var(--projects-text)] file:mr-3 file:rounded file:border-0 file:bg-[var(--projects-accent-strong)] file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-[var(--projects-text)]">
            <input
              type="checkbox"
              checked={activateUpload}
              onChange={(event) => setActivateUpload(event.target.checked)}
              disabled={pending}
              className="accent-[var(--projects-accent)]"
            />
            Activate
          </label>
          <button
            type="submit"
            disabled={pending || !source}
            className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle
                size={13}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload size={13} aria-hidden="true" />
            )}
            Deploy
          </button>
        </form>
      ) : null}
      {loading ? (
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
                    className="max-w-[200px] truncate px-3 py-3 text-[var(--projects-muted)]"
                    title={deployment.source_name ?? deployment.source}
                  >
                    {deployment.source_name ?? deployment.source}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--projects-muted)]">
                    <time dateTime={deployment.created_at}>
                      {formatDate(deployment.created_at)}
                    </time>
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
                        onClick={() => onDelete(deployment.id)}
                        disabled={pending}
                        aria-label={`Delete deployment ${deployment.id}`}
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
          No deployments yet. Upload a source archive to create one.
        </p>
      )}
      {selectedDeploymentID ? (
        <section className="mt-5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-[var(--projects-accent)]" aria-hidden="true" />
              <h4 className="m-0 text-sm font-semibold">Build logs</h4>
            </div>
            <span className="font-mono text-[10px] text-[var(--projects-muted)]">
              deployment: {selectedDeploymentID}
            </span>
          </div>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
            Secret-redacted output emitted by the trusted Function build worker.
          </p>
          {buildLogsLoading ? (
            <p className="m-0 mt-4 text-xs text-[var(--projects-muted)]">Loading build logs…</p>
          ) : buildLogsError ? (
            <p role="alert" className="m-0 mt-4 text-xs text-rose-200">
              {browserAPIErrorMessage(buildLogsError, "Unable to load build logs.")}
            </p>
          ) : buildLogs.length ? (
            <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">
              {buildLogs.map((log) => (
                <p key={log.id} className="m-0 border-b border-[var(--projects-divider)] py-1.5 font-mono text-[10px] leading-5 last:border-0">
                  <span className={`mr-2 uppercase ${log.level === "error" ? "text-rose-200" : log.level === "warn" ? "text-amber-200" : "text-[var(--projects-accent)]"}`}>
                    {log.level}
                  </span>
                  <span className="mr-2 text-[var(--projects-muted)]">#{log.sequence}</span>
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
  );
}

function VariablesPanel({
  canManage,
  pending,
  variables,
  loading,
  variableKey,
  setVariableKey,
  variableValue,
  setVariableValue,
  variableSecret,
  setVariableSecret,
  variableDescription,
  setVariableDescription,
  onCreate,
  onDelete,
}: {
  canManage: boolean;
  pending: boolean;
  variables: BrowserFunctionVariable[];
  loading: boolean;
  variableKey: string;
  setVariableKey: (value: string) => void;
  variableValue: string;
  setVariableValue: (value: string) => void;
  variableSecret: boolean;
  setVariableSecret: (value: boolean) => void;
  variableDescription: string;
  setVariableDescription: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (variable: BrowserFunctionVariable) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div>
        <h3 className="m-0 text-lg font-semibold">Encrypted variables</h3>
        <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
          Secret values are write-only and never returned by the API.
        </p>
      </div>
      {canManage ? (
        <form
          onSubmit={onCreate}
          className="mt-4 grid gap-3 md:grid-cols-2"
          noValidate
        >
          <Field label="Key">
            <input
              required
              value={variableKey}
              onChange={(event) => setVariableKey(event.target.value)}
              disabled={pending}
              className={inputClass()}
              placeholder="DATABASE_URL"
            />
          </Field>
          <Field label="Value">
            <input
              required
              type="password"
              value={variableValue}
              onChange={(event) => setVariableValue(event.target.value)}
              disabled={pending}
              className={inputClass()}
            />
          </Field>
          <Field label="Description">
            <input
              value={variableDescription}
              onChange={(event) => setVariableDescription(event.target.value)}
              disabled={pending}
              className={inputClass()}
              placeholder="Used by the API worker"
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-xs text-[var(--projects-text)]">
            <input
              type="checkbox"
              checked={variableSecret}
              onChange={(event) => setVariableSecret(event.target.checked)}
              disabled={pending}
              className="accent-[var(--projects-accent)]"
            />
            Store as encrypted secret
            <button
              type="submit"
              disabled={pending}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Plus size={13} aria-hidden="true" />
              Add variable
            </button>
          </label>
        </form>
      ) : null}
      {loading ? (
        <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
          Loading variables…
        </p>
      ) : variables.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Key
                </th>
                <th scope="col" className="px-3 py-2">
                  Kind
                </th>
                <th scope="col" className="px-3 py-2">
                  Value
                </th>
                <th scope="col" className="px-3 py-2">
                  Updated
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--projects-divider)]">
              {variables.map((variable) => (
                <tr key={variable.id}>
                  <td className="px-3 py-3 font-mono">{variable.key}</td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {variable.kind}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {variable.has_value ? "••••••••" : "empty"}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {formatDate(variable.updated_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => onDelete(variable)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-1 text-rose-200"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Delete
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
          No variables configured.
        </p>
      )}
    </div>
  );
}

function ExecutionsPanel({
  pending,
  executions,
  loading,
  selectedExecutionID,
  onSelectExecution,
  logs,
  logsLoading,
  logsError,
  executionTrigger,
  setExecutionTrigger,
  executionInput,
  setExecutionInput,
  onInvoke,
}: {
  pending: boolean;
  executions: Array<{
    id: string;
    status: string;
    trigger: string;
    response_status?: number | null;
    error_message?: string | null;
    created_at: string;
    finished_at?: string | null;
  }>;
  loading: boolean;
  selectedExecutionID: string;
  onSelectExecution: (executionID: string) => void;
  logs: BrowserFunctionExecutionLog[];
  logsLoading: boolean;
  logsError: unknown;
  executionTrigger: string;
  setExecutionTrigger: (value: string) => void;
  executionInput: string;
  setExecutionInput: (value: string) => void;
  onInvoke: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-semibold">Executions</h3>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
            Invocation is queued; the worker owns runtime execution.
          </p>
        </div>
        <Play
          size={18}
          className="text-[var(--projects-accent)]"
          aria-hidden="true"
        />
      </div>
      <form
        onSubmit={onInvoke}
        className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]"
        noValidate
      >
        <Field label="Trigger">
          <input
            value={executionTrigger}
            onChange={(event) => setExecutionTrigger(event.target.value)}
            disabled={pending}
            className={inputClass()}
            placeholder="manual"
          />
        </Field>
        <Field label="JSON input">
          <textarea
            value={executionInput}
            onChange={(event) => setExecutionInput(event.target.value)}
            disabled={pending}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-xs text-[var(--projects-text)]"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Play size={13} aria-hidden="true" />
          Invoke
        </button>
      </form>
      {loading ? (
        <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
          Loading executions…
        </p>
      ) : executions.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Status
                </th>
                <th scope="col" className="px-3 py-2">
                  Trigger
                </th>
                <th scope="col" className="px-3 py-2">
                  Response
                </th>
                <th scope="col" className="px-3 py-2">
                  Created
                </th>
                <th scope="col" className="px-3 py-2">
                  Finished
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--projects-divider)]">
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onSelectExecution(execution.id)} className="text-left">
                      <span
                        className={`rounded-full border px-2 py-1 ${statusClass(execution.status)} ${selectedExecutionID === execution.id ? "ring-2 ring-[var(--projects-accent)]/50" : ""}`}
                      >
                        {execution.status}
                      </span>
                      {execution.error_message ? (
                        <p
                          className="m-0 mt-1 max-w-[220px] truncate text-[var(--projects-danger)]"
                          title={execution.error_message}
                        >
                          {execution.error_message}
                        </p>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-3 py-3 font-mono text-[var(--projects-muted)]">
                    {execution.trigger}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {execution.response_status ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {formatDate(execution.created_at)}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {formatDate(execution.finished_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 mt-5 rounded-lg border border-dashed border-[var(--projects-border)] p-10 text-center text-sm text-[var(--projects-muted)]">
          No executions yet.
        </p>
      )}
      {selectedExecutionID ? (
        <section className="mt-5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Terminal size={15} className="text-[var(--projects-accent)]" aria-hidden="true" /><h4 className="m-0 text-sm font-semibold">Runtime logs</h4></div>
            <span className="font-mono text-[10px] text-[var(--projects-muted)]">execution: {selectedExecutionID}</span>
          </div>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Secret-redacted output emitted by the trusted Function worker.</p>
          {logsLoading ? <p className="m-0 mt-4 text-xs text-[var(--projects-muted)]">Loading logs…</p> : logsError ? <p role="alert" className="m-0 mt-4 text-xs text-rose-200">{browserAPIErrorMessage(logsError, "Unable to load execution logs.")}</p> : logs.length ? <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">{logs.map((log) => <p key={log.id} className="m-0 border-b border-[var(--projects-divider)] py-1.5 font-mono text-[10px] leading-5 last:border-0"><span className={`mr-2 uppercase ${log.level === "error" ? "text-rose-200" : log.level === "warn" ? "text-amber-200" : "text-[var(--projects-accent)]"}`}>{log.level}</span><span className="mr-2 text-[var(--projects-muted)]">#{log.sequence}</span>{log.message}</p>)}</div> : <p className="m-0 mt-4 rounded-lg border border-dashed border-[var(--projects-border)] p-6 text-center text-xs text-[var(--projects-muted)]">No worker logs have been emitted for this execution.</p>}
        </section>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  selected,
  canManage,
  pending,
  name,
  setName,
  runtime,
  setRuntime,
  entrypoint,
  setEntrypoint,
  commands,
  setCommands,
  timeout,
  setTimeout,
  quota,
  setQuota,
  enabled,
  setEnabled,
  logging,
  setLogging,
  executePermissions,
  setExecutePermissions,
  onSave,
  onDelete,
}: {
  selected: BrowserFunction;
  canManage: boolean;
  pending: boolean;
  name: string;
  setName: (value: string) => void;
  runtime: BrowserFunctionRuntime;
  setRuntime: (value: BrowserFunctionRuntime) => void;
  entrypoint: string;
  setEntrypoint: (value: string) => void;
  commands: string;
  setCommands: (value: string) => void;
  timeout: string;
  setTimeout: (value: string) => void;
  quota: string;
  setQuota: (value: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  logging: boolean;
  setLogging: (value: boolean) => void;
  executePermissions: string;
  setExecutePermissions: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  return (
    <form
      onSubmit={onSave}
      className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"
      noValidate
    >
      <div className="flex items-start gap-3">
        <Settings2
          size={19}
          className="mt-0.5 text-[var(--projects-muted)]"
          aria-hidden="true"
        />
        <div>
          <h3 className="m-0 text-lg font-semibold">Function settings</h3>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
            Runtime and deployment policy are applied to the next release.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <input
            required
            minLength={2}
            maxLength={63}
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canManage || pending}
            className={inputClass()}
          />
        </Field>
        <Field label="Runtime">
          <select
            value={runtime}
            onChange={(event) =>
              setRuntime(event.target.value as BrowserFunctionRuntime)
            }
            disabled={!canManage || pending}
            className={inputClass()}
          >
            {runtimes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entrypoint">
          <input
            required
            value={entrypoint}
            onChange={(event) => setEntrypoint(event.target.value)}
            disabled={!canManage || pending}
            className={`${inputClass()} font-mono text-xs`}
          />
        </Field>
        <Field label="Build commands">
          <input
            value={commands}
            onChange={(event) => setCommands(event.target.value)}
            disabled={!canManage || pending}
            className={`${inputClass()} font-mono text-xs`}
            placeholder="npm install && npm run build"
          />
        </Field>
        <Field label="Timeout seconds">
          <input
            type="number"
            min={1}
            max={900}
            value={timeout}
            onChange={(event) => setTimeout(event.target.value)}
            disabled={!canManage || pending}
            className={inputClass()}
          />
        </Field>
        <Field label="Artifact quota bytes">
          <input
            type="number"
            min={selected.artifact_used_bytes}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
            disabled={!canManage || pending}
            className={inputClass()}
          />
        </Field>
        <Field label="Execute permissions">
          <input
            value={executePermissions}
            onChange={(event) => setExecutePermissions(event.target.value)}
            disabled={!canManage || pending}
            className={`${inputClass()} font-mono text-xs`}
            placeholder="any, users, user:uuid"
          />
        </Field>
        <div className="flex items-end gap-4 pb-2 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              disabled={!canManage || pending}
              className="accent-[var(--projects-accent)]"
            />
            Enabled
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={logging}
              onChange={(event) => setLogging(event.target.checked)}
              disabled={!canManage || pending}
              className="accent-[var(--projects-accent)]"
            />
            Logging
          </label>
        </div>
      </div>
      {canManage ? (
        <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-[var(--projects-divider)] pt-4">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-200"
          >
            <Trash2 size={13} aria-hidden="true" />
            Delete function
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save size={13} aria-hidden="true" />
            Save settings
          </button>
        </div>
      ) : null}
    </form>
  );
}
