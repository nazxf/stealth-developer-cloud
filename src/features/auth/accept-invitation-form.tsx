"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleAlert, CircleCheck, MailPlus } from "lucide-react";
import { authFontStyle, errorText, linkClass, submitButton } from "./auth-shared";

type Membership = { organization_id: string; account_id: string; email: string; role: string; created_at: string };

export function InvitationAcceptForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const nextPath = `/accept-invitation?token=${encodeURIComponent(token)}`;
  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;
  const signupPath = `/signup?next=${encodeURIComponent(nextPath)}`;

  async function accept() {
    if (pending || membership) return;
    if (!token) {
      setError("This invitation link is missing its token.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/stealth/organization-invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => null) as { membership?: Membership; error?: { code?: string; message?: string } } | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? (response.status === 401 ? "Sign in with the invited email to accept this invitation." : "This invitation link is invalid or expired."));
        return;
      }
      if (!payload?.membership) {
        setError("The invitation was accepted, but no membership was returned.");
        return;
      }
      setMembership(payload.membership);
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[#0f0f0f] px-4 py-14 font-medium text-white sm:py-10" style={authFontStyle}>
      <div className="my-auto w-full max-w-[390px] text-center">
        {membership ? <><span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#12351f]"><CircleCheck size={26} strokeWidth={1.8} className="text-[#4ade80]" aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-bold">Invitation accepted</h1><p className="mt-2 text-[13.5px] leading-5 text-[#b3b3ba]">You now have <span className="font-semibold text-white">{membership.role}</span> access to this organization.</p><Link href={`/?organization=${encodeURIComponent(membership.organization_id)}`} className={`${submitButton} inline-flex items-center justify-center`}>Open Console</Link></> : <><span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#172642]"><MailPlus size={25} strokeWidth={1.8} className="text-[#70a5ff]" aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-bold">Join this organization</h1><p className="mt-2 text-[13.5px] leading-5 text-[#b3b3ba]">Accept the invitation to access a Stealth Console workspace.</p>{error ? <p role="alert" className={`${errorText} justify-center`}><CircleAlert size={13} strokeWidth={2} aria-hidden="true" />{error}</p> : null}<button type="button" onClick={() => void accept()} disabled={pending || !token} aria-busy={pending} className={`${submitButton} disabled:cursor-not-allowed disabled:opacity-60`}>{pending ? "Accepting…" : "Accept invitation"}</button><p className="mt-5 text-[13.5px] leading-5 text-[#b3b3ba]">Already have an account? <Link href={loginPath} className={linkClass}>Sign in</Link><br />New to Stealth? <Link href={signupPath} className={linkClass}>Create an account</Link></p></>}
      </div>
    </main>
  );
}
