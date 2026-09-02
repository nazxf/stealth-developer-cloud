"use client";

import { Check, Clipboard, KeyRound, LoaderCircle, LogOut, MailCheck, MonitorSmartphone, Save, Settings2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AdminHeader, AdminPageBody, AdminPanel, AdminPanelHeader, Mono } from "../components/admin-panel";
import type { Account, ConsoleSession, Organization } from "@/lib/stealth-api";

type AdminSettingsOrganization = Organization & { canManage: boolean };
type ErrorPayload = { error?: { message?: string } };

class SettingsRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function requestJSON<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/stealth/${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    throw new SettingsRequestError(response.status, payload?.error?.message ?? "The settings request could not be completed.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

/** Settings backed by the authenticated account and organization APIs. */
export function SettingsPage({ account, organizations: initialOrganizations, sessions: initialSessions }: { account: Account; organizations: AdminSettingsOrganization[]; sessions: ConsoleSession[] }) {
  const [organizations, setOrganizations] = useState<AdminSettingsOrganization[]>(initialOrganizations);
  const [sessions, setSessions] = useState<ConsoleSession[]>(initialSessions);
  const [selectedID, setSelectedID] = useState(initialOrganizations[0]?.id ?? "");
  const selected = organizations.find((organization) => organization.id === selectedID) ?? organizations[0];
  const [name, setName] = useState(selected?.name ?? "");
  const [slug, setSlug] = useState(selected?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectOrganization(id: string) {
    const next = organizations.find((organization) => organization.id === id);
    if (!next) return;
    setSelectedID(next.id);
    setName(next.name);
    setSlug(next.slug);
    setMessage(null);
    setError(null);
  }

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const nextName = name.trim();
    const nextSlug = slug.trim().toLowerCase();
    if (nextName.length < 2 || nextName.length > 120) {
      setError("Organization name must be between 2 and 120 characters.");
      setMessage(null);
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(nextSlug)) {
      setError("Slug must use 2–63 lowercase letters, numbers, or hyphens.");
      setMessage(null);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await requestJSON<{ organization: Organization }>(`organizations/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName, slug: nextSlug }),
      });
      setOrganizations((current) => current.map((organization) => organization.id === selected.id ? { ...organization, ...result.organization } : organization));
      setName(result.organization.name);
      setSlug(result.organization.slug);
      setMessage("Organization settings saved.");
    } catch (reason) {
      if (reason instanceof SettingsRequestError && reason.status === 403) setError("Only organization owners and admins can change organization settings.");
      else if (reason instanceof SettingsRequestError && reason.status === 409) setError("That organization slug is already in use.");
      else setError(reason instanceof Error ? reason.message : "Organization settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function sendVerification() {
    if (verificationBusy || account.email_verified) return;
    setVerificationBusy(true);
    setError(null);
    setMessage(null);
    try {
      await requestJSON<void>("account/verification", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      setMessage("Verification email sent. Check your inbox and follow the one-time link.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification email could not be sent.");
    } finally {
      setVerificationBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      setMessage(null);
      return;
    }
    setPasswordBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await requestJSON<{ sessions_revoked: number }>("account/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, password: newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSessions((current) => current.filter((session) => session.is_current));
      setMessage(`Password updated. ${result.sessions_revoked} other session${result.sessions_revoked === 1 ? " was" : "s were"} revoked.`);
    } catch (reason) {
      if (reason instanceof SettingsRequestError && reason.status === 401) setError("The current password is incorrect.");
      else setError(reason instanceof Error ? reason.message : "Password could not be updated.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function revokeSession(session: ConsoleSession) {
    if (sessionBusy || session.is_current) return;
    setSessionBusy(session.id);
    setError(null);
    setMessage(null);
    try {
      await requestJSON<void>(`account/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setMessage("The selected Console session was revoked.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Console session could not be revoked.");
    } finally {
      setSessionBusy(null);
    }
  }

  async function revokeOtherSessions() {
    if (sessionBusy || !sessions.some((session) => !session.is_current)) return;
    setSessionBusy("others");
    setError(null);
    setMessage(null);
    try {
      const result = await requestJSON<{ revoked: number }>("account/sessions", { method: "DELETE" });
      setSessions((current) => current.filter((session) => session.is_current));
      setMessage(result.revoked === 1 ? "1 other Console session was revoked." : `${result.revoked} other Console sessions were revoked.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Other Console sessions could not be revoked.");
    } finally {
      setSessionBusy(null);
    }
  }

  async function copyID() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("The organization ID could not be copied. Select it manually instead.");
    }
  }

  return (
    <AdminPageBody>
      <AdminHeader title="Settings" subtitle="Account identity and organization configuration stored by Stealth.">
        <Mono className="hidden rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 py-2 text-[11px] text-[var(--projects-muted)] sm:inline-flex">No browser-only settings</Mono>
      </AdminHeader>

      {(error || message) ? <p role={error ? "alert" : "status"} className={`m-0 rounded-lg border px-3.5 py-3 text-[12.5px] leading-5 ${error ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error ?? message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel>
          <AdminPanelHeader title="Console account" subtitle="This identity is used for Console sessions and audit events." />
          <div className="space-y-3.5">
            <InfoRow label="Email" value={account.email} />
            <InfoRow label="Account ID" value={account.id} mono />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--projects-divider)] pt-3">
              <span className="text-[12px] text-[var(--projects-muted)]">Email status</span>
              {account.email_verified ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200"><Check size={12} aria-hidden="true" />Verified</span> : <button type="button" onClick={() => void sendVerification()} disabled={verificationBusy} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60">{verificationBusy ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <MailCheck size={12} aria-hidden="true" />}{verificationBusy ? "Sending…" : "Send verification"}</button>}
            </div>
          </div>
          <form onSubmit={(event) => void updatePassword(event)} className="mt-5 border-t border-[var(--projects-divider)] pt-4">
            <div className="flex items-center gap-2"><KeyRound size={14} className="text-[var(--projects-muted)]" aria-hidden="true" /><h3 className="m-0 text-[12px] font-semibold text-[var(--projects-text)]">Change password</h3></div>
            <p className="m-0 mt-1 text-[11px] leading-5 text-[var(--projects-muted)]">Your current browser stays signed in; every other Console session is revoked after a successful change.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-[11px] font-medium text-[var(--projects-muted)]">Current password<input type="password" required minLength={1} maxLength={256} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={passwordBusy} className="mt-1.5 block h-9 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" /></label>
              <label className="block text-[11px] font-medium text-[var(--projects-muted)]">New password<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={passwordBusy} className="mt-1.5 block h-9 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" /></label>
              <label className="block text-[11px] font-medium text-[var(--projects-muted)]">Confirm new password<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={passwordBusy} className="mt-1.5 block h-9 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" /></label>
            </div>
            <button type="submit" disabled={passwordBusy} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[11px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60">{passwordBusy ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <KeyRound size={13} aria-hidden="true" />}{passwordBusy ? "Updating…" : "Update password"}</button>
          </form>
        </AdminPanel>

        <AdminPanel className="lg:col-span-2">
          <AdminPanelHeader
            title="Active Console sessions"
            subtitle="Review where this account is signed in. Tokens are never shown; revoking a session takes effect immediately."
            right={sessions.some((session) => !session.is_current) ? <button type="button" onClick={() => void revokeOtherSessions()} disabled={sessionBusy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-500/30 px-2.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60">{sessionBusy === "others" ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <LogOut size={12} aria-hidden="true" />}Revoke other sessions</button> : <Mono className="text-[11px] text-[var(--projects-muted)]">Only this session</Mono>}
          />
          {sessions.length ? <ul className="m-0 list-none divide-y divide-[var(--projects-divider)] rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] p-0">
            {sessions.map((session) => <li key={session.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-[var(--projects-muted)]"><MonitorSmartphone size={15} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Mono className="text-[11.5px] text-[var(--projects-text)]">{session.id}</Mono>{session.is_current ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">This device</span> : null}</div><p className="m-0 mt-1 text-[11px] text-[var(--projects-muted)]">Signed in {formatSessionTimestamp(session.created_at)} · expires {formatSessionTimestamp(session.expires_at)}</p></div>
              {session.is_current ? <span className="text-[10.5px] text-[var(--projects-muted)]">Current</span> : <button type="button" onClick={() => void revokeSession(session)} disabled={sessionBusy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60">{sessionBusy === session.id ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <LogOut size={12} aria-hidden="true" />}Revoke</button>}
            </li>)}
          </ul> : <p className="m-0 rounded-md border border-dashed border-[var(--projects-border)] px-3 py-6 text-center text-[12px] text-[var(--projects-muted)]">No active Console sessions were found.</p>}
        </AdminPanel>

        <AdminPanel>
          <AdminPanelHeader title="Organization" subtitle="Names and slugs are shared by every member; the ID never changes." />
          {organizations.length > 1 ? <label className="mb-4 block text-[11px] font-medium text-[var(--projects-muted)]">Organization<select value={selected?.id ?? ""} onChange={(event) => selectOrganization(event.target.value)} className="mt-1 block h-9 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)]">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label> : null}
          {selected ? <form onSubmit={(event) => void saveOrganization(event)} className="space-y-3.5">
            <label className="block text-[12px] font-medium text-[var(--projects-muted)]">Display name<input value={name} onChange={(event) => setName(event.target.value)} disabled={!selected.canManage || busy} maxLength={120} className="mt-1.5 block h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" /></label>
            <label className="block text-[12px] font-medium text-[var(--projects-muted)]">Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} disabled={!selected.canManage || busy} maxLength={63} spellCheck={false} className="mt-1.5 block h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 font-mono text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--projects-divider)] pt-3"><button type="button" onClick={() => void copyID()} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--projects-muted)] hover:text-[var(--projects-text)]"><Clipboard size={12} aria-hidden="true" />{copied ? "Copied organization ID" : "Copy organization ID"}</button>{selected.canManage ? <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3.5 text-[12px] font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{busy ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Save size={13} aria-hidden="true" />}{busy ? "Saving…" : "Save changes"}</button> : <span className="text-[11px] text-[var(--projects-muted)]">Read only</span>}</div>
          </form> : <p className="m-0 text-[12px] text-[var(--projects-muted)]">No organization is available for this account.</p>}
        </AdminPanel>

        <AdminPanel className="lg:col-span-2">
          <AdminPanelHeader title="Deployment configuration" subtitle="Runtime infrastructure is managed through environment variables and deployment manifests, not browser state." />
          <div className="grid gap-3 sm:grid-cols-3">
            <ConfigNote icon={<Settings2 size={15} aria-hidden="true" />} title="API endpoint" value="STEALTH_API_URL" />
            <ConfigNote icon={<Settings2 size={15} aria-hidden="true" />} title="Email delivery" value="EMAIL_DELIVERY_MODE" />
            <ConfigNote icon={<Settings2 size={15} aria-hidden="true" />} title="Telemetry" value="OTEL_EXPORTER_OTLP_ENDPOINT" />
          </div>
          <p className="m-0 mt-3 text-[11.5px] leading-5 text-[var(--projects-muted)]">See the deployment guide for production configuration. This page never pretends to persist settings that belong to the server environment.</p>
        </AdminPanel>
      </div>
    </AdminPageBody>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--projects-divider)] pb-3 last:border-b-0 last:pb-0"><span className="text-[12px] text-[var(--projects-muted)]">{label}</span><span className={mono ? "max-w-[70%] truncate font-mono text-[11px] text-[var(--projects-text)]" : "max-w-[70%] truncate text-[12px] text-[var(--projects-text)]"} title={value}>{value}</span></div>;
}

function ConfigNote({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3.5 py-3"><span className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--projects-text)]">{icon}{title}</span><Mono className="mt-1 block text-[10.5px] text-[var(--projects-muted)]">{value}</Mono></div>;
}

function formatSessionTimestamp(value: string) {
  // Keep the first render deterministic between the server and browser. A
  // full locale/time-zone formatter can produce a hydration mismatch when a
  // user's browser is not running in UTC.
  return `${value.slice(0, 16).replace("T", " ")} UTC`;
}
