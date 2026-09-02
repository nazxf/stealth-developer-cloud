"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import {
  authFontStyle,
  errorText,
  inputBorder,
  inputBorderError,
  inputClass,
  linkClass,
  submitButton,
} from "./auth-shared";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // This page sits outside the ApplicationShell, so it must load React Grab
  // itself to keep the grab overlay available in development.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") void import("react-grab");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(undefined);
    setSubmitting(true);
    try {
      const response = await fetch("/api/stealth/account/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "Unable to send reset instructions. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center bg-[#0f0f0f] px-4 py-14 font-medium text-white sm:py-10"
      style={authFontStyle}
    >
      <div className="my-auto w-full max-w-[364px]">
        {sent ? (
          <div className="flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#12351f]">
              <CircleCheck size={26} strokeWidth={1.8} className="text-[#4ade80]" aria-hidden="true" />
            </span>
            <h1 className="m-0 mt-4 text-2xl font-bold leading-8 tracking-[-0.01em]">Check your email</h1>
            <p className="mt-2 text-[13.5px] leading-5 text-[#b3b3ba]">
              If an account exists for <span className="font-semibold text-white">{email.trim()}</span>, we&apos;ve
              sent a link to reset your password.
            </p>
            <button type="button" onClick={() => router.push("/login")} className={submitButton}>
              Back to sign in
            </button>
            <p className="mt-5 text-[13.5px] leading-5 text-[#b3b3ba]">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button type="button" onClick={() => setSent(false)} className={linkClass}>
                try another email
              </button>
            </p>
          </div>
        ) : (
          <>
            <h1 className="m-0 text-center text-2xl font-bold leading-8 tracking-[-0.01em]">Forgot password?</h1>
            <p className="mt-2 text-center text-[13.5px] leading-5 text-[#b3b3ba]">
              Enter the email associated with your account and we&apos;ll send instructions to reset your password.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-6">
              <label htmlFor="forgot-email" className="mb-1.5 block text-[13.5px] font-medium leading-4">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(undefined);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "forgot-email-error" : undefined}
                className={`${inputClass} ${error ? inputBorderError : inputBorder}`}
              />
              {error && (
                <p id="forgot-email-error" className={errorText}>
                  <CircleAlert size={13} strokeWidth={2} aria-hidden="true" />
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting} aria-busy={submitting} className={submitButton}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-5 text-center text-[13.5px] leading-5 text-[#b3b3ba]">
              Remembered it?{" "}
              <Link href="/login" className={linkClass}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
