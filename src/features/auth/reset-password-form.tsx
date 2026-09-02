"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Eye, EyeOff } from "lucide-react";
import { authFontStyle, errorText, inputBorder, inputBorderError, inputClass, linkClass, submitButton } from "./auth-shared";

export function ResetPasswordForm({ token, projectID }: { token: string; projectID?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!token) return setError("This reset link is missing its token.");
    if (password.length < 12 || password.length > 256) return setError("Password must be between 12 and 256 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setPending(true);
    setError("");
    const path = projectID
      ? `/api/stealth/projects/${encodeURIComponent(projectID)}/account/recovery`
      : "/api/stealth/account/recovery";
    try {
      const response = await fetch(path, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "This reset link is invalid or expired.");
        return;
      }
      setDone(true);
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[#0f0f0f] px-4 py-14 font-medium text-white sm:py-10" style={authFontStyle}>
      <div className="my-auto w-full max-w-[364px]">
        {done ? (
          <div className="flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#12351f]"><CircleCheck size={26} strokeWidth={1.8} className="text-[#4ade80]" aria-hidden="true" /></span>
            <h1 className="m-0 mt-4 text-2xl font-bold leading-8">Password updated</h1>
            <p className="mt-2 text-[13.5px] leading-5 text-[#b3b3ba]">Your password has been changed. Sign in with the new password.</p>
            <button type="button" onClick={() => router.replace("/login")} className={submitButton}>Back to sign in</button>
          </div>
        ) : (
          <>
            <h1 className="m-0 text-center text-2xl font-bold leading-8">Set a new password</h1>
            <p className="mt-2 text-center text-[13.5px] leading-5 text-[#b3b3ba]">Choose a strong password for your Stealth account.</p>
            <form onSubmit={submit} noValidate className="mt-6">
              <label htmlFor="reset-password" className="mb-1.5 block text-[13.5px]">New password</label>
              <div className="relative">
                <input id="reset-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} disabled={pending || !token} className={`${inputClass} pr-11 ${error ? inputBorderError : inputBorder}`} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} disabled={pending} className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#9a9aa2] hover:text-white">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              <label htmlFor="reset-confirmation" className="mb-1.5 mt-4 block text-[13.5px]">Confirm password</label>
              <div className="relative">
                <input id="reset-confirmation" type={showConfirmation ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={256} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} disabled={pending || !token} className={`${inputClass} pr-11 ${error ? inputBorderError : inputBorder}`} />
                <button type="button" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"} disabled={pending} className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#9a9aa2] hover:text-white">{showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              {error ? <p role="alert" className={errorText}><CircleAlert size={13} strokeWidth={2} aria-hidden="true" />{error}</p> : null}
              <button type="submit" disabled={pending || !token} aria-busy={pending} className={`${submitButton} disabled:cursor-not-allowed disabled:opacity-60`}>{pending ? "Updating…" : "Update password"}</button>
            </form>
            <p className="mt-5 text-center text-[13.5px] text-[#b3b3ba]"><Link href="/login" className={linkClass}>Back to sign in</Link></p>
          </>
        )}
      </div>
    </main>
  );
}
