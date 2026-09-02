import { redirect } from "next/navigation";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { ConnectedProjectsPage } from "@/features/projects/connected-projects-page";

export default async function Page({ searchParams }: PageProps<"/">) {
  const { organization } = await searchParams;
  let accountResponse;
  let organizationsResponse;
  try {
    [accountResponse, organizationsResponse] = await Promise.all([stealthAPI.currentAccount(), stealthAPI.organizations()]);
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-dvh place-items-center">Unable to load Stealth Console. Please try again.</main>;
  }

  const requestedOrganization = typeof organization === "string" ? organization : undefined;
  const active = organizationsResponse.organizations.find((item) => item.id === requestedOrganization);
  const defaultOrganization = organizationsResponse.organizations[0];
  if (organization !== undefined && !active && defaultOrganization) {
    redirect(`/?organization=${encodeURIComponent(defaultOrganization.id)}`);
  }
  const selectedOrganization = active ?? defaultOrganization;
  if (!selectedOrganization) return <main className="grid min-h-dvh place-items-center">No organizations are available for this account.</main>;

  try {
    const projectsResponse = await stealthAPI.projects(selectedOrganization.id);
    return <ConnectedProjectsPage account={accountResponse.account} organizations={organizationsResponse.organizations} activeOrganization={selectedOrganization} projects={projectsResponse.projects} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-dvh place-items-center">Unable to load Stealth Console. Please try again.</main>;
  }
}
