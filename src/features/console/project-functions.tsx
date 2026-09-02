"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Box, CheckCircle2, Code2, FileArchive, KeyRound, LoaderCircle, Play, Plus, Save, Settings2, Terminal, Trash2, Upload } from "lucide-react";
import type { FunctionDeployment, FunctionExecution, FunctionRuntime, FunctionVariable, ProjectFunction } from "@/lib/stealth-api";

type Props = {
  projectId: string;
  initialFunctions: ProjectFunction[];
  initialNextCursor: string | null;
  initialCanManage: boolean;
};

type ErrorPayload = { error?: { code?: string; message?: string } };
type Tab = "deployments" | "variables" | "executions" | "settings";

class FunctionsBridgeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const runtimeOptions: Array<{ value: FunctionRuntime; label: string }> = [
  { value: "node-22", label: "Node.js 22" },
  { value: "python-3.13", label: "Python 3.13" },
  { value: "go-1.24", label: "Go 1.24" },
];
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "deployments", label: "Deployments" },
  { id: "variables", label: "Variables" },
  { id: "executions", label: "Executions" },
  { id: "settings", label: "Settings" },
];

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { accept: "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null) as T | ErrorPayload | null;
  if (!response.ok) throw new FunctionsBridgeError(response.status, (payload as ErrorPayload | null)?.error?.message ?? "The function request could not be completed.");
  return payload as T;
}

function functionsPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/functions${suffix}`;
}

function formatDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}

function statusClass(status: string) {
  if (status === "active" || status === "succeeded") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "ready") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

export function ProjectFunctions({ projectId, initialFunctions, initialNextCursor, initialCanManage }: Props) {
  const [functions, setFunctions] = useState(initialFunctions);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [selectedID, setSelectedID] = useState(initialFunctions[0]?.id ?? "");
  const [deployments, setDeployments] = useState<FunctionDeployment[]>([]);
  const [variables, setVariables] = useState<FunctionVariable[]>([]);
  const [executions, setExecutions] = useState<FunctionExecution[]>([]);
  const [tab, setTab] = useState<Tab>("deployments");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createRuntime, setCreateRuntime] = useState<FunctionRuntime>("node-22");
  const [createEntrypoint, setCreateEntrypoint] = useState("src/main.js");
  const [createCommands, setCreateCommands] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [runtimeDraft, setRuntimeDraft] = useState<FunctionRuntime>("node-22");
  const [entrypointDraft, setEntrypointDraft] = useState("");
  const [commandsDraft, setCommandsDraft] = useState("");
  const [timeoutDraft, setTimeoutDraft] = useState("15");
  const [enabledDraft, setEnabledDraft] = useState(true);
  const [loggingDraft, setLoggingDraft] = useState(true);
  const [executeDraft, setExecuteDraft] = useState("");
  const [variableKey, setVariableKey] = useState("");
  const [variableValue, setVariableValue] = useState("");
  const [variableSecret, setVariableSecret] = useState(true);
  const [executionTrigger, setExecutionTrigger] = useState("manual");
  const [executionInput, setExecutionInput] = useState("{}");
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const selected = functions.find((item) => item.id === selectedID) ?? null;

  useEffect(() => {
    if (!selectedID) { setDeployments([]); setVariables([]); setExecutions([]); return; }
    let cancelled = false;
    setLoadingDetails(true);
    setError(null);
    const base = functionsPath(projectId, `/${selectedID}`);
    const deploymentRequest = bridgeJSON<{ deployments: FunctionDeployment[] }>(`${base}/deployments?limit=50`);
    const variableRequest = bridgeJSON<{ variables: FunctionVariable[] }>(`${base}/variables?limit=100`);
    const executionRequest = bridgeJSON<{ executions: FunctionExecution[] }>(`${base}/executions?limit=50`).catch((reason) => {
      if (reason instanceof FunctionsBridgeError && reason.status === 404) return { executions: [] };
      throw reason;
    });
    void Promise.all([deploymentRequest, variableRequest, executionRequest])
      .then(([deploymentResponse, variableResponse, executionResponse]) => {
        if (cancelled) return;
        setDeployments(deploymentResponse.deployments);
        setVariables(variableResponse.variables);
        setExecutions(executionResponse.executions);
      })
      .catch((reason) => {
        if (cancelled) return;
        if (reason instanceof FunctionsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
        setError(reason instanceof Error ? reason.message : "Function details could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [projectId, selectedID]);

  useEffect(() => {
    if (!selectedID || tab !== "executions") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await bridgeJSON<{ executions: FunctionExecution[] }>(`${functionsPath(projectId, `/${selectedID}/executions`)}?limit=50`);
        if (!cancelled) setExecutions(result.executions);
      } catch {
        // The initial server-rendered state remains visible during a transient
        // refresh failure; the next interval will retry without interrupting
        // an in-progress invocation.
      }
    };
    const interval = window.setInterval(() => { void refresh(); }, 2000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [projectId, selectedID, tab]);

  useEffect(() => {
    if (!selectedID || tab !== "deployments") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await bridgeJSON<{ deployments: FunctionDeployment[] }>(`${functionsPath(projectId, `/${selectedID}/deployments`)}?limit=50`);
        if (!cancelled) setDeployments(result.deployments);
      } catch {
        // Keep the last deployment state visible while a worker or API poll
        // is transiently unavailable; the next interval retries.
      }
    };
    const interval = window.setInterval(() => { void refresh(); }, 1500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [projectId, selectedID, tab]);

  useEffect(() => {
    if (!selected) return;
    setNameDraft(selected.name);
    setRuntimeDraft(selected.runtime);
    setEntrypointDraft(selected.entrypoint);
    setCommandsDraft(selected.commands);
    setTimeoutDraft(String(selected.timeout_seconds));
    setEnabledDraft(selected.enabled);
    setLoggingDraft(selected.logging);
    setExecuteDraft(selected.execute_permissions.join(", "));
  }, [selected]);

  function report(reason: unknown, fallback: string) {
    if (reason instanceof FunctionsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
    setError(reason instanceof Error ? reason.message : fallback);
  }

  async function createFunction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ function: ProjectFunction }>(functionsPath(projectId), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), runtime: createRuntime, entrypoint: createEntrypoint.trim(), commands: createCommands.trim(), timeout_seconds: 15, enabled: true, logging: true, execute_permissions: [] }),
      });
      setFunctions((current) => [result.function, ...current]);
      setSelectedID(result.function.id);
      setCreating(false);
      setCreateName("");
    } catch (reason) { report(reason, "The function could not be created."); } finally { setBusy(false); }
  }

  async function loadMoreFunctions() {
    if (!nextCursor || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ functions: ProjectFunction[]; pagination: { next_cursor: string | null } }>(functionsPath(projectId, `?limit=20&cursor=${encodeURIComponent(nextCursor)}`));
      setFunctions((current) => [...current, ...result.functions]);
      setNextCursor(result.pagination.next_cursor);
    } catch (reason) { report(reason, "More functions could not be loaded."); } finally { setBusy(false); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || !initialCanManage) return;
    const timeout = Number(timeoutDraft);
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 900) { setError("Timeout must be between 1 and 900 seconds."); return; }
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ function: ProjectFunction }>(functionsPath(projectId, `/${selected.id}`), {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameDraft.trim(), runtime: runtimeDraft, entrypoint: entrypointDraft.trim(), commands: commandsDraft.trim(), timeout_seconds: timeout, enabled: enabledDraft, logging: loggingDraft, execute_permissions: executeDraft.split(",").map((value) => value.trim()).filter(Boolean) }),
      });
      setFunctions((current) => current.map((item) => item.id === result.function.id ? result.function : item));
    } catch (reason) { report(reason, "Function settings could not be saved."); } finally { setBusy(false); }
  }

  async function removeFunction() {
    if (!selected || busy || !initialCanManage || !window.confirm(`Delete function ${selected.name} and all source deployments? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      await bridgeJSON<void>(functionsPath(projectId, `/${selected.id}`), { method: "DELETE" });
      setFunctions((current) => {
        const remaining = current.filter((item) => item.id !== selected.id);
        setSelectedID(remaining[0]?.id ?? "");
        return remaining;
      });
    } catch (reason) { report(reason, "The function could not be deleted."); } finally { setBusy(false); }
  }

  async function uploadDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const source = sourceInputRef.current?.files?.[0];
    if (!selected || !source || busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("source", source, source.name);
      form.append("activate", "false");
      const result = await bridgeJSON<{ deployment: FunctionDeployment }>(functionsPath(projectId, `/${selected.id}/deployments`), { method: "POST", body: form });
      setDeployments((current) => [result.deployment, ...current]);
      if (sourceInputRef.current) sourceInputRef.current.value = "";
    } catch (reason) { report(reason, "The source deployment could not be uploaded."); } finally { setBusy(false); }
  }

  async function activateDeployment(deployment: FunctionDeployment) {
    if (!selected || busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ function: ProjectFunction; deployment: FunctionDeployment }>(functionsPath(projectId, `/${selected.id}/deployments/${deployment.id}/activate`), { method: "POST" });
      setFunctions((current) => current.map((item) => item.id === result.function.id ? result.function : item));
      setDeployments((current) => current.map((item) => item.id === result.deployment.id ? result.deployment : item.status === "active" ? { ...item, status: "superseded" } : item));
    } catch (reason) { report(reason, "The deployment could not be activated."); } finally { setBusy(false); }
  }

  async function removeDeployment(deployment: FunctionDeployment) {
    if (!selected || busy || !initialCanManage || deployment.status === "active" || !window.confirm(`Delete deployment ${deployment.id}?`)) return;
    setBusy(true); setError(null);
    try {
      await bridgeJSON<void>(functionsPath(projectId, `/${selected.id}/deployments/${deployment.id}`), { method: "DELETE" });
      setDeployments((current) => current.filter((item) => item.id !== deployment.id));
    } catch (reason) { report(reason, "The deployment could not be deleted."); } finally { setBusy(false); }
  }

  async function createVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ variable: FunctionVariable }>(functionsPath(projectId, `/${selected.id}/variables`), {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: variableKey.trim(), value: variableValue, kind: variableSecret ? "secret" : "variable", is_secret: variableSecret }),
      });
      setVariables((current) => [result.variable, ...current]);
      setVariableKey(""); setVariableValue(""); setVariableSecret(true);
    } catch (reason) { report(reason, "The variable could not be created."); } finally { setBusy(false); }
  }

  async function removeVariable(variable: FunctionVariable) {
    if (!selected || busy || !initialCanManage || !window.confirm(`Delete variable ${variable.key}? A new deployment is required afterward.`)) return;
    setBusy(true); setError(null);
    try {
      await bridgeJSON<void>(functionsPath(projectId, `/${selected.id}/variables/${variable.id}`), { method: "DELETE" });
      setVariables((current) => current.filter((item) => item.id !== variable.id));
    } catch (reason) { report(reason, "The variable could not be deleted."); } finally { setBusy(false); }
  }

  async function invokeFunction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || !initialCanManage) return;
    let input: unknown;
    try {
      input = JSON.parse(executionInput);
    } catch {
      setError("Execution input must be valid JSON.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ execution: FunctionExecution }>(functionsPath(projectId, `/${selected.id}/executions`), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: executionTrigger.trim() || "manual", input }),
      });
      setExecutions((current) => [result.execution, ...current]);
      setExecutionInput("{}");
    } catch (reason) { report(reason, "The function could not be invoked."); } finally { setBusy(false); }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div><p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p><h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Functions</h1><p className="m-0 mt-2 max-w-3xl text-[14px] leading-6 text-[var(--projects-muted)]">Version function source, configure write-only secrets, activate one deployment, and inspect executions handled by the isolated worker.</p></div>
        {initialCanManage ? <button type="button" onClick={() => setCreating((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white"><Plus size={15} aria-hidden="true" />Create function</button> : <p className="m-0 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-muted)]">Read-only project role</p>}
      </header>

      {error ? <div role="alert" className="mt-5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100">{error}</div> : null}
      <div aria-live="polite" className="sr-only">{busy || loadingDetails ? "Loading function data" : "Function data ready"}</div>

      {creating ? <form onSubmit={(event) => void createFunction(event)} className="mt-5 grid gap-3 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 md:grid-cols-2"><div className="md:col-span-2"><h2 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Create function</h2><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">Configuration is snapshotted when a new deployment is uploaded.</p></div><label className="text-[12px] text-[var(--projects-muted)]">Name (lowercase slug)<input autoFocus required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" value={createName} onChange={(event) => setCreateName(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><label className="text-[12px] text-[var(--projects-muted)]">Runtime<select value={createRuntime} onChange={(event) => setCreateRuntime(event.target.value as FunctionRuntime)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]">{runtimeOptions.map((runtime) => <option key={runtime.value} value={runtime.value}>{runtime.label}</option>)}</select></label><label className="text-[12px] text-[var(--projects-muted)]">Entrypoint<input required maxLength={255} value={createEntrypoint} onChange={(event) => setCreateEntrypoint(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="text-[12px] text-[var(--projects-muted)]">Build commands<input maxLength={4000} value={createCommands} onChange={(event) => setCreateCommands(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setCreating(false)} disabled={busy} className="h-9 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy} aria-busy={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}Create</button></div></form> : null}

      <div className="mt-7 grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3"><div className="flex items-center justify-between px-2 py-2"><h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Functions</h2>{loadingDetails ? <LoaderCircle size={14} className="animate-spin text-[var(--projects-muted)]" aria-label="Loading" /> : null}</div>{functions.length ? <div className="space-y-1">{functions.map((item) => <button key={item.id} type="button" onClick={() => setSelectedID(item.id)} aria-pressed={item.id === selectedID} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] ${item.id === selectedID ? "bg-[var(--projects-control)] text-[var(--projects-text)]" : "text-[var(--projects-muted)] hover:bg-white/[0.04]"}`}><Code2 size={14} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{item.name}</span>{item.active_deployment_id ? <span className="size-2 rounded-full bg-emerald-400" title="Active deployment" /> : null}</button>)}</div> : <p className="m-2 text-[13px] leading-5 text-[var(--projects-muted)]">No functions yet.</p>}{nextCursor ? <button type="button" onClick={() => void loadMoreFunctions()} disabled={busy} className="mt-3 w-full rounded-md border border-[var(--projects-border)] px-2 py-2 text-[12px] font-semibold text-[var(--projects-muted)]">Load more</button> : null}</aside>

        <div className="min-w-0">{selected ? <><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">{selected.id}</p><h2 className="m-0 mt-1 text-[21px] font-semibold text-[var(--projects-text)]">{selected.name}</h2><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">{selected.runtime} · {selected.entrypoint} · timeout {selected.timeout_seconds}s</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${selected.active_deployment_id ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-muted)]"}`}>{selected.active_deployment_id ? "Deployment active" : "No active deployment"}</span></div><div className="mt-5 flex gap-1 overflow-x-auto border-b border-[var(--projects-divider)]" role="tablist" aria-label="Function sections">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`border-b-2 px-3 py-2 text-[12px] font-semibold ${tab === item.id ? "border-[var(--projects-accent)] text-[var(--projects-text)]" : "border-transparent text-[var(--projects-muted)]"}`}>{item.label}</button>)}</div></div>

          {tab === "deployments" ? <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Source deployments</h3><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Upload a .zip, .tar.gz, or .tgz artifact. The worker builds it once, then executions reuse the immutable artifact.</p></div>{initialCanManage ? <form onSubmit={(event) => void uploadDeployment(event)} className="flex flex-wrap items-center justify-end gap-2"><input ref={sourceInputRef} type="file" required accept=".zip,.tar.gz,.tgz,application/zip,application/gzip" className="max-w-[240px] text-[11px] text-[var(--projects-muted)] file:mr-2 file:rounded file:border-0 file:bg-[var(--projects-control)] file:px-2 file:py-1.5 file:text-[var(--projects-text)]" /><button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white"><Upload size={14} aria-hidden="true" />Upload</button></form> : null}</div>{deployments.length ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[820px] text-left text-[12px]"><caption className="sr-only">Deployments for {selected.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[11px] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Deployment</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Source</th><th scope="col" className="px-3 py-2">Created</th><th scope="col" className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{deployments.map((deployment) => <tr key={deployment.id}><td className="px-3 py-2"><p className="m-0 font-mono text-[10px] text-[var(--projects-text)]">v{deployment.version} · {deployment.id}</p><p className="m-0 mt-1 max-w-[180px] truncate text-[10px] text-[var(--projects-muted)]">{deployment.source_name ?? deployment.source}</p></td><td className="px-3 py-2"><div className="flex flex-wrap gap-1"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(deployment.status)}`}>{deployment.status}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(deployment.build_status)}`}>{deployment.build_status === "succeeded" ? "built" : `build ${deployment.build_status}`}</span></div></td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatBytes(deployment.size_bytes)} · {deployment.checksum_sha256.slice(0, 10)}…</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatDate(deployment.created_at)}</td><td className="px-3 py-2 text-right">{initialCanManage && deployment.status === "ready" && deployment.build_status !== "failed" ? <button type="button" onClick={() => void activateDeployment(deployment)} disabled={busy} className="mr-2 inline-flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-200"><Play size={11} aria-hidden="true" />Activate</button> : null}{initialCanManage && deployment.status !== "active" ? <button type="button" onClick={() => void removeDeployment(deployment)} disabled={busy} aria-label={`Delete deployment ${deployment.id}`} className="rounded border border-rose-500/30 px-2 py-1 text-rose-200"><Trash2 size={12} aria-hidden="true" /></button> : null}</td></tr>)}</tbody></table></div> : <div className="mt-4 grid min-h-[180px] place-items-center rounded-md border border-dashed border-[var(--projects-border)] text-center"><div><FileArchive size={25} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-3 text-[13px] text-[var(--projects-muted)]">No source deployments yet.</p></div></div>}</div> : null}

          {tab === "variables" ? <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Environment variables</h3><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Secret values are encrypted at rest and never returned after creation. Variable changes require a new deployment.</p></div>{initialCanManage ? <form onSubmit={(event) => void createVariable(event)} className="mt-4 grid gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-[1fr_1.5fr_auto_auto]"><label className="text-[11px] text-[var(--projects-muted)]">Key<input required pattern="[A-Za-z_][A-Za-z0-9_]{0,127}" value={variableKey} onChange={(event) => setVariableKey(event.target.value)} placeholder="API_TOKEN" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Value<input required type={variableSecret ? "password" : "text"} value={variableValue} onChange={(event) => setVariableValue(event.target.value)} autoComplete="off" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="flex items-end gap-2 pb-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={variableSecret} onChange={(event) => setVariableSecret(event.target.checked)} className="accent-[var(--projects-accent)]" />Secret</label><button type="submit" disabled={busy} className="mt-auto inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white"><Plus size={13} aria-hidden="true" />Add</button></form> : null}{variables.length ? <ul className="mt-4 divide-y divide-[var(--projects-divider)] rounded-md border border-[var(--projects-border)]">{variables.map((variable) => <li key={variable.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"><div className="flex min-w-0 items-center gap-3"><KeyRound size={15} className="shrink-0 text-[var(--projects-muted)]" aria-hidden="true" /><div><p className="m-0 font-mono text-[12px] text-[var(--projects-text)]">{variable.key}</p><p className="m-0 mt-1 text-[11px] text-[var(--projects-muted)]">{variable.is_secret ? "Secret · value hidden permanently" : "Encrypted runtime variable"} · {variable.has_value ? "value configured" : "no value"} · updated {formatDate(variable.updated_at)}</p></div></div>{initialCanManage ? <button type="button" onClick={() => void removeVariable(variable)} disabled={busy} aria-label={`Delete variable ${variable.key}`} className="rounded border border-rose-500/30 px-2 py-1 text-rose-200"><Trash2 size={12} aria-hidden="true" /></button> : null}</li>)}</ul> : <p className="mt-4 rounded-md border border-dashed border-[var(--projects-border)] px-4 py-8 text-center text-[13px] text-[var(--projects-muted)]">No function variables configured.</p>}</div> : null}

          {tab === "executions" ? <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-start gap-3"><Terminal size={19} className="mt-0.5 text-[var(--projects-muted)]" aria-hidden="true" /><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Execution history</h3><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Invocations are queued here and run asynchronously in the hardened worker. The API process never executes uploaded code.</p></div></div>{initialCanManage ? <form onSubmit={(event) => void invokeFunction(event)} className="mt-4 grid gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-[180px_minmax(0,1fr)_auto]"><label className="text-[11px] text-[var(--projects-muted)]">Trigger<input value={executionTrigger} onChange={(event) => setExecutionTrigger(event.target.value)} maxLength={64} className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Input JSON<textarea value={executionInput} onChange={(event) => setExecutionInput(event.target.value)} rows={2} maxLength={65536} className="mt-1 w-full resize-y rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><button type="submit" disabled={busy || !selected.active_deployment_id} className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Play size={13} aria-hidden="true" />Run now</button></form> : null}{executions.length ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[680px] text-left text-[12px]"><caption className="sr-only">Executions for {selected.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[11px] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Execution</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Trigger</th><th scope="col" className="px-3 py-2">Deployment</th><th scope="col" className="px-3 py-2">Created</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{executions.map((execution) => <tr key={execution.id}><td className="px-3 py-2 font-mono text-[10px] text-[var(--projects-text)]">{execution.id}</td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(execution.status)}`}>{execution.status}</span></td><td className="px-3 py-2 text-[var(--projects-muted)]">{execution.trigger}</td><td className="px-3 py-2 font-mono text-[10px] text-[var(--projects-muted)]">{execution.deployment_id}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatDate(execution.created_at)}</td></tr>)}</tbody></table></div> : <div className="mt-4 grid min-h-[180px] place-items-center rounded-md border border-dashed border-[var(--projects-border)] text-center"><div><Terminal size={25} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-3 text-[13px] text-[var(--projects-muted)]">No executions have been recorded.</p></div></div>}</div> : null}

          {tab === "settings" ? <form onSubmit={(event) => void saveSettings(event)} className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-start gap-3"><Settings2 size={19} className="mt-0.5 text-[var(--projects-muted)]" aria-hidden="true" /><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Function settings</h3><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Runtime, entrypoint, commands, and variables are captured by the next deployment.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-[12px] text-[var(--projects-muted)]">Name<input required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><label className="text-[12px] text-[var(--projects-muted)]">Runtime<select value={runtimeDraft} onChange={(event) => setRuntimeDraft(event.target.value as FunctionRuntime)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]">{runtimeOptions.map((runtime) => <option key={runtime.value} value={runtime.value}>{runtime.label}</option>)}</select></label><label className="text-[12px] text-[var(--projects-muted)]">Entrypoint<input required maxLength={255} value={entrypointDraft} onChange={(event) => setEntrypointDraft(event.target.value)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="text-[12px] text-[var(--projects-muted)]">Build commands<input maxLength={4000} value={commandsDraft} onChange={(event) => setCommandsDraft(event.target.value)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="text-[12px] text-[var(--projects-muted)]">Timeout seconds<input type="number" min={1} max={900} value={timeoutDraft} onChange={(event) => setTimeoutDraft(event.target.value)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><label className="text-[12px] text-[var(--projects-muted)]">Execute permissions<input value={executeDraft} onChange={(event) => setExecuteDraft(event.target.value)} disabled={!initialCanManage || busy} placeholder="any, users, user:uuid" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="flex items-center gap-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={enabledDraft} onChange={(event) => setEnabledDraft(event.target.checked)} disabled={!initialCanManage || busy} className="accent-[var(--projects-accent)]" />Function enabled</label><label className="flex items-center gap-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={loggingDraft} onChange={(event) => setLoggingDraft(event.target.checked)} disabled={!initialCanManage || busy} className="accent-[var(--projects-accent)]" />Retain execution logs</label></div>{initialCanManage ? <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => void removeFunction()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-500/30 px-3 text-[12px] font-semibold text-rose-200"><Trash2 size={13} aria-hidden="true" />Delete function</button><button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}Save settings</button></div> : null}</form> : null}</> : <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-center"><div><Box size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">Create a function to begin</h2><p className="m-0 mt-2 text-[13px] text-[var(--projects-muted)]">Functions keep versioned source artifacts and one active deployment.</p></div></div>}</div>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] leading-5 text-amber-100"><CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><p className="m-0"><strong>Safe execution boundary:</strong> source upload, checksums, activation state, encrypted variables, scopes, and audit events are available. Build commands run only inside the isolated worker; the API process never starts user code.</p></div>
    </section>
  );
}
