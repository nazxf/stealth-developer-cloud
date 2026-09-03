"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, KeyRound, LoaderCircle, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import type { ProjectAPIKey } from "@/lib/stealth-api";

type ProjectAPIKeysProps = {
  projectId: string;
  initialKeys: ProjectAPIKey[];
  initialNextCursor: string | null;
  initialCanManage: boolean;
};

type BridgeErrorPayload = { error?: { code?: string; message?: string } };

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const scopeOptions = [
  { value: "users.read" as const, label: "Users read", description: "List and fetch project identities." },
  { value: "users.write" as const, label: "Users write", description: "Create and block or unblock identities." },
  { value: "databases.read" as const, label: "Databases read", description: "Read database schemas and rows from a trusted server." },
  { value: "databases.write" as const, label: "Databases write", description: "Create and mutate database schemas and rows." },
  { value: "storage.read" as const, label: "Storage read", description: "List and download permission-checked project files." },
  { value: "storage.write" as const, label: "Storage write", description: "Create buckets and upload or delete project files." },
  { value: "functions.read" as const, label: "Functions read", description: "Inspect function configuration, deployments, and execution metadata." },
  { value: "functions.write" as const, label: "Functions write", description: "Create functions, variables, and deployment source versions." },
  { value: "sites.read" as const, label: "Sites read", description: "Inspect static Sites and immutable publication deployments." },
  { value: "sites.write" as const, label: "Sites write", description: "Create Sites, manage custom domains, and upload, activate, or delete publications." },
  { value: "webhooks.read" as const, label: "Webhooks read", description: "Inspect webhook configurations and delivery history." },
  { value: "webhooks.write" as const, label: "Webhooks write", description: "Create, update, rotate, and delete project webhooks." },
  { value: "realtime.read" as const, label: "Realtime read", description: "Consume the authenticated project Server-Sent Events stream." },
  { value: "messaging.read" as const, label: "Messaging read", description: "Inspect messaging providers, topics, and masked subscribers." },
  { value: "messaging.write" as const, label: "Messaging write", description: "Create, update, and delete messaging providers, topics, and subscribers." },
];

class APIKeysBridgeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
  });
  const payload = (await response.json().catch(() => null)) as T | BridgeErrorPayload | null;
  if (!response.ok) {
    const error = payload as BridgeErrorPayload | null;
    throw new APIKeysBridgeError(response.status, error?.error?.message ?? "The request could not be completed.");
  }
  return payload as T;
}

function keysPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/api-keys${suffix}`;
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Never";
}

function statusOf(key: ProjectAPIKey): "active" | "revoked" | "expired" {
  if (key.revoked_at) return "revoked";
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

function statusClass(status: ReturnType<typeof statusOf>) {
  if (status === "active") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "expired") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-rose-500/25 bg-rose-500/10 text-rose-200";
}

function permissionError(reason: unknown, fallback: string) {
  if (reason instanceof APIKeysBridgeError && reason.status === 403) {
    return "Only project owners and admins can create or revoke API keys.";
  }
  return reason instanceof Error ? reason.message : fallback;
}

export function ProjectAPIKeys({ projectId, initialKeys, initialNextCursor, initialCanManage }: ProjectAPIKeysProps) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);
  const [revokeKey, setRevokeKey] = useState<ProjectAPIKey | null>(null);
  const [revokePending, setRevokePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ProjectAPIKey["scopes"]>(["users.read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const modal = createOpen ? "create" : revokeKey ? "revoke" : null;

  useEffect(() => {
    if (!modal) return;
    const opener = openerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    openerRef.current = opener;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      const preferred = modal === "create" ? "#project-api-key-name" : "#confirm-api-key-revoke";
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(preferred) ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? dialogRef.current)?.focus({ preventScroll: true });
    });
    const closeOnEscapeAndTrapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (modal === "create") setCreateOpen(false);
        else setRevokeKey(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscapeAndTrapFocus);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscapeAndTrapFocus);
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.overflow = previousBodyStyles.overflow;
      window.scrollTo(0, scrollY);
      opener?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [modal]);

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setFormError(null);
    setError(null);
    setCreateOpen(true);
  }

  function openRevoke(event: MouseEvent<HTMLButtonElement>, key: ProjectAPIKey) {
    openerRef.current = event.currentTarget;
    setError(null);
    setRevokeKey(key);
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;
    setCreatePending(true);
    setFormError(null);
    setError(null);
    const normalizedName = name.trim();
    const scopes = scopeOptions.filter(({ value }) => selectedScopes.includes(value)).map(({ value }) => value);
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setFormError("Name must be between 2 and 120 characters.");
      setCreatePending(false);
      return;
    }
    if (scopes.length === 0) {
        setFormError("Select at least one scope.");
      setCreatePending(false);
      return;
    }
    let expiry: string | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      const now = Date.now();
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now || parsed.getTime() > now + 365 * 24 * 60 * 60 * 1000) {
        setFormError("Expiry must be in the future and no more than 365 days away.");
        setCreatePending(false);
        return;
      }
      expiry = parsed.toISOString();
    }
    try {
      const result = await bridgeJSON<{ key: ProjectAPIKey; secret: string }>(keysPath(projectId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: normalizedName, scopes, expires_at: expiry }),
      });
      setKeys((current) => [...current, result.key]);
      setName("");
      setSelectedScopes(["users.read"]);
      setExpiresAt("");
      setCreateOpen(false);
      setRevealedSecret(result.secret);
      setCopied(false);
    } catch (reason) {
      if (reason instanceof APIKeysBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setFormError(permissionError(reason, "The API key could not be created."));
    } finally {
      setCreatePending(false);
    }
  }

  async function revoke() {
    if (!revokeKey || revokePending) return;
    setRevokePending(true);
    setError(null);
    try {
      await bridgeJSON<null>(keysPath(projectId, `/${encodeURIComponent(revokeKey.id)}`), { method: "DELETE" });
      const revokedAt = new Date().toISOString();
      setKeys((current) => current.map((key) => key.id === revokeKey.id ? { ...key, revoked_at: revokedAt, updated_at: revokedAt } : key));
      setRevokeKey(null);
    } catch (reason) {
      if (reason instanceof APIKeysBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setError(permissionError(reason, "The API key could not be revoked."));
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
      setError("Clipboard access was unavailable. Copy the secret manually from the field.");
    }
  }

  async function loadMore() {
    if (!nextCursor || loadPending) return;
    setLoadPending(true);
    setError(null);
    try {
      const result = await bridgeJSON<{ keys: ProjectAPIKey[]; pagination: { next_cursor: string | null }; can_manage: boolean }>(`${keysPath(projectId)}?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      setKeys((current) => [...current, ...result.keys]);
      setNextCursor(result.pagination.next_cursor);
      setCanManage(result.can_manage);
    } catch (reason) {
      if (reason instanceof APIKeysBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "More API keys could not be loaded.");
    } finally {
      setLoadPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">API Keys</h1>
            <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Scoped server-to-server keys for this project. Users, Database, Storage, Functions, Sites, Webhooks, Realtime, and Messaging scopes are available; write never implies read.</p>
        </div>
        {canManage ? <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-colors hover:bg-[var(--projects-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)]/70"><Plus size={15} aria-hidden="true" />Create API key</button> : null}
      </header>

      {revealedSecret ? <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5" role="status">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold text-amber-100"><ShieldAlert size={17} aria-hidden="true" />Save this secret now</h2>
            <p className="m-0 mt-1 max-w-2xl text-[13px] leading-5 text-amber-100/75">This is the only time the full API key is shown. Stealth cannot recover it after you dismiss this notice.</p>
          </div>
          <button type="button" onClick={() => { setRevealedSecret(null); setCopied(false); }} className="inline-flex size-8 items-center justify-center rounded-md text-amber-100/80 hover:bg-amber-100/10 focus-visible:outline-2 focus-visible:outline-amber-200" aria-label="Dismiss one-time secret"><X size={17} aria-hidden="true" /></button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <code className="min-h-10 min-w-0 flex-1 overflow-x-auto rounded-md border border-amber-200/20 bg-black/20 px-3 py-2.5 font-mono text-[12px] text-amber-50">{revealedSecret}</code>
          <button type="button" onClick={copySecret} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-200/30 px-3 text-[12px] font-semibold text-amber-50 hover:bg-amber-100/10 focus-visible:outline-2 focus-visible:outline-amber-200">{copied ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy secret"}</button>
        </div>
      </div> : null}

      {error ? <p role="alert" className="mt-5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{error}</p> : null}

      {keys.length === 0 ? <div className="mt-8 grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-12 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><KeyRound size={20} aria-hidden="true" /></span>
          <h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">No API keys yet</h2>
          <p className="m-0 mt-2 text-[14px] leading-6 text-[var(--projects-muted)]">Create a scoped key for a trusted server-side integration. API keys are never shown again after creation.</p>
          {canManage ? <button type="button" onClick={openCreate} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border-hover)] bg-[var(--projects-control)] px-3 text-[13px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]"><Plus size={14} aria-hidden="true" />Create first key</button> : <p className="m-0 mt-5 text-[12px] text-[var(--projects-muted)]">Read-only project membership</p>}
        </div>
      </div> : <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <caption className="sr-only">Project server API keys</caption>
          <thead><tr className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]"><th scope="col" className="px-5 py-3">Key</th><th scope="col" className="px-5 py-3">Scopes</th><th scope="col" className="px-5 py-3">Expires</th><th scope="col" className="px-5 py-3">Last used</th><th scope="col" className="px-5 py-3">Status</th>{canManage ? <th scope="col" className="px-5 py-3 text-right">Action</th> : null}</tr></thead>
          <tbody>{keys.map((key) => { const status = statusOf(key); return <tr key={key.id} className="border-b border-[var(--projects-divider)] last:border-b-0">
            <td className="px-5 py-4"><p className="m-0 text-[13px] font-semibold text-[var(--projects-text)]">{key.name}</p><p className="m-0 mt-1 font-mono text-[12px] text-[var(--projects-muted)]">{key.prefix}…</p><p className="m-0 mt-1 font-mono text-[10px] text-[var(--projects-muted)]">{key.id}</p></td>
            <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{key.scopes.map((scope) => <span key={scope} className="rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1 font-mono text-[10px] text-[var(--projects-muted)]">{scope}</span>)}</div></td>
            <td className="px-5 py-4 text-[13px] text-[var(--projects-muted)]">{key.expires_at ? formatDate(key.expires_at) : "Never"}</td>
            <td className="px-5 py-4 text-[13px] text-[var(--projects-muted)]">{formatDate(key.last_used_at)}</td>
            <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${statusClass(status)}`}>{status}</span></td>
            {canManage ? <td className="px-5 py-4 text-right">{status === "active" ? <button type="button" onClick={(event) => openRevoke(event, key)} className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-500/25 px-3 text-[12px] font-semibold text-rose-200 hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-rose-300"><Trash2 size={13} aria-hidden="true" />Revoke</button> : <span className="text-[12px] text-[var(--projects-muted)]">Irreversible</span>}</td> : null}
          </tr>; })}</tbody>
        </table>
        {nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={loadMore} disabled={loadPending} aria-busy={loadPending} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{loadPending ? "Loading…" : "Load more"}</button></div> : null}
      </div>}

      {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-project-api-key-title" tabIndex={-1} className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4"><div><h2 id="create-project-api-key-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Create API key</h2><p className="m-0 mt-1 text-[13px] leading-5 text-[var(--projects-muted)]">The secret is shown once. Use it only from a trusted server.</p></div><button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} aria-label="Close create API key dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]"><X size={17} aria-hidden="true" /></button></div>
        <form onSubmit={createKey} className="mt-5 space-y-4"><div><label htmlFor="project-api-key-name" className="mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]">Name</label><input id="project-api-key-name" type="text" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={createPending} className="h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:opacity-60" /></div>
          <fieldset><legend className="mb-2 text-[12px] font-medium text-[var(--projects-muted)]">Scopes</legend><div className="space-y-2">{scopeOptions.map((option) => { const checked = selectedScopes.includes(option.value); return <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--projects-accent)]"><input type="checkbox" checked={checked} onChange={(event) => setSelectedScopes((current) => event.target.checked ? [...new Set([...current, option.value])] : current.filter((scope) => scope !== option.value))} disabled={createPending} className="mt-0.5 accent-[var(--projects-accent)]" /><span><span className="block font-mono text-[12px] text-[var(--projects-text)]">{option.value}</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--projects-muted)]">{option.description}</span></span></label>; })}</div></fieldset>
          <div><label htmlFor="project-api-key-expires" className="mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]">Expires <span className="font-normal text-[var(--projects-muted)]/75">(optional, max 365 days)</span></label><input id="project-api-key-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={createPending} className="h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:opacity-60" /></div>
          {formError ? <p role="alert" className="m-0 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] leading-5 text-rose-200">{formError}</p> : null}<div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] disabled:opacity-60">Cancel</button><button type="submit" disabled={createPending} aria-busy={createPending} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{createPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{createPending ? "Creating…" : "Create key"}</button></div>
        </form>
      </div></div> : null}

      {revokeKey ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="revoke-project-api-key-title" tabIndex={-1} className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="revoke-project-api-key-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Revoke API key?</h2><p className="m-0 mt-2 text-[13px] leading-5 text-[var(--projects-muted)]">{revokeKey.name} will stop authenticating immediately. This action cannot be undone.</p></div><button type="button" onClick={() => setRevokeKey(null)} disabled={revokePending} aria-label="Close revoke API key dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]"><X size={17} aria-hidden="true" /></button></div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setRevokeKey(null)} disabled={revokePending} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05]">Cancel</button><button id="confirm-api-key-revoke" type="button" onClick={revoke} disabled={revokePending} aria-busy={revokePending} className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 text-[12px] font-semibold text-rose-100 hover:bg-rose-500/20">{revokePending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{revokePending ? "Revoking…" : "Revoke key"}</button></div></div></div> : null}
    </section>
  );
}
