import { redirect } from "next/navigation";
import { UsagePage } from "@/features/admin/usage/usage-page";
import { loadWorkspaceUsage } from "@/features/admin/lib/workspace-usage";
import { StealthAPIError } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const snapshot = await loadWorkspaceUsage();
    return <UsagePage snapshot={snapshot} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load workspace usage. Please try again.</main>;
  }
}
