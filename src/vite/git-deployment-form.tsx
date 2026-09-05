import { GitBranch, LoaderCircle, Server } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { browserAPI, browserAPIErrorMessage } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";

export type GitDeploymentRuntime = "node-22" | "python-3.13" | "go-1.24";
export type GitDeployableResource = { id: string; name: string; type: "function" | "site"; activeDeploymentID: string | null };

const siteNameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Site name must use 2–63 lowercase letters, numbers, or hyphens.");
const gitDeploymentInputSchema = z.object({
  repository: z.string().trim().min(1, "Repository URL is required."),
  ref: z.string().trim().max(256, "Branch or tag must be 256 characters or fewer."),
  buildRuntime: z.enum(["node-22", "python-3.13", "go-1.24"]),
  buildCommand: z.string().trim().min(1, "Build command is required.").max(4000, "Build command must be 4000 bytes or fewer."),
  outputDirectory: z.string().trim().min(1, "Output directory is required.").max(255, "Output directory must be 255 characters or fewer.").refine((value) => value === "." || !value.startsWith("/") && !value.includes("\\") && !value.includes("\u0000") && !value.includes("\r") && !value.includes("\n") && value.split("/").every((part) => part && part !== "." && part !== ".." && /^[A-Za-z0-9_.-]+$/.test(part)), "Output directory must be a safe relative path."),
});

function firstValidationMessage(result: { success: false; error: z.ZodError }) {
  return result.error.issues[0]?.message ?? "Please check the deployment options.";
}

function errorMessage(error: unknown) {
  return browserAPIErrorMessage(error, "The Git deployment could not be created.");
}

export function GitDeploymentForm({ projectId, resources, canManage, onClose }: { projectId: string; resources: GitDeployableResource[]; canManage: boolean; onClose: () => void }) {
  const sites = resources.filter((resource) => resource.type === "site");
  const [siteID, setSiteID] = useState(sites[0]?.id ?? "__new__");
  const [siteName, setSiteName] = useState("");
  const [repository, setRepository] = useState("");
  const [ref, setRef] = useState("main");
  const [runtime, setRuntime] = useState<GitDeploymentRuntime>("node-22");
  const [command, setCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || pending) return;
    const parsed = gitDeploymentInputSchema.safeParse({ repository, ref, buildRuntime: runtime, buildCommand: command, outputDirectory });
    if (!parsed.success) {
      setError(firstValidationMessage(parsed));
      return;
    }
    let targetID = siteID;
    let normalizedSiteName = "";
    if (targetID === "__new__") {
      const parsedSiteName = siteNameSchema.safeParse(siteName);
      if (!parsedSiteName.success) {
        setError(firstValidationMessage(parsedSiteName));
        return;
      }
      normalizedSiteName = parsedSiteName.data;
    }
    setPending(true);
    setError("");
    try {
      if (targetID === "__new__") {
        const created = await browserAPI.createProjectSite(projectId, { name: normalizedSiteName });
        targetID = created.site.id;
      }
      await browserAPI.createProjectSiteGitDeployment(projectId, targetID, {
        repository: parsed.data.repository,
        ref: parsed.data.ref || "main",
        build_runtime: parsed.data.buildRuntime,
        build_command: parsed.data.buildCommand,
        output_directory: parsed.data.outputDirectory || ".",
        activate,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectSites(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deployments(projectId) }),
      ]);
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="mt-5 rounded-xl border border-[var(--projects-accent-border)] bg-[color-mix(in_srgb,var(--projects-accent)_5%,var(--projects-card-bg))] p-5" noValidate>
    <div className="flex items-start gap-3"><Server size={18} className="mt-0.5 text-[var(--projects-accent)]" aria-hidden="true" /><div><h2 className="m-0 text-lg font-semibold">Deploy from Git</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">The trusted Site worker fetches, builds, and optionally activates the immutable release.</p></div></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-xs text-[var(--projects-muted)] md:col-span-2">Target site<select value={siteID} onChange={(event) => setSiteID(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="__new__">Create a new site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
      {siteID === "__new__" ? <label className="text-xs text-[var(--projects-muted)]">New site name<input value={siteName} onChange={(event) => setSiteName(event.target.value)} disabled={pending} placeholder="marketing-site" className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label> : <span />}
      <label className="text-xs text-[var(--projects-muted)]">Repository URL<input required value={repository} onChange={(event) => setRepository(event.target.value)} disabled={pending} placeholder="https://github.com/acme/site" className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label>
      <label className="text-xs text-[var(--projects-muted)]">Branch or tag<input value={ref} onChange={(event) => setRef(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label>
      <label className="text-xs text-[var(--projects-muted)]">Build command<input required value={command} onChange={(event) => setCommand(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label>
      <label className="text-xs text-[var(--projects-muted)]">Output directory<select value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="dist">dist</option><option value="build">build</option><option value="out">out</option><option value=".">.</option></select></label>
      <label className="text-xs text-[var(--projects-muted)]">Runtime<select value={runtime} onChange={(event) => setRuntime(event.target.value as GitDeploymentRuntime)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="node-22">Node 22</option><option value="python-3.13">Python 3.13</option><option value="go-1.24">Go 1.24</option></select></label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-[var(--projects-text)]"><input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} disabled={pending} className="accent-[var(--projects-accent)]" />Activate after build</label>
    </div>
    {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
    <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={pending || !canManage} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <GitBranch size={14} aria-hidden="true" />}{pending ? "Creating…" : "Create deployment"}</button></div>
  </form>;
}
