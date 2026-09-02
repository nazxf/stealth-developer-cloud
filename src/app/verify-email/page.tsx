import type { Metadata } from "next";
import { VerifyEmailForm } from "@/features/auth/verify-email-form";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; project_id?: string | string[] }> }) {
  const params = await searchParams;
  const value = (input: string | string[] | undefined) => Array.isArray(input) ? input[0] ?? "" : input ?? "";
  return <VerifyEmailForm token={value(params.token)} projectID={value(params.project_id) || undefined} />;
}
