"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, LoaderCircle, Plus, RefreshCw, Trash2, Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectWebhook, ProjectWebhookDelivery } from "@/lib/stealth-api";

type Props = { projectId: string; initialWebhooks: ProjectWebhook[]; initialNextCursor: string | null; initialCanManage: boolean };

class WebhookRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function bridgeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { accept: "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new WebhookRequestError(response.status, payload?.error?.message ?? "The request could not be completed.");
  return payload as T;
}

function endpoint(projectId: string, suffix = "") { return `/api/stealth/projects/${encodeURIComponent(projectId)}/webhooks${suffix}`; }
function eventList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never"; }

export function ProjectWebhooks({ projectId, initialWebhooks, initialNextCursor, initialCanManage }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialWebhooks);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [name, setName] = useState("");
  const [url, setURL] = useState("");
  const [events, setEvents] = useState("*");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState<string | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<Record<string, ProjectWebhookDelivery[]>>({});
  const [deliveryCursors, setDeliveryCursors] = useState<Record<string, string | null>>({});
  const [deliveryBusy, setDeliveryBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await bridgeRequest<{ webhook: ProjectWebhook; secret: string }>(endpoint(projectId), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), url: url.trim(), events: eventList(events) }) });
      setItems((current) => [response.webhook, ...current]);
      setSecret(response.secret); setName(""); setURL(""); setEvents("*"); setCreateOpen(false); router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The webhook could not be created.");
    } finally { setBusy(false); }
  }

  async function toggle(item: ProjectWebhook) {
    if (busyID) return;
    setBusyID(item.id); setError(null);
    try {
      const response = await bridgeRequest<{ webhook: ProjectWebhook }>(endpoint(projectId, `/${encodeURIComponent(item.id)}`), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !item.enabled }) });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? response.webhook : candidate));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The webhook could not be updated."); }
    finally { setBusyID(null); }
  }

  async function rotate(item: ProjectWebhook) {
    if (busyID) return;
    setBusyID(item.id); setError(null);
    try {
      const response = await bridgeRequest<{ webhook: ProjectWebhook; secret: string }>(endpoint(projectId, `/${encodeURIComponent(item.id)}/rotate-secret`), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? response.webhook : candidate));
      setSecret(response.secret); setCopied(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The webhook secret could not be rotated."); }
    finally { setBusyID(null); }
  }

  async function remove(item: ProjectWebhook) {
    if (busyID || !window.confirm(`Delete webhook “${item.name}”? Pending deliveries will be removed.`)) return;
    setBusyID(item.id); setError(null);
    try {
      await bridgeRequest<void>(endpoint(projectId, `/${encodeURIComponent(item.id)}`), { method: "DELETE" });
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The webhook could not be deleted."); }
    finally { setBusyID(null); }
  }

  async function loadMore() {
    if (!nextCursor || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await bridgeRequest<{ webhooks: ProjectWebhook[]; pagination: { next_cursor: string | null }; can_manage: boolean }>(`${endpoint(projectId)}?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      setItems((current) => [...current, ...response.webhooks]); setNextCursor(response.pagination.next_cursor); setCanManage(response.can_manage);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "More webhooks could not be loaded."); }
    finally { setBusy(false); }
  }

  async function loadDeliveries(item: ProjectWebhook, append = false) {
    if (deliveryBusy) return;
    const cursor = append ? deliveryCursors[item.id] : null;
    setDeliveryBusy(item.id); setError(null);
    try {
      const query = new URLSearchParams({ limit: "10" });
      if (cursor) query.set("cursor", cursor);
      const response = await bridgeRequest<{ deliveries: ProjectWebhookDelivery[]; pagination: { next_cursor: string | null } }>(endpoint(projectId, `/${encodeURIComponent(item.id)}/deliveries?${query.toString()}`));
      setDeliveryItems((current) => ({ ...current, [item.id]: append ? [...(current[item.id] ?? []), ...response.deliveries] : response.deliveries }));
      setDeliveryCursors((current) => ({ ...current, [item.id]: response.pagination.next_cursor }));
      setDeliveryOpen(item.id);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Delivery history could not be loaded."); }
    finally { setDeliveryBusy(null); }
  }

  async function copySecret() {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret); setCopied(true); } catch { setError("Clipboard access was unavailable. Copy the secret manually."); }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Webhooks</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Receive signed, retryable events from Auth, Database, Storage, Functions, and Sites. Endpoints must use HTTPS.</p>
        </div>
        {canManage ? <button type="button" onClick={() => { setCreateOpen(true); setError(null); }} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:bg-[var(--projects-accent-hover)] focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]"><Plus size={15} aria-hidden="true" />Create webhook</button> : null}
      </header>

      {secret ? <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5" role="status">
        <h2 className="m-0 text-[15px] font-semibold text-amber-100">Save this signing secret now</h2>
        <p className="m-0 mt-1 text-[13px] leading-5 text-amber-100/75">It is shown only after create or rotate. Store it in your secret manager; Stealth cannot recover it.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-h-10 min-w-0 flex-1 overflow-x-auto rounded-md border border-amber-200/20 bg-black/20 px-3 py-2.5 font-mono text-[12px] text-amber-50">{secret}</code><button type="button" onClick={() => void copySecret()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-200/30 px-3 text-[12px] font-semibold text-amber-50 hover:bg-amber-100/10">{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy secret"}</button></div>
        <button type="button" onClick={() => { setSecret(null); setCopied(false); }} className="mt-3 text-[12px] font-semibold text-amber-100 underline underline-offset-2">Dismiss</button>
      </div> : null}

      {error ? <p role="alert" className="mt-5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{error}</p> : null}

      {items.length === 0 ? <div className="mt-8 grid min-h-[300px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-12 text-center"><div className="max-w-md"><Webhook size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">No webhooks yet</h2><p className="m-0 mt-2 text-[14px] leading-6 text-[var(--projects-muted)]">Create one to receive signed project events with automatic retries and delivery history.</p></div></div> : <div className="mt-8 grid gap-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${item.enabled ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden="true" /><h2 className="m-0 truncate text-[16px] font-semibold text-[var(--projects-text)]">{item.name}</h2><span className="rounded-full border border-[var(--projects-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">{item.enabled ? "Enabled" : "Paused"}</span></div><p className="m-0 mt-2 truncate font-mono text-[12px] text-[var(--projects-muted)]" title={item.url}>{item.url}</p><p className="m-0 mt-2 text-[12px] text-[var(--projects-muted)]">Events: <span className="font-mono text-[var(--projects-text)]">{item.events.join(", ")}</span></p></div>{canManage ? <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" disabled={busyID === item.id} onClick={() => void toggle(item)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busyID === item.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{item.enabled ? "Pause" : "Enable"}</button><button type="button" disabled={busyID === item.id} onClick={() => void rotate(item)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50"><RefreshCw size={13} aria-hidden="true" />Rotate secret</button><button type="button" disabled={busyID === item.id} onClick={() => void remove(item)} aria-label={`Delete ${item.name}`} className="inline-flex h-8 items-center justify-center rounded-md border border-rose-500/30 px-2.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" /></button></div> : null}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--projects-divider)] pt-3 text-[11px] text-[var(--projects-muted)]"><span>Failures: {item.failure_count}</span><span>Last delivery: {formatDate(item.last_delivery_at)}</span><span>Last failure: {formatDate(item.last_failure_at)}</span></div><div className="mt-4 border-t border-[var(--projects-divider)] pt-3"><button type="button" onClick={() => deliveryOpen === item.id ? setDeliveryOpen(null) : void loadDeliveries(item)} disabled={deliveryBusy === item.id} className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{deliveryBusy === item.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{deliveryOpen === item.id ? "Hide deliveries" : "View deliveries"}</button>{deliveryOpen === item.id ? <div className="mt-3 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[620px] text-left text-[11px]"><caption className="sr-only">Delivery history for {item.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Event</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Attempts</th><th scope="col" className="px-3 py-2">HTTP</th><th scope="col" className="px-3 py-2">Created</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{(deliveryItems[item.id] ?? []).map((delivery) => <tr key={delivery.id}><td className="max-w-[220px] truncate px-3 py-2 font-mono text-[var(--projects-text)]" title={delivery.event_name}>{delivery.event_name}</td><td className="px-3 py-2"><span className={delivery.status === "succeeded" ? "text-emerald-300" : delivery.status === "failed" ? "text-rose-300" : "text-amber-200"}>{delivery.status}</span>{delivery.last_error ? <p className="m-0 mt-1 max-w-[260px] truncate text-[10px] text-rose-200/75" title={delivery.last_error}>{delivery.last_error}</p> : null}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{delivery.attempt_count}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{delivery.last_status_code ?? "—"}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatDate(delivery.created_at)}</td></tr>)}</tbody></table>{(deliveryItems[item.id] ?? []).length === 0 ? <p className="m-0 px-3 py-4 text-center text-[12px] text-[var(--projects-muted)]">No deliveries yet.</p> : null}{deliveryCursors[item.id] ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-3 py-2"><button type="button" onClick={() => void loadDeliveries(item, true)} disabled={deliveryBusy === item.id} className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)]">Load more</button></div> : null}</div> : null}</div></article>)}</div>}

      {nextCursor ? <button type="button" onClick={() => void loadMore()} disabled={busy} className="mx-auto mt-5 flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}Load more</button> : null}

      {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="webhook-dialog-title" className="w-full max-w-lg rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="webhook-dialog-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Create webhook</h2><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Use a public HTTPS endpoint. Private and loopback destinations are blocked by the delivery worker.</p></div><button type="button" onClick={() => setCreateOpen(false)} className="text-[12px] text-[var(--projects-muted)]">Close</button></div><form onSubmit={(event) => void create(event)} className="mt-5 space-y-4"><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><label className="block text-[12px] font-medium text-[var(--projects-muted)]">HTTPS URL<input type="url" value={url} onChange={(event) => setURL(event.target.value)} required placeholder="https://example.com/stealth/webhooks" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Events <span className="font-normal">(comma separated)</span><input value={events} onChange={(event) => setEvents(event.target.value)} placeholder="* or function_execution.succeeded" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={busy} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}Create</button></div></form></div></div> : null}
    </section>
  );
}
