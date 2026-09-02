import { redirect } from "next/navigation";
import { LogsPage } from "@/features/admin/logs/logs-page";
import { logEntryFromAuditEvent } from "@/features/admin/logs/admin-logs";
import { StealthAPIError, stealthAPI, type OrganizationAuditEvent } from "@/lib/stealth-api";

const AUDIT_PAGE_LIMIT = 100;
const MAX_AUDIT_PAGES = 100;

export default async function Page() {
  try {
    const { organizations } = await stealthAPI.organizations();
    const results = await Promise.allSettled(organizations.map(async (organization) => ({
      organization,
      ...(await listAllAuditEvents(organization.id)),
    })));
    if (results.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) {
      redirect("/login");
    }

    const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const initialEntries = available
      .flatMap(({ events }) => events.map((event) => logEntryFromAuditEvent(event)))
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

    return (
      <LogsPage
        initialEntries={initialEntries}
        organizationCount={organizations.length}
        unavailableOrganizations={results.filter((result) => result.status === "rejected").length}
        truncatedOrganizations={available.filter((result) => result.truncated).length}
      />
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load workspace audit events. Please try again.</main>;
  }
}

async function listAllAuditEvents(organizationID: string) {
  const events: OrganizationAuditEvent[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_AUDIT_PAGES; page += 1) {
    const response = await stealthAPI.organizationAuditEvents(organizationID, { limit: AUDIT_PAGE_LIMIT, cursor });
    events.push(...response.events);
    const nextCursor = response.pagination.next_cursor;
    if (!nextCursor) return { events, truncated: false };
    cursor = nextCursor;
  }

  return { events, truncated: true };
}
