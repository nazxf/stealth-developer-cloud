import { AdminShell } from "@/features/admin/components/admin-shell";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { redirect } from "next/navigation";

/** All /admin routes share the admin-only chrome (separate from customer nav). */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    const { account } = await stealthAPI.currentAccount();
    return <AdminShell accountEmail={account.email}>{children}</AdminShell>;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--projects-bg)] px-6 text-center text-[13px] text-[var(--projects-muted)]">
        Unable to load the admin console. Please try again.
      </main>
    );
  }
}
