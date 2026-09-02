import type { Agent, AgentTool } from "./types";

export const ALL_TOOLS: AgentTool[] = [
  "Read files",
  "Search code",
  "Edit files",
  "Terminal",
  "Run tests",
  "Git diff",
];

export const AGENT_ROLES: Agent["role"][] = ["General", "Frontend", "Reviewer", "Documentation"];

export const DEFAULT_INSTRUCTIONS = `You are a senior frontend engineer.

Inspect the repository before making changes.
Read project instructions before editing.
Follow the existing design system and project conventions.
Prefer small, focused changes.
Run typecheck after editing.
Do not commit or push changes without approval.`;

export function formatLastActive(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
