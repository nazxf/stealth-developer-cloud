import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Columns3, Download, KeyRound, LoaderCircle, Pencil, Plus, Table2, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  browserAPI,
  browserAPIErrorMessage,
  type BrowserDatabaseColumn,
  type BrowserDatabaseColumnType,
  type BrowserDatabaseIndex,
  type BrowserDatabaseRow,
  type BrowserDatabaseTable,
} from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";

type DatabaseTableWorkspaceProps = {
  projectID: string;
  databaseID: string;
  table: BrowserDatabaseTable;
  canManage: boolean;
};

type WorkspaceTab = "rows" | "schema" | "indexes";

const inputClass = "mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm";
const panelClass = "rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5";
const columnTypes: BrowserDatabaseColumnType[] = ["varchar", "text", "integer", "double", "boolean", "datetime", "json"];

export function formatDatabaseCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function parsePermissions(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function errorMessage(error: unknown, fallback: string) {
  return browserAPIErrorMessage(error, fallback);
}

function EmptyPanel({ children }: { children: string }) {
  return <div className="rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-sm text-[var(--projects-muted)]">{children}</div>;
}

export default function DatabaseTableWorkspace({ projectID, databaseID, table, canManage }: DatabaseTableWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("rows");
  const [columnFormOpen, setColumnFormOpen] = useState(false);
  const [indexFormOpen, setIndexFormOpen] = useState(false);
  const [columnKey, setColumnKey] = useState("");
  const [columnType, setColumnType] = useState<BrowserDatabaseColumnType>("text");
  const [columnRequired, setColumnRequired] = useState(false);
  const [columnVarcharSize, setColumnVarcharSize] = useState("255");
  const [columnDefault, setColumnDefault] = useState("");
  const [indexName, setIndexName] = useState("");
  const [indexType, setIndexType] = useState<"key" | "unique">("key");
  const [indexColumnKeys, setIndexColumnKeys] = useState("");
  const [indexDirections, setIndexDirections] = useState("");
  const [rowJSON, setRowJSON] = useState("{\n  \n}");
  const [rowReadPermissions, setRowReadPermissions] = useState("");
  const [rowUpdatePermissions, setRowUpdatePermissions] = useState("");
  const [rowDeletePermissions, setRowDeletePermissions] = useState("");
  const [editingRowID, setEditingRowID] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  const columnsQuery = useQuery({
    queryKey: queryKeys.databaseColumns(projectID, databaseID, table.id),
    queryFn: () => browserAPI.projectDatabaseColumns(projectID, databaseID, table.id, { limit: 100 }),
  });
  const indexesQuery = useQuery({
    queryKey: queryKeys.databaseIndexes(projectID, databaseID, table.id),
    queryFn: () => browserAPI.projectDatabaseIndexes(projectID, databaseID, table.id, { limit: 100 }),
  });
  const rowsQuery = useInfiniteQuery({
    queryKey: queryKeys.databaseRows(projectID, databaseID, table.id),
    initialPageParam: "",
    queryFn: ({ pageParam }) => browserAPI.projectDatabaseRows(projectID, databaseID, table.id, { limit: 50, cursor: pageParam || undefined }),
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
  });

  const columns = columnsQuery.data?.columns ?? [];
  const indexes = indexesQuery.data?.indexes ?? [];
  const rows = rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [];
  const queryError = columnsQuery.error ?? indexesQuery.error ?? rowsQuery.error;
  const columnKeys = useMemo(() => new Set(columns.map((column) => column.key)), [columns]);

  function resetColumnForm() {
    setColumnKey("");
    setColumnType("text");
    setColumnRequired(false);
    setColumnVarcharSize("255");
    setColumnDefault("");
    setColumnFormOpen(false);
  }

  function resetIndexForm() {
    setIndexName("");
    setIndexType("key");
    setIndexColumnKeys("");
    setIndexDirections("");
    setIndexFormOpen(false);
  }

  function resetRowForm() {
    setEditingRowID(null);
    setRowJSON("{\n  \n}");
    setRowReadPermissions("");
    setRowUpdatePermissions("");
    setRowDeletePermissions("");
  }

  async function createColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const key = columnKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,119}$/.test(key)) {
      setError("Column keys must start with a letter or underscore and contain only letters, numbers, and underscores.");
      return;
    }
    if (columnKeys.has(key)) {
      setError(`Column “${key}” already exists.`);
      return;
    }
    const input: {
      key: string;
      type: BrowserDatabaseColumnType;
      required?: boolean;
      varchar_size?: number;
      default?: unknown;
    } = { key, type: columnType, required: columnRequired };
    if (columnType === "varchar") {
      const varcharSize = Number(columnVarcharSize);
      if (!Number.isInteger(varcharSize) || varcharSize < 1 || varcharSize > 10_000) {
        setError("Varchar size must be an integer between 1 and 10,000.");
        return;
      }
      input.varchar_size = varcharSize;
    }
    if (columnDefault.trim()) {
      try {
        input.default = JSON.parse(columnDefault);
      } catch {
        setError("Column default must be one valid JSON value.");
        return;
      }
    }
    setPending("column");
    setError("");
    try {
      await browserAPI.createProjectDatabaseColumn(projectID, databaseID, table.id, input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.databaseColumns(projectID, databaseID, table.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.databaseRows(projectID, databaseID, table.id) }),
      ]);
      resetColumnForm();
    } catch (requestError) {
      setError(errorMessage(requestError, "The column could not be created."));
    } finally {
      setPending(null);
    }
  }

  async function deleteColumn(column: BrowserDatabaseColumn) {
    if (pending || !window.confirm(`Delete column “${column.key}”? Existing row values for this key will be removed.`)) return;
    setPending(`column:${column.id}`);
    setError("");
    try {
      await browserAPI.deleteProjectDatabaseColumn(projectID, databaseID, table.id, column.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.databaseColumns(projectID, databaseID, table.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.databaseRows(projectID, databaseID, table.id) }),
      ]);
    } catch (requestError) {
      setError(errorMessage(requestError, "The column could not be deleted."));
    } finally {
      setPending(null);
    }
  }

  async function createIndex(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const name = indexName.trim();
    const keys = indexColumnKeys.split(",").map((item) => item.trim()).filter(Boolean);
    const directions = indexDirections.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) as Array<"asc" | "desc">;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,119}$/.test(name)) {
      setError("Index names must start with a letter or underscore and contain only letters, numbers, and underscores.");
      return;
    }
    if (!keys.length || keys.some((key) => !columnKeys.has(key))) {
      setError("Every indexed column must be declared in this table.");
      return;
    }
    if (directions.some((direction) => direction !== "asc" && direction !== "desc") || (directions.length > 0 && directions.length !== keys.length)) {
      setError("Directions must be omitted or contain one asc/desc value for every indexed column.");
      return;
    }
    const input: { name: string; type: "key" | "unique"; column_keys: string[]; directions?: Array<"asc" | "desc"> } = { name, type: indexType, column_keys: keys };
    if (directions.length) input.directions = directions;
    setPending("index");
    setError("");
    try {
      await browserAPI.createProjectDatabaseIndex(projectID, databaseID, table.id, input);
      await queryClient.invalidateQueries({ queryKey: queryKeys.databaseIndexes(projectID, databaseID, table.id) });
      resetIndexForm();
    } catch (requestError) {
      setError(errorMessage(requestError, "The index could not be created."));
    } finally {
      setPending(null);
    }
  }

  async function deleteIndex(index: BrowserDatabaseIndex) {
    if (pending || !window.confirm(`Delete index “${index.name}”?`)) return;
    setPending(`index:${index.id}`);
    setError("");
    try {
      await browserAPI.deleteProjectDatabaseIndex(projectID, databaseID, table.id, index.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.databaseIndexes(projectID, databaseID, table.id) });
    } catch (requestError) {
      setError(errorMessage(requestError, "The index could not be deleted."));
    } finally {
      setPending(null);
    }
  }

  function editRow(row: BrowserDatabaseRow) {
    setEditingRowID(row.id);
    setRowJSON(JSON.stringify(row.data, null, 2));
    setRowReadPermissions(row.read_permissions.join(", "));
    setRowUpdatePermissions(row.update_permissions.join(", "));
    setRowDeletePermissions(row.delete_permissions.join(", "));
    setActiveTab("rows");
    setError("");
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(rowJSON);
    } catch {
      setError("Row data must be valid JSON.");
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("Row data must be a JSON object.");
      return;
    }
    const data = parsed as Record<string, unknown>;
    const permissions = {
      read_permissions: parsePermissions(rowReadPermissions),
      update_permissions: parsePermissions(rowUpdatePermissions),
      delete_permissions: parsePermissions(rowDeletePermissions),
    };
    setPending(editingRowID ? `row:${editingRowID}` : "row");
    setError("");
    try {
      if (editingRowID) {
        await browserAPI.updateProjectDatabaseRow(projectID, databaseID, table.id, editingRowID, { data, ...permissions });
      } else {
        await browserAPI.createProjectDatabaseRow(projectID, databaseID, table.id, { data, ...permissions });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.databaseRows(projectID, databaseID, table.id) });
      resetRowForm();
    } catch (requestError) {
      setError(errorMessage(requestError, editingRowID ? "The row could not be updated." : "The row could not be created."));
    } finally {
      setPending(null);
    }
  }

  async function deleteRow(row: BrowserDatabaseRow) {
    if (pending || !window.confirm(`Delete row “${row.id}”?`)) return;
    setPending(`row:${row.id}`);
    setError("");
    try {
      await browserAPI.deleteProjectDatabaseRow(projectID, databaseID, table.id, row.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.databaseRows(projectID, databaseID, table.id) });
      if (editingRowID === row.id) resetRowForm();
    } catch (requestError) {
      setError(errorMessage(requestError, "The row could not be deleted."));
    } finally {
      setPending(null);
    }
  }

  async function exportRows() {
    if (pending) return;
    setPending("export");
    setError("");
    try {
      const blob = await browserAPI.downloadProjectDatabaseRowsCSV(projectID, databaseID, table.id, { limit: 10_000 });
      const objectURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = table.name.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || table.id;
      anchor.href = objectURL;
      anchor.download = `${safeName}-rows.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectURL), 0);
    } catch (requestError) {
      setError(errorMessage(requestError, "The table export could not be downloaded."));
    } finally {
      setPending(null);
    }
  }

  const tabs: Array<{ id: WorkspaceTab; label: string; count: number; icon: typeof Table2 }> = [
    { id: "rows", label: "Rows", count: rows.length, icon: Table2 },
    { id: "schema", label: "Schema", count: columns.length, icon: Columns3 },
    { id: "indexes", label: "Indexes", count: indexes.length, icon: KeyRound },
  ];

  return <section className="mt-5 space-y-5" aria-labelledby="database-table-workspace-title">
    <div className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">table: {table.id}</p>
          <h3 id="database-table-workspace-title" className="m-0 mt-1 text-xl font-semibold">{table.name}</h3>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{table.row_security ? "Row security enabled" : "Row security disabled"} · created {formatDate(table.created_at)}</p>
        </div>
        <span className="rounded-full border border-[var(--projects-border)] px-2.5 py-1 text-xs text-[var(--projects-muted)]">PostgreSQL table</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-1 border-b border-[var(--projects-divider)]" role="tablist" aria-label="Table workspace sections">
        {tabs.map(({ id, label, count, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${activeTab === id ? "border-[var(--projects-accent)] text-[var(--projects-text)]" : "border-transparent text-[var(--projects-muted)] hover:text-[var(--projects-text)]"}`}><Icon size={14} aria-hidden="true" />{label}<span className="rounded-full bg-[var(--projects-control)] px-1.5 py-0.5 text-[10px]">{count}</span></button>)}
      </div>
      {error || queryError ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error || errorMessage(queryError, "Unable to load this table.")}</p> : null}
    </div>

    {activeTab === "schema" ? <div className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="m-0 text-lg font-semibold">Typed columns</h4><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">The API validates every row against this schema.</p></div>{canManage ? <button type="button" onClick={() => { setError(""); setColumnFormOpen((value) => !value); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white"><Plus size={14} aria-hidden="true" />{columnFormOpen ? "Close" : "Add column"}</button> : null}</div>
      {columnFormOpen ? <form onSubmit={(event) => void createColumn(event)} className="mt-4 grid gap-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4 md:grid-cols-2"><label className="text-xs text-[var(--projects-muted)]">Key<input required value={columnKey} onChange={(event) => setColumnKey(event.target.value)} disabled={Boolean(pending)} className={inputClass} placeholder="display_name" /></label><label className="text-xs text-[var(--projects-muted)]">Type<select value={columnType} onChange={(event) => setColumnType(event.target.value as BrowserDatabaseColumnType)} disabled={Boolean(pending)} className={inputClass}>{columnTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="flex items-center gap-2 text-xs text-[var(--projects-muted)]"><input type="checkbox" checked={columnRequired} onChange={(event) => setColumnRequired(event.target.checked)} disabled={Boolean(pending)} className="accent-[var(--projects-accent)]" />Required column</label>{columnType === "varchar" ? <label className="text-xs text-[var(--projects-muted)]">Varchar size<input type="number" min={1} max={10000} value={columnVarcharSize} onChange={(event) => setColumnVarcharSize(event.target.value)} disabled={Boolean(pending)} className={inputClass} /></label> : null}<label className="text-xs text-[var(--projects-muted)] md:col-span-2">Default JSON (optional)<input value={columnDefault} onChange={(event) => setColumnDefault(event.target.value)} disabled={Boolean(pending)} className={`${inputClass} font-mono text-xs`} placeholder={'"draft" or 0'} /></label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={resetColumnForm} disabled={Boolean(pending)} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-xs">Cancel</button><button type="submit" disabled={Boolean(pending)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-60">{pending === "column" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{pending === "column" ? "Creating…" : "Create column"}</button></div></form> : null}
      {columnsQuery.isPending ? <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">Loading columns…</p> : columns.length ? <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]"><table className="w-full min-w-[680px] text-left text-xs"><caption className="sr-only">Columns in {table.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Key</th><th scope="col" className="px-3 py-2">Type</th><th scope="col" className="px-3 py-2">Required</th><th scope="col" className="px-3 py-2">Default</th>{canManage ? <th scope="col" className="px-3 py-2 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{columns.map((column) => <tr key={column.id}><td className="px-3 py-3 font-mono font-medium">{column.key}</td><td className="px-3 py-3 text-[var(--projects-muted)]">{column.type}{column.varchar_size ? `(${column.varchar_size})` : ""}</td><td className="px-3 py-3 text-[var(--projects-muted)]">{column.required ? "yes" : "no"}</td><td className="max-w-[240px] truncate px-3 py-3 font-mono text-[var(--projects-muted)]">{column.default === undefined ? "—" : formatDatabaseCell(column.default)}</td>{canManage ? <td className="px-3 py-3 text-right"><button type="button" onClick={() => void deleteColumn(column)} disabled={Boolean(pending)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" />Delete</button></td> : null}</tr>)}</tbody></table></div> : <div className="mt-5"><EmptyPanel>No typed columns yet. Add a column before creating rows.</EmptyPanel></div>}
    </div> : null}

    {activeTab === "indexes" ? <div className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="m-0 text-lg font-semibold">Indexes</h4><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Filters and ordering require a real key index on the declared column.</p></div>{canManage ? <button type="button" onClick={() => { setError(""); setIndexFormOpen((value) => !value); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white"><Plus size={14} aria-hidden="true" />{indexFormOpen ? "Close" : "Add index"}</button> : null}</div>
      {indexFormOpen ? <form onSubmit={(event) => void createIndex(event)} className="mt-4 grid gap-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4 md:grid-cols-2"><label className="text-xs text-[var(--projects-muted)]">Name<input required value={indexName} onChange={(event) => setIndexName(event.target.value)} disabled={Boolean(pending)} className={inputClass} placeholder="users_email_key" /></label><label className="text-xs text-[var(--projects-muted)]">Kind<select value={indexType} onChange={(event) => setIndexType(event.target.value as "key" | "unique")} disabled={Boolean(pending)} className={inputClass}><option value="key">Key</option><option value="unique">Unique</option></select></label><label className="text-xs text-[var(--projects-muted)] md:col-span-2">Column keys (comma separated)<input required value={indexColumnKeys} onChange={(event) => setIndexColumnKeys(event.target.value)} disabled={Boolean(pending)} className={`${inputClass} font-mono text-xs`} placeholder="email, created_at" /></label><label className="text-xs text-[var(--projects-muted)] md:col-span-2">Directions (optional, comma separated)<input value={indexDirections} onChange={(event) => setIndexDirections(event.target.value)} disabled={Boolean(pending)} className={`${inputClass} font-mono text-xs`} placeholder="asc, desc" /></label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={resetIndexForm} disabled={Boolean(pending)} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-xs">Cancel</button><button type="submit" disabled={Boolean(pending)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-60">{pending === "index" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{pending === "index" ? "Creating…" : "Create index"}</button></div></form> : null}
      {indexesQuery.isPending ? <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">Loading indexes…</p> : indexes.length ? <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]"><table className="w-full min-w-[650px] text-left text-xs"><caption className="sr-only">Indexes on {table.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Name</th><th scope="col" className="px-3 py-2">Kind</th><th scope="col" className="px-3 py-2">Columns</th><th scope="col" className="px-3 py-2">Directions</th>{canManage ? <th scope="col" className="px-3 py-2 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{indexes.map((index) => <tr key={index.id}><td className="px-3 py-3 font-mono font-medium">{index.name}</td><td className="px-3 py-3 text-[var(--projects-muted)]">{index.type}</td><td className="px-3 py-3 font-mono text-[var(--projects-muted)]">{index.column_keys.join(", ")}</td><td className="px-3 py-3 font-mono text-[var(--projects-muted)]">{index.directions.join(", ")}</td>{canManage ? <td className="px-3 py-3 text-right"><button type="button" onClick={() => void deleteIndex(index)} disabled={Boolean(pending)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" />Delete</button></td> : null}</tr>)}</tbody></table></div> : <div className="mt-5"><EmptyPanel>No indexes yet. Add one to enable stable filters and ordering.</EmptyPanel></div>}
    </div> : null}

    {activeTab === "rows" ? <div className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="m-0 text-lg font-semibold">Rows</h4><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Showing up to 50 rows from the permission-filtered API.</p></div><div className="flex flex-wrap gap-2">{canManage ? <button type="button" onClick={() => void exportRows()} disabled={Boolean(pending)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold text-[var(--projects-muted)] hover:text-[var(--projects-text)] disabled:opacity-60">{pending === "export" ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}{pending === "export" ? "Exporting…" : "Download CSV"}</button> : null}{canManage ? <button type="button" onClick={() => { resetRowForm(); setError(""); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white"><Plus size={14} aria-hidden="true" />New row</button> : null}</div></div>
      {canManage ? <form onSubmit={(event) => void saveRow(event)} className="mt-4 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4"><div className="flex items-start justify-between gap-3"><div><h5 className="m-0 text-sm font-semibold">{editingRowID ? "Edit row" : "Create row"}</h5><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Enter a JSON object whose keys match the typed columns.</p></div>{editingRowID ? <button type="button" onClick={resetRowForm} disabled={Boolean(pending)} aria-label="Cancel row edit" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-card-bg)]"><X size={16} aria-hidden="true" /></button> : null}</div><label className="mt-3 block text-xs text-[var(--projects-muted)]">Data<textarea required value={rowJSON} onChange={(event) => setRowJSON(event.target.value)} disabled={Boolean(pending)} className="mt-1 block min-h-32 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3 font-mono text-xs" spellCheck={false} /></label><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-xs text-[var(--projects-muted)]">Read permissions<input value={rowReadPermissions} onChange={(event) => setRowReadPermissions(event.target.value)} disabled={Boolean(pending)} className={`${inputClass} font-mono text-xs`} placeholder="any, users" /></label><label className="text-xs text-[var(--projects-muted)]">Update permissions<input value={rowUpdatePermissions} onChange={(event) => setRowUpdatePermissions(event.target.value)} disabled={Boolean(pending)} className={`${inputClass} font-mono text-xs`} placeholder="users" /></label><label className="text-xs text-[var(--projects-muted)]">Delete permissions<input value={rowDeletePermissions} onChange={(event) => setRowDeletePermissions(event.target.value)} disabled={Boolean(pending)} className={`${inputClass} font-mono text-xs`} placeholder="users" /></label></div><div className="mt-3 flex justify-end"><button type="submit" disabled={Boolean(pending)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-60">{pending?.startsWith("row") ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{pending?.startsWith("row") ? (editingRowID ? "Saving…" : "Creating…") : (editingRowID ? "Save row" : "Create row")}</button></div></form> : null}
      {rowsQuery.isPending ? <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">Loading rows…</p> : rows.length ? <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]"><table className="w-full min-w-[760px] text-left text-xs"><caption className="sr-only">Rows in {table.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">ID</th>{columns.map((column) => <th key={column.id} scope="col" className="px-3 py-2">{column.key}</th>)}{canManage ? <th scope="col" className="px-3 py-2 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{rows.map((row) => <tr key={row.id}><td className="max-w-[180px] truncate px-3 py-3 font-mono text-[10px] text-[var(--projects-muted)]" title={row.id}>{row.id}</td>{columns.map((column) => <td key={column.id} className="max-w-[220px] truncate px-3 py-3" title={formatDatabaseCell(row.data[column.key])}>{formatDatabaseCell(row.data[column.key])}</td>)}{canManage ? <td className="whitespace-nowrap px-3 py-3 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => editRow(row)} disabled={Boolean(pending)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--projects-border)] px-2.5 text-[var(--projects-muted)] disabled:opacity-50"><Pencil size={13} aria-hidden="true" />Edit</button><button type="button" onClick={() => void deleteRow(row)} disabled={Boolean(pending)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" />Delete</button></div></td> : null}</tr>)}</tbody></table></div> : <div className="mt-5"><EmptyPanel>No rows yet. Create the first typed row for this table.</EmptyPanel></div>}
      {rowsQuery.hasNextPage ? <div className="mt-4 flex justify-center"><button type="button" onClick={() => void rowsQuery.fetchNextPage()} disabled={rowsQuery.isFetchingNextPage} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold text-[var(--projects-muted)] hover:text-[var(--projects-text)] disabled:opacity-50">{rowsQuery.isFetchingNextPage ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}{rowsQuery.isFetchingNextPage ? "Loading…" : "Load more rows"}</button></div> : null}
    </div> : null}
  </section>;
}
