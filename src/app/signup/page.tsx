import { SignupForm } from "@/features/auth/signup-form";
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] ?? "" : params.next ?? "";
  const nextPath = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <SignupForm nextPath={nextPath} />;
}
