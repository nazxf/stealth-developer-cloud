import type { Metadata } from "next";
import { InvitationAcceptForm } from "@/features/auth/accept-invitation-form";

export const metadata: Metadata = { title: "Accept organization invitation" };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] ?? "" : params.token ?? "";
  return <InvitationAcceptForm token={token} />;
}
