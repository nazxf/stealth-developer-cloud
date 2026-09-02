import { ArrowUpRight, Code2, Plus } from "lucide-react";

const resources = {
  auth: { title: "Auth", description: "Configure how users authenticate with this project.", action: "Configure Auth" },
  databases: { title: "Databases", description: "Create typed tables, real indexes, and permission-aware rows for your application.", action: "Create database" },
  storage: { title: "Storage", description: "Create buckets for application files and media.", action: "Create bucket" },
  functions: { title: "Functions", description: "Deploy server-side code that runs from events, schedules, or HTTP requests.", action: "Create function" },
  sites: { title: "Sites", description: "Deploy immutable static releases and serve the active version from a public URL.", action: "Create site" },
  deployments: { title: "Deployments", description: "Inspect the latest function and static-site releases across this project.", action: "View deployments" },
  realtime: { title: "Realtime", description: "Subscribe clients to permission-aware project events.", action: "View documentation" },
  messaging: { title: "Messaging", description: "Configure email, SMS, and push delivery providers for this project.", action: "Configure messaging" },
  "api-keys": { title: "API Keys", description: "Create scoped keys for server-to-server access to this project.", action: "Create API key" },
  webhooks: { title: "Webhooks", description: "Deliver project events to verified external endpoints.", action: "Create webhook" },
  logs: { title: "Logs", description: "Search API, function, deployment, and security events for this project.", action: "Configure log export" },
  usage: { title: "Usage", description: "Inspect live project resource totals and quota consumption.", action: "Refresh usage" },
  settings: { title: "Settings", description: "Manage project configuration, access, domains, and environments.", action: "Open settings" },
} as const;

export type ProjectResource = keyof typeof resources;

export function isProjectResource(value: string): value is ProjectResource {
  return Object.hasOwn(resources, value);
}

export function ProjectResourcePage({ resource, projectId }: { resource: ProjectResource; projectId: string }) {
  const content = resources[resource];
  const isDocumentationAction = resource === "realtime" || resource === "usage";
  const isRealtime = resource === "realtime";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">{content.title}</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">{content.description}</p>
        </div>
        <button type="button" disabled className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-border)] bg-[var(--projects-control)] px-4 text-[13px] font-semibold text-[var(--projects-muted)] opacity-70" title={isRealtime ? "Use the SDK or API endpoint" : "Not implemented yet"}>
          {isDocumentationAction ? <ArrowUpRight size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
          {content.action}
        </button>
      </header>

      <div className="mt-8 grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-12 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Code2 size={20} aria-hidden="true" /></span>
          <h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">{isRealtime ? "Realtime stream is available" : "This resource is not implemented yet"}</h2>
          <p className="m-0 mt-2 text-[14px] leading-6 text-[var(--projects-muted)]">{isRealtime ? <>Subscribe with <code className="rounded bg-[var(--projects-control)] px-1.5 py-0.5 text-[12px]">client.realtime.subscribe()</code> or <code className="rounded bg-[var(--projects-control)] px-1.5 py-0.5 text-[12px]">GET /v1/projects/{projectId}/realtime</code>. Cursors, SSE reconnect hints, and database row permission filtering are enabled.</> : <>The project route and access boundary are in place, but creating and managing {content.title.toLowerCase()} resources is not available yet.</>}</p>
        </div>
      </div>
    </section>
  );
}
