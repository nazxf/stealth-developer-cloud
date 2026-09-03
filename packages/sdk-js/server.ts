import { StealthSDKError, type ApplicationUser } from "./index";

export type ServerStealthClientOptions = {
  /** API base URL, without the /v1 suffix. A path prefix is preserved. */
  endpoint: string;
  projectID: string;
  /** Keep this value server-side; it must never be bundled into a browser. */
  apiKey: string;
};

export type ServerProjectUsersPage = {
  users: ApplicationUser[];
  pagination: { limit: number; next_cursor: string | null };
  can_manage: boolean;
};

export type ServerCreateProjectUserInput = {
  email: string;
  password: string;
  name?: string;
};

export type ServerUpdateProjectUserStatusInput = {
  status: "active" | "blocked";
};

export type ServerDatabaseColumnType = "varchar" | "text" | "integer" | "double" | "boolean" | "datetime" | "json";
export type ServerDatabase = { id: string; project_id: string; name: string; created_at: string; updated_at: string };
export type ServerDatabaseTable = { id: string; database_id: string; project_id: string; name: string; row_security: boolean; create_permissions: string[]; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; created_at: string; updated_at: string };
export type ServerDatabaseColumn = { id: string; table_id: string; key: string; type: ServerDatabaseColumnType; required: boolean; varchar_size?: number | null; default?: unknown; created_at: string; updated_at: string };
export type ServerDatabaseIndex = { id: string; table_id: string; name: string; type: "key" | "unique"; column_keys: string[]; directions: Array<"asc" | "desc">; created_at: string; updated_at: string };
export type ServerDatabaseRow = { id: string; table_id: string; project_id: string; data: Record<string, unknown>; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; creator_project_user_id?: string; created_at: string; updated_at: string };
export type ServerDatabasePage<T> = { pagination: { limit: number; next_cursor: string | null }; can_manage?: boolean } & Record<string, unknown>;
export type ServerCreateDatabaseInput = { name: string };
export type ServerCreateDatabaseTableInput = { name: string; row_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };
export type ServerUpdateDatabaseTableInput = Omit<ServerCreateDatabaseTableInput, "name"> & { name?: string };
export type ServerCreateDatabaseColumnInput = { key: string; type: ServerDatabaseColumnType; required?: boolean; varchar_size?: number | null; default?: unknown };
export type ServerCreateDatabaseIndexInput = { name: string; type: "key" | "unique"; column_keys: string[]; directions?: Array<"asc" | "desc"> };
export type ServerCreateDatabaseRowInput = { data: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };
export type ServerUpdateDatabaseRowInput = { data?: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };

export type ServerStorageBucket = { id: string; project_id: string; name: string; file_security: boolean; create_permissions: string[]; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; max_file_size_bytes: number; quota_bytes: number; used_bytes: number; created_at: string; updated_at: string };
export type ServerStorageFile = { id: string; bucket_id: string; project_id: string; name: string; mime_type: string; size_bytes: number; checksum_sha256: string; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; creator_project_user_id?: string; created_at: string; updated_at: string };
export type ServerCreateStorageBucketInput = { name: string; file_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[]; max_file_size_bytes?: number; quota_bytes?: number };
export type ServerUpdateStorageBucketInput = Partial<Omit<ServerCreateStorageBucketInput, "name">> & { name?: string };
export type ServerStorageFileUploadInput = { file: Blob; filename?: string; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };
export type ServerStorageFilePatch = { name?: string; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };

export type ServerFunctionRuntime = "node-22" | "python-3.13" | "go-1.24";
export type ServerFunction = { id: string; project_id: string; name: string; runtime: ServerFunctionRuntime; entrypoint: string; commands: string; timeout_seconds: number; enabled: boolean; logging: boolean; execute_permissions: string[]; description?: string; status: "active" | "disabled"; artifact_quota_bytes: number; artifact_used_bytes: number; active_deployment_id?: string; created_at: string; updated_at: string };
export type ServerFunctionVariable = { id: string; function_id: string; project_id: string; key: string; kind: "variable" | "secret"; is_secret: boolean; has_value: boolean; description?: string; created_at: string; updated_at: string };
export type ServerFunctionDeployment = { id: string; function_id: string; project_id: string; version: number; source: string; source_name?: string; size_bytes: number; checksum_sha256: string; status: "queued" | "building" | "ready" | "active" | "superseded" | "failed" | "cancelled"; build_status: "queued" | "running" | "deferred" | "succeeded" | "failed"; error_message?: string; created_by_account_id?: string; queued_at: string; build_started_at?: string; built_at?: string; activated_at?: string; finished_at?: string; created_at: string; updated_at: string };
export type ServerFunctionExecution = { id: string; deployment_id: string; function_id: string; project_id: string; status: "accepted" | "running" | "succeeded" | "failed" | "cancelled"; trigger: string; input_json?: unknown; response_status?: number; output_json?: unknown; output_content_type?: string; error_message?: string; started_at?: string; finished_at?: string; created_at: string; updated_at: string };
export type ServerCreateFunctionExecutionInput = { trigger?: string; input?: unknown };
export type ServerFunctionExecutionLog = { id: string; execution_id: string; function_id: string; project_id: string; sequence: number; level: "debug" | "info" | "warn" | "error"; message: string; created_at: string };
export type ServerCreateFunctionInput = { name: string; runtime: ServerFunctionRuntime; entrypoint: string; commands?: string; timeout_seconds?: number; enabled?: boolean; logging?: boolean; execute_permissions?: string[]; description?: string; artifact_quota_bytes?: number };
export type ServerUpdateFunctionInput = Partial<ServerCreateFunctionInput>;
export type ServerCreateFunctionVariableInput = { key: string; value: string; kind?: "variable" | "secret"; is_secret?: boolean; description?: string };
export type ServerUpdateFunctionVariableInput = { key?: string; value?: string; description?: string };
export type ServerFunctionDeploymentUploadInput = { source: Blob; filename?: string };
export type ServerSite = { id: string; project_id: string; name: string; framework: "static"; enabled: boolean; status: "active" | "disabled"; artifact_quota_bytes: number; artifact_used_bytes: number; artifact_reserved_bytes: number; active_deployment_id?: string; created_at: string; updated_at: string };
export type ServerSiteDomain = { id: string; project_id: string; site_id: string; hostname: string; status: "pending" | "verified" | "disabled"; verification_token: string; verification_record_name: string; verification_record_type: "TXT"; verification_record_value: string; verified_at?: string; tls_status: "external" | "pending" | "active" | "failed"; created_at: string; updated_at: string };
export type ServerSiteDeployment = { id: string; site_id: string; project_id: string; version: number; source: "upload" | "github" | "gitlab"; source_name?: string; git_repository?: string; git_ref?: string; size_bytes: number; archive_size_bytes: number; checksum_sha256: string; status: "queued" | "ready" | "active" | "superseded" | "failed" | "cancelled"; build_runtime?: "node-22" | "python-3.13" | "go-1.24"; build_command?: string; output_directory?: string; build_status: "queued" | "running" | "deferred" | "succeeded" | "failed"; reserved_bytes?: number; activate_requested?: boolean; error_message?: string; created_by_account_id?: string; queued_at: string; build_started_at?: string; built_at?: string; activated_at?: string; finished_at?: string; created_at: string; updated_at: string };
export type ServerCreateSiteInput = { name: string; framework?: "static"; enabled?: boolean; status?: "active" | "disabled"; artifact_quota_bytes?: number };
export type ServerUpdateSiteInput = Partial<ServerCreateSiteInput>;
export type ServerCreateSiteDomainInput = { hostname: string };
export type ServerSiteDeploymentUploadInput = { source: Blob; filename?: string; activate?: boolean; buildRuntime?: "node-22" | "python-3.13" | "go-1.24"; buildCommand?: string; outputDirectory?: string };
export type ServerSiteGitDeploymentInput = { repository: string; ref?: string; buildRuntime?: "node-22" | "python-3.13" | "go-1.24"; buildCommand: string; outputDirectory?: string; activate?: boolean };
export type ServerWebhook = { id: string; project_id: string; name: string; url: string; events: string[]; enabled: boolean; failure_count: number; last_delivery_at?: string; last_failure_at?: string; created_at: string; updated_at: string };
export type ServerWebhookDelivery = { id: string; webhook_id: string; event_id: string; event_name: string; status: "pending" | "running" | "succeeded" | "failed"; attempt_count: number; last_status_code?: number; last_error?: string; delivered_at?: string; created_at: string; updated_at: string };
export type ServerCreateWebhookInput = { name: string; url: string; events?: string[]; enabled?: boolean };
export type ServerUpdateWebhookInput = Partial<ServerCreateWebhookInput>;
export type ServerWebhookSecretResponse = { webhook: ServerWebhook; secret: string };
export type ServerRealtimeStreamOptions = { cursor?: string; events?: string[] };

export class ServerStealthClient {
  private readonly endpoint: string;
  private readonly projectID: string;
  private readonly apiKey: string;

  readonly users: {
    list: (options?: { limit?: number; cursor?: string }) => Promise<ServerProjectUsersPage>;
    get: (userID: string) => Promise<ApplicationUser>;
    create: (input: ServerCreateProjectUserInput) => Promise<ApplicationUser>;
    updateStatus: (userID: string, input: ServerUpdateProjectUserStatusInput) => Promise<ApplicationUser>;
    delete: (userID: string) => Promise<void>;
  };
  readonly databases: {
    list: (options?: { limit?: number; cursor?: string }) => Promise<{ databases: ServerDatabase[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
    get: (databaseID: string) => Promise<ServerDatabase>;
    create: (input: ServerCreateDatabaseInput) => Promise<ServerDatabase>;
    delete: (databaseID: string) => Promise<void>;
    tables: {
      list: (databaseID: string, options?: { limit?: number; cursor?: string }) => Promise<{ tables: ServerDatabaseTable[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (databaseID: string, tableID: string) => Promise<ServerDatabaseTable>;
      create: (databaseID: string, input: ServerCreateDatabaseTableInput) => Promise<ServerDatabaseTable>;
      update: (databaseID: string, tableID: string, input: ServerUpdateDatabaseTableInput) => Promise<ServerDatabaseTable>;
      delete: (databaseID: string, tableID: string) => Promise<void>;
    };
    columns: {
      list: (databaseID: string, tableID: string, options?: { limit?: number; cursor?: string }) => Promise<{ columns: ServerDatabaseColumn[]; pagination: { limit: number; next_cursor: string | null } }>;
      create: (databaseID: string, tableID: string, input: ServerCreateDatabaseColumnInput) => Promise<ServerDatabaseColumn>;
      delete: (databaseID: string, tableID: string, columnID: string) => Promise<void>;
    };
    indexes: {
      list: (databaseID: string, tableID: string, options?: { limit?: number; cursor?: string }) => Promise<{ indexes: ServerDatabaseIndex[]; pagination: { limit: number; next_cursor: string | null } }>;
      create: (databaseID: string, tableID: string, input: ServerCreateDatabaseIndexInput) => Promise<ServerDatabaseIndex>;
      delete: (databaseID: string, tableID: string, indexID: string) => Promise<void>;
    };
    rows: {
      list: (databaseID: string, tableID: string, options?: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; filters?: Record<string, string> }) => Promise<{ rows: ServerDatabaseRow[]; pagination: { limit: number; next_cursor: string | null } }>;
      get: (databaseID: string, tableID: string, rowID: string) => Promise<ServerDatabaseRow>;
      create: (databaseID: string, tableID: string, input: ServerCreateDatabaseRowInput) => Promise<ServerDatabaseRow>;
      update: (databaseID: string, tableID: string, rowID: string, input: ServerUpdateDatabaseRowInput) => Promise<ServerDatabaseRow>;
      delete: (databaseID: string, tableID: string, rowID: string) => Promise<void>;
    };
  };
  readonly storage: {
    buckets: {
      list: (options?: { limit?: number; cursor?: string }) => Promise<{ buckets: ServerStorageBucket[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (bucketID: string) => Promise<ServerStorageBucket>;
      create: (input: ServerCreateStorageBucketInput) => Promise<ServerStorageBucket>;
      update: (bucketID: string, input: ServerUpdateStorageBucketInput) => Promise<ServerStorageBucket>;
      delete: (bucketID: string) => Promise<void>;
    };
    files: {
      list: (bucketID: string, options?: { limit?: number; cursor?: string }) => Promise<{ files: ServerStorageFile[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (bucketID: string, fileID: string) => Promise<ServerStorageFile>;
      upload: (bucketID: string, input: ServerStorageFileUploadInput) => Promise<ServerStorageFile>;
      update: (bucketID: string, fileID: string, input: ServerStorageFilePatch) => Promise<ServerStorageFile>;
      download: (bucketID: string, fileID: string) => Promise<ArrayBuffer>;
      delete: (bucketID: string, fileID: string) => Promise<void>;
    };
  };
  readonly functions: {
    list: (options?: { limit?: number; cursor?: string }) => Promise<{ functions: ServerFunction[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
    get: (functionID: string) => Promise<ServerFunction>;
    create: (input: ServerCreateFunctionInput) => Promise<ServerFunction>;
    update: (functionID: string, input: ServerUpdateFunctionInput) => Promise<ServerFunction>;
    delete: (functionID: string) => Promise<void>;
    variables: {
      list: (functionID: string, options?: { limit?: number; cursor?: string }) => Promise<{ variables: ServerFunctionVariable[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (functionID: string, variableID: string) => Promise<ServerFunctionVariable>;
      create: (functionID: string, input: ServerCreateFunctionVariableInput) => Promise<ServerFunctionVariable>;
      update: (functionID: string, variableID: string, input: ServerUpdateFunctionVariableInput) => Promise<ServerFunctionVariable>;
      delete: (functionID: string, variableID: string) => Promise<void>;
    };
    deployments: {
      list: (functionID: string, options?: { limit?: number; cursor?: string }) => Promise<{ deployments: ServerFunctionDeployment[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (functionID: string, deploymentID: string) => Promise<ServerFunctionDeployment>;
      upload: (functionID: string, input: ServerFunctionDeploymentUploadInput) => Promise<ServerFunctionDeployment>;
      activate: (functionID: string, deploymentID: string) => Promise<{ function: ServerFunction; deployment: ServerFunctionDeployment }>;
      delete: (functionID: string, deploymentID: string) => Promise<void>;
    };
    executions: {
      list: (functionID: string, options?: { limit?: number; cursor?: string }) => Promise<{ executions: ServerFunctionExecution[]; pagination: { limit: number; next_cursor: string | null } }>;
      get: (functionID: string, executionID: string) => Promise<ServerFunctionExecution>;
      create: (functionID: string, input?: ServerCreateFunctionExecutionInput) => Promise<ServerFunctionExecution>;
      logs: (functionID: string, executionID: string, options?: { limit?: number; after?: number }) => Promise<{ logs: ServerFunctionExecutionLog[]; pagination: { limit: number; next_cursor: string | null } }>;
    };
  };
  readonly sites: {
    list: (options?: { limit?: number; cursor?: string }) => Promise<{ sites: ServerSite[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
    get: (siteID: string) => Promise<ServerSite>;
    create: (input: ServerCreateSiteInput) => Promise<ServerSite>;
    update: (siteID: string, input: ServerUpdateSiteInput) => Promise<ServerSite>;
    delete: (siteID: string) => Promise<void>;
    domains: {
      list: (siteID: string, options?: { limit?: number; cursor?: string }) => Promise<{ domains: ServerSiteDomain[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (siteID: string, domainID: string) => Promise<ServerSiteDomain>;
      create: (siteID: string, input: ServerCreateSiteDomainInput) => Promise<ServerSiteDomain>;
      verify: (siteID: string, domainID: string) => Promise<ServerSiteDomain>;
      delete: (siteID: string, domainID: string) => Promise<void>;
    };
    deployments: {
      list: (siteID: string, options?: { limit?: number; cursor?: string }) => Promise<{ deployments: ServerSiteDeployment[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
      get: (siteID: string, deploymentID: string) => Promise<ServerSiteDeployment>;
      upload: (siteID: string, input: ServerSiteDeploymentUploadInput) => Promise<ServerSiteDeployment>;
      fromGit: (siteID: string, input: ServerSiteGitDeploymentInput) => Promise<ServerSiteDeployment>;
      activate: (siteID: string, deploymentID: string) => Promise<{ site: ServerSite; deployment: ServerSiteDeployment }>;
      delete: (siteID: string, deploymentID: string) => Promise<void>;
    };
  };
  readonly webhooks: {
    list: (options?: { limit?: number; cursor?: string }) => Promise<{ webhooks: ServerWebhook[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>;
    get: (webhookID: string) => Promise<ServerWebhook>;
    create: (input: ServerCreateWebhookInput) => Promise<ServerWebhookSecretResponse>;
    update: (webhookID: string, input: ServerUpdateWebhookInput) => Promise<ServerWebhook>;
    rotateSecret: (webhookID: string) => Promise<ServerWebhookSecretResponse>;
    delete: (webhookID: string) => Promise<void>;
    deliveries: (webhookID: string, options?: { limit?: number; cursor?: string }) => Promise<{ deliveries: ServerWebhookDelivery[]; pagination: { limit: number; next_cursor: string | null } }>;
  };
  /**
   * Opens the authenticated SSE stream. The caller owns response.body and
   * should cancel it when the consumer shuts down.
   */
  readonly realtime: {
    stream: (options?: ServerRealtimeStreamOptions) => Promise<Response>;
  };

  constructor(options: ServerStealthClientOptions) {
    const endpoint = options.endpoint.trim().replace(/\/+$/, "");
    if (!endpoint) throw new TypeError("ServerStealthClient endpoint is required");
    if (!options.projectID.trim()) throw new TypeError("ServerStealthClient projectID is required");
    if (!options.apiKey.trim()) throw new TypeError("ServerStealthClient apiKey is required");
    try {
      const parsed = new URL(endpoint);
      if (parsed.search || parsed.hash) throw new TypeError("ServerStealthClient endpoint must not include a query or hash");
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new TypeError("ServerStealthClient endpoint must use HTTP or HTTPS");
    } catch (error) {
      if (error instanceof TypeError && (error.message.includes("must not include") || error.message.includes("must use HTTP"))) throw error;
      throw new TypeError("ServerStealthClient endpoint must be an absolute HTTP(S) URL");
    }
    this.endpoint = endpoint;
    this.projectID = options.projectID.trim();
    this.apiKey = options.apiKey.trim();
    this.users = {
      list: (listOptions) => this.listUsers(listOptions),
      get: (userID) => this.getUser(userID),
      create: (input) => this.createUser(input),
      updateStatus: (userID, input) => this.updateUserStatus(userID, input),
      delete: (userID) => this.deleteUser(userID),
    };
    this.databases = {
      list: (listOptions) => this.listDatabases(listOptions),
      get: (databaseID) => this.getDatabase(databaseID),
      create: (input) => this.createDatabase(input),
      delete: (databaseID) => this.deleteDatabase(databaseID),
      tables: {
        list: (databaseID, listOptions) => this.listTables(databaseID, listOptions),
        get: (databaseID, tableID) => this.getTable(databaseID, tableID),
        create: (databaseID, input) => this.createTable(databaseID, input),
        update: (databaseID, tableID, input) => this.updateTable(databaseID, tableID, input),
        delete: (databaseID, tableID) => this.deleteTable(databaseID, tableID),
      },
      columns: {
        list: (databaseID, tableID, listOptions) => this.listColumns(databaseID, tableID, listOptions),
        create: (databaseID, tableID, input) => this.createColumn(databaseID, tableID, input),
        delete: (databaseID, tableID, columnID) => this.deleteColumn(databaseID, tableID, columnID),
      },
      indexes: {
        list: (databaseID, tableID, listOptions) => this.listIndexes(databaseID, tableID, listOptions),
        create: (databaseID, tableID, input) => this.createIndex(databaseID, tableID, input),
        delete: (databaseID, tableID, indexID) => this.deleteIndex(databaseID, tableID, indexID),
      },
      rows: {
        list: (databaseID, tableID, listOptions) => this.listRows(databaseID, tableID, listOptions),
        get: (databaseID, tableID, rowID) => this.getRow(databaseID, tableID, rowID),
        create: (databaseID, tableID, input) => this.createRow(databaseID, tableID, input),
        update: (databaseID, tableID, rowID, input) => this.updateRow(databaseID, tableID, rowID, input),
        delete: (databaseID, tableID, rowID) => this.deleteRow(databaseID, tableID, rowID),
      },
    };
    this.storage = {
      buckets: {
        list: (listOptions) => this.listStorageBuckets(listOptions),
        get: (bucketID) => this.getStorageBucket(bucketID),
        create: (input) => this.createStorageBucket(input),
        update: (bucketID, input) => this.updateStorageBucket(bucketID, input),
        delete: (bucketID) => this.deleteStorageBucket(bucketID),
      },
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
      list: (listOptions) => this.listFunctions(listOptions),
      get: (functionID) => this.getFunction(functionID),
      create: (input) => this.createFunction(input),
      update: (functionID, input) => this.updateFunction(functionID, input),
      delete: (functionID) => this.deleteFunction(functionID),
      variables: {
        list: (functionID, listOptions) => this.listFunctionVariables(functionID, listOptions),
        get: (functionID, variableID) => this.getFunctionVariable(functionID, variableID),
        create: (functionID, input) => this.createFunctionVariable(functionID, input),
        update: (functionID, variableID, input) => this.updateFunctionVariable(functionID, variableID, input),
        delete: (functionID, variableID) => this.deleteFunctionVariable(functionID, variableID),
      },
      deployments: {
        list: (functionID, listOptions) => this.listFunctionDeployments(functionID, listOptions),
        get: (functionID, deploymentID) => this.getFunctionDeployment(functionID, deploymentID),
        upload: (functionID, input) => this.uploadFunctionDeployment(functionID, input),
        activate: (functionID, deploymentID) => this.activateFunctionDeployment(functionID, deploymentID),
        delete: (functionID, deploymentID) => this.deleteFunctionDeployment(functionID, deploymentID),
      },
      executions: {
        list: (functionID, listOptions) => this.listFunctionExecutions(functionID, listOptions),
        get: (functionID, executionID) => this.getFunctionExecution(functionID, executionID),
        create: (functionID, input) => this.createFunctionExecution(functionID, input),
        logs: (functionID, executionID, options) => this.listFunctionExecutionLogs(functionID, executionID, options),
      },
    };
    this.sites = {
      list: (listOptions) => this.listSites(listOptions),
      get: (siteID) => this.getSite(siteID),
      create: (input) => this.createSite(input),
      update: (siteID, input) => this.updateSite(siteID, input),
      delete: (siteID) => this.deleteSite(siteID),
      domains: {
        list: (siteID, listOptions) => this.listSiteDomains(siteID, listOptions),
        get: (siteID, domainID) => this.getSiteDomain(siteID, domainID),
        create: (siteID, input) => this.createSiteDomain(siteID, input),
        verify: (siteID, domainID) => this.verifySiteDomain(siteID, domainID),
        delete: (siteID, domainID) => this.deleteSiteDomain(siteID, domainID),
      },
      deployments: {
        list: (siteID, listOptions) => this.listSiteDeployments(siteID, listOptions),
        get: (siteID, deploymentID) => this.getSiteDeployment(siteID, deploymentID),
        upload: (siteID, input) => this.uploadSiteDeployment(siteID, input),
        fromGit: (siteID, input) => this.createGitSiteDeployment(siteID, input),
        activate: (siteID, deploymentID) => this.activateSiteDeployment(siteID, deploymentID),
        delete: (siteID, deploymentID) => this.deleteSiteDeployment(siteID, deploymentID),
      },
    };
    this.webhooks = {
      list: (listOptions) => this.listWebhooks(listOptions),
      get: (webhookID) => this.getWebhook(webhookID),
      create: (input) => this.createWebhook(input),
      update: (webhookID, input) => this.updateWebhook(webhookID, input),
      rotateSecret: (webhookID) => this.rotateWebhookSecret(webhookID),
      delete: (webhookID) => this.deleteWebhook(webhookID),
      deliveries: (webhookID, listOptions) => this.listWebhookDeliveries(webhookID, listOptions),
    };
    this.realtime = {
      stream: (streamOptions) => this.openRealtimeStream(streamOptions),
    };
  }

  private async listUsers(options: { limit?: number; cursor?: string } = {}): Promise<ServerProjectUsersPage> {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.cursor) query.set("cursor", options.cursor);
    const suffix = `/users${query.toString() ? `?${query.toString()}` : ""}`;
    return this.request<ServerProjectUsersPage>(suffix);
  }

  private async getUser(userID: string): Promise<ApplicationUser> {
    const response = await this.request<{ user: ApplicationUser }>(`/users/${encodeURIComponent(userID)}`);
    return response.user;
  }

  private async createUser(input: ServerCreateProjectUserInput): Promise<ApplicationUser> {
    const response = await this.request<{ user: ApplicationUser }>("/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.user;
  }

  private async updateUserStatus(userID: string, input: ServerUpdateProjectUserStatusInput): Promise<ApplicationUser> {
    const response = await this.request<{ user: ApplicationUser }>(`/users/${encodeURIComponent(userID)}/status`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return response.user;
  }

  private async deleteUser(userID: string): Promise<void> {
    await this.request<void>(`/users/${encodeURIComponent(userID)}`, { method: "DELETE" });
  }

  private pageQuery(options: { limit?: number; cursor?: string } = {}): string {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.cursor) query.set("cursor", options.cursor);
    return query.toString();
  }

  private projectPath(suffix: string): string { return suffix; }

  private async listDatabases(options?: { limit?: number; cursor?: string }) { return this.request<{ databases: ServerDatabase[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/databases${this.pageQuery(options) ? `?${this.pageQuery(options)}` : ""}`); }
  private async getDatabase(databaseID: string) { const response = await this.request<{ database: ServerDatabase }>(`/databases/${encodeURIComponent(databaseID)}`); return response.database; }
  private async createDatabase(input: ServerCreateDatabaseInput) { const response = await this.request<{ database: ServerDatabase }>("/databases", { method: "POST", body: JSON.stringify(input) }); return response.database; }
  private async deleteDatabase(databaseID: string) { await this.request<void>(`/databases/${encodeURIComponent(databaseID)}`, { method: "DELETE" }); }
  private async listTables(databaseID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ tables: ServerDatabaseTable[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/databases/${encodeURIComponent(databaseID)}/tables${query ? `?${query}` : ""}`); }
  private async getTable(databaseID: string, tableID: string) { const response = await this.request<{ table: ServerDatabaseTable }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`); return response.table; }
  private async createTable(databaseID: string, input: ServerCreateDatabaseTableInput) { const response = await this.request<{ table: ServerDatabaseTable }>(`/databases/${encodeURIComponent(databaseID)}/tables`, { method: "POST", body: JSON.stringify(input) }); return response.table; }
  private async updateTable(databaseID: string, tableID: string, input: ServerUpdateDatabaseTableInput) { const response = await this.request<{ table: ServerDatabaseTable }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.table; }
  private async deleteTable(databaseID: string, tableID: string) { await this.request<void>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`, { method: "DELETE" }); }
  private async listColumns(databaseID: string, tableID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ columns: ServerDatabaseColumn[]; pagination: { limit: number; next_cursor: string | null } }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns${query ? `?${query}` : ""}`); }
  private async createColumn(databaseID: string, tableID: string, input: ServerCreateDatabaseColumnInput) { const response = await this.request<{ column: ServerDatabaseColumn }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns`, { method: "POST", body: JSON.stringify(input) }); return response.column; }
  private async deleteColumn(databaseID: string, tableID: string, columnID: string) { await this.request<void>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns/${encodeURIComponent(columnID)}`, { method: "DELETE" }); }
  private async listIndexes(databaseID: string, tableID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ indexes: ServerDatabaseIndex[]; pagination: { limit: number; next_cursor: string | null } }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes${query ? `?${query}` : ""}`); }
  private async createIndex(databaseID: string, tableID: string, input: ServerCreateDatabaseIndexInput) { const response = await this.request<{ index: ServerDatabaseIndex }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes`, { method: "POST", body: JSON.stringify(input) }); return response.index; }
  private async deleteIndex(databaseID: string, tableID: string, indexID: string) { await this.request<void>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes/${encodeURIComponent(indexID)}`, { method: "DELETE" }); }
  private async listRows(databaseID: string, tableID: string, options: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; filters?: Record<string, string> } = {}) { const query = new URLSearchParams(this.pageQuery(options)); if (options.order_by) query.set("order_by", options.order_by); if (options.order_direction) query.set("order_direction", options.order_direction); for (const [key, value] of Object.entries(options.filters ?? {})) query.set(`filter.${key}`, value); return this.request<{ rows: ServerDatabaseRow[]; pagination: { limit: number; next_cursor: string | null } }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows${query.toString() ? `?${query.toString()}` : ""}`); }
  private async getRow(databaseID: string, tableID: string, rowID: string) { const response = await this.request<{ row: ServerDatabaseRow }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`); return response.row; }
  private async createRow(databaseID: string, tableID: string, input: ServerCreateDatabaseRowInput) { const response = await this.request<{ row: ServerDatabaseRow }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows`, { method: "POST", body: JSON.stringify(input) }); return response.row; }
  private async updateRow(databaseID: string, tableID: string, rowID: string, input: ServerUpdateDatabaseRowInput) { const response = await this.request<{ row: ServerDatabaseRow }>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.row; }
  private async deleteRow(databaseID: string, tableID: string, rowID: string) { await this.request<void>(`/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`, { method: "DELETE" }); }

  private async listStorageBuckets(options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ buckets: ServerStorageBucket[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/storage/buckets${query ? `?${query}` : ""}`); }
  private async getStorageBucket(bucketID: string) { const response = await this.request<{ bucket: ServerStorageBucket }>(`/storage/buckets/${encodeURIComponent(bucketID)}`); return response.bucket; }
  private async createStorageBucket(input: ServerCreateStorageBucketInput) { const response = await this.request<{ bucket: ServerStorageBucket }>("/storage/buckets", { method: "POST", body: JSON.stringify(input) }); return response.bucket; }
  private async updateStorageBucket(bucketID: string, input: ServerUpdateStorageBucketInput) { const response = await this.request<{ bucket: ServerStorageBucket }>(`/storage/buckets/${encodeURIComponent(bucketID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.bucket; }
  private async deleteStorageBucket(bucketID: string) { await this.request<void>(`/storage/buckets/${encodeURIComponent(bucketID)}`, { method: "DELETE" }); }
  private async listStorageFiles(bucketID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ files: ServerStorageFile[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files${query ? `?${query}` : ""}`); }
  private async getStorageFile(bucketID: string, fileID: string) { const response = await this.request<{ file: ServerStorageFile }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`); return response.file; }
  private async updateStorageFile(bucketID: string, fileID: string, input: ServerStorageFilePatch) { const response = await this.request<{ file: ServerStorageFile }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.file; }
  private async uploadStorageFile(bucketID: string, input: ServerStorageFileUploadInput) { if (!(input.file instanceof Blob)) throw new TypeError("Storage upload file must be a Blob or File"); const form = new FormData(); const filename = input.filename ?? (typeof File !== "undefined" && input.file instanceof File ? input.file.name : "upload"); form.append("file", input.file, filename); if (input.read_permissions) form.append("read_permissions", JSON.stringify(input.read_permissions)); if (input.update_permissions) form.append("update_permissions", JSON.stringify(input.update_permissions)); if (input.delete_permissions) form.append("delete_permissions", JSON.stringify(input.delete_permissions)); const response = await this.request<{ file: ServerStorageFile }>(`/storage/buckets/${encodeURIComponent(bucketID)}/files`, { method: "POST", body: form }); return response.file; }
  private async downloadStorageFile(bucketID: string, fileID: string) { const response = await fetch(`${this.endpoint}/v1/projects/${encodeURIComponent(this.projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}/download`, { headers: { accept: "*/*", "x-stealth-key": this.apiKey } }); if (!response.ok) throw await this.errorFromResponse(response); return response.arrayBuffer(); }
  private async deleteStorageFile(bucketID: string, fileID: string) { await this.request<void>(`/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`, { method: "DELETE" }); }

  private async listFunctions(options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ functions: ServerFunction[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/functions${query ? `?${query}` : ""}`); }
  private async getFunction(functionID: string) { const response = await this.request<{ function: ServerFunction }>(`/functions/${encodeURIComponent(functionID)}`); return response.function; }
  private async createFunction(input: ServerCreateFunctionInput) { const response = await this.request<{ function: ServerFunction }>("/functions", { method: "POST", body: JSON.stringify(input) }); return response.function; }
  private async updateFunction(functionID: string, input: ServerUpdateFunctionInput) { const response = await this.request<{ function: ServerFunction }>(`/functions/${encodeURIComponent(functionID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.function; }
  private async deleteFunction(functionID: string) { await this.request<void>(`/functions/${encodeURIComponent(functionID)}`, { method: "DELETE" }); }
  private async listFunctionVariables(functionID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ variables: ServerFunctionVariable[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/functions/${encodeURIComponent(functionID)}/variables${query ? `?${query}` : ""}`); }
  private async getFunctionVariable(functionID: string, variableID: string) { const response = await this.request<{ variable: ServerFunctionVariable }>(`/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`); return response.variable; }
  private async createFunctionVariable(functionID: string, input: ServerCreateFunctionVariableInput) { const response = await this.request<{ variable: ServerFunctionVariable }>(`/functions/${encodeURIComponent(functionID)}/variables`, { method: "POST", body: JSON.stringify(input) }); return response.variable; }
  private async updateFunctionVariable(functionID: string, variableID: string, input: ServerUpdateFunctionVariableInput) { const response = await this.request<{ variable: ServerFunctionVariable }>(`/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.variable; }
  private async deleteFunctionVariable(functionID: string, variableID: string) { await this.request<void>(`/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`, { method: "DELETE" }); }
  private async listFunctionDeployments(functionID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ deployments: ServerFunctionDeployment[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/functions/${encodeURIComponent(functionID)}/deployments${query ? `?${query}` : ""}`); }
  private async getFunctionDeployment(functionID: string, deploymentID: string) { const response = await this.request<{ deployment: ServerFunctionDeployment }>(`/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}`); return response.deployment; }
  private async uploadFunctionDeployment(functionID: string, input: ServerFunctionDeploymentUploadInput) { if (!(input.source instanceof Blob)) throw new TypeError("Function deployment source must be a Blob or File"); const form = new FormData(); const filename = input.filename ?? (typeof File !== "undefined" && input.source instanceof File ? input.source.name : "source.zip"); form.append("source", input.source, filename); const response = await this.request<{ deployment: ServerFunctionDeployment }>(`/functions/${encodeURIComponent(functionID)}/deployments`, { method: "POST", body: form }); return response.deployment; }
  private async activateFunctionDeployment(functionID: string, deploymentID: string) { return this.request<{ function: ServerFunction; deployment: ServerFunctionDeployment }>(`/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}/activate`, { method: "POST" }); }
  private async deleteFunctionDeployment(functionID: string, deploymentID: string) { await this.request<void>(`/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}`, { method: "DELETE" }); }
  private async listFunctionExecutions(functionID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ executions: ServerFunctionExecution[]; pagination: { limit: number; next_cursor: string | null } }>(`/functions/${encodeURIComponent(functionID)}/executions${query ? `?${query}` : ""}`); }
  private async getFunctionExecution(functionID: string, executionID: string) { const response = await this.request<{ execution: ServerFunctionExecution }>(`/functions/${encodeURIComponent(functionID)}/executions/${encodeURIComponent(executionID)}`); return response.execution; }
  private async createFunctionExecution(functionID: string, input: ServerCreateFunctionExecutionInput = {}) { const response = await this.request<{ execution: ServerFunctionExecution }>(`/functions/${encodeURIComponent(functionID)}/executions`, { method: "POST", body: JSON.stringify(input) }); return response.execution; }
  private async listFunctionExecutionLogs(functionID: string, executionID: string, options?: { limit?: number; after?: number }) { const query = new URLSearchParams(); if (options?.limit !== undefined) query.set("limit", String(options.limit)); if (options?.after !== undefined) query.set("after", String(options.after)); const response = await this.request<{ logs: ServerFunctionExecutionLog[]; pagination: { limit: number; next_cursor: string | null } }>(`/functions/${encodeURIComponent(functionID)}/executions/${encodeURIComponent(executionID)}/logs${query.toString() ? `?${query}` : ""}`); return response; }

  private async listSites(options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ sites: ServerSite[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/sites${query ? `?${query}` : ""}`); }
  private async getSite(siteID: string) { const response = await this.request<{ site: ServerSite }>(`/sites/${encodeURIComponent(siteID)}`); return response.site; }
  private async createSite(input: ServerCreateSiteInput) { const response = await this.request<{ site: ServerSite }>("/sites", { method: "POST", body: JSON.stringify(input) }); return response.site; }
  private async updateSite(siteID: string, input: ServerUpdateSiteInput) { const response = await this.request<{ site: ServerSite }>(`/sites/${encodeURIComponent(siteID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.site; }
  private async deleteSite(siteID: string) { await this.request<void>(`/sites/${encodeURIComponent(siteID)}`, { method: "DELETE" }); }
  private async listSiteDomains(siteID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ domains: ServerSiteDomain[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/sites/${encodeURIComponent(siteID)}/domains${query ? `?${query}` : ""}`); }
  private async getSiteDomain(siteID: string, domainID: string) { const response = await this.request<{ domain: ServerSiteDomain }>(`/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}`); return response.domain; }
  private async createSiteDomain(siteID: string, input: ServerCreateSiteDomainInput) { const response = await this.request<{ domain: ServerSiteDomain }>(`/sites/${encodeURIComponent(siteID)}/domains`, { method: "POST", body: JSON.stringify(input) }); return response.domain; }
  private async verifySiteDomain(siteID: string, domainID: string) { const response = await this.request<{ domain: ServerSiteDomain }>(`/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}/verify`, { method: "POST" }); return response.domain; }
  private async deleteSiteDomain(siteID: string, domainID: string) { await this.request<void>(`/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}`, { method: "DELETE" }); }
  private async listSiteDeployments(siteID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ deployments: ServerSiteDeployment[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/sites/${encodeURIComponent(siteID)}/deployments${query ? `?${query}` : ""}`); }
  private async getSiteDeployment(siteID: string, deploymentID: string) { const response = await this.request<{ deployment: ServerSiteDeployment }>(`/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}`); return response.deployment; }
  private async uploadSiteDeployment(siteID: string, input: ServerSiteDeploymentUploadInput) { if (!(input.source instanceof Blob)) throw new TypeError("Site deployment source must be a Blob or File"); const form = new FormData(); const filename = input.filename ?? (typeof File !== "undefined" && input.source instanceof File ? input.source.name : "site.zip"); form.append("source", input.source, filename); if (input.activate !== undefined) form.append("activate", String(input.activate)); if (input.buildRuntime !== undefined) form.append("build_runtime", input.buildRuntime); if (input.buildCommand !== undefined) form.append("build_command", input.buildCommand); if (input.outputDirectory !== undefined) form.append("output_directory", input.outputDirectory); const response = await this.request<{ deployment: ServerSiteDeployment }>(`/sites/${encodeURIComponent(siteID)}/deployments`, { method: "POST", body: form }); return response.deployment; }
  private async createGitSiteDeployment(siteID: string, input: ServerSiteGitDeploymentInput) { const response = await this.request<{ deployment: ServerSiteDeployment }>(`/sites/${encodeURIComponent(siteID)}/deployments/git`, { method: "POST", body: JSON.stringify({ repository: input.repository, ref: input.ref, build_runtime: input.buildRuntime, build_command: input.buildCommand, output_directory: input.outputDirectory, activate: input.activate }) }); return response.deployment; }
  private async activateSiteDeployment(siteID: string, deploymentID: string) { return this.request<{ site: ServerSite; deployment: ServerSiteDeployment }>(`/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}/activate`, { method: "POST" }); }
  private async deleteSiteDeployment(siteID: string, deploymentID: string) { await this.request<void>(`/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}`, { method: "DELETE" }); }

  private async listWebhooks(options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ webhooks: ServerWebhook[]; pagination: { limit: number; next_cursor: string | null }; can_manage: boolean }>(`/webhooks${query ? `?${query}` : ""}`); }
  private async getWebhook(webhookID: string) { const response = await this.request<{ webhook: ServerWebhook }>(`/webhooks/${encodeURIComponent(webhookID)}`); return response.webhook; }
  private async createWebhook(input: ServerCreateWebhookInput) { const response = await this.request<ServerWebhookSecretResponse>("/webhooks", { method: "POST", body: JSON.stringify(input) }); return response; }
  private async updateWebhook(webhookID: string, input: ServerUpdateWebhookInput) { const response = await this.request<{ webhook: ServerWebhook }>(`/webhooks/${encodeURIComponent(webhookID)}`, { method: "PATCH", body: JSON.stringify(input) }); return response.webhook; }
  private async rotateWebhookSecret(webhookID: string) { return this.request<ServerWebhookSecretResponse>(`/webhooks/${encodeURIComponent(webhookID)}/rotate-secret`, { method: "POST", body: "{}" }); }
  private async deleteWebhook(webhookID: string) { await this.request<void>(`/webhooks/${encodeURIComponent(webhookID)}`, { method: "DELETE" }); }
  private async listWebhookDeliveries(webhookID: string, options?: { limit?: number; cursor?: string }) { const query = this.pageQuery(options); return this.request<{ deliveries: ServerWebhookDelivery[]; pagination: { limit: number; next_cursor: string | null } }>(`/webhooks/${encodeURIComponent(webhookID)}/deliveries${query ? `?${query}` : ""}`); }
  private async openRealtimeStream(options: ServerRealtimeStreamOptions = {}): Promise<Response> {
    const query = new URLSearchParams();
    if (options.cursor) query.set("cursor", options.cursor);
    if (options.events?.length) query.set("events", options.events.join(","));
    const suffix = `/realtime${query.toString() ? `?${query.toString()}` : ""}`;
    const response = await fetch(`${this.endpoint}/v1/projects/${encodeURIComponent(this.projectID)}${suffix}`, {
      headers: { accept: "text/event-stream", "x-stealth-key": this.apiKey },
    });
    if (!response.ok) throw await this.errorFromResponse(response);
    return response;
  }

  private async errorFromResponse(response: Response): Promise<StealthSDKError> {
    const payload = await response.json().catch(() => null) as { error?: { code?: unknown; message?: unknown } } | null;
    const code = typeof payload?.error?.code === "string" ? payload.error.code : "upstream_error";
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "Stealth API request failed";
    return new StealthSDKError(response.status, code, message);
  }

  private async request<T>(suffix: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("x-stealth-key", this.apiKey);
    if (init.body !== undefined && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    const response = await fetch(`${this.endpoint}/v1/projects/${encodeURIComponent(this.projectID)}${suffix}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      throw await this.errorFromResponse(response);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export function createServerStealthClient(options: ServerStealthClientOptions): ServerStealthClient {
  return new ServerStealthClient(options);
}
