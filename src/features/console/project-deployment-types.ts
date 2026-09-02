export type DeploymentResourceType = "function" | "site";

export type DeploymentResource = {
  id: string;
  name: string;
  type: DeploymentResourceType;
  href: string;
  apiPath: string;
  activeDeploymentId: string | null;
};

export type DeploymentOverviewRecord = {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: DeploymentResourceType;
  resourceHref: string;
  version: number;
  source: string;
  sourceName: string | null;
  status: string;
  buildStatus: string;
  errorMessage: string | null;
  createdAt: string;
  activatedAt: string | null;
};
