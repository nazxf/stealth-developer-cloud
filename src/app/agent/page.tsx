import { redirect } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { AgentPage } from "@/features/agents/agent-page";
import { agentFromRecord } from "@/features/agents/agent-api";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";

export default async function Page() {
  try {
    // The roster and project options are independent reads. Fetch the first
    // pair together, then fan out project reads so the page has no serial
    // organization -> project waterfall.
    const [{ agents }, { organizations }, { account }] = await Promise.all([stealthAPI.agents({ limit: 100 }), stealthAPI.organizations(), stealthAPI.currentAccount()]);
    const projectPages = await Promise.all(organizations.map((organization) => stealthAPI.projects(organization.id)));
    const projects = projectPages
      .flatMap((page) => page.projects)
      .filter((project, index, all) => all.findIndex((candidate) => candidate.id === project.id) === index)
      .map((project) => ({ id: project.id, name: project.name }));

    return (
      <ApplicationShell accountEmail={account.email}>
        <AgentPage initialAgents={agents.map(agentFromRecord)} projects={projects} />
      </ApplicationShell>
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return (
      <ApplicationShell>
        <section className="min-h-dvh bg-[var(--projects-bg)] px-4 pb-12 pt-20 sm:px-6 lg:px-7">
          <div className="mx-auto w-full max-w-[900px] rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-6">
            <p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Agents</p>
            <h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--projects-text)]">Unable to load agents</h1>
            <p className="m-0 mt-2 text-[14px] leading-6 text-[var(--projects-muted)]">The Agent control plane did not return a roster. Refresh the page and try again.</p>
          </div>
        </section>
      </ApplicationShell>
    );
  }
}
