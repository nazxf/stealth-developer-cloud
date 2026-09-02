"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { authFontStyle, errorText, linkClass, submitButton } from "./auth-shared";

export function VerifyEmailForm({ token, projectID }: { token: string; projectID?: string }) {
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (pending || verified) return;
    if (!token) return setError("This verification link is missing its token.");
    setPending(true);
    setError("");
    const path = projectID
      ? `/api/stealth/projects/${encodeURIComponent(projectID)}/account/verification`
      : "/api/stealth/account/verification";
    try {
      const response = await fetch(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "This verification link is invalid or expired.");
        return;
      }
      setVerified(true);
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[#0f0f0f] px-4 py-14 font-medium text-white sm:py-10" style={authFontStyle}>
      <div className="my-auto w-full max-w-[364px] text-center">
        {verified ? <><span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#12351f]"><CircleCheck size={26} strokeWidth={1.8} className="text-[#4ade80]" aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-bold">Email verified</h1><p className="mt-2 text-[13.5px] leading-5 text-[#b3b3ba]">Your email address is now verified.</p><Link href="/login" className={`${submitButton} inline-flex`}>Back to sign in</Link></> : <><h1 className="text-2xl font-bold">Verify your email</h1><p className="mt-2 text-[13.5px] leading-5 text-[#b3b3ba]">Confirm your email address to finish setting up your account.</p>{error ? <p role="alert" className={`${errorText} justify-center`}><CircleAlert size={13} strokeWidth={2} aria-hidden="true" />{error}</p> : null}<button type="button" onClick={verify} disabled={pending || !token} aria-busy={pending} className={`${submitButton} disabled:cursor-not-allowed disabled:opacity-60`}>{pending ? "Verifying…" : "Verify email"}</button><p className="mt-5 text-[13.5px] text-[#b3b3ba]"><Link href="/login" className={linkClass}>Back to sign in</Link></p></>}
      </div>
    </main>
  );
}
