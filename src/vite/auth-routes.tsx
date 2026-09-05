import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { browserAPI, browserAPIErrorMessage } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";
import { LoginForm } from "./login-form";
import { PasswordRecoveryForm, ResetPasswordForm, SignupForm } from "./auth-forms";

export function LoginRoute() {
  const navigate = useNavigate();
  return <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center"><LoginForm onAuthenticated={async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.account() }); await navigate({ to: "/" }); }} /></div>;
}

export function SignupRoute() {
  const navigate = useNavigate();
  return <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center"><div className="w-full"><SignupForm onAuthenticated={async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.account() }); await navigate({ to: "/" }); }} /><p className="m-0 mt-4 text-center text-sm text-[var(--projects-muted)]">Already have an account? <Link to="/login" className="text-[var(--projects-accent)] hover:underline">Sign in</Link></p></div></div>;
}

export function ForgotPasswordRoute() {
  return <AuthCard title="Reset your password" detail="We will send a one-time link if the account exists."><PasswordRecoveryForm resetURL={`${window.location.origin}/reset-password`} /><p className="m-0 mt-4 text-center text-sm text-[var(--projects-muted)]"><Link to="/login" className="text-[var(--projects-accent)] hover:underline">Back to sign in</Link></p></AuthCard>;
}

export function ResetPasswordRoute() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  return <AuthCard title="Choose a new password" detail="The reset link can only be used once."><ResetPasswordForm token={token} onReset={() => navigate({ to: "/login" })} /></AuthCard>;
}

export function VerifyEmailRoute() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Confirming your email…");
  useEffect(() => {
    if (!token) { setState("error"); setMessage("This verification link is missing its token."); return; }
    void browserAPI.verifyEmail(token).then(() => { setState("success"); setMessage("Email verified. You can return to the console."); }).catch((error: unknown) => { setState("error"); setMessage(browserAPIErrorMessage(error, "Unable to verify this link.")); });
  }, [token]);
  return <AuthCard title="Email verification" detail=""><p className={state === "success" ? "text-[var(--projects-accent)]" : state === "error" ? "text-[var(--projects-danger)]" : "text-[var(--projects-muted)]"} role={state === "error" ? "alert" : "status"}>{message}</p><Link to="/" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--projects-accent-strong)] text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]">Open console</Link></AuthCard>;
}

export function AcceptInvitationRoute() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Accepting invitation…");
  useEffect(() => {
    if (!token) { setState("error"); setMessage("This invitation link is missing its token."); return; }
    void browserAPI.acceptInvitation(token).then(() => { setState("success"); setMessage("Invitation accepted. The organization is now available in your Console."); }).catch((error: unknown) => { setState("error"); setMessage(browserAPIErrorMessage(error, "Unable to accept this invitation.")); });
  }, [token]);
  return <AuthCard title="Organization invitation" detail=""><p className={state === "success" ? "text-[var(--projects-accent)]" : state === "error" ? "text-[var(--projects-danger)]" : "text-[var(--projects-muted)]"} role={state === "error" ? "alert" : "status"}>{message}</p><Link to="/" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--projects-accent-strong)] text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]">Open console</Link></AuthCard>;
}

function AuthCard({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center"><div className="w-full rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6 shadow-2xl"><div className="mb-6 text-center"><img src="/stealth-mark.png" alt="Stealth" className="mx-auto size-12" /><h1 className="m-0 mt-4 text-2xl font-semibold">{title}</h1>{detail ? <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p> : null}</div>{children}</div></div>;
}
