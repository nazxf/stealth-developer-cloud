import { useState, type FormEvent } from "react";
import { z } from "zod";
import { browserAPI, browserAPIErrorMessage } from "@/lib/browser-api";

const signupInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(12, "Password must be at least 12 characters.").max(256, "Password must be 256 characters or fewer."),
  organizationName: z.string().trim().max(120, "Organization name must be 120 characters or fewer.").optional(),
});

const emailInputSchema = z.object({ email: z.string().trim().email("Enter a valid email address.") });
const passwordInputSchema = z.object({ password: z.string().min(12, "Password must be at least 12 characters.").max(256, "Password must be 256 characters or fewer.") });

function firstValidationMessage(result: { success: false; error: z.ZodError }) {
  return result.error.issues[0]?.message ?? "Please check the form and try again.";
}

function apiError(error: unknown, fallback: string) {
  return browserAPIErrorMessage(error, fallback);
}

export function SignupForm({ onAuthenticated }: { onAuthenticated: () => Promise<void> | void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = signupInputSchema.safeParse({ email, password, organizationName: organizationName.trim() || undefined });
    if (!parsed.success) {
      setError(firstValidationMessage(parsed));
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.register({ email: parsed.data.email, password: parsed.data.password, organization_name: parsed.data.organizationName || undefined });
      await onAuthenticated();
    } catch (requestError) {
      setError(apiError(requestError, "Unable to create the account. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="w-full rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6 shadow-2xl" noValidate>
    <div className="mb-6 text-center"><img src="/stealth-mark.png" alt="Stealth" className="mx-auto size-12" /><h1 className="m-0 mt-4 text-2xl font-semibold">Create your Stealth account</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">A personal organization is created with your account.</p></div>
    <label className="block text-sm font-medium" htmlFor="vite-signup-email">Email</label>
    <input id="vite-signup-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
    <label className="mt-4 block text-sm font-medium" htmlFor="vite-signup-password">Password</label>
    <input id="vite-signup-password" required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
    <p className="m-0 mt-1.5 text-xs text-[var(--projects-muted)]">Use 12–256 characters.</p>
    <label className="mt-4 block text-sm font-medium" htmlFor="vite-signup-organization">Organization name <span className="font-normal text-[var(--projects-muted)]">(optional)</span></label>
    <input id="vite-signup-organization" maxLength={120} autoComplete="organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} disabled={pending} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
    {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
    <button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
  </form>;
}

export function PasswordRecoveryForm({ resetURL }: { resetURL: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = emailInputSchema.safeParse({ email });
    if (!parsed.success) {
      setError(firstValidationMessage(parsed));
      setMessage("");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      await browserAPI.requestPasswordRecovery({ email: parsed.data.email, url: resetURL });
      setMessage("If an account exists for that email, a reset link has been sent.");
    } catch (requestError) {
      setError(apiError(requestError, "Unable to request a reset link."));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} noValidate>
    <label className="block text-sm font-medium" htmlFor="vite-recovery-email">Email</label>
    <input id="vite-recovery-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
    {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
    {message ? <p className="mt-3 text-sm text-[var(--projects-accent)]" role="status">{message}</p> : null}
    <button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{pending ? "Sending…" : "Send reset link"}</button>
  </form>;
}

export function ResetPasswordForm({ token, onReset }: { token: string; onReset: () => Promise<void> | void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }
    const parsed = passwordInputSchema.safeParse({ password });
    if (!parsed.success) {
      setError(firstValidationMessage(parsed));
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.resetPassword({ token, password: parsed.data.password });
      await onReset();
    } catch (requestError) {
      setError(apiError(requestError, "Unable to reset the password."));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} noValidate>
    <label className="block text-sm font-medium" htmlFor="vite-reset-password">New password</label>
    <input id="vite-reset-password" required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
    <p className="m-0 mt-1.5 text-xs text-[var(--projects-muted)]">Use 12–256 characters.</p>
    {error ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
    <button type="submit" disabled={pending} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{pending ? "Saving…" : "Save password"}</button>
  </form>;
}
