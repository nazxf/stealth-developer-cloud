import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; project_id?: string | string[] }> }) {
  const params = await searchParams;
  const value = (input: string | string[] | undefined) => Array.isArray(input) ? input[0] ?? "" : input ?? "";
  return <ResetPasswordForm token={value(params.token)} projectID={value(params.project_id) || undefined} />;
}
