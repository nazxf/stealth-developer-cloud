import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Files, FolderPlus, LoaderCircle, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserStorageBucket, type BrowserStorageFile } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { ErrorState as AsyncErrorState } from "./error-state";

function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
function formatBytes(value: number) { return value === 0 ? "0 B" : `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)} B`; }
function parsePermissions(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function LoadingState() { return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading storage…</div>; }
function ErrorState({ error }: { error: unknown }) { return <AsyncErrorState error={error} fallback="Unable to load storage." />; }

export default function StorageRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/storage" });
  const bucketsQuery = useQuery({ queryKey: ["project-storage-buckets", projectId], queryFn: () => browserAPI.projectStorageBuckets(projectId, { limit: 100 }) });
  const [selectedBucketID, setSelectedBucketID] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const [bucketQuota, setBucketQuota] = useState("");
  const [bucketMaxFile, setBucketMaxFile] = useState("");
  const [fileSecurity, setFileSecurity] = useState(true);
  const [readPermissions, setReadPermissions] = useState("");
  const [createPermissions, setCreatePermissions] = useState("");
  const [updatePermissions, setUpdatePermissions] = useState("");
  const [deletePermissions, setDeletePermissions] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buckets = bucketsQuery.data?.buckets ?? [];
  const selectedBucket = buckets.find((bucket) => bucket.id === selectedBucketID);
  const filesQuery = useQuery({ queryKey: ["storage-files", projectId, selectedBucketID], queryFn: () => browserAPI.projectStorageFiles(projectId, selectedBucketID, { limit: 100 }), enabled: Boolean(selectedBucketID) });
  const canManage = bucketsQuery.data?.can_manage ?? false;

  useEffect(() => {
    const first = buckets[0]?.id ?? "";
    if (!selectedBucketID || !buckets.some((bucket) => bucket.id === selectedBucketID)) setSelectedBucketID(first);
  }, [buckets, selectedBucketID]);
  useEffect(() => {
    if (!selectedBucket) return;
    setFileSecurity(selectedBucket.file_security);
    setBucketQuota(String(selectedBucket.quota_bytes));
    setBucketMaxFile(String(selectedBucket.max_file_size_bytes));
    setReadPermissions(selectedBucket.read_permissions.join(", "));
    setCreatePermissions(selectedBucket.create_permissions.join(", "));
    setUpdatePermissions(selectedBucket.update_permissions.join(", "));
    setDeletePermissions(selectedBucket.delete_permissions.join(", "));
  }, [selectedBucket]);

  async function createBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const normalizedName = bucketName.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalizedName)) { setError("Bucket name must use 2–63 lowercase letters, numbers, or hyphens."); return; }
    setPending(true); setError("");
    try {
      const response = await browserAPI.createProjectStorageBucket(projectId, { name: normalizedName, file_security: true });
      setBucketName(""); setCreateOpen(false); setSelectedBucketID(response.bucket.id); await queryClient.invalidateQueries({ queryKey: ["project-storage-buckets", projectId] });
    } catch (requestError) { setError(browserAPIErrorMessage(requestError, "The bucket could not be created.")); } finally { setPending(false); }
  }

  async function saveBucket() {
    if (!selectedBucket || pending) return;
    const quota = Number(bucketQuota); const maxFile = Number(bucketMaxFile);
    if (!Number.isFinite(quota) || !Number.isFinite(maxFile) || quota <= 0 || maxFile <= 0 || maxFile > quota) { setError("Quota and maximum file size must be positive, and max file size cannot exceed quota."); return; }
    setPending(true); setError("");
    try { await browserAPI.updateProjectStorageBucket(projectId, selectedBucket.id, { file_security: fileSecurity, quota_bytes: quota, max_file_size_bytes: maxFile, read_permissions: parsePermissions(readPermissions), create_permissions: parsePermissions(createPermissions), update_permissions: parsePermissions(updatePermissions), delete_permissions: parsePermissions(deletePermissions) }); await queryClient.invalidateQueries({ queryKey: ["project-storage-buckets", projectId] }); } catch (requestError) { setError(browserAPIErrorMessage(requestError, "Bucket settings could not be saved.")); } finally { setPending(false); }
  }

  async function deleteBucket() {
    if (!selectedBucket || pending || !window.confirm(`Delete bucket “${selectedBucket.name}” and its files?`)) return;
    setPending(true); setError("");
    try { await browserAPI.deleteProjectStorageBucket(projectId, selectedBucket.id); await queryClient.invalidateQueries({ queryKey: ["project-storage-buckets", projectId] }); setSelectedBucketID(""); } catch (requestError) { setError(browserAPIErrorMessage(requestError, "The bucket could not be deleted.")); } finally { setPending(false); }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedBucket || pending || !canManage) return;
    const form = new FormData(); form.append("file", file, file.name);
    setPending(true); setError("");
    try { await browserAPI.uploadProjectStorageFile(projectId, selectedBucket.id, form); await Promise.all([queryClient.invalidateQueries({ queryKey: ["storage-files", projectId, selectedBucket.id] }), queryClient.invalidateQueries({ queryKey: ["project-storage-buckets", projectId] })]); } catch (requestError) { setError(browserAPIErrorMessage(requestError, "File upload failed.")); } finally { setPending(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function deleteFile(file: BrowserStorageFile) {
    if (!selectedBucket || pending || !window.confirm(`Delete file “${file.name}”?`)) return;
    setPending(true); setError("");
    try { await browserAPI.deleteProjectStorageFile(projectId, selectedBucket.id, file.id); await Promise.all([queryClient.invalidateQueries({ queryKey: ["storage-files", projectId, selectedBucket.id] }), queryClient.invalidateQueries({ queryKey: ["project-storage-buckets", projectId] })]); } catch (requestError) { setError(browserAPIErrorMessage(requestError, "The file could not be deleted.")); } finally { setPending(false); }
  }

  async function downloadFile(file: BrowserStorageFile) {
    if (!selectedBucket || pending) return;
    setPending(true); setError("");
    try {
      const blob = await browserAPI.downloadProjectStorageFile(projectId, selectedBucket.id, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(browserAPIErrorMessage(requestError, "The file could not be downloaded.")); } finally { setPending(false); }
  }

  if (bucketsQuery.isPending) return <LoadingState />;
  if (bucketsQuery.error || filesQuery.error) return <ErrorState error={bucketsQuery.error ?? filesQuery.error} />;

  return <section><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">File platform</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Storage</h1><p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--projects-muted)]">Manage secure buckets and project files. Storage permissions are enforced by the Go API for every upload and download.</p></div>{canManage ? <button type="button" onClick={() => { setError(""); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><FolderPlus size={15} aria-hidden="true" />Create bucket</button> : null}</header>{error ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}<div className="mt-6 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3"><div className="flex items-center justify-between px-2 py-2"><h2 className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Buckets</h2>{bucketsQuery.isFetching ? <LoaderCircle size={14} className="animate-spin text-[var(--projects-muted)]" aria-label="Loading" /> : null}</div>{buckets.length ? <div className="space-y-1">{buckets.map((bucket) => <button key={bucket.id} type="button" onClick={() => setSelectedBucketID(bucket.id)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${bucket.id === selectedBucketID ? "bg-[var(--projects-control)] text-[var(--projects-text)]" : "text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"}`}><span className="inline-flex min-w-0 items-center gap-2"><Files size={14} aria-hidden="true" /><span className="truncate">{bucket.name}</span></span><span className="text-[10px]">{formatBytes(bucket.used_bytes)}</span></button>)}</div> : <p className="m-2 text-sm text-[var(--projects-muted)]">No buckets yet.</p>}</aside><div className="min-w-0">{selectedBucket ? <><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">bucket: {selectedBucket.id}</p><h2 className="m-0 mt-1 text-2xl font-semibold">{selectedBucket.name}</h2><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{formatBytes(selectedBucket.used_bytes)} of {formatBytes(selectedBucket.quota_bytes)} used · max file {formatBytes(selectedBucket.max_file_size_bytes)}</p></div>{canManage ? <div className="flex gap-2"><button type="button" onClick={() => void saveBucket()} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold disabled:opacity-50"><Save size={13} aria-hidden="true" />Save</button><button type="button" onClick={() => void deleteBucket()} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" />Delete</button></div> : null}</div>{canManage ? <div className="mt-5 grid gap-3 md:grid-cols-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fileSecurity} onChange={(event) => setFileSecurity(event.target.checked)} disabled={pending} className="accent-[var(--projects-accent)]" />File security enabled</label><label className="text-xs text-[var(--projects-muted)]">Quota (bytes)<input type="number" min={1} value={bucketQuota} onChange={(event) => setBucketQuota(event.target.value)} disabled={pending} className="mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label><label className="text-xs text-[var(--projects-muted)]">Max file size (bytes)<input type="number" min={1} value={bucketMaxFile} onChange={(event) => setBucketMaxFile(event.target.value)} disabled={pending} className="mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label>{[["Read", readPermissions, setReadPermissions], ["Create", createPermissions, setCreatePermissions], ["Update", updatePermissions, setUpdatePermissions], ["Delete", deletePermissions, setDeletePermissions]].map(([label, value, setter]) => <label key={label as string} className="text-xs text-[var(--projects-muted)]">{label as string} permissions<input value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} disabled={pending} placeholder="any, users, user:uuid" className="mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 font-mono text-xs" /></label>)}</div> : null}</div><div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="m-0 text-lg font-semibold">Files</h3><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{filesQuery.data?.files.length ?? 0} loaded</p></div>{canManage ? <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Upload size={14} aria-hidden="true" />Upload<input ref={fileInputRef} type="file" onChange={(event) => void uploadFile(event)} disabled={pending} className="sr-only" /></label> : null}</div>{filesQuery.isPending ? <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">Loading files…</p> : filesQuery.data?.files.length ? <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]"><table className="w-full min-w-[620px] text-left text-xs"><caption className="sr-only">Files in {selectedBucket.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Name</th><th scope="col" className="px-3 py-2">Type</th><th scope="col" className="px-3 py-2">Size</th><th scope="col" className="px-3 py-2">Updated</th>{canManage ? <th scope="col" className="px-3 py-2 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{filesQuery.data.files.map((file) => <tr key={file.id}><td className="px-3 py-3"><p className="m-0 font-medium">{file.name}</p><p className="m-0 mt-1 font-mono text-[10px] text-[var(--projects-muted)]">{file.id}</p></td><td className="px-3 py-3 text-[var(--projects-muted)]">{file.mime_type}</td><td className="px-3 py-3 text-[var(--projects-muted)]">{formatBytes(file.size_bytes)}</td><td className="px-3 py-3 text-[var(--projects-muted)]">{formatDate(file.updated_at)}</td>{canManage ? <td className="px-3 py-3 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => void downloadFile(file)} disabled={pending} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--projects-border)] px-2.5 text-[var(--projects-muted)] hover:text-[var(--projects-text)] disabled:opacity-50"><Download size={13} aria-hidden="true" />Download</button><button type="button" onClick={() => void deleteFile(file)} disabled={pending} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" />Delete</button></div></td> : null}</tr>)}</tbody></table></div> : <div className="mt-5 rounded-lg border border-dashed border-[var(--projects-border)] p-10 text-center text-sm text-[var(--projects-muted)]">No files yet. Upload your first project artifact.</div>}</div></> : <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-8 text-center"><div><Files size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-lg font-semibold">Create a bucket to begin</h2><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Buckets enforce quotas and file permissions.</p></div></div>}</div></div>{createOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-bucket-title" className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-bucket-title" className="m-0 text-lg font-semibold">Create bucket</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">A secure file namespace with default project quotas.</p></div><button type="button" onClick={() => { if (!pending) setCreateOpen(false); }} aria-label="Close create bucket dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createBucket(event)} className="mt-5 space-y-4"><label className="block text-xs font-medium text-[var(--projects-muted)]">Name<input required minLength={2} maxLength={63} value={bucketName} onChange={(event) => setBucketName(event.target.value)} disabled={pending} className="mt-1.5 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" placeholder="uploads" /></label><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={pending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <FolderPlus size={14} aria-hidden="true" />}{pending ? "Creating…" : "Create"}</button></div></form></div></div> : null}</section>;
}
