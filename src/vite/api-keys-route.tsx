import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Clipboard, KeyRound, LoaderCircle, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserProjectAPIKey, type BrowserProjectAPIKeyScope } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";
import { ErrorState as AsyncErrorState } from "./error-state";

const scopeOptions: Array<{ value: BrowserProjectAPIKeyScope; label: string; description: string }> = [
  { value: "users.read", label: "Users read", description: "List and fetch project identities." },
  { value: "users.write", label: "Users write", description: "Create and block or unblock identities." },
  { value: "databases.read", label: "Databases read", description: "Read database schemas and rows from a trusted server." },
  { value: "databases.write", label: "Databases write", description: "Create and mutate database schemas and rows." },
  { value: "storage.read", label: "Storage read", description: "List and download permission-checked project files." },
  { value: "storage.write", label: "Storage write", description: "Create buckets and upload or delete project files." },
  { value: "functions.read", label: "Functions read", description: "Inspect function configuration and execution metadata." },
  { value: "functions.write", label: "Functions write", description: "Create functions and publish source versions." },
  { value: "sites.read", label: "Sites read", description: "Inspect static Sites and publication deployments." },
  { value: "sites.write", label: "Sites write", description: "Create Sites and manage publication deployments." },
  { value: "webhooks.read", label: "Webhooks read", description: "Inspect webhook configurations and delivery history." },
  { value: "webhooks.write", label: "Webhooks write", description: "Create, update, rotate, and delete project webhooks." },
  { value: "realtime.read", label: "Realtime read", description: "Consume the authenticated project event stream." },
  { value: "messaging.read", label: "Messaging read", description: "Inspect messaging providers, topics, and deliveries." },
  { value: "messaging.write", label: "Messaging write", description: "Manage messaging and queue or cancel messages." },
];

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "Never";
}

function keyStatus(key: BrowserProjectAPIKey): "active" | "revoked" | "expired" {
  if (key.revoked_at) return "revoked";
  if (key.expires_at && Date.parse(key.expires_at) <= Date.now()) return "expired";
  return "active";
}

function statusClass(status: ReturnType<typeof keyStatus>) {
  if (status === "active") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "expired") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-rose-500/25 bg-rose-500/10 text-rose-200";
}

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading API keys…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <AsyncErrorState error={error} fallback="Unable to load API keys." />;
}

export default function APIKeysRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/api-keys" });
  const keysQuery = useQuery({ queryKey: queryKeys.projectAPIKeys(projectId), queryFn: () => browserAPI.projectAPIKeys(projectId, { limit: 50 }) });
  const [additionalKeys, setAdditionalKeys] = useState<BrowserProjectAPIKey[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeKey, setRevokeKey] = useState<BrowserProjectAPIKey | null>(null);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<BrowserProjectAPIKeyScope[]>(["users.read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAdditionalKeys([]);
    setNextCursor(keysQuery.data?.pagination.next_cursor ?? null);
  }, [keysQuery.data]);

  const keys = useMemo(() => [...(keysQuery.data?.keys ?? []), ...additionalKeys], [additionalKeys, keysQuery.data?.keys]);
  const canManage = keysQuery.data?.can_manage ?? false;

  async function loadMore() {
    if (!nextCursor || loadPending) return;
    setLoadPending(true);
    setLoadError("");
    try {
      const response = await browserAPI.projectAPIKeys(projectId, { limit: 50, cursor: nextCursor });
      setAdditionalKeys((current) => [...current, ...response.keys]);
      setNextCursor(response.pagination.next_cursor);
    } catch (error) {
      setLoadError(browserAPIErrorMessage(error, "Unable to load more API keys."));
    } finally {
      setLoadPending(false);
    }
  }

  function resetCreateForm() {
    setName("");
    setSelectedScopes(["users.read"]);
    setExpiresAt("");
    setFormError("");
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setFormError("Name must be between 2 and 120 characters.");
      return;
    }
    if (selectedScopes.length === 0) {
      setFormError("Select at least one scope.");
      return;
    }
    let expiry: string | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now() || parsed.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
        setFormError("Expiry must be in the future and no more than 365 days away.");
        return;
      }
      expiry = parsed.toISOString();
    }
    setCreatePending(true);
    setFormError("");
    setActionError("");
    try {
      const result = await browserAPI.createProjectAPIKey(projectId, { name: normalizedName, scopes: selectedScopes, expires_at: expiry });
      setRevealedSecret(result.secret);
      setCopied(false);
      setCreateOpen(false);
      resetCreateForm();
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectAPIKeys(projectId) });
    } catch (error) {
      setFormError(browserAPIErrorMessage(error, "The API key could not be created."));
    } finally {
      setCreatePending(false);
    }
  }

  async function revoke() {
    if (!revokeKey || revokePending) return;
    setRevokePending(true);
    setActionError("");
    try {
      await browserAPI.revokeProjectAPIKey(projectId, revokeKey.id);
      setRevokeKey(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectAPIKeys(projectId) });
    } catch (error) {
      setActionError(browserAPIErrorMessage(error, "The API key could not be revoked."));
    } finally {
      setRevokePending(false);
    }
  }

  async function copySecret() {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      setCopied(true);
    } catch {
      setActionError("Clipboard access was unavailable. Copy the secret manually.");
    }
  }

  if (keysQuery.isPending) return <LoadingState />;
  if (keysQuery.error) return <ErrorState error={keysQuery.error} />;

  return <section>
    <Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link>
    <header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6">
      <div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project security</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">API keys</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Create scoped server-to-server keys. Secrets are displayed once and are never stored in the browser.</p></div>
      {canManage ? <button type="button" onClick={() => { setActionError(""); setFormError(""); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />Create API key</button> : null}
    </header>

    {revealedSecret ? <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5" role="status"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-amber-100"><ShieldAlert size={17} aria-hidden="true" />Save this secret now</h2><p className="m-0 mt-1 max-w-2xl text-xs leading-5 text-amber-100/75">This is the only time the full API key is shown.</p></div><button type="button" onClick={() => { setRevealedSecret(null); setCopied(false); }} aria-label="Dismiss one-time secret" className="inline-flex size-8 items-center justify-center rounded-md text-amber-100/80 hover:bg-amber-100/10"><X size={17} aria-hidden="true" /></button></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><code className="min-h-10 min-w-0 flex-1 overflow-x-auto rounded-md border border-amber-200/20 bg-black/20 px-3 py-2.5 font-mono text-xs text-amber-50">{revealedSecret}</code><button type="button" onClick={() => void copySecret()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-200/30 px-3 text-xs font-semibold text-amber-50 hover:bg-amber-100/10">{copied ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy secret"}</button></div></div> : null}
    {actionError ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{actionError}</p> : null}

    {keys.length === 0 ? <div className="mt-6 grid min-h-[18rem] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-8 text-center"><div className="max-w-md"><span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><KeyRound size={20} aria-hidden="true" /></span><h2 className="m-0 mt-4 text-lg font-semibold">No API keys yet</h2><p className="m-0 mt-2 text-sm leading-6 text-[var(--projects-muted)]">Create a scoped key for a trusted server-side integration.</p>{canManage ? <button type="button" onClick={() => setCreateOpen(true)} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-sm font-semibold hover:bg-[var(--projects-control)]"><Plus size={14} aria-hidden="true" />Create first key</button> : <p className="m-0 mt-5 text-xs text-[var(--projects-muted)]">Read-only project membership</p>}</div></div> : <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Project server API keys</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-5 py-3">Key</th><th scope="col" className="px-5 py-3">Scopes</th><th scope="col" className="px-5 py-3">Expires</th><th scope="col" className="px-5 py-3">Last used</th><th scope="col" className="px-5 py-3">Status</th>{canManage ? <th scope="col" className="px-5 py-3 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{keys.map((key) => { const status = keyStatus(key); return <tr key={key.id}><td className="px-5 py-4"><p className="m-0 font-semibold">{key.name}</p><p className="m-0 mt-1 font-mono text-xs text-[var(--projects-muted)]">{key.prefix}…</p><p className="m-0 mt-1 font-mono text-[10px] text-[var(--projects-muted)]">{key.id}</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{key.scopes.map((scope) => <span key={scope} className="rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1 font-mono text-[10px] text-[var(--projects-muted)]">{scope}</span>)}</div></td><td className="px-5 py-4 text-[var(--projects-muted)]">{formatDate(key.expires_at)}</td><td className="px-5 py-4 text-[var(--projects-muted)]">{formatDate(key.last_used_at)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{status}</span></td>{canManage ? <td className="px-5 py-4 text-right">{status === "active" ? <button type="button" onClick={() => { setActionError(""); setRevokeKey(key); }} className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-500/25 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"><Trash2 size={13} aria-hidden="true" />Revoke</button> : <span className="text-xs text-[var(--projects-muted)]">Irreversible</span>}</td> : null}</tr>; })}</tbody></table>{loadError ? <p role="alert" className="m-0 border-t border-[var(--projects-divider)] px-5 py-3 text-sm text-rose-200">{loadError}</p> : null}{nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={() => void loadMore()} disabled={loadPending} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{loadPending ? "Loading…" : "Load more"}</button></div> : null}</div>}

    {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-api-key-title" className="my-8 w-full max-w-lg rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-api-key-title" className="m-0 text-lg font-semibold">Create API key</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">The secret is shown once. Use it only from a trusted server.</p></div><button type="button" onClick={() => { if (!createPending) setCreateOpen(false); }} aria-label="Close create API key dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createKey(event)} className="mt-5 space-y-4" noValidate><div><label htmlFor="vite-api-key-name" className="mb-1.5 block text-xs font-medium text-[var(--projects-muted)]">Name</label><input id="vite-api-key-name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={createPending} className="h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" placeholder="production-api" /></div><fieldset><legend className="mb-2 text-xs font-medium text-[var(--projects-muted)]">Scopes</legend><div className="grid gap-2 sm:grid-cols-2">{scopeOptions.map((option) => { const checked = selectedScopes.includes(option.value); return <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2"><input type="checkbox" checked={checked} onChange={(event) => setSelectedScopes((current) => event.target.checked ? [...new Set([...current, option.value])] : current.filter((scope) => scope !== option.value))} disabled={createPending} className="mt-0.5 accent-[var(--projects-accent)]" /><span><span className="block font-mono text-xs">{option.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[var(--projects-muted)]">{option.description}</span></span></label>; })}</div></fieldset><div><label htmlFor="vite-api-key-expires" className="mb-1.5 block text-xs font-medium text-[var(--projects-muted)]">Expires <span className="font-normal text-[var(--projects-muted)]">(optional, max 365 days)</span></label><input id="vite-api-key-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={createPending} className="h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /></div>{formError ? <p role="alert" className="m-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p> : null}<div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} className="inline-flex h-9 items-center rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={createPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{createPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{createPending ? "Creating…" : "Create key"}</button></div></form></div></div> : null}
    {revokeKey ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-revoke-api-key-title" className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-revoke-api-key-title" className="m-0 text-lg font-semibold">Revoke API key?</h2><p className="m-0 mt-2 text-sm leading-6 text-[var(--projects-muted)]"><strong>{revokeKey.name}</strong> will stop authenticating immediately. This cannot be undone.</p></div><button type="button" onClick={() => { if (!revokePending) setRevokeKey(null); }} aria-label="Close revoke API key dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setRevokeKey(null)} disabled={revokePending} className="inline-flex h-9 items-center rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="button" onClick={() => void revoke()} disabled={revokePending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-sm font-semibold text-rose-100 hover:bg-rose-500/20">{revokePending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{revokePending ? "Revoking…" : "Revoke key"}</button></div></div></div> : null}
  </section>;
}
