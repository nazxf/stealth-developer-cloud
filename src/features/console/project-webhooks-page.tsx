import { notFound, redirect } from "next/navigation";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { ProjectWebhooks } from "./project-webhooks";

export async function ProjectWebhooksPage({ projectId }: { projectId: string }) {
  try {
    const { webhooks, pagination, can_manage: canManage } = await stealthAPI.projectWebhooks(projectId, { limit: 20 });
    return <ProjectWebhooks projectId={projectId} initialWebhooks={webhooks} initialNextCursor={pagination.next_cursor} initialCanManage={canManage} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    if (error instanceof StealthAPIError && error.status === 404) notFound();
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div role="alert" className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-6">
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Webhooks</p>
          <h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--projects-text)]">Unable to load project webhooks</h1>
          <p className="m-0 mt-2 max-w-xl text-[14px] leading-6 text-[var(--projects-muted)]">The Stealth API did not return the webhook control plane. Refresh the page and try again.</p>
        </div>
      </section>
    );
  }
}
