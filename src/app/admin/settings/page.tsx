import { redirect } from "next/navigation";
import { SettingsPage } from "@/features/admin/settings/settings-page";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const [{ account }, { organizations }, { sessions }] = await Promise.all([stealthAPI.currentAccount(), stealthAPI.organizations(), stealthAPI.accountSessions()]);
    const organizationResults = await Promise.allSettled(organizations.map(async (organization) => {
      const membership = await stealthAPI.organizationMemberships(organization.id, { limit: 1 });
      return { organization, canManage: membership.can_manage };
    }));
    if (organizationResults.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) redirect("/login");
    const available = organizationResults.flatMap((result) => result.status === "fulfilled" ? [{ ...result.value.organization, canManage: result.value.canManage }] : []);
    return <SettingsPage account={account} organizations={available} sessions={sessions} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load account settings. Please try again.</main>;
  }
}
