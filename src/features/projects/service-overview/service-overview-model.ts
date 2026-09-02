import {
  Activity,
  Box,
  Code2,
  FileText,
  Globe2,
  Settings,
} from "lucide-react";
import type {
  DeploymentConfig,
  DeploymentSourceId,
  DeploymentStatus,
  PreDeployStep,
} from "../pre-deploy/pre-deploy-model";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 620;
export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 154;
export const SERVICE_STORAGE_KEY = "app-ig-service-canvas-v1";
export const WORKFLOW_STORAGE_PREFIX = "project-deployment-workflow-v1";

export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  branch: "main",
  framework: "auto",
  rootDirectory: "/",
  buildCommand: "composer install --no-interaction --prefer-dist && php artisan optimize",
  startCommand: "php artisan serve --host=0.0.0.0",
  port: "8080",
  envVariables: [],
  autoDeploy: true,
};

export type WorkflowMode = PreDeployStep | "overview";

export type StoredWorkflow = {
  mode: WorkflowMode;
  source: DeploymentSourceId | null;
  config: DeploymentConfig;
  status: DeploymentStatus;
};

export type ServiceStatus = "building" | "live" | "failed" | "stopped" | "available";
export type ServiceKind = "laravel" | "node" | "react" | "docker" | "postgresql" | "mysql" | "redis";

export type ServiceNode = {
  id: string;
  name: string;
  kind: ServiceKind;
  runtime: string;
  status: ServiceStatus;
  endpoint: string;
  cpu: string;
  ram: string;
  branch?: string;
  connections: string[];
  position: { x: number; y: number };
};

export type ServiceChoice = {
  id: string;
  label: string;
  description: string;
  kind: ServiceKind;
  icon: string;
  source?: boolean;
};

export const SERVICE_CHOICES: ServiceChoice[] = [
  { id: "github", label: "GitHub Repo", description: "Connect a repository", kind: "laravel", icon: "/icons/github.svg", source: true },
  { id: "upload", label: "Upload Source", description: "Deploy a local project", kind: "laravel", icon: "/icons/php.svg", source: true },
  { id: "docker", label: "Docker Image", description: "Run a container image", kind: "docker", icon: "/icons/docker.svg", source: true },
  { id: "template", label: "Template", description: "Start from a starter kit", kind: "react", icon: "/icons/react.svg", source: true },
  { id: "postgresql", label: "PostgreSQL", description: "Managed relational database", kind: "postgresql", icon: "/icons/postgresql.svg" },
  { id: "mysql", label: "MySQL", description: "Managed relational database", kind: "mysql", icon: "/icons/mysql.svg" },
  { id: "redis", label: "Redis", description: "Managed in-memory store", kind: "redis", icon: "/icons/redis.svg" },
];

export const DEFAULT_SERVICES: ServiceNode[] = [
  {
    id: "laravel-web",
    name: "Laravel Web",
    kind: "laravel",
    runtime: "PHP 8.3",
    status: "live",
    endpoint: "Port 8080",
    cpu: "0.5 vCPU",
    ram: "512 MB",
    branch: "main",
    connections: [],
    position: { x: 120, y: 224 },
  },
  {
    id: "queue-worker",
    name: "Queue Worker",
    kind: "node",
    runtime: "Node.js 20",
    status: "live",
    endpoint: "Worker process",
    cpu: "0.25 vCPU",
    ram: "256 MB",
    connections: ["laravel-web"],
    position: { x: 474, y: 86 },
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    kind: "postgresql",
    runtime: "PostgreSQL 16",
    status: "available",
    endpoint: "Port 5432",
    cpu: "0.25 vCPU",
    ram: "512 MB",
    connections: ["laravel-web"],
    position: { x: 474, y: 360 },
  },
  {
    id: "redis",
    name: "Redis",
    kind: "redis",
    runtime: "Redis 7",
    status: "available",
    endpoint: "Port 6379",
    cpu: "0.25 vCPU",
    ram: "128 MB",
    connections: ["laravel-web", "queue-worker"],
    position: { x: 800, y: 224 },
  },
];

export const tabs = [
  { label: "Overview", Icon: Activity },
  { label: "Deployments", Icon: Box },
  { label: "Logs", Icon: FileText },
  { label: "Variables", Icon: Code2 },
  { label: "Domains", Icon: Globe2 },
  { label: "Settings", Icon: Settings },
] as const;

export type TabLabel = (typeof tabs)[number]["label"];

export function cloneDefaultServices() {
  return DEFAULT_SERVICES.map((service) => ({
    ...service,
    position: { ...service.position },
    connections: [...service.connections],
  }));
}

export function cloneDeploymentConfig(config: DeploymentConfig = DEFAULT_DEPLOYMENT_CONFIG): DeploymentConfig {
  return {
    ...config,
    envVariables: config.envVariables.map((variable) => ({ ...variable })),
  };
}

export function serviceStorageKey(projectId: string) {
  return `${SERVICE_STORAGE_KEY}:${projectId}`;
}

export function workflowStorageKey(projectId: string) {
  return `${WORKFLOW_STORAGE_PREFIX}:${projectId}`;
}

function isDeploymentSource(value: unknown): value is DeploymentSourceId {
  return ["github", "upload", "docker", "template", "postgresql", "mysql", "redis"].includes(value as DeploymentSourceId);
}

function isDeploymentFramework(value: unknown): value is DeploymentConfig["framework"] {
  return ["auto", "laravel", "php", "node", "react", "static-html"].includes(value as DeploymentConfig["framework"]);
}

function isDeploymentStatus(value: unknown): value is DeploymentStatus {
  return ["Queued", "Building", "Deploying", "Live", "Failed"].includes(value as DeploymentStatus);
}

function isWorkflowMode(value: unknown): value is WorkflowMode {
  return value === "source" || value === "configure" || value === "deploy" || value === "overview";
}

export function parseStoredWorkflow(raw: string | null): StoredWorkflow | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;

    const candidate = value as Partial<StoredWorkflow> & { config?: Partial<DeploymentConfig> };
    const storedConfig = candidate.config;
    const envVariables = Array.isArray(storedConfig?.envVariables)
      ? storedConfig.envVariables.filter((item): item is { id: string; key: string; value: string } => {
        if (!item || typeof item !== "object") return false;
        const variable = item as Partial<{ id: string; key: string; value: string }>;
        return typeof variable.id === "string" && typeof variable.key === "string" && typeof variable.value === "string";
      })
      : DEFAULT_DEPLOYMENT_CONFIG.envVariables;

    if (!isWorkflowMode(candidate.mode) || (candidate.source !== null && !isDeploymentSource(candidate.source))) return null;

    return {
      mode: candidate.mode,
      source: candidate.source,
      status: isDeploymentStatus(candidate.status) ? candidate.status : "Queued",
      config: {
        ...DEFAULT_DEPLOYMENT_CONFIG,
        ...storedConfig,
        framework: isDeploymentFramework(storedConfig?.framework) ? storedConfig.framework : DEFAULT_DEPLOYMENT_CONFIG.framework,
        branch: typeof storedConfig?.branch === "string" ? storedConfig.branch : DEFAULT_DEPLOYMENT_CONFIG.branch,
        rootDirectory: typeof storedConfig?.rootDirectory === "string" ? storedConfig.rootDirectory : DEFAULT_DEPLOYMENT_CONFIG.rootDirectory,
        buildCommand: typeof storedConfig?.buildCommand === "string" ? storedConfig.buildCommand : DEFAULT_DEPLOYMENT_CONFIG.buildCommand,
        startCommand: typeof storedConfig?.startCommand === "string" ? storedConfig.startCommand : DEFAULT_DEPLOYMENT_CONFIG.startCommand,
        port: typeof storedConfig?.port === "string" ? storedConfig.port : DEFAULT_DEPLOYMENT_CONFIG.port,
        autoDeploy: typeof storedConfig?.autoDeploy === "boolean" ? storedConfig.autoDeploy : DEFAULT_DEPLOYMENT_CONFIG.autoDeploy,
        envVariables,
      },
    };
  } catch {
    return null;
  }
}

function isServiceKind(value: unknown): value is ServiceKind {
  return ["laravel", "node", "react", "docker", "postgresql", "mysql", "redis"].includes(value as ServiceKind);
}

function isServiceStatus(value: unknown): value is ServiceStatus {
  return ["building", "live", "failed", "stopped", "available"].includes(value as ServiceStatus);
}

export function parseStoredServices(raw: string | null): ServiceNode[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;

    const parsed = value.filter((item): item is ServiceNode => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<ServiceNode>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        isServiceKind(candidate.kind) &&
        typeof candidate.runtime === "string" &&
        isServiceStatus(candidate.status) &&
        typeof candidate.endpoint === "string" &&
        typeof candidate.cpu === "string" &&
        typeof candidate.ram === "string" &&
        Array.isArray(candidate.connections) &&
        candidate.connections.every((connection) => typeof connection === "string") &&
        candidate.position !== undefined &&
        typeof candidate.position === "object" &&
        typeof candidate.position.x === "number" &&
        typeof candidate.position.y === "number"
      );
    });

    return parsed.map((service) => ({
      ...service,
      position: { x: service.position.x, y: service.position.y },
      connections: [...service.connections],
    }));
  } catch {
    return null;
  }
}

export function serviceIcon(kind: ServiceKind) {
  const iconByKind: Record<ServiceKind, string> = {
    laravel: "/icons/laravel.svg",
    node: "/icons/nodejs.svg",
    react: "/icons/react.svg",
    docker: "/icons/docker.svg",
    postgresql: "/icons/postgresql.svg",
    mysql: "/icons/mysql.svg",
    redis: "/icons/redis.svg",
  };
  return iconByKind[kind];
}

export function serviceKindLabel(kind: ServiceKind) {
  const labels: Record<ServiceKind, string> = {
    laravel: "Web service",
    node: "Worker service",
    react: "Web service",
    docker: "Container",
    postgresql: "Database",
    mysql: "Database",
    redis: "Cache",
  };
  return labels[kind];
}

export function statusLabel(status: ServiceStatus) {
  const labels: Record<ServiceStatus, string> = {
    building: "Building",
    live: "Live",
    failed: "Failed",
    stopped: "Stopped",
    available: "Available",
  };
  return labels[status];
}

export function isDatabase(service: ServiceNode) {
  return service.kind === "postgresql" || service.kind === "mysql" || service.kind === "redis";
}

export function getConnectorAnchors(from: ServiceNode, to: ServiceNode) {
  const fromCenter = { x: from.position.x + NODE_WIDTH / 2, y: from.position.y + NODE_HEIGHT / 2 };
  const toCenter = { x: to.position.x + NODE_WIDTH / 2, y: to.position.y + NODE_HEIGHT / 2 };
  const deltaX = toCenter.x - fromCenter.x;
  const deltaY = toCenter.y - fromCenter.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    const points = deltaX >= 0
      ? { start: { x: from.position.x + NODE_WIDTH, y: fromCenter.y }, end: { x: to.position.x, y: toCenter.y } }
      : { start: { x: from.position.x, y: fromCenter.y }, end: { x: to.position.x + NODE_WIDTH, y: toCenter.y } };
    return points;
  }

  const points = deltaY >= 0
    ? { start: { x: fromCenter.x, y: from.position.y + NODE_HEIGHT }, end: { x: toCenter.x, y: to.position.y } }
    : { start: { x: fromCenter.x, y: from.position.y }, end: { x: toCenter.x, y: to.position.y + NODE_HEIGHT } };
  return points;
}

export function connectorPath(start: { x: number; y: number }, end: { x: number; y: number }) {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  if (horizontal) {
    const controlX = start.x + (end.x - start.x) / 2;
    return `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`;
  }

  const controlY = start.y + (end.y - start.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${controlY}, ${end.x} ${controlY}, ${end.x} ${end.y}`;
}

export function buildNewService(choice: ServiceChoice, existing: ServiceNode[], id: string): ServiceNode {
  const index = existing.length;
  const layouts = [
    { x: 150, y: 224 },
    { x: 476, y: 86 },
    { x: 476, y: 360 },
    { x: 800, y: 224 },
  ];
  const position = layouts[index % layouts.length];
  const sourceDefaults: Record<string, Pick<ServiceNode, "name" | "runtime" | "endpoint" | "cpu" | "ram">> = {
    github: { name: "Laravel Web", runtime: "PHP 8.3", endpoint: "Port 8080", cpu: "0.5 vCPU", ram: "512 MB" },
    upload: { name: "Uploaded Source", runtime: "PHP 8.3", endpoint: "Port 8080", cpu: "0.5 vCPU", ram: "512 MB" },
    docker: { name: "Docker Service", runtime: "Docker image", endpoint: "Port 8080", cpu: "0.5 vCPU", ram: "512 MB" },
    template: { name: "React Starter", runtime: "React 19", endpoint: "Port 3000", cpu: "0.5 vCPU", ram: "512 MB" },
    postgresql: { name: "PostgreSQL", runtime: "PostgreSQL 16", endpoint: "Port 5432", cpu: "0.25 vCPU", ram: "512 MB" },
    mysql: { name: "MySQL", runtime: "MySQL 8", endpoint: "Port 3306", cpu: "0.25 vCPU", ram: "512 MB" },
    redis: { name: "Redis", runtime: "Redis 7", endpoint: "Port 6379", cpu: "0.25 vCPU", ram: "128 MB" },
  };
  const defaults = sourceDefaults[choice.id];
  const source = choice.source ?? false;
  const parent = existing.find((service) => service.kind === "laravel" || service.kind === "react" || service.kind === "docker");

  return {
    id,
    name: defaults.name,
    kind: choice.kind,
    runtime: defaults.runtime,
    status: source ? "building" : "available",
    endpoint: defaults.endpoint,
    cpu: defaults.cpu,
    ram: defaults.ram,
    branch: source ? "main" : undefined,
    connections: parent && !source ? [parent.id] : [],
    position,
  };
}

export function makeServiceId(choice: ServiceChoice, existing: ServiceNode[]) {
  const base = choice.id === "github" ? "laravel-web" : choice.id;
  let id = base;
  let suffix = 2;
  while (existing.some((service) => service.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}
