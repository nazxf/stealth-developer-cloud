export type ApplicationUser = {
  id: string;
  project_id: string;
  email: string;
  name: string | null;
  status: "active" | "blocked";
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateApplicationUserInput = {
  email: string;
  password: string;
  name?: string;
};

export type EmailPasswordCredentials = {
  email: string;
  password: string;
};

export type PasswordRecoveryInput = {
  email: string;
  /** Optional redirect page; the API accepts only a trusted project origin. */
  url?: string;
};

export type VerificationInput = {
  /** Optional redirect page; the API accepts only a trusted project origin. */
  url?: string;
};

export type DatabaseRow = {
  id: string;
  table_id: string;
  project_id: string;
  data: Record<string, unknown>;
  read_permissions: string[];
  update_permissions: string[];
  delete_permissions: string[];
  creator_project_user_id?: string;
  created_at: string;
  updated_at: string;
};

export type ApplicationRowInput = {
  data: Record<string, unknown>;
  read_permissions?: string[];
  update_permissions?: string[];
  delete_permissions?: string[];
};

export type DatabaseRowImportInput = ApplicationRowInput & { id?: string };
export type DatabaseRowsExport = { rows: DatabaseRow[]; count: number };
export type DatabaseRowsImportResponse = { rows: DatabaseRow[]; count: number };

export type ApplicationRowPatch = {
  data?: Record<string, unknown>;
};

export type StorageFile = {
  id: string;
  bucket_id: string;
  project_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  read_permissions: string[];
  update_permissions: string[];
  delete_permissions: string[];
  creator_project_user_id?: string;
  created_at: string;
  updated_at: string;
};

export type StorageFileUploadInput = {
  file: Blob;
  filename?: string;
  read_permissions?: string[];
  update_permissions?: string[];
  delete_permissions?: string[];
};

export type StorageFilePatch = {
  name?: string;
  read_permissions?: string[];
  update_permissions?: string[];
  delete_permissions?: string[];
};

export type FunctionExecution = {
  id: string;
  deployment_id: string;
  function_id: string;
  project_id: string;
  status: "accepted" | "running" | "succeeded" | "failed" | "cancelled";
  trigger: string;
  input_json?: unknown;
  response_status?: number;
  output_json?: unknown;
  output_content_type?: string;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
};

export type FunctionExecutionInput = {
  trigger?: string;
  input?: unknown;
};

export type RealtimeSubscribeOptions = {
  cursor?: string;
  events?: string[];
};

/** Public URL helper for an active Site deployment. Management stays in server.ts. */
export type SiteURLPath = string;

type ErrorPayload = {
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

export class StealthSDKError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "StealthSDKError";
    this.status = status;
    this.code = code;
  }
}

export type StealthClientOptions = {
  /** API base URL, without the /v1 suffix. */
  endpoint: string;
  projectID: string;
};

export class StealthClient {
  private readonly endpoint: string;
  private readonly projectID: string;

  readonly account: {
    create: (input: CreateApplicationUserInput) => Promise<ApplicationUser>;
    register: (input: CreateApplicationUserInput) => Promise<ApplicationUser>;
    createEmailPasswordSession: (input: EmailPasswordCredentials) => Promise<void>;
    createVerification: (input?: VerificationInput) => Promise<void>;
    confirmVerification: (token: string) => Promise<ApplicationUser>;
    createRecovery: (input: PasswordRecoveryInput) => Promise<void>;
    confirmRecovery: (token: string, password: string) => Promise<void>;
    get: () => Promise<ApplicationUser>;
    deleteSession: () => Promise<void>;
  };
  /** Application-facing rows only. Console and server-key management stays in server.ts. */
  readonly rows: {
    list: (databaseID: string, tableID: string, options?: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; filters?: Record<string, string> }) => Promise<{ rows: DatabaseRow[]; pagination: { limit: number; next_cursor: string | null } }>;
    export: (databaseID: string, tableID: string, options?: { limit?: number }) => Promise<DatabaseRowsExport>;
    import: (databaseID: string, tableID: string, input: { rows: DatabaseRowImportInput[] }) => Promise<DatabaseRowsImportResponse>;
    get: (databaseID: string, tableID: string, rowID: string) => Promise<DatabaseRow>;
    create: (databaseID: string, tableID: string, input: ApplicationRowInput) => Promise<DatabaseRow>;
    update: (databaseID: string, tableID: string, rowID: string, input: ApplicationRowPatch) => Promise<DatabaseRow>;
    delete: (databaseID: string, tableID: string, rowID: string) => Promise<void>;
  };
  /** Application-facing file data only. Bucket management stays in server.ts. */
  readonly storage: {
    files: {
      list: (bucketID: string, options?: { limit?: number; cursor?: string }) => Promise<{ files: StorageFile[]; pagination: { limit: number; next_cursor: string | null } }>;
      get: (bucketID: string, fileID: string) => Promise<StorageFile>;
      upload: (bucketID: string, input: StorageFileUploadInput) => Promise<StorageFile>;
      update: (bucketID: string, fileID: string, input: StorageFilePatch) => Promise<StorageFile>;
      download: (bucketID: string, fileID: string) => Promise<Blob>;
      delete: (bucketID: string, fileID: string) => Promise<void>;
    };
  };
  /** Application-facing invocation. Management/deployment APIs stay in server.ts. */
  readonly functions: {
    execute: (functionID: string, input?: FunctionExecutionInput) => Promise<FunctionExecution>;
  };
  readonly sites: {
    url: (siteID: string, path?: SiteURLPath) => string;
  };
  /** Application-facing Server-Sent Events stream. The caller owns the
   * EventSource and must call close() when it is no longer needed. */
  readonly realtime: {
    subscribe: (options?: RealtimeSubscribeOptions) => EventSource;
  };

  constructor(options: StealthClientOptions) {
    const endpoint = options.endpoint.trim().replace(/\/+$/, "");
    if (!endpoint) throw new TypeError("StealthClient endpoint is required");
    if (!options.projectID.trim()) throw new TypeError("StealthClient projectID is required");
    try {
      const parsed = new URL(endpoint);
      if (parsed.search || parsed.hash) throw new TypeError("StealthClient endpoint must not include a query or hash");
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new TypeError("StealthClient endpoint must use HTTP or HTTPS");
    } catch (error) {
      if (error instanceof TypeError && (error.message.includes("must not include") || error.message.includes("must use HTTP"))) throw error;
      throw new TypeError("StealthClient endpoint must be an absolute HTTP(S) URL");
    }
    this.endpoint = endpoint;
    this.projectID = options.projectID.trim();
    this.account = {
      create: (input) => this.createAccount(input),
      register: (input) => this.createAccount(input),
      createEmailPasswordSession: (input) => this.createEmailPasswordSession(input),
      createVerification: (input) => this.createVerification(input),
      confirmVerification: (token) => this.confirmVerification(token),
      createRecovery: (input) => this.createRecovery(input),
      confirmRecovery: (token, password) => this.confirmRecovery(token, password),
      get: () => this.get(),
      deleteSession: () => this.deleteSession(),
    };
    this.rows = {
      list: (databaseID, tableID, listOptions) => this.listRows(databaseID, tableID, listOptions),
      export: (databaseID, tableID, exportOptions) => this.exportRows(databaseID, tableID, exportOptions),
      import: (databaseID, tableID, input) => this.importRows(databaseID, tableID, input),
      get: (databaseID, tableID, rowID) => this.getRow(databaseID, tableID, rowID),
      create: (databaseID, tableID, input) => this.createRow(databaseID, tableID, input),
      update: (databaseID, tableID, rowID, input) => this.updateRow(databaseID, tableID, rowID, input),
      delete: (databaseID, tableID, rowID) => this.deleteRow(databaseID, tableID, rowID),
    };
    this.storage = {
      files: {
        list: (bucketID, listOptions) => this.listStorageFiles(bucketID, listOptions),
        get: (bucketID, fileID) => this.getStorageFile(bucketID, fileID),
        upload: (bucketID, input) => this.uploadStorageFile(bucketID, input),
        update: (bucketID, fileID, input) => this.updateStorageFile(bucketID, fileID, input),
        download: (bucketID, fileID) => this.downloadStorageFile(bucketID, fileID),
        delete: (bucketID, fileID) => this.deleteStorageFile(bucketID, fileID),
      },
    };
    this.functions = {
      execute: (functionID, input) => this.executeFunction(functionID, input),
    };
    this.sites = {
      url: (siteID, path) => this.siteURL(siteID, path),
    };
    this.realtime = {
      subscribe: (streamOptions) => this.subscribeRealtime(streamOptions),
    };
  }

  async createAccount(input: CreateApplicationUserInput): Promise<ApplicationUser> {
    const payload: CreateApplicationUserInput = { email: input.email, password: input.password };
    if (input.name !== undefined) payload.name = input.name;
    const response = await this.request<{ account: ApplicationUser }>("/account/registrations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.account;
  }

  async createEmailPasswordSession(input: EmailPasswordCredentials): Promise<void> {
    await this.request<void>("/sessions/email-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createVerification(input: VerificationInput = {}): Promise<void> {
    await this.request<void>("/account/verification", { method: "POST", body: JSON.stringify(input) });
  }

  async confirmVerification(token: string): Promise<ApplicationUser> {
    const response = await this.request<{ account: ApplicationUser }>("/account/verification", {
      method: "PUT",
      body: JSON.stringify({ token }),
    });
    return response.account;
  }

  async createRecovery(input: PasswordRecoveryInput): Promise<void> {
    await this.request<void>("/account/recovery", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async confirmRecovery(token: string, password: string): Promise<void> {
    await this.request<void>("/account/recovery", {
      method: "PUT",
      body: JSON.stringify({ token, password }),
    });
  }

  async get(): Promise<ApplicationUser> {
    const response = await this.request<{ account: ApplicationUser }>("/account");
    return response.account;
  }

  async deleteSession(): Promise<void> {
    await this.request<void>("/session", { method: "DELETE" });
  }

  private async listRows(databaseID: string, tableID: string, options: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; filters?: Record<string, string> } = {}): Promise<{ rows: DatabaseRow[]; pagination: { limit: number; next_cursor: string | null } }> {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.cursor) query.set("cursor", options.cursor);
    if (options.order_by) query.set("order_by", options.order_by);
    if (options.order_direction) query.set("order_direction", options.order_direction);
    for (const [key, value] of Object.entries(options.filters ?? {})) query.set(`filter.${key}`, value);
    const suffix = `/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows${query.toString() ? `?${query.toString()}` : ""}`;
    return this.request<{ rows: DatabaseRow[]; pagination: { limit: number; next_cursor: string | null } }>(suffix);
  }

  private async exportRows(databaseID: string, tableID: string, options: { limit?: number } = {}): Promise<DatabaseRowsExport> {
    const query = new URLSearchParams({ format: "json" });
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    return this.request<DatabaseRowsExport>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/export?${query.toString()}`);
  }

  private async importRows(databaseID: string, tableID: string, input: { rows: DatabaseRowImportInput[] }): Promise<DatabaseRowsImportResponse> {
    return this.request<DatabaseRowsImportResponse>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/import`, { method: "POST", body: JSON.stringify(input) });
  }

  private async getRow(databaseID: string, tableID: string, rowID: string): Promise<DatabaseRow> {
    const response = await this.request<{ row: DatabaseRow }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`);
    return response.row;
  }

  private async createRow(databaseID: string, tableID: string, input: ApplicationRowInput): Promise<DatabaseRow> {
    const response = await this.request<{ row: DatabaseRow }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows`, { method: "POST", body: JSON.stringify(input) });
    return response.row;
  }

  private async updateRow(databaseID: string, tableID: string, rowID: string, input: ApplicationRowPatch): Promise<DatabaseRow> {
    const response = await this.request<{ row: DatabaseRow }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`, { method: "PATCH", body: JSON.stringify(input) });
    return response.row;
  }

  private async deleteRow(databaseID: string, tableID: string, rowID: string): Promise<void> {
    await this.request<void>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`, { method: "DELETE" });
  }

  private async listStorageFiles(bucketID: string, options: { limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.cursor) query.set("cursor", options.cursor);
    const suffix = `/storage/buckets/${encodeURIComponent(bucketID)}/files${query.toString() ? `?${query.toString()}` : ""}`;
    return this.request<{ files: StorageFile[]; pagination: { limit: number; next_cursor: string | null } }>(suffix);
  }

  private async getStorageFile(bucketID: string, fileID: string): Promise<StorageFile> {
    const response = await this.request<{ file: StorageFile }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`);
    return response.file;
  }

  private async uploadStorageFile(bucketID: string, input: StorageFileUploadInput): Promise<StorageFile> {
    if (!(input.file instanceof Blob)) throw new TypeError("Storage upload file must be a Blob or File");
    const form = new FormData();
    const filename = input.filename ?? (typeof File !== "undefined" && input.file instanceof File ? input.file.name : "upload");
    form.append("file", input.file, filename);
    if (input.read_permissions) form.append("read_permissions", JSON.stringify(input.read_permissions));
    if (input.update_permissions) form.append("update_permissions", JSON.stringify(input.update_permissions));
    if (input.delete_permissions) form.append("delete_permissions", JSON.stringify(input.delete_permissions));
    const response = await this.request<{ file: StorageFile }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files`, { method: "POST", body: form });
    return response.file;
  }

  private async downloadStorageFile(bucketID: string, fileID: string): Promise<Blob> {
    const response = await fetch(`${this.endpoint}/v1/projects/${encodeURIComponent(this.projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}/download`, { credentials: "include", headers: { accept: "*/*" } });
    if (!response.ok) throw await this.errorFromResponse(response);
    return response.blob();
  }

  private async updateStorageFile(bucketID: string, fileID: string, input: StorageFilePatch): Promise<StorageFile> {
    const response = await this.request<{ file: StorageFile }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`, { method: "PATCH", body: JSON.stringify(input) });
    return response.file;
  }

  private async deleteStorageFile(bucketID: string, fileID: string): Promise<void> {
    await this.request<void>(`/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`, { method: "DELETE" });
  }

  private async executeFunction(functionID: string, input: FunctionExecutionInput = {}): Promise<FunctionExecution> {
    const response = await this.request<{ execution: FunctionExecution }>(`/functions/${encodeURIComponent(functionID)}/executions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.execution;
  }

  private siteURL(siteID: string, requestedPath = ""): string {
    const id = siteID.trim();
    if (!id) throw new TypeError("Site ID is required");
    const parts = requestedPath.split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === ".." || part.includes("\\") || part.includes("\0"))) {
      throw new TypeError("Site path must not contain traversal segments");
    }
    const suffix = parts.length > 0 ? `/${parts.map((part) => encodeURIComponent(part)).join("/")}` : "";
    return `${this.endpoint}/v1/sites/${encodeURIComponent(id)}${suffix}`;
  }

  private subscribeRealtime(options: RealtimeSubscribeOptions = {}): EventSource {
    const query = new URLSearchParams();
    if (options.cursor) query.set("cursor", options.cursor);
    if (options.events?.length) query.set("events", options.events.join(","));
    const suffix = `/realtime${query.toString() ? `?${query.toString()}` : ""}`;
    return new EventSource(`${this.endpoint}/v1/projects/${encodeURIComponent(this.projectID)}${suffix}`, { withCredentials: true });
  }

  private async errorFromResponse(response: Response): Promise<StealthSDKError> {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    const code = typeof payload?.error?.code === "string" ? payload.error.code : "upstream_error";
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "Stealth API request failed";
    return new StealthSDKError(response.status, code, message);
  }

  private async request<T>(suffix: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body !== undefined && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    const response = await fetch(`${this.endpoint}/v1/projects/${encodeURIComponent(this.projectID)}${suffix}`, {
      ...init,
      credentials: "include",
      headers,
    });
    if (!response.ok) {
      throw await this.errorFromResponse(response);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export function createStealthClient(options: StealthClientOptions): StealthClient {
  return new StealthClient(options);
}
