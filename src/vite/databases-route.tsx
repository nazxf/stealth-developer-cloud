import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Database, FolderPlus, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { BrowserAPIError, browserAPI, type BrowserDatabaseTable } from "@/lib/browser-api";
import DatabaseTableWorkspace from "./database-table-workspace";
import { queryClient } from "./query-client";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading databases…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-danger)]">{error instanceof Error ? error.message : "Unable to load databases."}</div>;
}

export default function DatabasesRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/databases" });
  const databasesQuery = useQuery({ queryKey: ["project-databases", projectId], queryFn: () => browserAPI.projectDatabases(projectId, { limit: 100 }) });
  const [selectedDatabaseID, setSelectedDatabaseID] = useState("");
  const [selectedTableID, setSelectedTableID] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [name, setName] = useState("");
  const [tableName, setTableName] = useState("");
  const [pending, setPending] = useState(false);
  const [busyTableID, setBusyTableID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tablesQuery = useQuery({ queryKey: ["database-tables", projectId, selectedDatabaseID], queryFn: () => browserAPI.projectDatabaseTables(projectId, selectedDatabaseID, { limit: 100 }), enabled: Boolean(selectedDatabaseID) });

  const databases = databasesQuery.data?.databases ?? [];
  const selected = databases.find((database) => database.id === selectedDatabaseID);
  const tables = tablesQuery.data?.tables ?? [];
  const selectedTable = tables.find((table) => table.id === selectedTableID);
  const canManage = databasesQuery.data?.can_manage ?? false;

  useEffect(() => {
    const first = databases[0]?.id ?? "";
    if (!selectedDatabaseID || !databases.some((database) => database.id === selectedDatabaseID)) {
      setSelectedDatabaseID(first);
    }
  }, [databases, selectedDatabaseID]);

  useEffect(() => {
    const first = tables[0]?.id ?? "";
    if (!selectedTableID || !tables.some((table) => table.id === selectedTableID)) {
      setSelectedTableID(first);
    }
  }, [selectedTableID, tables]);

  async function createDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setError("Database name must be between 2 and 120 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await browserAPI.createProjectDatabase(projectId, { name: normalizedName });
      setName("");
      setCreateOpen(false);
      setSelectedDatabaseID(response.database.id);
      setSelectedTableID("");
      await queryClient.invalidateQueries({ queryKey: ["project-databases", projectId] });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The database could not be created.");
    } finally {
      setPending(false);
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selectedDatabaseID) return;
    const normalizedName = tableName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setError("Table name must be between 2 and 120 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await browserAPI.createProjectDatabaseTable(projectId, selectedDatabaseID, { name: normalizedName, row_security: true, create_permissions: [], read_permissions: [], update_permissions: [], delete_permissions: [] });
      setTableName("");
      setTableOpen(false);
      setSelectedTableID(response.table.id);
      await queryClient.invalidateQueries({ queryKey: ["database-tables", projectId, selectedDatabaseID] });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The table could not be created.");
    } finally {
      setPending(false);
    }
  }

  async function deleteTable(table: BrowserDatabaseTable) {
    if (busyTableID || !selectedDatabaseID || !window.confirm(`Delete table “${table.name}”?`)) return;
    setBusyTableID(table.id);
    setError("");
    try {
      await browserAPI.deleteProjectDatabaseTable(projectId, selectedDatabaseID, table.id);
      if (selectedTableID === table.id) setSelectedTableID("");
      await queryClient.invalidateQueries({ queryKey: ["database-tables", projectId, selectedDatabaseID] });
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The table could not be deleted.");
    } finally {
      setBusyTableID(null);
    }
  }

  async function deleteDatabase() {
    const database = databases.find((item) => item.id === selectedDatabaseID);
    if (!database || !window.confirm(`Delete database “${database.name}” and its tables?`)) return;
    setPending(true);
    setError("");
    try {
      await browserAPI.deleteProjectDatabase(projectId, database.id);
      await queryClient.invalidateQueries({ queryKey: ["project-databases", projectId] });
      setSelectedDatabaseID("");
      setSelectedTableID("");
    } catch (requestError) {
      setError(requestError instanceof BrowserAPIError ? requestError.message : "The database could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  if (databasesQuery.isPending) return <LoadingState />;
  if (databasesQuery.error) return <ErrorState error={databasesQuery.error} />;
  if (tablesQuery.error) return <ErrorState error={tablesQuery.error} />;

  return <section>
    <Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link>
    <header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6">
      <div>
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Data platform</p>
        <h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Databases</h1>
        <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--projects-muted)]">Create PostgreSQL-backed databases and typed tables. The table workspace manages schema, indexes, permission-filtered rows, and deployment-ready API contracts.</p>
      </div>
      {canManage ? <button type="button" onClick={() => { setError(""); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />Create database</button> : null}
    </header>
    {error ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    <div className="mt-6 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">
        <div className="flex items-center justify-between px-2 py-2"><h2 className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Databases</h2>{databasesQuery.isFetching ? <LoaderCircle size={14} className="animate-spin text-[var(--projects-muted)]" aria-label="Loading" /> : null}</div>
        {databases.length ? <div className="space-y-1">{databases.map((database) => <button key={database.id} type="button" onClick={() => { setSelectedDatabaseID(database.id); setSelectedTableID(""); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${database.id === selectedDatabaseID ? "bg-[var(--projects-control)] text-[var(--projects-text)]" : "text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"}`}><Database size={14} aria-hidden="true" />{database.name}</button>)}</div> : <p className="m-2 text-sm leading-5 text-[var(--projects-muted)]">No databases yet.</p>}
      </aside>
      <div className="min-w-0">
        {selected ? <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">database: {selected.id}</p><h2 className="m-0 mt-1 text-2xl font-semibold">{selected.name}</h2><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Created {formatDate(selected.created_at)}</p></div>
            <div className="flex gap-2">{canManage ? <><button type="button" onClick={() => setTableOpen((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold"><FolderPlus size={14} aria-hidden="true" />{tableOpen ? "Close" : "Create table"}</button><button type="button" onClick={() => void deleteDatabase()} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" />Delete</button></> : null}</div>
          </div>
          {tableOpen ? <form onSubmit={(event) => void createTable(event)} className="mt-4 flex flex-wrap gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3"><label className="min-w-[220px] flex-1 text-xs text-[var(--projects-muted)]">Table name<input required minLength={2} maxLength={120} value={tableName} onChange={(event) => setTableName(event.target.value)} disabled={pending} className="mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 text-sm" placeholder="users" /></label><button type="submit" disabled={pending} className="mt-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}Create</button></form> : null}
          <div className="mt-6"><div className="flex items-center justify-between gap-3"><h3 className="m-0 text-sm font-semibold">Tables</h3><span className="text-xs text-[var(--projects-muted)]">{tables.length} loaded</span></div>
            {tablesQuery.isPending ? <p className="m-0 mt-4 text-sm text-[var(--projects-muted)]">Loading tables…</p> : tables.length ? <div className="mt-3 divide-y divide-[var(--projects-divider)] rounded-lg border border-[var(--projects-border)]">{tables.map((table) => <div key={table.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${table.id === selectedTableID ? "bg-[var(--projects-control)]" : ""}`}><button type="button" onClick={() => setSelectedTableID(table.id)} className="min-w-0 flex-1 text-left"><p className="m-0 font-medium hover:text-[var(--projects-accent)]">{table.name}</p><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{table.row_security ? "Row security enabled" : "Row security disabled"} · created {formatDate(table.created_at)}</p></button>{canManage ? <button type="button" onClick={() => void deleteTable(table)} disabled={busyTableID !== null} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 text-xs text-rose-200 disabled:opacity-50">{busyTableID === table.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}Delete</button> : null}</div>)}</div> : <div className="mt-3 rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-sm text-[var(--projects-muted)]">No tables yet. Create a table to define your schema.</div>}
          </div>
        </div> : <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-8 text-center"><div><Database size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-lg font-semibold">Create a database to begin</h2><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">The Database core stores schemas and rows in PostgreSQL.</p></div></div>}
        {selectedTable ? <DatabaseTableWorkspace key={selectedTable.id} projectID={projectId} databaseID={selectedDatabaseID} table={selectedTable} canManage={canManage} /> : null}
      </div>
    </div>
    {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-database-title" className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-database-title" className="m-0 text-lg font-semibold">Create database</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">A PostgreSQL-backed project database.</p></div><button type="button" onClick={() => { if (!pending) setCreateOpen(false); }} aria-label="Close create database dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createDatabase(event)} className="mt-5"><label className="block text-xs font-medium text-[var(--projects-muted)]">Name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} className="mt-1.5 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" placeholder="main" /></label><div className="mt-5 flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={pending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{pending ? "Creating…" : "Create"}</button></div></form></div></div> : null}
  </section>;
}
