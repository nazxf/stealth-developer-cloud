import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Box, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  browserAPI,
  browserAPIErrorMessage,
  type BrowserFunctionRuntime,
  type BrowserFunctionVariable,
} from "@/lib/api/browser-api";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { ErrorState as AsyncErrorState } from "@/components/error-state";
import {
  deploymentIsInProgress,
  deploymentPollInterval,
  executionIsInProgress,
  executionPollInterval,
  operationPollIntervalMs,
} from "@/lib/polling";
import { CreateFunctionDialog } from "./function-create-dialog";
import { DeploymentsPanel } from "./function-deployments-panel";
import { ExecutionsPanel } from "./function-executions-panel";
import { SettingsPanel } from "./function-settings-panel";
import { VariablesPanel } from "./function-variables-panel";
import { formatBytes, parsePermissions, statusClass, tabs, type Tab } from "./function-ui";

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

export default function FunctionsPage() {
  const { projectId } = useParams({ from: "/_console/projects/$projectId/functions" });
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
