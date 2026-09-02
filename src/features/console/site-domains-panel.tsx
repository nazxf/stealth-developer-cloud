"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Globe2, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { SiteDomain } from "@/lib/stealth-api";

type Props = {
  projectId: string;
  siteId: string;
  canManage: boolean;
};

type ErrorPayload = { error?: { message?: string } };

class DomainsBridgeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { accept: "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null) as T | ErrorPayload | null;
  if (!response.ok) throw new DomainsBridgeError(response.status, (payload as ErrorPayload | null)?.error?.message ?? "The domain request could not be completed.");
  return payload as T;
}

function domainsPath(projectId: string, siteId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/sites/${encodeURIComponent(siteId)}/domains${suffix}`;
}

function statusClass(status: string) {
  if (status === "verified") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "disabled") return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

export function SiteDomainsPanel({ projectId, siteId, canManage }: Props) {
  const [domains, setDomains] = useState<SiteDomain[]>([]);
  const [hostname, setHostname] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void bridgeJSON<{ domains: SiteDomain[] }>(`${domainsPath(projectId, siteId)}?limit=50`)
      .then((result) => { if (!cancelled) setDomains(result.domains); })
      .catch((reason) => {
        if (cancelled) return;
        if (reason instanceof DomainsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
        setError(reason instanceof Error ? reason.message : "Site domains could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, siteId]);

  async function createDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy || !hostname.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ domain: SiteDomain }>(domainsPath(projectId, siteId), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostname: hostname.trim() }) });
      setDomains((current) => [result.domain, ...current]);
      setHostname("");
    } catch (reason) {
      if (reason instanceof DomainsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
      setError(reason instanceof Error ? reason.message : "The custom domain could not be created.");
    } finally { setBusy(false); }
  }

  async function verifyDomain(item: SiteDomain) {
    if (!canManage || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ domain: SiteDomain }>(domainsPath(projectId, siteId, `/${item.id}/verify`), { method: "POST" });
      setDomains((current) => current.map((domain) => domain.id === result.domain.id ? result.domain : domain));
    } catch (reason) {
      if (reason instanceof DomainsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
      setError(reason instanceof Error ? reason.message : "The DNS verification could not be completed.");
    } finally { setBusy(false); }
  }

  async function deleteDomain(item: SiteDomain) {
    if (!canManage || busy || !window.confirm(`Remove ${item.hostname} from this site?`)) return;
    setBusy(true); setError(null);
    try {
      await bridgeJSON<void>(domainsPath(projectId, siteId, `/${item.id}`), { method: "DELETE" });
      setDomains((current) => current.filter((domain) => domain.id !== item.id));
    } catch (reason) {
      if (reason instanceof DomainsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
      setError(reason instanceof Error ? reason.message : "The custom domain could not be removed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><Globe2 size={19} className="mt-0.5 text-[var(--projects-muted)]" aria-hidden="true" /><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Custom domains</h3><p className="m-0 mt-1 max-w-2xl text-[12px] leading-5 text-[var(--projects-muted)]">Bind a hostname after publishing a DNS TXT challenge. The TLS badge reflects your configured certificate manager.</p></div></div>
        {loading ? <LoaderCircle size={16} className="animate-spin text-[var(--projects-muted)]" aria-label="Loading domains" /> : <span className="font-mono text-[11px] text-[var(--projects-muted)]">{domains.length} bound</span>}
      </div>
      {error ? <div role="alert" className="mt-3 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">{error}</div> : null}
      {canManage ? <form onSubmit={(event) => void createDomain(event)} className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-[240px] flex-1 text-[11px] text-[var(--projects-muted)]">Hostname<input value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="www.example.com" autoComplete="off" spellCheck={false} required minLength={4} maxLength={253} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><button type="submit" disabled={busy || !hostname.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white disabled:opacity-50"><Plus size={13} aria-hidden="true" />Add domain</button></form> : null}
      {domains.length ? <div className="mt-4 space-y-3">{domains.map((item) => <article key={item.id} className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="m-0 text-[13px] font-semibold text-[var(--projects-text)]">{item.hostname}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass(item.status)}`}>{item.status}</span><span className="rounded-full border border-slate-500/30 px-2 py-0.5 text-[10px] text-slate-300">TLS {item.tls_status}</span></div>{item.status !== "verified" ? <p className="m-0 mt-2 text-[11px] leading-5 text-[var(--projects-muted)]">Publish <code>{item.verification_record_type}</code> <code>{item.verification_record_name}</code> with value <code className="break-all">{item.verification_record_value}</code>.</p> : <p className="m-0 mt-2 flex items-center gap-1 text-[11px] text-emerald-200"><ShieldCheck size={12} aria-hidden="true" />DNS ownership verified{item.verified_at ? ` · ${new Date(item.verified_at).toLocaleString()}` : ""}</p>}</div><div className="flex shrink-0 items-center gap-2">{canManage && item.status === "pending" ? <button type="button" onClick={() => void verifyDomain(item)} disabled={busy} className="inline-flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-200"><RefreshCw size={11} aria-hidden="true" />Verify DNS</button> : null}{canManage ? <button type="button" onClick={() => void deleteDomain(item)} disabled={busy} aria-label={`Delete domain ${item.hostname}`} className="rounded border border-rose-500/30 px-2 py-1 text-rose-200"><Trash2 size={12} aria-hidden="true" /></button> : null}</div></div></article>)}</div> : <div className="mt-4 rounded-md border border-dashed border-[var(--projects-border)] px-3 py-6 text-center text-[12px] text-[var(--projects-muted)]">No custom domains are bound to this Site.</div>}
    </section>
  );
}
