import { redirect } from "next/navigation";
import { UsersPage } from "@/features/admin/users/users-page";
import { StealthAPIError, stealthAPI, type OrganizationInvitation, type OrganizationMembership } from "@/lib/stealth-api";

const MEMBERSHIP_PAGE_LIMIT = 100;
const MAX_MEMBERSHIP_PAGES = 100;

export default async function Page() {
  try {
    const { organizations } = await stealthAPI.organizations();
    const results = await Promise.allSettled(organizations.map(async (organization) => {
      const membershipResult = await listAllMemberships(organization.id);
      let invitations: OrganizationInvitation[] = [];
      if (membershipResult.canManage) {
        try {
          invitations = await listAllInvitations(organization.id);
        } catch (error) {
          // Membership management remains useful when an older API has not
          // applied the invitations migration yet; a 401 still bubbles out so
          // the page can redirect consistently.
          if (error instanceof StealthAPIError && error.status === 401) throw error;
        }
      }
      return { organization, ...membershipResult, invitations };
    }));

    if (results.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) {
      redirect("/login");
    }

    const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const unavailableOrganizations = results.filter((result) => result.status === "rejected").length;
    const truncatedOrganizations = available.filter((result) => result.truncated).length;

    return (
      <UsersPage
        initialOrganizations={available.map(({ organization, memberships, canManage, invitations }) => ({ id: organization.id, name: organization.name, memberships, canManage, invitations }))}
      organizationCount={organizations.length}
        unavailableOrganizations={unavailableOrganizations}
        truncatedOrganizations={truncatedOrganizations}
      />
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load workspace members. Please try again.</main>;
  }
}

async function listAllInvitations(organizationID: string) {
  const invitations: OrganizationInvitation[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_MEMBERSHIP_PAGES; page += 1) {
    const response = await stealthAPI.organizationInvitations(organizationID, { limit: MEMBERSHIP_PAGE_LIMIT, cursor });
    invitations.push(...response.invitations);
    const nextCursor = response.pagination.next_cursor;
    if (!nextCursor) return invitations;
    cursor = nextCursor;
  }

  return invitations;
}

async function listAllMemberships(organizationID: string) {
  const memberships: OrganizationMembership[] = [];
  let cursor: string | undefined;
  let canManage = false;

  for (let page = 0; page < MAX_MEMBERSHIP_PAGES; page += 1) {
    const response = await stealthAPI.organizationMemberships(organizationID, { limit: MEMBERSHIP_PAGE_LIMIT, cursor });
    canManage = response.can_manage;
    memberships.push(...response.memberships);
    const nextCursor = response.pagination.next_cursor;
    if (!nextCursor) return { memberships, truncated: false, canManage };
    cursor = nextCursor;
  }

  return { memberships, truncated: true, canManage };
}
