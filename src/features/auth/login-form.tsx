"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { authFontStyle, errorText, inputBorder, inputBorderError, inputClass, linkClass, submitButton } from "./auth-shared";

type FieldErrors = { email?: string; password?: string; form?: string };

export function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/stealth/sessions/email-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setErrors({ form: payload?.error?.message ?? "Unable to sign in. Please try again." });
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrors({ form: "Unable to reach Stealth. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[#0f0f0f] px-4 py-14 font-medium text-white sm:py-10" style={authFontStyle}>
      <div className="my-auto w-full max-w-[364px]">
        <div className="mb-6 flex justify-center"><img alt="Stealth" src="/stealth-mark.png?v=2" width={56} height={56} className="size-14" /></div>
        <h1 className="m-0 text-center text-2xl font-bold leading-8 tracking-[-0.01em]">Sign in to Stealth</h1>
        <form onSubmit={handleSubmit} noValidate className="mt-7">
          <label htmlFor="login-email" className="mb-1.5 block text-[13.5px] font-medium leading-4">Email</label>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((previous) => ({ ...previous, email: undefined, form: undefined })); }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "login-email-error" : undefined} disabled={submitting} className={`${inputClass} ${errors.email ? inputBorderError : inputBorder}`} />
          {errors.email ? <p id="login-email-error" className={errorText}><CircleAlert size={13} strokeWidth={2} aria-hidden="true" />{errors.email}</p> : null}
          <label htmlFor="login-password" className="mb-1.5 mt-4 block text-[13.5px] font-medium leading-4">Password</label>
          <div className="relative">
            <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((previous) => ({ ...previous, password: undefined, form: undefined })); }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "login-password-error" : undefined} disabled={submitting} className={`${inputClass} pr-11 ${errors.password ? inputBorderError : inputBorder}`} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={submitting} className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#9a9aa2] transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#186cee] disabled:opacity-60">{showPassword ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}</button>
          </div>
          {errors.password ? <p id="login-password-error" className={errorText}><CircleAlert size={13} strokeWidth={2} aria-hidden="true" />{errors.password}</p> : null}
          <div className="mt-2 text-right"><Link href="/forgot-password" className={linkClass}>Forgot password?</Link></div>
          <p aria-live="polite" className="sr-only">{submitting ? "Signing in" : ""}</p>
          {errors.form ? <p role="alert" className={errorText}><CircleAlert size={13} strokeWidth={2} aria-hidden="true" />{errors.form}</p> : null}
          <button type="submit" disabled={submitting} aria-busy={submitting} className={`${submitButton} disabled:cursor-not-allowed disabled:opacity-60`}>{submitting ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-center text-[13.5px] leading-5 text-[#b3b3ba]">Don&apos;t have an account? <Link href={nextPath === "/" ? "/signup" : `/signup?next=${encodeURIComponent(nextPath)}`} className={linkClass}>Sign up</Link></p>
      </div>
    </main>
  );
}
