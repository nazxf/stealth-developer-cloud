"use client";

import { Clock3, LoaderCircle, MailPlus, UserPlus, UserRound, UserRoundX } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AdminHeader, AdminPageBody, Mono } from "../components/admin-panel";
import { ToolbarSearch } from "../components/toolbar-search";
import { AdminSelect } from "../components/admin-select";
import { mergeOrganizationMemberships, memberDisplayName, memberInitials, membershipRoleLabel, type AdminInvitationRecord, type AdminMembershipRecord, type AdminMembershipRole, type AdminOrganization } from "./admin-users";
import type { OrganizationMembershipRole } from "@/lib/stealth-api";

type RoleFilter = "all" | AdminMembershipRole;
type ErrorPayload = { error?: { message?: string } };

class MembershipRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/stealth/${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    throw new MembershipRequestError(response.status, payload?.error?.message ?? "The membership request could not be completed.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const manageableRoles: Array<{ value: OrganizationMembershipRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "viewer", label: "Viewer" },
  { value: "billing", label: "Billing" },
];

function membershipsPath(organizationID: string, accountID?: string) {
  const base = `organizations/${encodeURIComponent(organizationID)}/memberships`;
  return accountID ? `${base}/${encodeURIComponent(accountID)}` : base;
}

function invitationsPath(organizationID: string, invitationID?: string) {
  const base = `organizations/${encodeURIComponent(organizationID)}/invitations`;
  return invitationID ? `${base}/${encodeURIComponent(invitationID)}` : base;
}

/** Users — authenticated organization membership directory and controls. */
export function UsersPage({
  initialOrganizations,
  organizationCount,
  unavailableOrganizations,
  truncatedOrganizations,
}: {
  initialOrganizations: AdminOrganization[];
  organizationCount: number;
  unavailableOrganizations: number;
  truncatedOrganizations: number;
}) {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>(() => initialOrganizations.map((organization) => ({ ...organization, memberships: [...organization.memberships], invitations: [...organization.invitations] })));
  const [selectedOrganizationID, setSelectedOrganizationID] = useState(initialOrganizations[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<OrganizationMembershipRole>("viewer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationMembershipRole>("viewer");
  const [mutation, setMutation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationID) ?? organizations[0];
  const members = useMemo(() => mergeOrganizationMemberships(organizations.map((organization) => ({
    organizationID: organization.id,
    organizationName: organization.name,
    memberships: organization.memberships,
  }))), [organizations]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return members.filter((user) => {
      if (role !== "all" && user.role !== role) return false;
      if (!normalizedQuery) return true;
      return [user.id, user.email, ...user.organizations].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [members, query, role]);

  function showRequestError(reason: unknown, fallback: string) {
    if (reason instanceof MembershipRequestError && reason.status === 403) {
      setError("Only organization owners and admins can manage members; owners cannot be removed or transferred here.");
    } else if (reason instanceof MembershipRequestError && reason.status === 404) {
      setError("The account or membership was not found. The account must sign up before it can be added.");
    } else if (reason instanceof MembershipRequestError && reason.status === 409) {
      setError("That account is already a member or already has a pending invitation for this organization.");
    } else {
      setError(reason instanceof Error ? reason.message : fallback);
    }
    setMessage(null);
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization?.canManage || mutation) return;
    const email = addEmail.trim();
    if (!email) {
      setError("Enter the email address of an existing Console account.");
      setMessage(null);
      return;
    }
    setMutation("add");
    setError(null);
    setMessage(null);
    try {
      const result = await bridgeJSON<{ membership: AdminMembershipRecord }>(membershipsPath(selectedOrganization.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: addRole }),
      });
      setOrganizations((current) => current.map((organization) => organization.id === selectedOrganization.id ? { ...organization, memberships: [...organization.memberships, result.membership] } : organization));
      setAddEmail("");
      setMessage(`${email} was added as ${membershipRoleLabel(addRole)}.`);
    } catch (reason) {
      showRequestError(reason, "The account could not be added.");
    } finally {
      setMutation(null);
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization?.canManage || mutation) return;
    const email = inviteEmail.trim();
    if (!email) {
      setError("Enter the email address to invite.");
      setMessage(null);
      return;
    }
    setMutation("invite");
    setError(null);
    setMessage(null);
    try {
      const result = await bridgeJSON<{ invitation: AdminInvitationRecord; delivery: "sent" | "failed" }>(invitationsPath(selectedOrganization.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      setOrganizations((current) => current.map((organization) => organization.id === selectedOrganization.id ? { ...organization, invitations: [result.invitation, ...organization.invitations.filter((item) => item.email !== result.invitation.email)] } : organization));
      setInviteEmail("");
      setMessage(result.delivery === "sent" ? `Invitation sent to ${email}.` : `Invitation created for ${email}, but email delivery is unavailable. Configure the mailer and resend.`);
    } catch (reason) {
      showRequestError(reason, "The invitation could not be created.");
    } finally {
      setMutation(null);
    }
  }

  async function revokeInvitation(invitation: AdminInvitationRecord) {
    if (!selectedOrganization?.canManage || mutation || !window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    setMutation(`revoke:${invitation.id}`);
    setError(null);
    setMessage(null);
    try {
      await bridgeJSON<void>(invitationsPath(selectedOrganization.id, invitation.id), { method: "DELETE" });
      setOrganizations((current) => current.map((organization) => organization.id === selectedOrganization.id ? { ...organization, invitations: organization.invitations.filter((item) => item.id !== invitation.id) } : organization));
      setMessage(`Invitation for ${invitation.email} was revoked.`);
    } catch (reason) {
      showRequestError(reason, "The invitation could not be revoked.");
    } finally {
      setMutation(null);
    }
  }

  async function changeRole(member: AdminMembershipRecord, nextRole: OrganizationMembershipRole) {
    if (!selectedOrganization?.canManage || member.role === "owner" || member.role === nextRole || mutation) return;
    setMutation(`role:${member.account_id}`);
    setError(null);
    setMessage(null);
    try {
      const result = await bridgeJSON<{ membership: AdminMembershipRecord }>(membershipsPath(selectedOrganization.id, member.account_id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      setOrganizations((current) => current.map((organization) => organization.id === selectedOrganization.id ? { ...organization, memberships: organization.memberships.map((item) => item.account_id === member.account_id ? result.membership : item) } : organization));
      setMessage(`${member.email} is now ${membershipRoleLabel(nextRole)}.`);
    } catch (reason) {
      showRequestError(reason, "The member role could not be updated.");
    } finally {
      setMutation(null);
    }
  }

  async function removeMember(member: AdminMembershipRecord) {
    if (!selectedOrganization?.canManage || member.role === "owner" || mutation || !window.confirm(`Remove ${member.email} from ${selectedOrganization.name}?`)) return;
    setMutation(`remove:${member.account_id}`);
    setError(null);
    setMessage(null);
    try {
      await bridgeJSON<void>(membershipsPath(selectedOrganization.id, member.account_id), { method: "DELETE" });
      setOrganizations((current) => current.map((organization) => organization.id === selectedOrganization.id ? { ...organization, memberships: organization.memberships.filter((item) => item.account_id !== member.account_id) } : organization));
      setMessage(`${member.email} was removed from ${selectedOrganization.name}.`);
    } catch (reason) {
      showRequestError(reason, "The member could not be removed.");
    } finally {
      setMutation(null);
    }
  }

  return (
    <AdminPageBody>
      <AdminHeader title="Users" subtitle="Organization members with access to this Console workspace.">
        <Mono className="hidden h-9 items-center rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 text-[12px] text-[var(--projects-muted)] sm:inline-flex">
          {visible.length} / {members.length} accounts · {organizationCount} orgs
        </Mono>
      </AdminHeader>

      {(unavailableOrganizations > 0 || truncatedOrganizations > 0) ? (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">
          {unavailableOrganizations > 0 ? `${unavailableOrganizations} of ${organizationCount} organization membership lists were unavailable.` : null}
          {unavailableOrganizations > 0 && truncatedOrganizations > 0 ? " " : null}
          {truncatedOrganizations > 0 ? `${truncatedOrganizations} organization membership lists exceeded the pagination safety limit.` : null}
          {" The table includes only records that were read successfully."}
        </p>
      ) : null}

      <section className="rounded-lg border border-[var(--projects-border)] bg-[#141416] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><UserRound size={15} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Manage organization members</h2></div>
            <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Add an existing account directly or invite someone by email. Owners remain protected.</p>
          </div>
          {selectedOrganization ? <span className="rounded-full border border-[var(--projects-border)] px-2.5 py-1 text-[11px] text-[var(--projects-muted)]">{selectedOrganization.memberships.length} members</span> : null}
        </div>
        {organizations.length > 1 ? <label className="mt-4 block max-w-sm text-[11px] font-medium text-[var(--projects-muted)]">Organization<select value={selectedOrganization?.id ?? ""} onChange={(event) => { setSelectedOrganizationID(event.target.value); setError(null); setMessage(null); }} className="mt-1 block h-9 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)]"><option value="" disabled>Select an organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label> : null}
        {selectedOrganization ? <form onSubmit={(event) => void addMember(event)} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
          <label className="sr-only" htmlFor="member-email">Account email</label>
          <input id="member-email" type="email" required value={addEmail} onChange={(event) => setAddEmail(event.target.value)} placeholder="existing-account@example.com" disabled={!selectedOrganization.canManage || mutation !== null} className="h-9 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" />
          <label className="sr-only" htmlFor="member-role">Role</label>
          <select id="member-role" value={addRole} onChange={(event) => setAddRole(event.target.value as OrganizationMembershipRole)} disabled={!selectedOrganization.canManage || mutation !== null} className="h-9 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60">{manageableRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <button type="submit" disabled={!selectedOrganization.canManage || mutation !== null} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white outline-none hover:bg-[var(--projects-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-50">{mutation === "add" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <UserPlus size={13} aria-hidden="true" />}{mutation === "add" ? "Adding…" : "Add member"}</button>
        </form> : <p className="m-0 mt-4 text-[12px] text-[var(--projects-muted)]">No organizations are available for this account.</p>}
        {selectedOrganization ? <form onSubmit={(event) => void inviteMember(event)} className="mt-3 grid gap-2 rounded-md border border-dashed border-[var(--projects-border)] bg-[var(--projects-control)]/45 p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
          <label className="sr-only" htmlFor="invite-email">Invite email</label>
          <input id="invite-email" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" disabled={!selectedOrganization.canManage || mutation !== null} className="h-9 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" />
          <label className="sr-only" htmlFor="invite-role">Invitation role</label>
          <select id="invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as OrganizationMembershipRole)} disabled={!selectedOrganization.canManage || mutation !== null} className="h-9 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2.5 text-[12px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60">{manageableRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <button type="submit" disabled={!selectedOrganization.canManage || mutation !== null} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--projects-accent)] px-3 text-[12px] font-semibold text-[var(--projects-accent)] outline-none hover:bg-[var(--projects-accent)]/10 focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-50">{mutation === "invite" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <MailPlus size={13} aria-hidden="true" />}{mutation === "invite" ? "Sending…" : "Invite by email"}</button>
        </form> : null}
        {selectedOrganization && selectedOrganization.invitations.length > 0 ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[660px] text-left text-[12px]"><caption className="sr-only">Pending invitations for {selectedOrganization.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Invitation</th><th scope="col" className="px-3 py-2">Role</th><th scope="col" className="px-3 py-2">Expires</th><th scope="col" className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{selectedOrganization.invitations.map((invitation) => <tr key={invitation.id}><td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-[var(--projects-muted)]"><MailPlus size={13} aria-hidden="true" /></span><div><p className="m-0 font-medium text-[var(--projects-text)]">{invitation.email}</p><span className={`inline-flex items-center gap-1 text-[10.5px] ${invitation.status === "expired" ? "text-amber-200" : "text-[var(--projects-muted)]"}`}><Clock3 size={11} aria-hidden="true" />{invitation.status === "expired" ? "Expired" : "Pending"}</span></div></div></td><td className="px-3 py-2.5">{membershipRoleLabel(invitation.role)}</td><td className="px-3 py-2.5"><Mono className="text-[11px] text-[var(--projects-muted)]">{formatMemberSince(invitation.expires_at)}</Mono></td><td className="px-3 py-2.5 text-right">{selectedOrganization.canManage ? <button type="button" onClick={() => void revokeInvitation(invitation)} disabled={mutation !== null} className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-1.5 text-[10.5px] font-medium text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60">{mutation === `revoke:${invitation.id}` ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <UserRoundX size={12} aria-hidden="true" />}Revoke</button> : <span className="text-[10.5px] text-[var(--projects-muted)]">Read only</span>}</td></tr>)}</tbody></table></div> : null}
        {!selectedOrganization?.canManage && selectedOrganization ? <p className="m-0 mt-3 text-[11px] text-[var(--projects-muted)]">Read-only membership view. Ask an organization owner or admin to make changes.</p> : null}
        {error ? <p role="alert" className="m-0 mt-3 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[12px] leading-5 text-rose-200">{error}</p> : null}
        {message ? <p role="status" className="m-0 mt-3 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[12px] leading-5 text-emerald-200">{message}</p> : null}
        {selectedOrganization ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[660px] text-left text-[12px]"><caption className="sr-only">Members of {selectedOrganization.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Member</th><th scope="col" className="px-3 py-2">Role</th><th scope="col" className="px-3 py-2">Member since</th><th scope="col" className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{selectedOrganization.memberships.map((member) => <tr key={member.account_id}><td className="px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-[10px] font-semibold text-[var(--projects-muted)]">{memberInitials(member.email)}</span><div className="min-w-0"><p className="m-0 truncate font-medium text-[var(--projects-text)]">{memberDisplayName(member.email)}</p><Mono className="m-0 block truncate text-[10.5px] text-[var(--projects-muted)]">{member.email}</Mono></div></div></td><td className="px-3 py-2.5">{member.role === "owner" ? <span className="rounded-full border border-amber-400/30 px-2 py-1 text-[10.5px] font-medium text-amber-200">Owner</span> : <select value={member.role} onChange={(event) => void changeRole(member, event.target.value as OrganizationMembershipRole)} disabled={!selectedOrganization.canManage || mutation !== null} aria-label={`Change role for ${member.email}`} className="h-8 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 text-[11px] text-[var(--projects-text)] disabled:cursor-not-allowed disabled:opacity-60">{manageableRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}</td><td className="px-3 py-2.5"><Mono className="text-[11px] text-[var(--projects-muted)]">{formatMemberSince(member.created_at)}</Mono></td><td className="px-3 py-2.5 text-right">{member.role === "owner" ? <span className="text-[10.5px] text-[var(--projects-muted)]">Owner protected</span> : selectedOrganization.canManage ? <button type="button" onClick={() => void removeMember(member)} disabled={mutation !== null} className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-1.5 text-[10.5px] font-medium text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60">{mutation === `remove:${member.account_id}` ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <UserRoundX size={12} aria-hidden="true" />}Remove</button> : <span className="text-[10.5px] text-[var(--projects-muted)]">Read only</span>}</td></tr>)}</tbody></table></div> : null}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Workspace directory</h2><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">The same accounts may belong to more than one organization.</p></div><Mono className="text-[11px] text-[var(--projects-muted)]">{visible.length} visible</Mono></div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5"><ToolbarSearch value={query} onChange={setQuery} placeholder="Search email, account, organization..." label="Search workspace members" /><AdminSelect label="Filter by role" value={role} onChange={setRole} options={[{ value: "all", label: "All roles" }, { value: "owner", label: "Owner" }, ...manageableRoles.map((option) => ({ value: option.value, label: option.label }))]} /></div>
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[#141416]"><div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.25fr)_150px] gap-3 border-b border-[var(--projects-divider)] px-3.5 py-2 lg:grid"><ColLabel>User</ColLabel><ColLabel>Highest role</ColLabel><ColLabel>Organizations</ColLabel><ColLabel>Member since</ColLabel></div><ul className="m-0 list-none p-0">{visible.length === 0 ? <li className="px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">{members.length === 0 ? "No organization members found." : "No members match the current filters."}</li> : visible.map((user) => <li key={user.id} className="border-b border-[var(--projects-divider)] px-3.5 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid lg:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.25fr)_150px] lg:items-center lg:gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--projects-border)] bg-[var(--projects-control)] text-[11px] font-semibold text-[var(--projects-muted)]">{memberInitials(user.email)}</span><div className="min-w-0"><p className="m-0 truncate text-[13px] font-medium leading-5 text-[var(--projects-text)]">{memberDisplayName(user.email)}</p><Mono className="m-0 block truncate text-[11px] leading-4 text-[var(--projects-muted)]">{user.email}</Mono><Mono className="m-0 block truncate text-[10.5px] leading-4 text-[var(--projects-muted)]/75">{user.id}</Mono></div></div><span className="mt-2 block text-[12px] text-[var(--projects-muted)] lg:mt-0"><span className="lg:hidden">Highest role: </span>{membershipRoleLabel(user.role)}</span><span className="mt-1 block min-w-0 text-[12px] text-[var(--projects-muted)] lg:mt-0"><span className="lg:hidden">Organizations: </span><span title={user.organizations.join(", ")}>{formatOrganizations(user.organizations)}</span></span><Mono className="mt-1 block text-[11.5px] text-[var(--projects-muted)] lg:mt-0"><span className="font-sans text-[11px] lg:hidden">Member since: </span>{formatMemberSince(user.memberSince)}</Mono></li>)}</ul></div>
      </section>
    </AdminPageBody>
  );
}

function ColLabel({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>;
}

function formatOrganizations(organizations: string[]) {
  if (organizations.length === 0) return "—";
  if (organizations.length <= 2) return organizations.join(", ");
  return `${organizations.slice(0, 2).join(", ")} +${organizations.length - 2}`;
}

function formatMemberSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
