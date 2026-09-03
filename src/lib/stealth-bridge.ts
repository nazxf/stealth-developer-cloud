const hopByHop = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host"]);
const canonicalUUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const organizationResourcePath = new RegExp(`^organizations/${canonicalUUID}/(memberships|audit-events|projects)$`);
const organizationTracesPath = new RegExp(`^organizations/${canonicalUUID}/traces$`);
const organizationPath = new RegExp(`^organizations/${canonicalUUID}$`);
const organizationMembershipPath = new RegExp(`^organizations/${canonicalUUID}/memberships/${canonicalUUID}$`);
const organizationInvitationsPath = new RegExp(`^organizations/${canonicalUUID}/invitations$`);
const organizationInvitationPath = new RegExp(`^organizations/${canonicalUUID}/invitations/${canonicalUUID}$`);
const organizationInvitationAcceptPath = /^organization-invitations\/accept$/;
const organizationIncidentsPath = new RegExp(`^organizations/${canonicalUUID}/incidents$`);
const organizationIncidentPath = new RegExp(`^organizations/${canonicalUUID}/incidents/${canonicalUUID}$`);
const accountSessionPath = new RegExp(`^account/sessions/${canonicalUUID}$`);
const projectResourcePath = new RegExp(`^projects/${canonicalUUID}$`);
const projectAuditEventsPath = new RegExp(`^projects/${canonicalUUID}/audit-events$`);
const agentsPath = /^agents$/;
const agentPath = new RegExp(`^agents/${canonicalUUID}$`);
const agentRunsPath = new RegExp(`^agents/${canonicalUUID}/runs$`);
const agentRunPath = new RegExp(`^agents/${canonicalUUID}/runs/${canonicalUUID}$`);
const agentRunCancelPath = new RegExp(`^agents/${canonicalUUID}/runs/${canonicalUUID}/cancel$`);
const agentRunLogsPath = new RegExp(`^agents/${canonicalUUID}/runs/${canonicalUUID}/logs$`);
const projectUsersPath = new RegExp(`^projects/${canonicalUUID}/users$`);
const projectUserPath = new RegExp(`^projects/${canonicalUUID}/users/${canonicalUUID}$`);
const projectUserStatusPath = new RegExp(`^projects/${canonicalUUID}/users/${canonicalUUID}/status$`);
const projectAuthSettingsPath = new RegExp(`^projects/${canonicalUUID}/auth/settings$`);
const projectUsagePath = new RegExp(`^projects/${canonicalUUID}/usage$`);
const projectUsageMeteringPath = new RegExp(`^projects/${canonicalUUID}/usage/metering$`);
const projectAuthVerificationPath = new RegExp(`^projects/${canonicalUUID}/account/verification$`);
const projectAuthRecoveryPath = new RegExp(`^projects/${canonicalUUID}/account/recovery$`);
const projectAPIKeysPath = new RegExp(`^projects/${canonicalUUID}/api-keys$`);
const projectAPIKeyPath = new RegExp(`^projects/${canonicalUUID}/api-keys/${canonicalUUID}$`);
const projectWebhooksPath = new RegExp(`^projects/${canonicalUUID}/webhooks$`);
const projectWebhookPath = new RegExp(`^projects/${canonicalUUID}/webhooks/${canonicalUUID}$`);
const projectWebhookRotatePath = new RegExp(`^projects/${canonicalUUID}/webhooks/${canonicalUUID}/rotate-secret$`);
const projectWebhookDeliveriesPath = new RegExp(`^projects/${canonicalUUID}/webhooks/${canonicalUUID}/deliveries$`);
const projectRealtimePath = new RegExp(`^projects/${canonicalUUID}/realtime$`);
const projectDatabasesPath = new RegExp(`^projects/${canonicalUUID}/databases$`);
const projectDatabasePath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}$`);
const projectDatabaseTablesPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables$`);
const projectDatabaseTablePath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}$`);
const projectDatabaseColumnsPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}/columns$`);
const projectDatabaseColumnPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}/columns/${canonicalUUID}$`);
const projectDatabaseIndexesPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}/indexes$`);
const projectDatabaseIndexPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}/indexes/${canonicalUUID}$`);
const projectDatabaseRowsPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}/rows$`);
const projectDatabaseRowPath = new RegExp(`^projects/${canonicalUUID}/databases/${canonicalUUID}/tables/${canonicalUUID}/rows/${canonicalUUID}$`);
const projectStorageBucketsPath = new RegExp(`^projects/${canonicalUUID}/storage/buckets$`);
const projectStorageBucketPath = new RegExp(`^projects/${canonicalUUID}/storage/buckets/${canonicalUUID}$`);
const projectStorageFilesPath = new RegExp(`^projects/${canonicalUUID}/storage/buckets/${canonicalUUID}/files$`);
const projectStorageFilePath = new RegExp(`^projects/${canonicalUUID}/storage/buckets/${canonicalUUID}/files/${canonicalUUID}$`);
const projectStorageDownloadPath = new RegExp(`^projects/${canonicalUUID}/storage/buckets/${canonicalUUID}/files/${canonicalUUID}/download$`);
const projectFunctionsPath = new RegExp(`^projects/${canonicalUUID}/functions$`);
const projectFunctionPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}$`);
const projectFunctionVariablesPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/variables$`);
const projectFunctionVariablePath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/variables/${canonicalUUID}$`);
const projectFunctionDeploymentsPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/deployments$`);
const projectFunctionDeploymentPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/deployments/${canonicalUUID}$`);
const projectFunctionDeploymentActivatePath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/deployments/${canonicalUUID}/activate$`);
const projectFunctionExecutionsPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/executions$`);
const projectFunctionExecutionPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/executions/${canonicalUUID}$`);
const projectFunctionExecutionLogsPath = new RegExp(`^projects/${canonicalUUID}/functions/${canonicalUUID}/executions/${canonicalUUID}/logs$`);
const projectSitesPath = new RegExp(`^projects/${canonicalUUID}/sites$`);
const projectSitePath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}$`);
const projectSiteDomainsPath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/domains$`);
const projectSiteDomainPath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/domains/${canonicalUUID}$`);
const projectSiteDomainVerifyPath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/domains/${canonicalUUID}/verify$`);
const projectSiteDeploymentsPath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/deployments$`);
const projectSiteGitDeploymentPath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/deployments/git$`);
const projectSiteDeploymentPath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/deployments/${canonicalUUID}$`);
const projectSiteDeploymentActivatePath = new RegExp(`^projects/${canonicalUUID}/sites/${canonicalUUID}/deployments/${canonicalUUID}/activate$`);
const publicSitePath = new RegExp(`^sites/${canonicalUUID}(?:/.*)?$`);

export function isAllowedStealthPath(path: string[], method: string) {
  const joined = path.join("/");
  const allowed = new Map<string, string[]>([
    ["account/registrations", ["POST"]], ["account", ["GET"]], ["account/sessions", ["GET", "DELETE"]], ["account/password", ["PATCH"]], ["account/verification", ["POST", "PUT"]], ["account/recovery", ["POST", "PUT"]], ["sessions/email-password", ["POST"]], ["session", ["DELETE"]], ["organizations", ["GET", "POST"]],
  ]);
  if (allowed.get(joined)?.includes(method)) return true;
  return (
    (organizationResourcePath.test(joined) && ["GET", "POST"].includes(method)) ||
    (organizationPath.test(joined) && method === "PATCH") ||
    (organizationMembershipPath.test(joined) && ["PATCH", "DELETE"].includes(method)) ||
    (organizationInvitationsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (organizationInvitationPath.test(joined) && method === "DELETE") ||
    (organizationIncidentsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (organizationIncidentPath.test(joined) && ["GET", "PATCH"].includes(method)) ||
    (organizationTracesPath.test(joined) && method === "GET") ||
    (organizationInvitationAcceptPath.test(joined) && method === "POST") ||
    (accountSessionPath.test(joined) && method === "DELETE") ||
    (projectResourcePath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectAuditEventsPath.test(joined) && method === "GET") ||
    (agentsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (agentPath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (agentRunsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (agentRunPath.test(joined) && method === "GET") ||
    (agentRunCancelPath.test(joined) && method === "POST") ||
    (agentRunLogsPath.test(joined) && method === "GET") ||
    (projectUsersPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectUserPath.test(joined) && method === "GET") ||
    (projectUserStatusPath.test(joined) && method === "PATCH") ||
    (projectAuthSettingsPath.test(joined) && ["GET", "PATCH"].includes(method)) ||
    (projectUsagePath.test(joined) && method === "GET") ||
    (projectUsageMeteringPath.test(joined) && method === "GET") ||
    (projectAuthVerificationPath.test(joined) && ["POST", "PUT"].includes(method)) ||
    (projectAuthRecoveryPath.test(joined) && ["POST", "PUT"].includes(method)) ||
    (projectAPIKeysPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectAPIKeyPath.test(joined) && ["GET", "DELETE"].includes(method)) ||
    (projectWebhooksPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectWebhookPath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectWebhookRotatePath.test(joined) && method === "POST") ||
    (projectWebhookDeliveriesPath.test(joined) && method === "GET") ||
    (projectRealtimePath.test(joined) && method === "GET") ||
    (projectDatabasesPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectDatabasePath.test(joined) && ["GET", "DELETE"].includes(method)) ||
    (projectDatabaseTablesPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectDatabaseTablePath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectDatabaseColumnsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectDatabaseColumnPath.test(joined) && method === "DELETE") ||
    (projectDatabaseIndexesPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectDatabaseIndexPath.test(joined) && method === "DELETE") ||
    (projectDatabaseRowsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectDatabaseRowPath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectStorageBucketsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectStorageBucketPath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectStorageFilesPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectStorageFilePath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectStorageDownloadPath.test(joined) && method === "GET") ||
    (projectFunctionsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectFunctionPath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectFunctionVariablesPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectFunctionVariablePath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectFunctionDeploymentsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectFunctionDeploymentPath.test(joined) && ["GET", "DELETE"].includes(method)) ||
    (projectFunctionDeploymentActivatePath.test(joined) && method === "POST") ||
    (projectFunctionExecutionsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectFunctionExecutionPath.test(joined) && method === "GET") ||
    (projectFunctionExecutionLogsPath.test(joined) && method === "GET") ||
    (projectSitesPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectSitePath.test(joined) && ["GET", "PATCH", "DELETE"].includes(method)) ||
    (projectSiteDomainsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectSiteDomainPath.test(joined) && ["GET", "DELETE"].includes(method)) ||
    (projectSiteDomainVerifyPath.test(joined) && method === "POST") ||
    (projectSiteDeploymentsPath.test(joined) && ["GET", "POST"].includes(method)) ||
    (projectSiteGitDeploymentPath.test(joined) && method === "POST") ||
    (projectSiteDeploymentPath.test(joined) && ["GET", "DELETE"].includes(method)) ||
    (projectSiteDeploymentActivatePath.test(joined) && method === "POST") ||
    (publicSitePath.test(joined) && method === "GET")
  );
}

export function forwardHeaders(source: Headers) {
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "accept", "last-event-id"]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  const cookieName = process.env.STEALTH_SESSION_COOKIE_NAME ?? "stealth_session";
  const session = source.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`));
  if (session) headers.set("cookie", session);
  return headers;
}

export function relayHeaders(source: Headers) {
  const headers = new Headers();
  for (const [key, value] of source.entries()) if (!hopByHop.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") headers.set(key, value);
  return headers;
}
