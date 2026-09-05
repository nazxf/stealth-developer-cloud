import { Link, useParams } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Database, HardDrive, KeyRound, LockKeyhole, Mail, RefreshCcw, ServerCog, ShieldCheck, UserMinus, UserPlus, Users, Workflow } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserOrganization, type BrowserOrganizationMembershipManageRole } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { ErrorState as AsyncErrorState } from "./error-state";

const adminSections = ["usage", "incidents", "traces", "users", "runs", "workers", "settings"] as const;

export default function AdminRoute() {
  const organizationsQuery = useQuery({ queryKey: ["organizations"], queryFn: () => browserAPI.organizations({ limit: 100 }) });
  const organizations = organizationsQuery.data?.organizations ?? [];
  const projectQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-projects", organization.id], queryFn: () => browserAPI.projects(organization.id, { limit: 100 }) })) });
  const projects = useMemo(() => projectQueries.flatMap((query) => query.data?.projects ?? []), [projectQueries]);
  const usageQueries = useQueries({ queries: projects.map((project) => ({ queryKey: ["admin-project-usage", project.id], queryFn: () => browserAPI.projectUsage(project.id) })) });
  const incidentQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-incidents", organization.id], queryFn: () => browserAPI.organizationIncidents(organization.id) })) });
  const healthQuery = useQuery({ queryKey: ["healthz"], queryFn: browserAPI.health, refetchInterval: 15_000 });
  const readinessQuery = useQuery({ queryKey: ["readyz"], queryFn: browserAPI.readiness, refetchInterval: 15_000 });
  const usages = usageQueries.flatMap((query) => query.data ? [query.data.usage] : []);
  const incidents = incidentQueries.flatMap((query, index) => query.data?.incidents.map((incident) => ({ ...incident, organizationName: organizations[index]?.name ?? "Organization" })) ?? []).sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
  const totals = {
    applicationUsers: usages.reduce((sum, usage) => sum + usage.application_users, 0),
    databases: usages.reduce((sum, usage) => sum + usage.database_count, 0),
    storageFiles: usages.reduce((sum, usage) => sum + usage.storage_file_count, 0),
    functions: usages.reduce((sum, usage) => sum + usage.function_count, 0),
    sites: usages.reduce((sum, usage) => sum + usage.site_count, 0),
  };
  if (organizationsQuery.isPending) return <AdminFrame><LoadingState /></AdminFrame>;
  if (organizationsQuery.error) return <AdminFrame><ErrorState error={organizationsQuery.error} /></AdminFrame>;
  const healthy = healthQuery.data?.status === "ok" && readinessQuery.data?.status === "ready";
  return <AdminFrame><header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Operations</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Admin overview</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Live workspace aggregates, platform health, and incident telemetry.</p></div><button type="button" onClick={() => void queryClient.invalidateQueries()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm hover:border-[var(--projects-border-hover)]"><RefreshCcw size={15} aria-hidden="true" />Refresh</button></header><section className={`mt-6 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${healthy ? "border-[var(--projects-border)] bg-[var(--projects-card-bg)]" : "border-[var(--projects-warning)]/40 bg-[color-mix(in_srgb,var(--projects-warning)_7%,var(--projects-card-bg))]"}`} aria-label="System status"><span className={`inline-flex items-center gap-2 text-sm font-semibold ${healthy ? "text-[var(--projects-accent)]" : "text-[var(--projects-warning)]"}`}>{healthy ? <CheckCircle2 size={17} aria-hidden="true" /> : <AlertTriangle size={17} aria-hidden="true" />}{healthy ? "All systems operational" : "Checking platform health"}</span><span className="text-sm text-[var(--projects-muted)]">API {healthQuery.data?.status ?? "pending"} · readiness {readinessQuery.data?.status ?? "pending"}</span><Link to="/admin/$section" params={{ section: "incidents" }} className="ml-auto text-sm text-[var(--projects-accent)] hover:underline">View incidents →</Link></section><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Users size={18} />} label="Application users" value={totals.applicationUsers} detail={`${projects.length} projects`} /><Metric icon={<Database size={18} />} label="Databases" value={totals.databases} detail={`${organizations.length} organizations`} /><Metric icon={<HardDrive size={18} />} label="Storage files" value={totals.storageFiles} detail="Across connected projects" /><Metric icon={<Workflow size={18} />} label="Functions + sites" value={totals.functions + totals.sites} detail={`${totals.functions} functions · ${totals.sites} sites`} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><section className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-lg font-semibold">Workspace footprint</h2><Link to="/admin/$section" params={{ section: "usage" }} className="text-xs text-[var(--projects-accent)] hover:underline">Details →</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Organizations" value={organizations.length} /><Stat label="Projects" value={projects.length} /><Stat label="Usage snapshots" value={usages.length} /><Stat label="Unavailable" value={projects.length - usages.length} /></div></section><section className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-lg font-semibold">Recent incidents</h2><Link to="/admin/$section" params={{ section: "incidents" }} className="text-xs text-[var(--projects-accent)] hover:underline">All incidents →</Link></div>{incidents.length ? <ul className="m-0 mt-3 list-none divide-y divide-[var(--projects-divider)] p-0">{incidents.slice(0, 4).map((incident) => <li key={incident.id} className="py-3 first:pt-0"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium">{incident.title}</span><span className={`shrink-0 text-xs ${incident.status === "resolved" ? "text-[var(--projects-accent)]" : "text-[var(--projects-warning)]"}`}>{incident.status}</span></div><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{incident.organizationName} · {incident.severity}</p></li>)}</ul> : <p className="m-0 mt-4 text-sm text-[var(--projects-muted)]">No incidents reported.</p>}</section></div></AdminFrame>;
}

export function AdminSectionRoute() {
  const { section } = useParams({ from: "/admin/$section" });
  const validSection = adminSections.includes(section as (typeof adminSections)[number]);
  const organizationsQuery = useQuery({ queryKey: ["organizations"], queryFn: () => browserAPI.organizations({ limit: 100 }) });
  const organizations = organizationsQuery.data?.organizations ?? [];
  const incidentQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-incidents", organization.id], queryFn: () => browserAPI.organizationIncidents(organization.id), enabled: section === "incidents" })) });
  const traceQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-traces", organization.id], queryFn: () => browserAPI.organizationTraces(organization.id), enabled: section === "traces" })) });
  if (!validSection) return <AdminFrame><ErrorState error={new Error("That admin section does not exist.")} /></AdminFrame>;
  if (organizationsQuery.isPending) return <AdminFrame><LoadingState /></AdminFrame>;
  if (organizationsQuery.error) return <AdminFrame><ErrorState error={organizationsQuery.error} /></AdminFrame>;
  const incidents = incidentQueries.flatMap((query, index) => query.data?.incidents.map((incident) => ({ ...incident, organizationName: organizations[index]?.name ?? "Organization" })) ?? []);
  const traces = traceQueries.flatMap((query) => query.data?.traces ?? []);
  const title = section === "usage" ? "Usage" : section === "incidents" ? "Incidents" : section === "traces" ? "HTTP traces" : section[0].toUpperCase() + section.slice(1);
  return <AdminFrame><Link to="/admin" className="text-sm text-[var(--projects-accent)] hover:underline">← Admin overview</Link><header className="mt-5 border-b border-[var(--projects-border)] pb-6"><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Operations</p><h1 className="m-0 mt-2 text-3xl font-semibold">{title}</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Authenticated workspace data from the Go control plane.</p></header>{section === "incidents" ? <IncidentList incidents={incidents} /> : section === "traces" ? <TraceList traces={traces} /> : section === "usage" ? <AdminUsagePanel organizations={organizations} /> : section === "users" ? <AdminUsersPanel organizations={organizations} /> : section === "runs" ? <AdminRunsPanel /> : section === "workers" ? <AdminWorkersPanel /> : <AdminSettingsPanel organizations={organizations} />}</AdminFrame>;
}

function AdminFrame({ children }: { children: React.ReactNode }) { return <div className="min-h-[60vh]">{children}<nav className="mt-8 flex flex-wrap gap-2 border-t border-[var(--projects-border)] pt-5" aria-label="Admin sections"><Link to="/admin" activeOptions={{ exact: true }} className="rounded-lg border border-[var(--projects-border)] px-3 py-2 text-xs text-[var(--projects-muted)] hover:text-[var(--projects-text)]">Overview</Link>{adminSections.map((section) => <Link key={section} to="/admin/$section" params={{ section }} className="rounded-lg border border-[var(--projects-border)] px-3 py-2 text-xs text-[var(--projects-muted)] hover:text-[var(--projects-text)]">{section[0].toUpperCase() + section.slice(1)}</Link>)}</nav></div>; }
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) { return <article className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><span className="inline-flex size-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-accent)]">{icon}</span><p className="m-0 mt-4 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-1 font-mono text-2xl font-semibold">{value.toLocaleString()}</p><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{detail}</p></article>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3"><p className="m-0 text-xs text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-1 font-mono text-xl font-semibold">{value.toLocaleString()}</p></div>; }
function IncidentList({ incidents }: { incidents: Array<{ id: string; title: string; status: string; severity: string; organizationName: string; started_at: string }> }) { return <section className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">{incidents.length ? <div className="divide-y divide-[var(--projects-divider)]">{incidents.map((incident) => <article key={incident.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-base font-semibold">{incident.title}</h2><span className="inline-flex items-center gap-1.5 text-xs text-[var(--projects-muted)]">{incident.status === "resolved" ? <CheckCircle2 size={14} className="text-[var(--projects-accent)]" /> : <AlertTriangle size={14} className="text-[var(--projects-warning)]" />}{incident.status}</span></div><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{incident.organizationName} · {incident.severity} · {new Date(incident.started_at).toLocaleString()}</p></article>)}</div> : <p className="m-0 text-sm text-[var(--projects-muted)]">No incidents found.</p>}</section>; }
function TraceList({ traces }: { traces: Array<{ id: string; service: string; method: string; route: string; status: number; duration_ms: number }> }) { return <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[680px] text-left text-sm"><caption className="sr-only">Recent HTTP traces</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Service</th><th scope="col" className="px-4 py-3">Route</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Duration</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{traces.slice(0, 100).map((trace) => <tr key={trace.id}><td className="px-4 py-3">{trace.service}<span className="mt-0.5 block text-xs text-[var(--projects-muted)]">{trace.method}</span></td><td className="px-4 py-3 font-mono text-xs">{trace.route}</td><td className={`px-4 py-3 font-mono text-xs ${trace.status >= 500 ? "text-[var(--projects-danger)]" : "text-[var(--projects-accent)]"}`}>{trace.status}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{trace.duration_ms} ms</td></tr>)}</tbody></table>{traces.length === 0 ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No traces found.</p> : null}</section>; }

function AdminUsagePanel({ organizations }: { organizations: BrowserOrganization[] }) {
  const projectQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-usage-projects", organization.id], queryFn: () => browserAPI.projects(organization.id, { limit: 100 }) })) });
  const projects = projectQueries.flatMap((query) => query.data?.projects ?? []);
  const usageQueries = useQueries({ queries: projects.map((project) => ({ queryKey: ["admin-usage-detail", project.id], queryFn: () => browserAPI.projectUsage(project.id) })) });
  return <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Project usage</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Project</th><th scope="col" className="px-4 py-3">Users</th><th scope="col" className="px-4 py-3">Databases</th><th scope="col" className="px-4 py-3">Storage</th><th scope="col" className="px-4 py-3">Functions</th><th scope="col" className="px-4 py-3">Sites</th><th scope="col" className="px-4 py-3">Captured</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{projects.map((project, index) => { const usage = usageQueries[index]?.data?.usage; return <tr key={project.id}><td className="px-4 py-3"><Link to="/projects/$projectId" params={{ projectId: project.id }} className="font-medium text-[var(--projects-accent)] hover:underline">{project.name}</Link><span className="mt-0.5 block font-mono text-xs text-[var(--projects-muted)]">{project.id}</span></td><td className="px-4 py-3 font-mono text-xs">{usage?.application_users ?? "—"}</td><td className="px-4 py-3 font-mono text-xs">{usage?.database_count ?? "—"}</td><td className="px-4 py-3 font-mono text-xs">{usage?.storage_file_count ?? "—"}</td><td className="px-4 py-3 font-mono text-xs">{usage?.function_count ?? "—"}</td><td className="px-4 py-3 font-mono text-xs">{usage?.site_count ?? "—"}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{usage ? new Date(usage.captured_at).toLocaleString() : "Loading…"}</td></tr>; })}</tbody></table>{projects.length === 0 ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No projects found in the available organizations.</p> : null}</section>;
}

const manageableRoles: BrowserOrganizationMembershipManageRole[] = ["admin", "developer", "viewer", "billing"];

function AdminUsersPanel({ organizations }: { organizations: BrowserOrganization[] }) {
  const [organizationID, setOrganizationID] = useState(organizations[0]?.id ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<BrowserOrganizationMembershipManageRole>("developer");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const membershipQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-memberships", organization.id], queryFn: () => browserAPI.organizationMemberships(organization.id, { limit: 100 }) })) });
  const invitationQueries = useQueries({ queries: organizations.map((organization) => ({ queryKey: ["admin-invitations", organization.id], queryFn: () => browserAPI.organizationInvitations(organization.id, { limit: 100 }) })) });
  const selectedOrganization = organizations.find((organization) => organization.id === organizationID) ?? organizations[0];
  const selectedIndex = selectedOrganization ? organizations.findIndex((organization) => organization.id === selectedOrganization.id) : -1;
  const memberships = selectedIndex >= 0 ? membershipQueries[selectedIndex]?.data?.memberships ?? [] : [];
  const invitations = selectedIndex >= 0 ? invitationQueries[selectedIndex]?.data?.invitations ?? [] : [];

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization || !inviteEmail.trim()) return;
    setPending("invite");
    setMessage("");
    try {
      const result = await browserAPI.createOrganizationInvitation(selectedOrganization.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      setMessage(result.delivery === "sent" ? "Invitation sent." : "Invitation created, but email delivery failed.");
      await queryClient.invalidateQueries({ queryKey: ["admin-invitations", selectedOrganization.id] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  async function updateRole(accountID: string, role: BrowserOrganizationMembershipManageRole) {
    if (!selectedOrganization) return;
    setPending(`role:${accountID}`);
    setMessage("");
    try {
      await browserAPI.updateOrganizationMembership(selectedOrganization.id, accountID, role);
      await queryClient.invalidateQueries({ queryKey: ["admin-memberships", selectedOrganization.id] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  async function removeMember(accountID: string) {
    if (!selectedOrganization || !window.confirm("Remove this member from the organization?")) return;
    setPending(`remove:${accountID}`);
    setMessage("");
    try {
      await browserAPI.removeOrganizationMembership(selectedOrganization.id, accountID);
      await queryClient.invalidateQueries({ queryKey: ["admin-memberships", selectedOrganization.id] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  async function revokeInvitation(invitationID: string) {
    if (!selectedOrganization) return;
    setPending(`invitation:${invitationID}`);
    setMessage("");
    try {
      await browserAPI.revokeOrganizationInvitation(selectedOrganization.id, invitationID);
      await queryClient.invalidateQueries({ queryKey: ["admin-invitations", selectedOrganization.id] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  return <section className="mt-6 space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm text-[var(--projects-muted)]">Organization<select value={selectedOrganization?.id ?? ""} onChange={(event) => setOrganizationID(event.target.value)} className="mt-1 block h-10 min-w-56 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><span className="text-xs text-[var(--projects-muted)]">{memberships.length} members · {invitations.length} invitations</span></div><form onSubmit={invite} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center gap-2"><UserPlus size={17} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-base font-semibold">Invite a member</h2></div><div className="mt-4 flex flex-wrap gap-2"><label className="min-w-64 flex-1"><span className="sr-only">Email address</span><input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" className="h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /></label><label><span className="sr-only">Role</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as BrowserOrganizationMembershipManageRole)} className="h-10 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm">{manageableRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><button type="submit" disabled={pending === "invite" || !selectedOrganization} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60"><Mail size={15} aria-hidden="true" />{pending === "invite" ? "Inviting…" : "Send invite"}</button></div>{message ? <p className="m-0 mt-3 text-sm text-[var(--projects-muted)]" role="status">{message}</p> : null}</form><div className="overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Organization members</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Member</th><th scope="col" className="px-4 py-3">Role</th><th scope="col" className="px-4 py-3">Joined</th><th scope="col" className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{memberships.map((membership) => <tr key={membership.account_id}><td className="px-4 py-3"><span className="font-medium">{membership.email}</span><span className="mt-0.5 block font-mono text-xs text-[var(--projects-muted)]">{membership.account_id}</span></td><td className="px-4 py-3">{membership.role === "owner" ? <span className="inline-flex items-center gap-1.5 text-xs text-[var(--projects-accent)]"><ShieldCheck size={14} aria-hidden="true" />owner</span> : <select value={membership.role} disabled={pending === `role:${membership.account_id}`} onChange={(event) => void updateRole(membership.account_id, event.target.value as BrowserOrganizationMembershipManageRole)} className="h-8 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 text-xs">{manageableRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select>}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{new Date(membership.created_at).toLocaleDateString()}</td><td className="px-4 py-3 text-right">{membership.role !== "owner" ? <button type="button" disabled={pending === `remove:${membership.account_id}`} onClick={() => void removeMember(membership.account_id)} className="inline-flex items-center gap-1.5 text-xs text-[var(--projects-danger)] hover:underline disabled:opacity-60"><UserMinus size={14} aria-hidden="true" />Remove</button> : <span className="text-xs text-[var(--projects-muted)]">Protected</span>}</td></tr>)}</tbody></table>{memberships.length === 0 ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No members loaded.</p> : null}</div><div className="overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[680px] text-left text-sm"><caption className="sr-only">Organization invitations</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Invitee</th><th scope="col" className="px-4 py-3">Role</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{invitations.map((invitation) => <tr key={invitation.id}><td className="px-4 py-3">{invitation.email}<span className="mt-0.5 block text-xs text-[var(--projects-muted)]">Expires {new Date(invitation.expires_at).toLocaleDateString()}</span></td><td className="px-4 py-3 text-xs">{invitation.role}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{invitation.status}</td><td className="px-4 py-3 text-right">{invitation.status === "pending" ? <button type="button" disabled={pending === `invitation:${invitation.id}`} onClick={() => void revokeInvitation(invitation.id)} className="text-xs text-[var(--projects-danger)] hover:underline">Revoke</button> : <span className="text-xs text-[var(--projects-muted)]">—</span>}</td></tr>)}</tbody></table>{invitations.length === 0 ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No invitations found.</p> : null}</div></section>;
}

function AdminRunsPanel() {
  const agentsQuery = useQuery({ queryKey: ["admin-runs-agents"], queryFn: () => browserAPI.agents({ limit: 100 }) });
  const agents = agentsQuery.data?.agents ?? [];
  const runQueries = useQueries({ queries: agents.map((agent) => ({ queryKey: ["admin-runs", agent.id], queryFn: () => browserAPI.agentRuns(agent.id, { limit: 50 }), enabled: agentsQuery.isSuccess })) });
  const runs = runQueries.flatMap((query, index) => query.data?.runs.map((run) => ({ ...run, agentName: agents[index]?.name ?? "Agent" })) ?? []).sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
  return <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[860px] text-left text-sm"><caption className="sr-only">Agent runs</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Agent</th><th scope="col" className="px-4 py-3">Prompt</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Queued</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{runs.slice(0, 100).map((run) => <tr key={run.id}><td className="px-4 py-3 font-medium">{run.agentName}<span className="mt-0.5 block font-mono text-xs text-[var(--projects-muted)]">{run.id}</span></td><td className="max-w-[34rem] truncate px-4 py-3 text-sm">{run.prompt}</td><td className={`px-4 py-3 text-xs font-semibold ${run.status === "failed" ? "text-[var(--projects-danger)]" : run.status === "completed" ? "text-[var(--projects-accent)]" : "text-[var(--projects-warning)]"}`}>{run.status}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{new Date(run.queued_at).toLocaleString()}</td></tr>)}</tbody></table>{runs.length === 0 ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No agent runs found.</p> : null}</section>;
}

function AdminWorkersPanel() {
  const agentsQuery = useQuery({ queryKey: ["admin-workers-agents"], queryFn: () => browserAPI.agents({ limit: 100 }), refetchInterval: 15_000 });
  const agents = agentsQuery.data?.agents ?? [];
  const active = agents.filter((agent) => agent.status === "active" || agent.status === "running").length;
  return <section className="mt-6 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric icon={<ServerCog size={18} />} label="Registered workers" value={agents.length} detail="Agent workers visible to the control plane" /><Metric icon={<Activity size={18} />} label="Active workers" value={active} detail="Reported active or running" /><Metric icon={<Workflow size={18} />} label="Idle workers" value={Math.max(agents.length - active, 0)} detail="Available for the next run" /></div><div className="overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Agent workers</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Worker</th><th scope="col" className="px-4 py-3">Project</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Last active</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{agents.map((agent) => <tr key={agent.id}><td className="px-4 py-3 font-medium">{agent.name}<span className="mt-0.5 block text-xs text-[var(--projects-muted)]">{agent.provider} · {agent.model}</span></td><td className="px-4 py-3">{agent.project_name}<span className="mt-0.5 block font-mono text-xs text-[var(--projects-muted)]">{agent.project_id}</span></td><td className="px-4 py-3 text-xs">{agent.status}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{agent.last_active_at ? new Date(agent.last_active_at).toLocaleString() : "No heartbeat"}</td></tr>)}</tbody></table>{agents.length === 0 ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No workers registered.</p> : null}</div></section>;
}

function AdminSettingsPanel({ organizations }: { organizations: BrowserOrganization[] }) {
  const accountQuery = useQuery({ queryKey: ["account"], queryFn: browserAPI.currentAccount });
  const sessionsQuery = useQuery({ queryKey: ["account-sessions"], queryFn: browserAPI.accountSessions });
  const [organizationID, setOrganizationID] = useState(organizations[0]?.id ?? "");
  const selectedOrganization = organizations.find((organization) => organization.id === organizationID) ?? organizations[0];
  const [name, setName] = useState(selectedOrganization?.name ?? "");
  const [slug, setSlug] = useState(selectedOrganization?.slug ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const auditQuery = useQuery({ queryKey: ["admin-settings-audit", selectedOrganization?.id], queryFn: () => browserAPI.organizationAuditEvents(selectedOrganization!.id, { limit: 20 }), enabled: Boolean(selectedOrganization) });

  useEffect(() => {
    setName(selectedOrganization?.name ?? "");
    setSlug(selectedOrganization?.slug ?? "");
  }, [selectedOrganization?.id, selectedOrganization?.name, selectedOrganization?.slug]);

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization) return;
    setPending("organization");
    setMessage("");
    try {
      await browserAPI.updateOrganization(selectedOrganization.id, { name: name.trim(), slug: slug.trim() });
      setMessage("Organization settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("password");
    setMessage("");
    try {
      const result = await browserAPI.updateAccountPassword({ current_password: currentPassword, password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage(`Password updated. ${result.sessions_revoked} other session(s) revoked.`);
      await queryClient.invalidateQueries({ queryKey: ["account-sessions"] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  async function revokeSession(sessionID: string) {
    setPending(`session:${sessionID}`);
    setMessage("");
    try {
      await browserAPI.revokeAccountSession(sessionID);
      await queryClient.invalidateQueries({ queryKey: ["account-sessions"] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  async function revokeOthers() {
    setPending("sessions");
    setMessage("");
    try {
      const result = await browserAPI.revokeOtherAccountSessions();
      setMessage(`${result.revoked} other session(s) revoked.`);
      await queryClient.invalidateQueries({ queryKey: ["account-sessions"] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending("");
    }
  }

  return <section className="mt-6 space-y-6"><div className="grid gap-6 lg:grid-cols-2"><form onSubmit={saveOrganization} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-base font-semibold">Organization</h2></div><label className="mt-4 block text-sm text-[var(--projects-muted)]">Organization<select value={selectedOrganization?.id ?? ""} onChange={(event) => setOrganizationID(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="mt-3 block text-sm text-[var(--projects-muted)]">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]" /></label><label className="mt-3 block text-sm text-[var(--projects-muted)]">Slug<input required value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]" /></label><button type="submit" disabled={!selectedOrganization || pending === "organization"} className="mt-4 h-10 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{pending === "organization" ? "Saving…" : "Save organization"}</button></form><form onSubmit={changePassword} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center gap-2"><LockKeyhole size={17} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-base font-semibold">Account security</h2></div><p className="m-0 mt-2 text-xs text-[var(--projects-muted)]">{accountQuery.data?.account.email ?? "Loading account…"}</p><label className="mt-4 block text-sm text-[var(--projects-muted)]">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]" /></label><label className="mt-3 block text-sm text-[var(--projects-muted)]">New password<input required minLength={12} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]" /></label><button type="submit" disabled={pending === "password"} className="mt-4 h-10 rounded-lg border border-[var(--projects-border)] px-4 text-sm font-semibold hover:border-[var(--projects-border-hover)] disabled:opacity-60">{pending === "password" ? "Updating…" : "Update password"}</button></form></div>{message ? <p className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4 text-sm text-[var(--projects-muted)]" role="status">{message}</p> : null}<section className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><KeyRound size={17} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-base font-semibold">Console sessions</h2></div><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Revoke devices you no longer recognize.</p></div><button type="button" disabled={pending === "sessions"} onClick={() => void revokeOthers()} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-xs hover:border-[var(--projects-border-hover)] disabled:opacity-60">Revoke other sessions</button></div><div className="mt-4 divide-y divide-[var(--projects-divider)]">{sessionsQuery.data?.sessions.map((session) => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><div><p className="m-0 text-sm">{session.is_current ? "This browser" : "Other session"}</p><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Created {new Date(session.created_at).toLocaleString()} · expires {new Date(session.expires_at).toLocaleDateString()}</p></div>{session.is_current ? <span className="text-xs text-[var(--projects-accent)]">Current</span> : <button type="button" disabled={pending === `session:${session.id}`} onClick={() => void revokeSession(session.id)} className="text-xs text-[var(--projects-danger)] hover:underline">Revoke</button>}</div>)}</div>{sessionsQuery.data?.sessions.length === 0 ? <p className="m-0 mt-4 text-sm text-[var(--projects-muted)]">No active sessions returned.</p> : null}</section><section className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><h2 className="m-0 text-base font-semibold">Recent audit events</h2><div className="mt-3 divide-y divide-[var(--projects-divider)]">{auditQuery.data?.events.map((event) => <div key={event.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-xs">{event.action}</span><time className="text-xs text-[var(--projects-muted)]">{new Date(event.created_at).toLocaleString()}</time></div><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{event.actor_email ?? "System"} · {event.target_type}{event.target_id ? ` · ${event.target_id}` : ""}</p></div>)}</div>{auditQuery.data?.events.length === 0 ? <p className="m-0 mt-4 text-sm text-[var(--projects-muted)]">No audit activity yet.</p> : null}</section></section>;
}

function errorMessage(error: unknown) {
  return browserAPIErrorMessage(error, "The request could not be completed.");
}

function LoadingState() { return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading admin workspace…</div>; }
function ErrorState({ error }: { error: unknown }) { return <AsyncErrorState error={error} fallback="Unable to load admin data." />; }
