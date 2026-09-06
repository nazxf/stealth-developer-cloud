import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { m, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { BrowserAPIError, browserAPI } from "@/lib/api/browser-api";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/async-state";
import { LogoutButton } from "@/features/auth/logout-button";
import { ProjectShellNavigation } from "@/features/projects/project-shell";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * The protected document layout for the Start route tree.
 *
 * The Go API remains the authority for the session. This component only
 * renders the existing console chrome around route content and uses the same
 * QueryClient/cache as the migrated screens.
 */
export function ConsoleLayout() {
  const accountQuery = useQuery({
    queryKey: queryKeys.account(),
    queryFn: browserAPI.currentAccount,
  });
  const account = accountQuery.data?.account;
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch ? decodeURIComponent(projectMatch[1]) : null;

  if (accountQuery.isPending) return <LoadingState label="Loading session…" />;
  if (accountQuery.error instanceof BrowserAPIError && accountQuery.error.status === 401) {
    return <LoginRedirect />;
  }
  if (accountQuery.error) {
    return (
      <ErrorState
        error={accountQuery.error}
        fallback="Unable to load this view."
        onRetry={() => void accountQuery.refetch()}
      />
    );
  }

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
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <m.div
          key={location.pathname}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
        >
          {projectId ? <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8"><ProjectShellNavigation projectId={projectId} /><div className="min-w-0"><Outlet /></div></div> : <Outlet />}
        </m.div>
      </main>
    </div>
  );
}

function LogoutControl() {
  const navigate = useNavigate();
  return <LogoutButton onLoggedOut={async () => { await queryClient.clear(); await navigate({ to: "/login", replace: true }); }} />;
}

export function LoginRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/login", replace: true });
  }, [navigate]);
  return <LoadingState label="Redirecting to sign in…" />;
}
