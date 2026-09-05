import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/start/not-found-page";

/**
 * Keep unknown protected URLs inside the Start hierarchy so the parent auth
 * boundary still runs before the not-found surface is rendered.
 */
export const Route = createFileRoute("/_console/$")({
  component: NotFoundPage,
});
