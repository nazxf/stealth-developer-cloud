"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authFontStyle, inputBorder, inputClass, linkClass, submitButton } from "./auth-shared";

const emailPattern = /^\S+@\S+\.\S+$/;
const organizationNameMinLength = 2;
const organizationNameMaxLength = 120;
type ErrorPayload = { error?: { message?: string } };

export function SignupForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const organizationName = String(form.get("organization_name") ?? "").trim();
    if (!emailPattern.test(email)) return setError("Enter a valid email address.");
    if (password.length < 12 || password.length > 256) return setError("Password must be between 12 and 256 characters.");
    if (organizationName && (organizationName.length < organizationNameMinLength || organizationName.length > organizationNameMaxLength)) {
      return setError("Organization name must be between 2 and 120 characters.");
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/stealth/account/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, organization_name: organizationName || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        setError(payload?.error?.message ?? "Unable to create the account. Please try again.");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0f0f0f] px-4 text-white" style={authFontStyle}>
      <form onSubmit={submit} noValidate className="w-full max-w-[364px]">
        <h1 className="text-center text-2xl font-bold">Create your Stealth account</h1>
        <label htmlFor="signup-email" className="mt-6 block text-sm">Email<input id="signup-email" required name="email" type="email" autoComplete="email" disabled={pending} className={`${inputClass} ${inputBorder} mt-1.5`} /></label>
        <label htmlFor="signup-password" className="mt-4 block text-sm">Password<input id="signup-password" required name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} disabled={pending} className={`${inputClass} ${inputBorder} mt-1.5`} /></label>
        <label htmlFor="signup-organization" className="mt-4 block text-sm">Organization name <span className="text-[#8b8b92]">(optional)</span><input id="signup-organization" name="organization_name" minLength={organizationNameMinLength} maxLength={organizationNameMaxLength} aria-describedby="signup-organization-help" disabled={pending} className={`${inputClass} ${inputBorder} mt-1.5`} /></label>
        <p id="signup-organization-help" className="mt-1 text-xs text-[#8b8b92]">If provided, use 2–120 characters.</p>
        <p aria-live="polite" className="sr-only">{pending ? "Creating account" : ""}</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
        <button disabled={pending} aria-busy={pending} className={`${submitButton} disabled:cursor-not-allowed disabled:opacity-60`}>{pending ? "Creating account…" : "Create account"}</button>
        <p className="mt-5 text-center text-sm text-[#b3b3ba]">Already have an account? <Link href={nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`} className={linkClass}>Sign in</Link></p>
      </form>
    </main>
  );
}
