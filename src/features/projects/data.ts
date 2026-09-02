import type { Project } from "./types";

export const projects: Project[] = [];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

export function formatProjectDate(iso: string) {
  const date = new Date(iso);
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}

export const usageRows = [
  { label: "Egress", value: "0 GB", limit: "5 GB", percent: 0 },
  { label: "Database size", value: "27 MB", limit: "500 MB", percent: 5.4 },
  { label: "Monthly active users", value: "0", limit: "50,000", percent: 0 },
  { label: "File storage", value: "0 MB", limit: "1 GB", percent: 0 },
] as const;
