import { notFound, redirect } from "next/navigation";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { ProjectFunctions } from "./project-functions";

export async function ProjectFunctionsPage({ projectId }: { projectId: string }) {
  try {
    const { functions, pagination, can_manage: canManage } = await stealthAPI.projectFunctions(projectId, { limit: 20 });
    return <ProjectFunctions projectId={projectId} initialFunctions={functions} initialNextCursor={pagination.next_cursor} initialCanManage={canManage} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    if (error instanceof StealthAPIError && error.status === 404) notFound();
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div role="alert" className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-6">
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Functions</p>
          <h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--projects-text)]">Unable to load project functions</h1>
          <p className="m-0 mt-2 max-w-xl text-[14px] leading-6 text-[var(--projects-muted)]">The Stealth API did not return the function control plane. Refresh the page and try again.</p>
        </div>
      </section>
    );
  }
}
