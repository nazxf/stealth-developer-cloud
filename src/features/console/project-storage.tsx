"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, Files, FolderPlus, LoaderCircle, Save, Trash2, Upload, X } from "lucide-react";
import type { StorageBucket, StorageFile } from "@/lib/stealth-api";

type ProjectStorageProps = {
  projectId: string;
  initialBuckets: StorageBucket[];
  initialNextCursor: string | null;
  initialCanManage: boolean;
};

type BridgeErrorPayload = { error?: { code?: string; message?: string } };

class StorageBridgeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
  });
  const payload = await response.json().catch(() => null) as T | BridgeErrorPayload | null;
  if (!response.ok) {
    const error = payload as BridgeErrorPayload | null;
    throw new StorageBridgeError(response.status, error?.error?.message ?? "The request could not be completed.");
  }
  return payload as T;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const byteFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const focusable = "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex='-1'])";

type BucketDraft = {
  name: string;
  fileSecurity: boolean;
  read: string;
  create: string;
  update: string;
  delete: string;
  quota: string;
  maxFile: string;
};

const emptyBucketDraft: BucketDraft = {
  name: "",
  fileSecurity: true,
  read: "",
  create: "",
  update: "",
  delete: "",
  quota: "",
  maxFile: "",
};

function storagePath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/storage/buckets${suffix}`;
}

function formatDate(value: string) { return dateFormatter.format(new Date(value)); }
function formatBytes(value: number) { return value === 0 ? "0 B" : `${byteFormatter.format(value)} B`; }
function parsePermissions(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

export function ProjectStorage({ projectId, initialBuckets, initialNextCursor, initialCanManage }: ProjectStorageProps) {
  const router = useRouter();
  const [buckets, setBuckets] = useState(initialBuckets);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [selectedBucketId, setSelectedBucketId] = useState(initialBuckets[0]?.id ?? null);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [filesCursor, setFilesCursor] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<BucketDraft>(emptyBucketDraft);
  const [bucketFileSecurity, setBucketFileSecurity] = useState(true);
  const [bucketRead, setBucketRead] = useState("");
  const [bucketCreate, setBucketCreate] = useState("");
  const [bucketUpdate, setBucketUpdate] = useState("");
  const [bucketDelete, setBucketDelete] = useState("");
  const [bucketQuota, setBucketQuota] = useState("");
  const [bucketMaxFile, setBucketMaxFile] = useState("");
  const [uploadPermissionsOpen, setUploadPermissionsOpen] = useState(false);
  const [uploadRead, setUploadRead] = useState("");
  const [uploadUpdate, setUploadUpdate] = useState("");
  const [uploadDelete, setUploadDelete] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [fileReadDraft, setFileReadDraft] = useState("");
  const [fileUpdateDraft, setFileUpdateDraft] = useState("");
  const [fileDeleteDraft, setFileDeleteDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createDialogRef = useRef<HTMLDivElement>(null);
  const createOpenerRef = useRef<HTMLElement | null>(null);

  const selectedBucket = buckets.find((item) => item.id === selectedBucketId) ?? null;

  useEffect(() => {
    if (!selectedBucketId) {
      setFiles([]);
      setFilesCursor(null);
      setEditingFileId(null);
      return;
    }
    let cancelled = false;
    setLoadingFiles(true);
    setError(null);
    void bridgeJSON<{ files: StorageFile[]; pagination: { next_cursor: string | null } }>(storagePath(projectId, `/${encodeURIComponent(selectedBucketId)}/files?limit=20`))
      .then((result) => {
        if (cancelled) return;
        setFiles(result.files);
        setFilesCursor(result.pagination.next_cursor);
        setEditingFileId(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof StorageBridgeError && reason.status === 401) { router.push("/login"); return; }
        setError(reason instanceof Error ? reason.message : "Files could not be loaded.");
      })
      .finally(() => { if (!cancelled) setLoadingFiles(false); });
    return () => { cancelled = true; };
  }, [projectId, router, selectedBucketId]);

  useEffect(() => {
    if (!selectedBucket) return;
    setBucketFileSecurity(selectedBucket.file_security);
    setBucketRead(selectedBucket.read_permissions.join(", "));
    setBucketCreate(selectedBucket.create_permissions.join(", "));
    setBucketUpdate(selectedBucket.update_permissions.join(", "));
    setBucketDelete(selectedBucket.delete_permissions.join(", "));
    setBucketQuota(String(selectedBucket.quota_bytes));
    setBucketMaxFile(String(selectedBucket.max_file_size_bytes));
  }, [selectedBucket]);

  useEffect(() => {
    if (!createOpen) return;
    const opener = createOpenerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    createOpenerRef.current = opener;
    const frame = requestAnimationFrame(() => createDialogRef.current?.querySelector<HTMLElement>(focusable)?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCreateOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(createDialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? []);
      if (!elements.length) { event.preventDefault(); createDialogRef.current?.focus(); return; }
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus(); }
      if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      createOpenerRef.current?.focus({ preventScroll: true });
      createOpenerRef.current = null;
    };
  }, [createOpen]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedBucket || busy || !canManage) return;
    void upload(file);
  }

  async function upload(file: File) {
    if (!selectedBucket || !canManage) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file, file.name);
    if (uploadPermissionsOpen) {
      form.append("read_permissions", JSON.stringify(parsePermissions(uploadRead)));
      form.append("update_permissions", JSON.stringify(parsePermissions(uploadUpdate)));
      form.append("delete_permissions", JSON.stringify(parsePermissions(uploadDelete)));
    }
    try {
      const result = await bridgeJSON<{ file: StorageFile }>(storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}/files`), { method: "POST", body: form });
      setFiles((current) => [result.file, ...current]);
      setBuckets((current) => current.map((bucket) => bucket.id === selectedBucket.id ? { ...bucket, used_bytes: bucket.used_bytes + result.file.size_bytes } : bucket));
      setUploadRead("");
      setUploadUpdate("");
      setUploadDelete("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) { router.push("/login"); return; }
      setError(reason instanceof Error ? reason.message : "File upload failed.");
    } finally { setBusy(false); }
  }

  async function loadMoreBuckets() {
    if (!nextCursor || busy) return;
    setBusy(true);
    try {
      const result = await bridgeJSON<{ buckets: StorageBucket[]; pagination: { next_cursor: string | null }; can_manage: boolean }>(`${storagePath(projectId)}?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      setBuckets((current) => [...current, ...result.buckets]);
      setNextCursor(result.pagination.next_cursor);
      setCanManage(result.can_manage);
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) router.push("/login");
      else setError(reason instanceof Error ? reason.message : "More buckets could not be loaded.");
    } finally { setBusy(false); }
  }

  async function loadMoreFiles() {
    if (!selectedBucket || !filesCursor || busy || loadingFiles) return;
    setLoadingFiles(true);
    setError(null);
    try {
      const result = await bridgeJSON<{ files: StorageFile[]; pagination: { next_cursor: string | null } }>(storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}/files?limit=20&cursor=${encodeURIComponent(filesCursor)}`));
      setFiles((current) => [...current, ...result.files]);
      setFilesCursor(result.pagination.next_cursor);
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) { router.push("/login"); return; }
      setError(reason instanceof Error ? reason.message : "More files could not be loaded.");
    } finally { setLoadingFiles(false); }
  }

  async function createBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const payload = {
      name: createDraft.name.trim(),
      file_security: createDraft.fileSecurity,
      create_permissions: parsePermissions(createDraft.create),
      read_permissions: parsePermissions(createDraft.read),
      update_permissions: parsePermissions(createDraft.update),
      delete_permissions: parsePermissions(createDraft.delete),
      ...(createDraft.quota ? { quota_bytes: Number(createDraft.quota) } : {}),
      ...(createDraft.maxFile ? { max_file_size_bytes: Number(createDraft.maxFile) } : {}),
    };
    try {
      const result = await bridgeJSON<{ bucket: StorageBucket }>(storagePath(projectId), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setBuckets((current) => [...current, result.bucket]);
      setSelectedBucketId(result.bucket.id);
      setCreateOpen(false);
      setCreateDraft(emptyBucketDraft);
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) router.push("/login");
      else setError(reason instanceof Error ? reason.message : "Bucket could not be created.");
    } finally { setBusy(false); }
  }

  async function saveBucketSettings() {
    if (!selectedBucket || busy || !canManage) return;
    setBusy(true);
    setError(null);
    const payload = {
      file_security: bucketFileSecurity,
      create_permissions: parsePermissions(bucketCreate),
      read_permissions: parsePermissions(bucketRead),
      update_permissions: parsePermissions(bucketUpdate),
      delete_permissions: parsePermissions(bucketDelete),
      quota_bytes: Number(bucketQuota),
      max_file_size_bytes: Number(bucketMaxFile),
    };
    try {
      const result = await bridgeJSON<{ bucket: StorageBucket }>(storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}`), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setBuckets((current) => current.map((bucket) => bucket.id === result.bucket.id ? result.bucket : bucket));
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) router.push("/login");
      else setError(reason instanceof Error ? reason.message : "Bucket settings could not be saved.");
    } finally { setBusy(false); }
  }

  async function deleteBucket() {
    if (!selectedBucket || busy || !canManage || !window.confirm(`Delete bucket ${selectedBucket.name} and all of its files?`)) return;
    setBusy(true);
    setError(null);
    try {
      await bridgeJSON<null>(storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}`), { method: "DELETE" });
      const remaining = buckets.filter((bucket) => bucket.id !== selectedBucket.id);
      setBuckets(remaining);
      setSelectedBucketId(remaining[0]?.id ?? null);
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) router.push("/login");
      else setError(reason instanceof Error ? reason.message : "Bucket could not be deleted.");
    } finally { setBusy(false); }
  }

  async function deleteFile(file: StorageFile) {
    if (!selectedBucket || busy || !canManage || !window.confirm(`Delete ${file.name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await bridgeJSON<null>(storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}/files/${encodeURIComponent(file.id)}`), { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setBuckets((current) => current.map((bucket) => bucket.id === selectedBucket.id ? { ...bucket, used_bytes: Math.max(0, bucket.used_bytes - file.size_bytes) } : bucket));
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) router.push("/login");
      else setError(reason instanceof Error ? reason.message : "File could not be deleted.");
    } finally { setBusy(false); }
  }

  function startFileEdit(file: StorageFile) {
    if (!canManage || busy) return;
    setEditingFileId(file.id);
    setFileNameDraft(file.name);
    setFileReadDraft(file.read_permissions.join(", "));
    setFileUpdateDraft(file.update_permissions.join(", "));
    setFileDeleteDraft(file.delete_permissions.join(", "));
  }

  function cancelFileEdit() {
    if (busy) return;
    setEditingFileId(null);
  }

  async function saveFileEdit(file: StorageFile) {
    if (!selectedBucket || !canManage || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridgeJSON<{ file: StorageFile }>(storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}/files/${encodeURIComponent(file.id)}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: fileNameDraft.trim(), read_permissions: parsePermissions(fileReadDraft), update_permissions: parsePermissions(fileUpdateDraft), delete_permissions: parsePermissions(fileDeleteDraft) }),
      });
      setFiles((current) => current.map((item) => item.id === result.file.id ? result.file : item));
      setEditingFileId(null);
    } catch (reason: unknown) {
      if (reason instanceof StorageBridgeError && reason.status === 401) router.push("/login");
      else setError(reason instanceof Error ? reason.message : "File settings could not be saved.");
    } finally { setBusy(false); }
  }

  function downloadPath(file: StorageFile) {
    if (!selectedBucket) return "#";
    return storagePath(projectId, `/${encodeURIComponent(selectedBucket.id)}/files/${encodeURIComponent(file.id)}/download`);
  }

  const editingFile = files.find((file) => file.id === editingFileId) ?? null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Storage</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Local, checksum-verified files with transactional bucket quotas and explicit application permissions.</p>
        </div>
        {canManage ? <button type="button" onClick={(event) => { createOpenerRef.current = event.currentTarget; setCreateDraft(emptyBucketDraft); setCreateOpen(true); }} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white"><FolderPlus size={15} aria-hidden="true" />Create bucket</button> : null}
      </header>
      {error ? <div role="alert" className="mt-5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100">{error}</div> : null}

      <div className="mt-7 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3" aria-busy={loadingFiles}>
          <div className="flex items-center justify-between px-2 py-2"><h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Buckets</h2>{loadingFiles ? <><LoaderCircle size={14} className="animate-spin text-[var(--projects-muted)]" aria-hidden="true" /><span role="status" className="sr-only">Loading files</span></> : null}</div>
          {buckets.length ? <div className="space-y-1">{buckets.map((bucket) => <button key={bucket.id} type="button" onClick={() => setSelectedBucketId(bucket.id)} aria-pressed={bucket.id === selectedBucketId} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] ${bucket.id === selectedBucketId ? "bg-[var(--projects-control)] text-[var(--projects-text)]" : "text-[var(--projects-muted)] hover:bg-white/[0.04]"}`}><Files size={14} aria-hidden="true" />{bucket.name}</button>)}</div> : <p className="m-2 text-[13px] leading-5 text-[var(--projects-muted)]">No buckets yet.</p>}
          {nextCursor ? <button type="button" onClick={() => void loadMoreBuckets()} disabled={busy} aria-busy={busy} className="mt-3 w-full rounded-md border border-[var(--projects-border)] px-2 py-2 text-[12px] font-semibold text-[var(--projects-muted)]">Load more buckets</button> : null}
        </aside>

        <div className="min-w-0 space-y-5">
          {selectedBucket ? (
            <div>
              <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">bucket</p><h2 className="m-0 mt-1 text-[20px] font-semibold text-[var(--projects-text)]">{selectedBucket.name}</h2><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">{formatBytes(selectedBucket.used_bytes)} of {formatBytes(selectedBucket.quota_bytes)} used · max file {formatBytes(selectedBucket.max_file_size_bytes)}</p></div>
                  {canManage ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void saveBucketSettings()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[12px] font-semibold text-[var(--projects-text)]"><Save size={14} aria-hidden="true" />Save settings</button><button type="button" onClick={() => void deleteBucket()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-500/30 px-3 text-[12px] font-semibold text-rose-200"><Trash2 size={14} aria-hidden="true" />Delete bucket</button></div> : null}
                </div>
                {canManage ? <div className="mt-5 grid gap-3 md:grid-cols-2"><label className="text-[11px] text-[var(--projects-muted)]">Quota bytes<input type="number" min={1} value={bucketQuota} onChange={(event) => setBucketQuota(event.target.value)} disabled={busy} className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Max file size bytes<input type="number" min={1} value={bucketMaxFile} onChange={(event) => setBucketMaxFile(event.target.value)} disabled={busy} className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="flex items-center gap-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={bucketFileSecurity} onChange={(event) => setBucketFileSecurity(event.target.checked)} disabled={busy} className="accent-[var(--projects-accent)]" />Enable per-file security</label><label className="text-[11px] text-[var(--projects-muted)]">Create permissions<input value={bucketCreate} onChange={(event) => setBucketCreate(event.target.value)} disabled={busy} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Read permissions<input value={bucketRead} onChange={(event) => setBucketRead(event.target.value)} disabled={busy} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Update permissions<input value={bucketUpdate} onChange={(event) => setBucketUpdate(event.target.value)} disabled={busy} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Delete permissions<input value={bucketDelete} onChange={(event) => setBucketDelete(event.target.value)} disabled={busy} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label></div> : null}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Files</h2><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">{files.length} files loaded.</p></div>{canManage ? <div className="flex flex-wrap items-center gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white"><Upload size={14} aria-hidden="true" />Upload file<input ref={fileInputRef} type="file" onChange={onFileChange} disabled={busy} className="sr-only" /></label><button type="button" onClick={() => setUploadPermissionsOpen((value) => !value)} className="h-9 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">{uploadPermissionsOpen ? "Hide file grants" : "File grants"}</button></div> : null}</div>
                {uploadPermissionsOpen && canManage ? <div className="mt-4 grid gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-3"><label className="text-[11px] text-[var(--projects-muted)]">Read<input value={uploadRead} onChange={(event) => setUploadRead(event.target.value)} placeholder="any, users" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Update<input value={uploadUpdate} onChange={(event) => setUploadUpdate(event.target.value)} placeholder="user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Delete<input value={uploadDelete} onChange={(event) => setUploadDelete(event.target.value)} placeholder="user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><p className="m-0 text-[11px] leading-4 text-[var(--projects-muted)] md:col-span-3">For application uploads, anonymous callers must provide all three grant arrays. When per-file security is disabled, bucket permissions are the only file permissions.</p></div> : null}
                {files.length ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[680px] text-left text-[12px]"><caption className="sr-only">Files in {selectedBucket.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[11px] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Name</th><th scope="col" className="px-3 py-2">Type</th><th scope="col" className="px-3 py-2">Size</th><th scope="col" className="px-3 py-2">Checksum</th><th scope="col" className="px-3 py-2">Created</th><th scope="col" className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{files.map((file) => <tr key={file.id}><td className="max-w-[220px] truncate px-3 py-2 font-medium text-[var(--projects-text)]">{file.name}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{file.mime_type}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatBytes(file.size_bytes)}</td><td className="px-3 py-2 font-mono text-[10px] text-[var(--projects-muted)]">{file.checksum_sha256.slice(0, 12)}…</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatDate(file.created_at)}</td><td className="px-3 py-2 text-right"><a href={downloadPath(file)} download={file.name} aria-label={`Download ${file.name}`} className="mr-2 inline-flex rounded border border-[var(--projects-border)] px-2 py-1 text-[11px] text-[var(--projects-text)]"><Download size={12} aria-hidden="true" /></a>{canManage ? <button type="button" onClick={() => void deleteFile(file)} disabled={busy} aria-label={`Delete ${file.name}`} className="rounded border border-rose-500/30 px-2 py-1 text-[11px] text-rose-200"><Trash2 size={12} aria-hidden="true" /></button> : null}</td></tr>)}</tbody></table></div> : <div className="mt-4 grid min-h-[180px] place-items-center rounded-md border border-dashed border-[var(--projects-border)] px-4 py-8 text-center"><div><Files size={24} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-3 text-[13px] text-[var(--projects-muted)]">No files in this bucket yet.</p></div></div>}
                {canManage && files.length ? <div className="mt-4 flex flex-wrap gap-2" aria-label="File editing controls">{files.map((file) => <button key={file.id} type="button" onClick={() => startFileEdit(file)} disabled={busy} className={`rounded-md border px-2.5 py-1.5 text-[11px] ${editingFileId === file.id ? "border-[var(--projects-accent-border)] text-[var(--projects-text)]" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`}>Edit {file.name}</button>)}</div> : null}
                {editingFile ? <form onSubmit={(event) => { event.preventDefault(); void saveFileEdit(editingFile); }} className="mt-4 grid gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-2"><label className="text-[11px] text-[var(--projects-muted)]">File name<input value={fileNameDraft} onChange={(event) => setFileNameDraft(event.target.value)} disabled={busy} required maxLength={255} className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Read permissions<input value={fileReadDraft} onChange={(event) => setFileReadDraft(event.target.value)} disabled={busy} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Update permissions<input value={fileUpdateDraft} onChange={(event) => setFileUpdateDraft(event.target.value)} disabled={busy} placeholder="user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Delete permissions<input value={fileDeleteDraft} onChange={(event) => setFileDeleteDraft(event.target.value)} disabled={busy} placeholder="user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={cancelFileEdit} disabled={busy} className="rounded-md border border-[var(--projects-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy} className="rounded-md bg-[var(--projects-accent-strong)] px-3 py-1.5 text-[11px] font-semibold text-white">Save file</button></div></form> : null}
                {filesCursor ? <button type="button" onClick={() => void loadMoreFiles()} disabled={busy || loadingFiles} className="mt-4 rounded-md border border-[var(--projects-border)] px-3 py-2 text-[12px] font-semibold text-[var(--projects-muted)]">{loadingFiles ? "Loading…" : "Load more files"}</button> : null}
              </div>
            </div>
          ) : <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-12 text-center"><div><Files size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">Create a bucket to begin</h2><p className="m-0 mt-2 text-[13px] text-[var(--projects-muted)]">Storage metadata stays in PostgreSQL while file bytes live under STORAGE_ROOT.</p></div></div>}
        </div>
      </div>

      {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation"><div ref={createDialogRef} role="dialog" aria-modal="true" aria-labelledby="storage-create-title" tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="storage-create-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Create bucket</h2><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Bucket names are lowercase slugs. Empty permission fields deny application access.</p></div><button type="button" onClick={() => setCreateOpen(false)} disabled={busy} aria-label="Close dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createBucket(event)} className="mt-5 space-y-3"><label className="block text-[12px] text-[var(--projects-muted)]">Name<input autoFocus value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-[12px] text-[var(--projects-muted)]">Quota bytes<input type="number" min={1} value={createDraft.quota} onChange={(event) => setCreateDraft((current) => ({ ...current, quota: event.target.value }))} placeholder="Default" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><label className="block text-[12px] text-[var(--projects-muted)]">Max file bytes<input type="number" min={1} value={createDraft.maxFile} onChange={(event) => setCreateDraft((current) => ({ ...current, maxFile: event.target.value }))} placeholder="Default" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label></div><label className="flex items-center gap-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={createDraft.fileSecurity} onChange={(event) => setCreateDraft((current) => ({ ...current, fileSecurity: event.target.checked }))} className="accent-[var(--projects-accent)]" />Enable per-file security</label><div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] text-[var(--projects-muted)]">Create permissions<input value={createDraft.create} onChange={(event) => setCreateDraft((current) => ({ ...current, create: event.target.value }))} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Read permissions<input value={createDraft.read} onChange={(event) => setCreateDraft((current) => ({ ...current, read: event.target.value }))} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Update permissions<input value={createDraft.update} onChange={(event) => setCreateDraft((current) => ({ ...current, update: event.target.value }))} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Delete permissions<input value={createDraft.delete} onChange={(event) => setCreateDraft((current) => ({ ...current, delete: event.target.value }))} placeholder="any, users, user:uuid" className="mt-1 w-full rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1.5 text-[12px] text-[var(--projects-text)]" /></label></div><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={busy} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy} aria-busy={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{busy ? "Creating…" : "Create bucket"}</button></div></form></div></div> : null}
    </section>
  );
}
