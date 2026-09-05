import { useState, type FormEvent } from "react";
import { z } from "zod";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";

const loginInputSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export function LoginForm({ onAuthenticated }: { onAuthenticated: () => Promise<void> | void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = loginInputSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your email and password.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.login(parsed.data);
      await onAuthenticated();
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="w-full rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6 shadow-2xl" noValidate>
      <div className="mb-6 text-center"><img src="/stealth-mark.png" alt="Stealth" className="mx-auto size-12" /><h1 className="m-0 mt-4 text-2xl font-semibold">Sign in to Stealth</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Manage projects, deployments, and observability.</p></div>
      <label className="block text-sm font-medium" htmlFor="vite-login-email">Email</label>
      <input id="vite-login-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
      <label className="mt-4 block text-sm font-medium" htmlFor="vite-login-password">Password</label>
      <input id="vite-login-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
      {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
