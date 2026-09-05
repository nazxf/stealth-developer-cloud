import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  useNavigate,
  useLocation,
  useParams,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Plus, Server, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { ProjectShellNavigation } from "./project-shell";

function LoadingState({ label = "Loading Stealth…" }: { label?: string }) {
  return (
    <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">
      {label}
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Unable to load this view.";
  return (
    <div className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-text)]" role="alert">
      <p className="m-0 font-semibold">Something went wrong</p>
      <p className="m-0 mt-2 text-[var(--projects-muted)]">{message}</p>
    </div>
  );
}

function RootLayout() {
  const accountQuery = useQuery({ queryKey: ["account"], queryFn: browserAPI.currentAccount });
  const account = accountQuery.data?.account;
  const location = useLocation();
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? decodeURIComponent(projectMatch[1]) : null;

  return (
    <div className="min-h-dvh bg-[var(--projects-bg)] text-[var(--projects-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--projects-border)] bg-[color-mix(in_srgb,var(--projects-bg)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em]" aria-label="Stealth home">
            <img src="/stealth-mark.png" alt="" className="size-7" />
            <span>Stealth</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Main navigation">
            <Link to="/" activeProps={{ className: "bg-[var(--projects-control)] text-[var(--projects-text)]" }} className="rounded-md px-3 py-1.5 text-[var(--projects-muted)] hover:text-[var(--projects-text)]">Projects</Link>
            <Link to="/agent" activeProps={{ className: "bg-[var(--projects-control)] text-[var(--projects-text)]" }} className="rounded-md px-3 py-1.5 text-[var(--projects-muted)] hover:text-[var(--projects-text)]">Agents</Link>
            <Link to="/admin" activeProps={{ className: "bg-[var(--projects-control)] text-[var(--projects-text)]" }} className="rounded-md px-3 py-1.5 text-[var(--projects-muted)] hover:text-[var(--projects-text)]">Admin</Link>
            {account ? <><span className="ml-2 hidden max-w-52 truncate text-xs text-[var(--projects-muted)] sm:inline">{account.email}</span><LogoutControl /></> : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{projectId ? <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8"><ProjectShellNavigation projectId={projectId} /><div className="min-w-0"><Outlet /></div></div> : <Outlet />}</main>
    </div>
  );
}

function LogoutControl() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await browserAPI.logout();
      await queryClient.clear();
      await navigate({ to: "/login", replace: true });
    } finally {
      setPending(false);
    }
  }
  return <button type="button" onClick={() => void logout()} disabled={pending} className="ml-2 inline-flex items-center rounded-md border border-[var(--projects-border)] px-2.5 py-1.5 text-xs text-[var(--projects-muted)] hover:text-[var(--projects-text)] disabled:opacity-60">{pending ? "…" : "Log out"}</button>;
}

function LoginRoute() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await browserAPI.login({ email: email.trim(), password });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await navigate({ to: "/" });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
      <form onSubmit={submit} className="w-full rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6 shadow-2xl" noValidate>
        <div className="mb-6 text-center"><img src="/stealth-mark.png" alt="Stealth" className="mx-auto size-12" /><h1 className="m-0 mt-4 text-2xl font-semibold">Sign in to Stealth</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Manage projects, deployments, and observability.</p></div>
        <label className="block text-sm font-medium" htmlFor="vite-login-email">Email</label>
        <input id="vite-login-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
        <label className="mt-4 block text-sm font-medium" htmlFor="vite-login-password">Password</label>
        <input id="vite-login-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
        {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
        <button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

function SignupRoute() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await browserAPI.register({ email: email.trim(), password, organization_name: organizationName.trim() || undefined });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await navigate({ to: "/" });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Unable to create the account. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
      <form onSubmit={submit} className="w-full rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6 shadow-2xl" noValidate>
        <div className="mb-6 text-center"><img src="/stealth-mark.png" alt="Stealth" className="mx-auto size-12" /><h1 className="m-0 mt-4 text-2xl font-semibold">Create your Stealth account</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">A personal organization is created with your account.</p></div>
        <label className="block text-sm font-medium" htmlFor="vite-signup-email">Email</label>
        <input id="vite-signup-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
        <label className="mt-4 block text-sm font-medium" htmlFor="vite-signup-password">Password</label>
        <input id="vite-signup-password" required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
        <label className="mt-4 block text-sm font-medium" htmlFor="vite-signup-organization">Organization name <span className="font-normal text-[var(--projects-muted)]">(optional)</span></label>
        <input id="vite-signup-organization" autoComplete="organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
        {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
        <button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
        <p className="m-0 mt-4 text-center text-sm text-[var(--projects-muted)]">Already have an account? <Link to="/login" className="text-[var(--projects-accent)] hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}

function ForgotPasswordRoute() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      await browserAPI.requestPasswordRecovery({ email: email.trim(), url: `${window.location.origin}/reset-password` });
      setMessage("If an account exists for that email, a reset link has been sent.");
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Unable to request a reset link.");
    } finally {
      setPending(false);
    }
  }
  return <AuthCard title="Reset your password" detail="We will send a one-time link if the account exists."><form onSubmit={submit} noValidate><label className="block text-sm font-medium" htmlFor="vite-recovery-email">Email</label><input id="vite-recovery-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />{error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}{message ? <p className="mt-3 text-sm text-[var(--projects-accent)]" role="status">{message}</p> : null}<button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{pending ? "Sending…" : "Send reset link"}</button><p className="m-0 mt-4 text-center text-sm text-[var(--projects-muted)]"><Link to="/login" className="text-[var(--projects-accent)] hover:underline">Back to sign in</Link></p></form></AuthCard>;
}

function ResetPasswordRoute() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setError("This reset link is missing its token."); return; }
    setPending(true);
    setError("");
    try {
      await browserAPI.resetPassword({ token, password });
      await navigate({ to: "/login" });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Unable to reset the password.");
    } finally {
      setPending(false);
    }
  }
  return <AuthCard title="Choose a new password" detail="The reset link can only be used once."><form onSubmit={submit} noValidate><label className="block text-sm font-medium" htmlFor="vite-reset-password">New password</label><input id="vite-reset-password" required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />{error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}<button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{pending ? "Saving…" : "Save password"}</button></form></AuthCard>;
}

function VerifyEmailRoute() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Confirming your email…");
  useEffect(() => {
    if (!token) { setState("error"); setMessage("This verification link is missing its token."); return; }
    void browserAPI.verifyEmail(token).then(() => { setState("success"); setMessage("Email verified. You can return to the console."); }).catch((error: unknown) => { setState("error"); setMessage(error instanceof BrowserAPIError ? error.message : "Unable to verify this link."); });
  }, [token]);
  return <AuthCard title="Email verification" detail=""><p className={state === "success" ? "text-[var(--projects-accent)]" : state === "error" ? "text-[var(--projects-danger)]" : "text-[var(--projects-muted)]"} role={state === "error" ? "alert" : "status"}>{message}</p><Link to="/" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--projects-accent-strong)] text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]">Open console</Link></AuthCard>;
}

function AcceptInvitationRoute() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Accepting invitation…");
  useEffect(() => {
    if (!token) { setState("error"); setMessage("This invitation link is missing its token."); return; }
    void browserAPI.acceptInvitation(token).then(() => { setState("success"); setMessage("Invitation accepted. The organization is now available in your Console."); }).catch((error: unknown) => { setState("error"); setMessage(error instanceof BrowserAPIError ? error.message : "Unable to accept this invitation."); });
  }, [token]);
  return <AuthCard title="Organization invitation" detail=""><p className={state === "success" ? "text-[var(--projects-accent)]" : state === "error" ? "text-[var(--projects-danger)]" : "text-[var(--projects-muted)]"} role={state === "error" ? "alert" : "status"}>{message}</p><Link to="/" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--projects-accent-strong)] text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]">Open console</Link></AuthCard>;
}

function AuthCard({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center"><div className="w-full rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6 shadow-2xl"><div className="mb-6 text-center"><img src="/stealth-mark.png" alt="Stealth" className="mx-auto size-12" /><h1 className="m-0 mt-4 text-2xl font-semibold">{title}</h1>{detail ? <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p> : null}</div>{children}</div></div>;
}

function ProjectsRoute() {
  const accountQuery = useQuery({ queryKey: ["account"], queryFn: browserAPI.currentAccount });
  const organizationsQuery = useQuery({ queryKey: ["organizations"], queryFn: () => browserAPI.organizations({ limit: 100 }) });
  const [activeOrganizationID, setActiveOrganizationID] = useState<string>();
  const [newProjectName, setNewProjectName] = useState("");
  const [createError, setCreateError] = useState("");
  const selectedOrganization = organizationsQuery.data?.organizations.find((organization) => organization.id === activeOrganizationID) ?? organizationsQuery.data?.organizations[0];
  const projectsQuery = useQuery({
    queryKey: ["projects", selectedOrganization?.id],
    queryFn: () => browserAPI.projects(selectedOrganization!.id, { limit: 100 }),
    enabled: Boolean(selectedOrganization),
  });

  if (accountQuery.isPending || organizationsQuery.isPending) return <LoadingState />;
  if (accountQuery.error instanceof BrowserAPIError && accountQuery.error.status === 401) return <LoginRedirect />;
  if (accountQuery.error) return <ErrorState error={accountQuery.error} />;
  if (organizationsQuery.error) return <ErrorState error={organizationsQuery.error} />;
  if (!selectedOrganization) return <EmptyState title="No organizations yet" detail="Create an organization through the API to start a project." />;
  const organization = selectedOrganization;

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = newProjectName.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalizedName)) {
      setCreateError("Use 2–63 lowercase letters, numbers, or hyphens.");
      return;
    }
    setCreateError("");
    try {
      await browserAPI.createProject(organization.id, { name: normalizedName });
      setNewProjectName("");
      await queryClient.invalidateQueries({ queryKey: ["projects", organization.id] });
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : "Unable to create the project.");
    }
  }

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6">
        <div><p className="m-0 text-xs font-medium uppercase tracking-[0.12em] text-[var(--projects-muted)]">Console</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Projects</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Deploy and operate your services from one control plane.</p></div>
        <label className="text-sm text-[var(--projects-muted)]">Organization<select value={selectedOrganization.id} onChange={(event) => setActiveOrganizationID(event.target.value)} className="mt-1 block h-10 min-w-48 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]"><option value="" disabled>Select organization</option>{organizationsQuery.data?.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
      </header>
      <form onSubmit={createProject} className="mt-6 flex flex-wrap gap-2" noValidate><label htmlFor="new-vite-project" className="sr-only">Project name</label><input id="new-vite-project" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="new-project" className="h-10 min-w-56 flex-1 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /><button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={16} aria-hidden="true" />New project</button></form>
      {createError ? <p className="mt-2 text-sm text-[var(--projects-danger)]" role="alert">{createError}</p> : null}
      {projectsQuery.isPending ? <div className="mt-6"><LoadingState label="Loading projects…" /></div> : projectsQuery.error ? <div className="mt-6"><ErrorState error={projectsQuery.error} /></div> : projectsQuery.data?.projects.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{projectsQuery.data.projects.map((project) => <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 transition-colors hover:border-[var(--projects-border-hover)]"><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--projects-border-hover)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Server size={18} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-semibold">{project.name}</span><span className="mt-1 block truncate text-xs text-[var(--projects-muted)]">{project.id}</span></span></div><p className="m-0 mt-5 text-xs text-[var(--projects-muted)]">Created {new Date(project.created_at).toLocaleDateString()}</p></Link>)}</div> : <EmptyState title="No projects in this organization" detail="Use the form above to create your first project." />}
    </section>
  );
}

function LoginRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/login", replace: true });
  }, [navigate]);
  return <LoadingState label="Redirecting to sign in…" />;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="mt-6 rounded-xl border border-dashed border-[var(--projects-border)] p-12 text-center"><p className="m-0 font-semibold">{title}</p><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p></div>;
}

function ProjectRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => browserAPI.project(projectId) });
  const usageQuery = useQuery({ queryKey: ["project-usage", projectId], queryFn: () => browserAPI.projectUsage(projectId) });
  if (projectQuery.isPending) return <LoadingState label="Loading project…" />;
  if (projectQuery.error) return <ErrorState error={projectQuery.error} />;
  const project = projectQuery.data.project;
  if (usageQuery.isPending) return <section><ProjectHeader project={project} /><LoadingState label="Loading project usage…" /></section>;
  if (usageQuery.error) return <section><ProjectHeader project={project} /><ErrorState error={usageQuery.error} /></section>;
  const usage = usageQuery.data.usage;
  const resources = [
    ["auth", "Auth", usage.application_users],
    ["databases", "Databases", usage.database_count],
    ["storage", "Storage", usage.storage_file_count],
    ["functions", "Functions", usage.function_count],
    ["sites", "Sites", usage.site_count],
    ["webhooks", "Webhooks", usage.webhook_delivery_count_7d],
    ["usage", "Usage", null],
    ["messaging", "Messaging", null],
    ["realtime", "Realtime", null],
    ["api-keys", "API keys", null],
    ["settings", "Settings", null],
  ] as const;
  return <section><div className="flex flex-wrap items-end justify-between gap-4"><ProjectHeader project={project} /><Link to="/projects/$projectId/deployments" params={{ projectId }} className="inline-flex h-10 items-center rounded-lg border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]">Open deployments</Link></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{resources.map(([resource, label, count]) => <Link key={resource} to={resource === "messaging" ? "/projects/$projectId/messaging" : resource === "api-keys" ? "/projects/$projectId/api-keys" : resource === "auth" ? "/projects/$projectId/auth" : resource === "webhooks" ? "/projects/$projectId/webhooks" : resource === "realtime" ? "/projects/$projectId/realtime" : resource === "settings" ? "/projects/$projectId/settings" : resource === "usage" ? "/projects/$projectId/usage" : resource === "databases" ? "/projects/$projectId/databases" : resource === "storage" ? "/projects/$projectId/storage" : resource === "functions" ? "/projects/$projectId/functions" : "/projects/$projectId/$resource"} params={{ projectId, resource }} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 transition-colors hover:border-[var(--projects-border-hover)]"><p className="m-0 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-2 font-mono text-2xl font-semibold">{count === null ? "—" : count.toLocaleString()}</p><span className="mt-3 inline-block text-xs text-[var(--projects-accent)]">Open resource →</span></Link>)}</div><div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6"><h2 className="m-0 text-lg font-semibold">Project control plane</h2><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Usage is read from the Go API while each resource route is progressively moved to TanStack Query. No project data is stored in browser localStorage.</p></div></section>;
}

function ProjectHeader({ project }: { project: { name: string; id: string } }) {
  return <><Link to="/" className="text-sm text-[var(--projects-accent)] hover:underline">← All projects</Link><header className="mt-5 border-b border-[var(--projects-border)] pb-6"><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">{project.name}</h1><p className="m-0 mt-2 font-mono text-xs text-[var(--projects-muted)]">{project.id}</p></header></>;
}

function ProjectResourceRoute() {
  const { projectId, resource } = useParams({ from: "/projects/$projectId/$resource" });
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => browserAPI.project(projectId) });
  const resourceQuery = useQuery({ queryKey: ["project-resource", projectId, resource], queryFn: () => browserAPI.projectResource(projectId, resource) });
  if (projectQuery.isPending || resourceQuery.isPending) return <LoadingState label="Loading resource…" />;
  if (projectQuery.error) return <ErrorState error={projectQuery.error} />;
  if (resourceQuery.error) return <ErrorState error={resourceQuery.error} />;
  const payload = resourceQuery.data as Record<string, unknown>;
  const collectionKey = Object.keys(payload).find((key) => Array.isArray(payload[key]));
  const items = collectionKey && Array.isArray(payload[collectionKey]) ? payload[collectionKey] : [];
  return <section><ProjectHeader project={projectQuery.data.project} /><div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">Resource</p><h2 className="m-0 mt-2 text-2xl font-semibold capitalize">{resource.replaceAll("-", " ")}</h2></div><span className="rounded-full border border-[var(--projects-border)] px-3 py-1 text-xs text-[var(--projects-muted)]">{items.length} loaded</span></div>{items.length ? <div className="mt-6 divide-y divide-[var(--projects-divider)]">{items.slice(0, 12).map((item, index) => <div key={typeof item === "object" && item !== null && "id" in item ? String(item.id) : String(index)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{typeof item === "object" && item !== null && "name" in item ? String(item.name) : `Item ${index + 1}`}</span><span className="font-mono text-xs text-[var(--projects-muted)]">{typeof item === "object" && item !== null && "status" in item ? String(item.status) : "managed"}</span></div>)}</div> : <p className="m-0 mt-6 rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-sm text-[var(--projects-muted)]">No {resource.replaceAll("-", " ")} records yet.</p>}</div></section>;
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><span className="inline-flex size-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-accent)]">{icon}</span><p className="m-0 mt-4 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-1 font-mono text-lg">{value}</p></div>;
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <EmptyState title="Page not found" detail="The route you requested does not exist in Stealth Console." />,
});
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: ProjectsRoute });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginRoute });
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/signup", component: SignupRoute });
const forgotPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: "/forgot-password", component: ForgotPasswordRoute });
const resetPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reset-password", component: ResetPasswordRoute });
const verifyEmailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/verify-email", component: VerifyEmailRoute });
const acceptInvitationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/accept-invitation", component: AcceptInvitationRoute });
const agentRoute = createRoute({ getParentRoute: () => rootRoute, path: "/agent", component: lazyRouteComponent(() => import("./agent-route")) });
const agentDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/agent/$agentId", component: lazyRouteComponent(() => import("./agent-detail-route")) });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin", component: lazyRouteComponent(() => import("./admin-route")) });
const adminSectionRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/$section", component: lazyRouteComponent(() => import("./admin-route"), "AdminSectionRoute") });
const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects", component: ProjectsRoute });
const projectRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId", component: ProjectRoute });
const projectDeploymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/deployments", component: lazyRouteComponent(() => import("./deployments-route")) });
const projectUsageRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/usage", component: lazyRouteComponent(() => import("./usage-route")) });
const projectServicesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/services", component: lazyRouteComponent(() => import("./services-route")) });
const projectMessagingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/messaging", component: lazyRouteComponent(() => import("./messaging-route")) });
const projectAPIKeysRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/api-keys", component: lazyRouteComponent(() => import("./api-keys-route")) });
const projectAuthRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/auth", component: lazyRouteComponent(() => import("./auth-route")) });
const projectWebhooksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/webhooks", component: lazyRouteComponent(() => import("./webhooks-route")) });
const projectRealtimeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/realtime", component: lazyRouteComponent(() => import("./realtime-route")) });
const projectSettingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/settings", component: lazyRouteComponent(() => import("./settings-route")) });
const projectDatabasesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/databases", component: lazyRouteComponent(() => import("./databases-route")) });
const projectStorageRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/storage", component: lazyRouteComponent(() => import("./storage-route")) });
const projectFunctionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/functions", component: lazyRouteComponent(() => import("./functions-route")) });
const projectSitesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/sites", component: lazyRouteComponent(() => import("./sites-route")) });
const projectResourceRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects/$projectId/$resource", component: ProjectResourceRoute });
const routeTree = rootRoute.addChildren([indexRoute, loginRoute, signupRoute, forgotPasswordRoute, resetPasswordRoute, verifyEmailRoute, acceptInvitationRoute, agentRoute, agentDetailRoute, adminRoute, adminSectionRoute, projectsRoute, projectRoute, projectDeploymentsRoute, projectUsageRoute, projectServicesRoute, projectMessagingRoute, projectAPIKeysRoute, projectAuthRoute, projectWebhooksRoute, projectRealtimeRoute, projectSettingsRoute, projectDatabasesRoute, projectStorageRoute, projectFunctionsRoute, projectSitesRoute, projectResourceRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
