import { accountAPI } from "./account";
import { agentsAPI } from "./agents";
import { databasesAPI } from "./databases";
import { deploymentsAPI } from "./deployments";
import { functionsAPI } from "./functions";
import { messagingAPI } from "./messaging";
import { observabilityAPI } from "./observability";
import { organizationsAPI } from "./organizations";
import { projectsAPI } from "./projects";
import { realtimeAPI } from "./realtime";
import { sitesAPI } from "./sites";
import { storageAPI } from "./storage";

export { BrowserAPIError, browserAPIErrorMessage } from "../api-core";

export * from "./account";
export * from "./agents";
export * from "./common";
export * from "./databases";
export * from "./deployments";
export * from "./functions";
export * from "./messaging";
export * from "./observability";
export * from "./organizations";
export * from "./projects";
export * from "./realtime";
export * from "./sites";
export * from "./storage";

/**
 * Composed browser-side management API client, assembled from the per-domain
 * clients in this directory.
 *
 * The console uses relative `/v1` requests by default and sends the HttpOnly
 * Console session cookie with `credentials: include`. `VITE_API_URL` is only
 * needed when the static console is hosted on a different origin from Go.
 */
export const browserAPI = {
  ...accountAPI,
  ...organizationsAPI,
  ...observabilityAPI,
  ...projectsAPI,
  ...databasesAPI,
  ...storageAPI,
  ...functionsAPI,
  ...deploymentsAPI,
  ...sitesAPI,
  ...agentsAPI,
  ...messagingAPI,
  ...realtimeAPI,
} as const;
