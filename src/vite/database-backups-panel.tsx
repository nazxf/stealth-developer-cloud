import { useQuery } from "@tanstack/react-query";
import { Archive, Download, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserDatabaseBackup } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";

type DatabaseBackupsPanelProps = {
  projectID: string;
  databaseID: string;
  canManage: boolean;
};

const panelClass = "rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(blob: Blob, backupID: string) {
  const objectURL = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectURL;
  link.download = `database-backup-${backupID}.json`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectURL), 0);
}

function BackupRow({
  backup,
  pending,
  onDownload,
  onRestore,
  onDelete,
}: {
  backup: BrowserDatabaseBackup;
  pending: string | null;
  onDownload: (backup: BrowserDatabaseBackup) => void;
  onRestore: (backup: BrowserDatabaseBackup) => void;
  onDelete: (backup: BrowserDatabaseBackup) => void;
}) {
  return <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
    <div className="min-w-0">
      <p className="m-0 truncate font-mono text-xs text-[var(--projects-text)]">{backup.id}</p>
      <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{formatBytes(backup.size_bytes)} · {formatDate(backup.created_at)}</p>
      <p className="m-0 mt-1 truncate font-mono text-[10px] text-[var(--projects-muted)]" title={backup.checksum_sha256}>sha256: {backup.checksum_sha256}</p>
    </div>
    <div className="flex shrink-0 gap-2">
      <button type="button" onClick={() => onDownload(backup)} disabled={pending !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--projects-border)] px-2.5 text-xs font-semibold disabled:opacity-50" aria-label={`Download backup ${backup.id}`}>
        {pending === `download:${backup.id}` ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}Download
      </button>
      <button type="button" onClick={() => onRestore(backup)} disabled={pending !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/35 px-2.5 text-xs font-semibold text-amber-200 disabled:opacity-50" aria-label={`Restore backup ${backup.id}`}>
        {pending === `restore:${backup.id}` ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}Restore
      </button>
      <button type="button" onClick={() => onDelete(backup)} disabled={pending !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 text-xs text-rose-200 disabled:opacity-50" aria-label={`Delete backup ${backup.id}`}>
        {pending === `delete:${backup.id}` ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}Delete
      </button>
    </div>
  </li>;
}

export default function DatabaseBackupsPanel({ projectID, databaseID, canManage }: DatabaseBackupsPanelProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const backupsQuery = useQuery({
    queryKey: queryKeys.databaseBackups(projectID, databaseID),
    queryFn: () => browserAPI.projectDatabaseBackups(projectID, databaseID, { limit: 100 }),
    enabled: canManage,
  });

  if (!canManage) return null;

  const backups = backupsQuery.data?.backups ?? [];

  async function createBackup() {
    if (pending) return;
    setPending("create");
    setError("");
    setMessage("");
    try {
      const response = await browserAPI.createProjectDatabaseBackup(projectID, databaseID);
      await queryClient.invalidateQueries({ queryKey: queryKeys.databaseBackups(projectID, databaseID) });
      setMessage(`Backup ${response.backup.id} created successfully.`);
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "The database backup could not be created."));
    } finally {
      setPending(null);
    }
  }

  async function downloadBackup(backup: BrowserDatabaseBackup) {
    if (pending) return;
    setPending(`download:${backup.id}`);
    setError("");
    setMessage("");
    try {
      const blob = await browserAPI.downloadProjectDatabaseBackup(projectID, databaseID, backup.id);
      downloadBlob(blob, backup.id);
      setMessage(`Backup ${backup.id} downloaded.`);
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "The database backup could not be downloaded."));
    } finally {
      setPending(null);
    }
  }

  async function restoreBackup(backup: BrowserDatabaseBackup) {
    if (pending || !window.confirm(`Restore backup ${backup.id}? This replaces every table, row, index, and relationship in this database.`)) return;
    setPending(`restore:${backup.id}`);
    setError("");
    setMessage("");
    try {
      const response = await browserAPI.restoreProjectDatabaseBackup(projectID, databaseID, backup.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.databaseTables(projectID, databaseID) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.databaseBackups(projectID, databaseID) }),
      ]);
      setMessage(`Restore complete: ${response.result.tables} tables, ${response.result.rows} rows, ${response.result.indexes} indexes.`);
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "The database backup could not be restored."));
    } finally {
      setPending(null);
    }
  }

  async function deleteBackup(backup: BrowserDatabaseBackup) {
    if (pending || !window.confirm(`Delete backup ${backup.id}?`)) return;
    setPending(`delete:${backup.id}`);
    setError("");
    setMessage("");
    try {
      await browserAPI.deleteProjectDatabaseBackup(projectID, databaseID, backup.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.databaseBackups(projectID, databaseID) });
      setMessage(`Backup ${backup.id} deleted.`);
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "The database backup could not be deleted."));
    } finally {
      setPending(null);
    }
  }

  return <section className={`${panelClass} mt-5`} aria-labelledby="database-backups-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><Archive size={17} className="text-[var(--projects-accent)]" aria-hidden="true" /><h3 id="database-backups-title" className="m-0 text-sm font-semibold">Database backups</h3></div>
        <p className="m-0 mt-1 max-w-2xl text-xs leading-5 text-[var(--projects-muted)]">Create a checksummed logical snapshot of this database and restore it atomically when needed. Restore replaces the current schema and data.</p>
      </div>
      <button type="button" onClick={() => void createBackup()} disabled={pending !== null || backupsQuery.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-60">
        {pending === "create" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}Create backup
      </button>
    </div>
    {error ? <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p> : null}
    {message ? <p role="status" className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</p> : null}
    {backupsQuery.isPending ? <p className="m-0 mt-4 text-sm text-[var(--projects-muted)]">Loading backups…</p> : backupsQuery.error ? <p role="alert" className="m-0 mt-4 text-sm text-rose-200">{browserAPIErrorMessage(backupsQuery.error, "Unable to load database backups.")}</p> : backups.length ? <ul className="m-0 mt-4 divide-y divide-[var(--projects-divider)] rounded-lg border border-[var(--projects-border)] p-0">{backups.map((backup) => <BackupRow key={backup.id} backup={backup} pending={pending} onDownload={(item) => void downloadBackup(item)} onRestore={(item) => void restoreBackup(item)} onDelete={(item) => void deleteBackup(item)} />)}</ul> : <div className="mt-4 rounded-lg border border-dashed border-[var(--projects-border)] p-6 text-center text-sm text-[var(--projects-muted)]">No backups yet. Create one before making a risky schema change.</div>}
  </section>;
}
