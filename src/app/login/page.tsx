import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] ?? "" : params.next ?? "";
  const nextPath = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <LoginForm nextPath={nextPath} />;
}
