import { z } from "zod";
import { download, request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";

const projectDatabaseSchema = z.object({ id: z.string(), project_id: z.string(), name: z.string(), created_at: z.string(), updated_at: z.string() });
const databaseTableSchema = z.object({
  id: z.string(),
  database_id: z.string(),
  project_id: z.string(),
  name: z.string(),
  row_security: z.boolean(),
  create_permissions: z.array(z.string()),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseColumnTypeSchema = z.enum(["varchar", "text", "integer", "double", "boolean", "datetime", "json"]);
const databaseColumnSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  key: z.string(),
  type: databaseColumnTypeSchema,
  required: z.boolean(),
  varchar_size: z.number().nullable().optional(),
  default: z.unknown().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseIndexSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  name: z.string(),
  type: z.enum(["key", "unique", "fulltext"]),
  column_keys: z.array(z.string()),
  directions: z.array(z.enum(["asc", "desc"])),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseRelationshipSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  database_id: z.string(),
  source_table_id: z.string(),
  source_column_key: z.string(),
  target_table_id: z.string(),
  type: z.literal("many_to_one"),
  on_delete: z.literal("restrict"),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseBackupSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  database_id: z.string(),
  size_bytes: z.number().int().positive(),
  checksum_sha256: z.string().length(64),
  created_at: z.string(),
});
const databaseBackupRestoreSchema = z.object({
  backup_id: z.string(),
  result: z.object({ tables: z.number().int().nonnegative(), columns: z.number().int().nonnegative(), indexes: z.number().int().nonnegative(), rows: z.number().int().nonnegative(), relationships: z.number().int().nonnegative() }),
});
const databaseRowSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  project_id: z.string(),
  data: z.record(z.string(), z.unknown()),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  creator_project_user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseRowsExportSchema = z.object({ rows: z.array(databaseRowSchema), count: z.number().int().nonnegative() });
const databaseRowsImportSchema = z.object({ rows: z.array(databaseRowSchema), count: z.number().int().positive() });
const databaseRowsTransactionSchema = z.object({ rows: z.array(databaseRowSchema), deleted_ids: z.array(z.string()), count: z.number().int().positive().max(100) });

export type BrowserProjectDatabase = z.infer<typeof projectDatabaseSchema>;
export type BrowserDatabaseTable = z.infer<typeof databaseTableSchema>;
export type BrowserDatabaseColumnType = z.infer<typeof databaseColumnTypeSchema>;
export type BrowserDatabaseColumn = z.infer<typeof databaseColumnSchema>;
export type BrowserDatabaseIndex = z.infer<typeof databaseIndexSchema>;
export type BrowserDatabaseRelationship = z.infer<typeof databaseRelationshipSchema>;
export type BrowserDatabaseBackup = z.infer<typeof databaseBackupSchema>;
export type BrowserDatabaseBackupRestore = z.infer<typeof databaseBackupRestoreSchema>;
export type BrowserDatabaseRow = z.infer<typeof databaseRowSchema>;
export type BrowserDatabaseRowsExport = z.infer<typeof databaseRowsExportSchema>;
export type BrowserDatabaseRowsImportResponse = z.infer<typeof databaseRowsImportSchema>;
export type BrowserDatabaseRowsTransactionResponse = z.infer<typeof databaseRowsTransactionSchema>;

export const databasesAPI = {
  projectDatabases: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases`, query), z.object({ databases: z.array(projectDatabaseSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectDatabase: (projectID: string, input: { name: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/databases`, z.object({ database: projectDatabaseSchema }), { method: "POST", body: JSON.stringify(input) }),
  deleteProjectDatabase: (projectID: string, databaseID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}`, z.undefined(), { method: "DELETE" }),
  projectDatabaseTables: (projectID: string, databaseID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables`, query), z.object({ tables: z.array(databaseTableSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectDatabaseTable: (projectID: string, databaseID: string, input: { name: string; row_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables`, z.object({ table: databaseTableSchema }), { method: "POST", body: JSON.stringify(input) }),
  deleteProjectDatabaseTable: (projectID: string, databaseID: string, tableID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`, z.undefined(), { method: "DELETE" }),
  projectDatabaseColumns: (projectID: string, databaseID: string, tableID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns`, query),
      z.object({ columns: z.array(databaseColumnSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  createProjectDatabaseColumn: (projectID: string, databaseID: string, tableID: string, input: { key: string; type: BrowserDatabaseColumnType; required?: boolean; varchar_size?: number; default?: unknown }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns`,
      z.object({ column: databaseColumnSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseColumn: (projectID: string, databaseID: string, tableID: string, columnID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns/${encodeURIComponent(columnID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
  projectDatabaseIndexes: (projectID: string, databaseID: string, tableID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes`, query),
      z.object({ indexes: z.array(databaseIndexSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  createProjectDatabaseIndex: (projectID: string, databaseID: string, tableID: string, input: { name: string; type: "key" | "unique" | "fulltext"; column_keys: string[]; directions?: Array<"asc" | "desc"> }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes`,
      z.object({ index: databaseIndexSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseIndex: (projectID: string, databaseID: string, tableID: string, indexID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes/${encodeURIComponent(indexID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
  projectDatabaseRelationships: (projectID: string, databaseID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/relationships`, query),
      z.object({ relationships: z.array(databaseRelationshipSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  getProjectDatabaseRelationship: (projectID: string, databaseID: string, relationshipID: string) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/relationships/${encodeURIComponent(relationshipID)}`,
      z.object({ relationship: databaseRelationshipSchema }),
    ),
  createProjectDatabaseRelationship: (projectID: string, databaseID: string, input: { source_table_id: string; source_column_key: string; target_table_id: string; type?: "many_to_one"; on_delete?: "restrict" }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/relationships`,
      z.object({ relationship: databaseRelationshipSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseRelationship: (projectID: string, databaseID: string, relationshipID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/relationships/${encodeURIComponent(relationshipID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
  projectDatabaseBackups: (projectID: string, databaseID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/backups`, query), z.object({ backups: z.array(databaseBackupSchema), pagination: paginationSchema }).passthrough());
  },
  createProjectDatabaseBackup: (projectID: string, databaseID: string, options: { max_rows?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.max_rows !== undefined) params.set("max_rows", String(options.max_rows));
    return request(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/backups${params.toString() ? `?${params.toString()}` : ""}`, z.object({ backup: databaseBackupSchema }), { method: "POST" });
  },
  getProjectDatabaseBackup: (projectID: string, databaseID: string, backupID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/backups/${encodeURIComponent(backupID)}`, z.object({ backup: databaseBackupSchema })),
  downloadProjectDatabaseBackup: (projectID: string, databaseID: string, backupID: string) =>
    download(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/backups/${encodeURIComponent(backupID)}/download`),
  restoreProjectDatabaseBackup: (projectID: string, databaseID: string, backupID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/backups/${encodeURIComponent(backupID)}/restore`, databaseBackupRestoreSchema, { method: "POST" }),
  deleteProjectDatabaseBackup: (projectID: string, databaseID: string, backupID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/backups/${encodeURIComponent(backupID)}`, z.undefined(), { method: "DELETE" }),
  projectDatabaseRows: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; search?: string; search_column?: string; filters?: Record<string, string> } = {}) => {
    const params = paginationParams(options);
    if (options.order_by) params.set("order_by", options.order_by);
    if (options.order_direction) params.set("order_direction", options.order_direction);
    if (options.search) params.set("search", options.search);
    if (options.search_column) params.set("search_column", options.search_column);
    for (const [key, value] of Object.entries(options.filters ?? {})) params.set(`filter.${key}`, value);
    const query = params.toString();
    return request(
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows`, query),
      z.object({ rows: z.array(databaseRowSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  projectDatabaseRowsExport: (projectID: string, databaseID: string, tableID: string, options: { limit?: number } = {}) => {
    const params = new URLSearchParams({ format: "json" });
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/export?${params.toString()}`,
      databaseRowsExportSchema,
    );
  },
  downloadProjectDatabaseRowsCSV: (projectID: string, databaseID: string, tableID: string, options: { limit?: number } = {}) => {
    const params = new URLSearchParams({ format: "csv" });
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    return download(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/export?${params.toString()}`);
  },
  importProjectDatabaseRows: (projectID: string, databaseID: string, tableID: string, input: { rows: Array<{ id?: string; data: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] }> }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/import`,
      databaseRowsImportSchema,
      { method: "POST", body: JSON.stringify(input) },
    ),
  transactProjectDatabaseRows: (projectID: string, databaseID: string, tableID: string, input: { operations: Array<{ action: "create" | "update" | "delete"; id?: string; data?: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] }> }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/transaction`,
      databaseRowsTransactionSchema,
      { method: "POST", body: JSON.stringify(input) },
    ),
  createProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, input: { data: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows`,
      z.object({ row: databaseRowSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  getProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`,
      z.object({ row: databaseRowSchema }),
    ),
  updateProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string, input: Partial<{ data: Record<string, unknown>; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[] }>) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`,
      z.object({ row: databaseRowSchema }),
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
};
