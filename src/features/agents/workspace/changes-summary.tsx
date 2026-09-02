import { FileDiff, FilePlus2, FileText } from "lucide-react";
import type { FileChange } from "../types";

/** Diff-style summary card for changes persisted by an execution worker. */
export function ChangesSummary({
  changes,
  onReview,
}: {
  changes: FileChange[];
  onReview?: () => void;
}) {
  const additions = changes.reduce((sum, change) => sum + change.additions, 0);
  const deletions = changes.reduce((sum, change) => sum + change.deletions, 0);

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-[var(--projects-border)] bg-[var(--projects-surface)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--projects-divider)] px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--projects-text)]">
          <FileDiff size={14} strokeWidth={1.8} className="text-[var(--projects-muted)]" aria-hidden="true" />
          {changes.length} {changes.length === 1 ? "file" : "files"} changed
        </span>
        <span className="projects-mono text-[12px] text-[#34d399]">+{additions}</span>
        <span className="projects-mono text-[12px] text-[var(--projects-danger)]">−{deletions}</span>
      </div>

      <ul className="m-0 list-none divide-y divide-[var(--projects-divider)] p-0">
        {changes.map((change) => (
          <li key={change.path} className="flex items-center gap-2.5 px-3.5 py-2">
            {change.status === "added" ? (
              <FilePlus2 size={13} strokeWidth={1.7} className="shrink-0 text-[var(--projects-accent)]" aria-hidden="true" />
            ) : (
              <FileText size={13} strokeWidth={1.7} className="shrink-0 text-[var(--projects-muted)]" aria-hidden="true" />
            )}
            <span className="projects-mono min-w-0 flex-1 truncate text-[12px] text-[var(--projects-text)]">
              {change.path}
            </span>
            <span className="projects-mono shrink-0 text-[11.5px] text-[#34d399]">+{change.additions}</span>
            <span className="projects-mono shrink-0 text-[11.5px] text-[var(--projects-danger)]">−{change.deletions}</span>
          </li>
        ))}
      </ul>

      {onReview && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--projects-divider)] px-3.5 py-2.5">
          <button
            type="button"
            onClick={onReview}
            className="inline-flex h-8 items-center rounded-md border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)]"
          >
            Review Changes
          </button>
        </div>
      )}
    </div>
  );
}
