import { useState } from "react";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";

export function LogoutButton({ onLoggedOut }: { onLoggedOut: () => Promise<void> | void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await browserAPI.logout();
      await onLoggedOut();
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Unable to sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <span className="inline-flex items-center gap-2"><button type="button" onClick={() => void logout()} disabled={pending} className="ml-2 inline-flex items-center rounded-md border border-[var(--projects-border)] px-2.5 py-1.5 text-xs text-[var(--projects-muted)] hover:text-[var(--projects-text)] disabled:opacity-60">{pending ? "…" : "Log out"}</button>{error ? <span role="alert" className="text-xs text-[var(--projects-danger)]">{error}</span> : null}</span>;
}
