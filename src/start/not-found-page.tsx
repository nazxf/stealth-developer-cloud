import { EmptyState } from "@/vite/async-state";

/** Protected fallback for legacy URLs that are not part of the current route tree. */
export function NotFoundPage() {
  return <EmptyState title="Page not found" detail="The route you requested does not exist in Stealth Console." />;
}
