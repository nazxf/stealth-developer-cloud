export type AdminMembershipRole = "owner" | "admin" | "developer" | "viewer" | "billing";

export type AdminMembershipRecord = {
  organization_id: string;
  account_id: string;
  email: string;
  role: AdminMembershipRole;
  created_at: string;
};

export type AdminInvitationRecord = {
  id: string;
  organization_id: string;
  email: string;
  role: Exclude<AdminMembershipRole, "owner">;
  invited_by_account_id?: string;
  invited_by_email?: string;
  status: "pending" | "expired" | "accepted" | "revoked";
  expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
  created_at: string;
};

export type AdminMember = {
  id: string;
  email: string;
  role: AdminMembershipRole;
  organizationCount: number;
  organizations: string[];
  memberSince: string;
};

export type AdminOrganization = {
  id: string;
  name: string;
  memberships: readonly AdminMembershipRecord[];
  canManage: boolean;
  invitations: readonly AdminInvitationRecord[];
};

type OrganizationMembershipBatch = {
  organizationID: string;
  organizationName: string;
  memberships: readonly AdminMembershipRecord[];
};

const ROLE_RANK: Record<AdminMembershipRole, number> = {
  owner: 5,
  admin: 4,
  developer: 3,
  billing: 2,
  viewer: 1,
};

/** Collapse one account's memberships across all visible organizations. */
export function mergeOrganizationMemberships(batches: readonly OrganizationMembershipBatch[]): AdminMember[] {
  const members = new Map<string, { email: string; role: AdminMembershipRole; organizations: Map<string, string>; memberSince: string }>();

  for (const batch of batches) {
    for (const membership of batch.memberships) {
      const email = membership.email.trim() || "Unknown account";
      const current = members.get(membership.account_id);
      if (!current) {
        members.set(membership.account_id, {
          email,
          role: membership.role,
          organizations: new Map([[batch.organizationID, batch.organizationName]]),
          memberSince: membership.created_at,
        });
        continue;
      }

      current.email = current.email === "Unknown account" ? email : current.email;
      if (ROLE_RANK[membership.role] > ROLE_RANK[current.role]) current.role = membership.role;
      current.organizations.set(batch.organizationID, batch.organizationName);
      if (isEarlier(membership.created_at, current.memberSince)) current.memberSince = membership.created_at;
    }
  }

  return Array.from(members, ([id, member]) => ({
    id,
    email: member.email,
    role: member.role,
    organizationCount: member.organizations.size,
    organizations: Array.from(member.organizations.values()).sort((left, right) => left.localeCompare(right)),
    memberSince: member.memberSince,
  })).sort((left, right) => left.email.localeCompare(right.email) || left.id.localeCompare(right.id));
}

export function membershipRoleLabel(role: AdminMembershipRole) {
  return role[0].toUpperCase() + role.slice(1);
}

export function memberDisplayName(email: string) {
  const localPart = email.split("@", 1)[0]?.replace(/[._-]+/g, " ").trim();
  if (!localPart) return email;
  return localPart.split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export function memberInitials(email: string) {
  const name = memberDisplayName(email);
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2)).toUpperCase();
}

function isEarlier(candidate: string, current: string) {
  const candidateTime = Date.parse(candidate);
  const currentTime = Date.parse(current);
  if (Number.isNaN(candidateTime) || Number.isNaN(currentTime)) return false;
  return candidateTime < currentTime;
}
