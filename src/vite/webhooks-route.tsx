import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Clipboard, LoaderCircle, Plus, RefreshCw, Trash2, Webhook, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { BrowserAPIError, browserAPI, type BrowserProjectWebhook, type BrowserProjectWebhookDelivery } from "@/lib/browser-api";
import { queryClient } from "./query-client";

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) : "Never";
}

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading webhooks…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-danger)]">{error instanceof Error ? error.message : "Unable to load webhooks."}</div>;
}

function deliveryStatusClass(status: BrowserProjectWebhookDelivery["status"]) {
  if (status === "succeeded") return "text-emerald-300";
  if (status === "failed") return "text-rose-300";
  return "text-amber-200";
}

export default function WebhooksRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/webhooks" });
  const webhooksQuery = useQuery({ queryKey: ["project-webhooks", projectId], queryFn: () => browserAPI.projectWebhooks(projectId, { limit: 50 }) });
  const [additionalWebhooks, setAdditionalWebhooks] = useState<BrowserProjectWebhook[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState<string | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<Record<string, BrowserProjectWebhookDelivery[]>>({});
  const [deliveryCursors, setDeliveryCursors] = useState<Record<string, string | null>>({});
  const [deliveryPending, setDeliveryPending] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setURL] = useState("");
  const [events, setEvents] = useState("*");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAdditionalWebhooks([]);
    setNextCursor(webhooksQuery.data?.pagination.next_cursor ?? null);
  }, [webhooksQuery.data]);

  const webhooks = [...(webhooksQuery.data?.webhooks ?? []), ...additionalWebhooks];
  const canManage = webhooksQuery.data?.can_manage ?? false;

  async function loadMore() {
    if (!nextCursor || loadPending) return;
    setLoadPending(true);
    setError("");
    try {
      const response = await browserAPI.projectWebhooks(projectId, { limit: 50, cursor: nextCursor });
      setAdditionalWebhooks((current) => [...current, ...response.webhooks]);
      setNextCursor(response.pagination.next_cursor);
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "More webhooks could not be loaded.");
    } finally {
      setLoadPending(false);
    }
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;
    const normalizedName = name.trim();
    const normalizedURL = url.trim();
    const eventList = events.split(",").map((item) => item.trim()).filter(Boolean);
    if (normalizedName.length < 2 || !normalizedURL || eventList.length === 0) { setFormError("Name, HTTPS URL, and at least one event are required."); return; }
    setCreatePending(true);
    setFormError("");
    setError("");
    try {
      const response = await browserAPI.createProjectWebhook(projectId, { name: normalizedName, url: normalizedURL, events: eventList });
      setSecret(response.secret);
      setCopied(false);
      setName("");
      setURL("");
      setEvents("*");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["project-webhooks", projectId] });
    } catch (requestError) {
      setFormError(requestError instanceof BrowserAPIError ? requestError.message : "The webhook could not be created.");
    } finally {
      setCreatePending(false);
    }
  }

  async function toggleWebhook(item: BrowserProjectWebhook) {
    if (busyID) return;
    setBusyID(item.id);
    setError("");
    try {
      await browserAPI.updateProjectWebhook(projectId, item.id, { enabled: !item.enabled });
      await queryClient.invalidateQueries({ queryKey: ["project-webhooks", projectId] });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The webhook could not be updated.");
    } finally {
      setBusyID(null);
    }
  }

  async function rotateSecret(item: BrowserProjectWebhook) {
    if (busyID) return;
    setBusyID(item.id);
    setError("");
    try {
      const response = await browserAPI.rotateProjectWebhookSecret(projectId, item.id);
      setSecret(response.secret);
      setCopied(false);
      await queryClient.invalidateQueries({ queryKey: ["project-webhooks", projectId] });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The webhook secret could not be rotated.");
    } finally {
      setBusyID(null);
    }
  }

  async function removeWebhook(item: BrowserProjectWebhook) {
    if (busyID || !window.confirm(`Delete webhook “${item.name}”?`)) return;
    setBusyID(item.id);
    setError("");
    try {
      await browserAPI.deleteProjectWebhook(projectId, item.id);
      await queryClient.invalidateQueries({ queryKey: ["project-webhooks", projectId] });
      if (deliveryOpen === item.id) setDeliveryOpen(null);
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The webhook could not be deleted.");
    } finally {
      setBusyID(null);
    }
  }

  async function loadDeliveries(item: BrowserProjectWebhook, append = false) {
    if (deliveryPending) return;
    const cursor = append ? deliveryCursors[item.id] : null;
    setDeliveryPending(item.id);
    setError("");
    try {
      const response = await browserAPI.projectWebhookDeliveries(projectId, item.id, { limit: 20, cursor: cursor ?? undefined });
      setDeliveryItems((current) => ({ ...current, [item.id]: append ? [...(current[item.id] ?? []), ...response.deliveries] : response.deliveries }));
      setDeliveryCursors((current) => ({ ...current, [item.id]: response.pagination.next_cursor }));
      setDeliveryOpen(item.id);
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Delivery history could not be loaded.");
    } finally {
      setDeliveryPending(null);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret); setCopied(true); } catch { setError("Clipboard access was unavailable. Copy the secret manually."); }
  }

  if (webhooksQuery.isPending) return <LoadingState />;
  if (webhooksQuery.error) return <ErrorState error={webhooksQuery.error} />;

  return <section><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project events</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Webhooks</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Receive signed, retryable events from project services. Private and loopback destinations are rejected by the trusted worker.</p></div>{canManage ? <button type="button" onClick={() => { setFormError(""); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />Create webhook</button> : null}</header>{secret ? <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5" role="status"><h2 className="m-0 text-sm font-semibold text-amber-100">Save this signing secret now</h2><p className="m-0 mt-1 text-xs leading-5 text-amber-100/75">It is shown only after create or rotate. Store it in your secret manager.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-h-10 min-w-0 flex-1 overflow-x-auto rounded-md border border-amber-200/20 bg-black/20 px-3 py-2.5 font-mono text-xs text-amber-50">{secret}</code><button type="button" onClick={() => void copySecret()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-200/30 px-3 text-xs font-semibold text-amber-50 hover:bg-amber-100/10">{copied ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy secret"}</button></div><button type="button" onClick={() => { setSecret(null); setCopied(false); }} className="mt-3 text-xs font-semibold text-amber-100 underline underline-offset-2">Dismiss</button></div> : null}{error ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}{webhooks.length === 0 ? <div className="mt-6 grid min-h-[18rem] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-8 text-center"><div><Webhook size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-lg font-semibold">No webhooks yet</h2><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Create one to receive signed project events with automatic retries.</p></div></div> : <div className="mt-6 grid gap-3">{webhooks.map((item) => <article key={item.id} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${item.enabled ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden="true" /><h2 className="m-0 truncate text-lg font-semibold">{item.name}</h2><span className="rounded-full border border-[var(--projects-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">{item.enabled ? "Enabled" : "Paused"}</span></div><p className="m-0 mt-2 truncate font-mono text-xs text-[var(--projects-muted)]" title={item.url}>{item.url}</p><p className="m-0 mt-2 text-xs text-[var(--projects-muted)]">Events: <span className="font-mono text-[var(--projects-text)]">{item.events.join(", ")}</span></p></div>{canManage ? <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={busyID === item.id} onClick={() => void toggleWebhook(item)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--projects-border)] px-2.5 text-xs font-semibold disabled:opacity-50">{busyID === item.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{item.enabled ? "Pause" : "Enable"}</button><button type="button" disabled={busyID === item.id} onClick={() => void rotateSecret(item)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--projects-border)] px-2.5 text-xs font-semibold disabled:opacity-50"><RefreshCw size={13} aria-hidden="true" />Rotate</button><button type="button" disabled={busyID === item.id} onClick={() => void removeWebhook(item)} aria-label={`Delete ${item.name}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-500/30 px-2.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" /></button></div> : null}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--projects-divider)] pt-3 text-xs text-[var(--projects-muted)]"><span>Failures: {item.failure_count}</span><span>Last delivery: {formatDate(item.last_delivery_at)}</span><span>Last failure: {formatDate(item.last_failure_at)}</span></div><div className="mt-4 border-t border-[var(--projects-divider)] pt-3"><button type="button" onClick={() => deliveryOpen === item.id ? setDeliveryOpen(null) : void loadDeliveries(item)} disabled={deliveryPending === item.id} className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-2.5 text-xs font-semibold disabled:opacity-50">{deliveryPending === item.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{deliveryOpen === item.id ? "Hide deliveries" : "View deliveries"}</button>{deliveryOpen === item.id ? <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--projects-border)]"><table className="w-full min-w-[620px] text-left text-xs"><caption className="sr-only">Delivery history for {item.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Event</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Attempts</th><th scope="col" className="px-3 py-2">HTTP</th><th scope="col" className="px-3 py-2">Created</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{(deliveryItems[item.id] ?? []).map((delivery) => <tr key={delivery.id}><td className="max-w-[220px] truncate px-3 py-2 font-mono" title={delivery.event_name}>{delivery.event_name}</td><td className={`px-3 py-2 ${deliveryStatusClass(delivery.status)}`}>{delivery.status}{delivery.last_error ? <p className="m-0 mt-1 max-w-[260px] truncate text-[10px] text-rose-200/75" title={delivery.last_error}>{delivery.last_error}</p> : null}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{delivery.attempt_count}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{delivery.last_status_code ?? "—"}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatDate(delivery.created_at)}</td></tr>)}</tbody></table>{(deliveryItems[item.id] ?? []).length === 0 ? <p className="m-0 px-3 py-4 text-center text-xs text-[var(--projects-muted)]">No deliveries yet.</p> : null}{deliveryCursors[item.id] ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-3 py-2"><button type="button" onClick={() => void loadDeliveries(item, true)} disabled={deliveryPending === item.id} className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-2.5 text-xs font-semibold">Load more</button></div> : null}</div> : null}</div></article>)}</div>}{nextCursor ? <button type="button" onClick={() => void loadMore()} disabled={loadPending} className="mx-auto mt-5 flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}Load more</button> : null}
    {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-webhook-title" className="w-full max-w-lg rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-webhook-title" className="m-0 text-lg font-semibold">Create webhook</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">Use a public HTTPS endpoint. The signing secret is shown once.</p></div><button type="button" onClick={() => { if (!createPending) setCreateOpen(false); }} aria-label="Close create webhook dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createWebhook(event)} className="mt-5 space-y-4" noValidate><label className="block text-xs font-medium text-[var(--projects-muted)]">Name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label><label className="block text-xs font-medium text-[var(--projects-muted)]">HTTPS URL<input required type="url" value={url} onChange={(event) => setURL(event.target.value)} disabled={createPending} placeholder="https://example.com/hooks" className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 font-mono text-xs" /></label><label className="block text-xs font-medium text-[var(--projects-muted)]">Events <span className="font-normal">(comma separated)</span><input value={events} onChange={(event) => setEvents(event.target.value)} disabled={createPending} placeholder="* or function_execution.succeeded" className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 font-mono text-xs" /></label>{formError ? <p role="alert" className="m-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p> : null}<div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={createPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60">{createPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}Create</button></div></form></div></div> : null}
  </section>;
}
