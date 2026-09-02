import type { MetricPoint, ServiceHealth, TimeRange } from "../types/telemetry";
import type { Host, ResourceSeries, Worker } from "../types/infrastructure";
import type { PreviewAgentRun } from "../types/runs";
import type { Incident } from "../types/incidents";
import type { ModelUsage, Provider } from "../types/platform";

// ---------------------------------------------------------------------------
// Deterministic mock generation. Every series comes from a seeded PRNG so the
// server render and the first client render produce identical data — live
// updates only ever mutate state after hydration.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Random walk that mean-reverts toward the middle of [min, max]. */
function walk(seed: number, count: number, min: number, max: number, volatility = 0.16): number[] {
  const rng = mulberry32(seed);
  const span = max - min;
  const mid = min + span / 2;
  let value = min + span * (0.35 + rng() * 0.3);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    value += (rng() - 0.5) * 2 * span * volatility;
    value += (mid - value) * 0.08;
    value = Math.min(max, Math.max(min, value));
    out.push(round(value, 2));
  }
  return out;
}

function toPoints(values: number[], labels: string[]): MetricPoint[] {
  return labels.map((timestamp, index) => ({ timestamp, value: values[index] ?? 0 }));
}

/** "12:05"-style axis labels, wrapping past midnight like a rolling window. */
function clockLabels(count: number, stepMinutes: number, startMinutes: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const total = (startMinutes + index * stepMinutes) % (24 * 60);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  });
}

// ---------------------------------------------------------------------------
// Overview — primary metrics, platform stats, main chart
// ---------------------------------------------------------------------------

const RANGE_CONFIG: Record<Exclude<TimeRange, "7d">, { count: number; step: number; start: number }> = {
  "1h": { count: 13, step: 5, start: 12 * 60 },
  "6h": { count: 13, step: 30, start: 12 * 60 },
  "24h": { count: 12, step: 120, start: 12 * 60 },
};

const DAY_LABELS = ["Aug 25", "Aug 26", "Aug 27", "Aug 28", "Aug 29", "Aug 30", "Aug 31"];

export const RANGE_SEEDS: Record<TimeRange, number> = { "1h": 11, "6h": 22, "24h": 33, "7d": 44 };

/** Labels for the overview main chart for each range. */
export function rangeLabels(range: TimeRange): string[] {
  if (range === "7d") return DAY_LABELS;
  const { count, step, start } = RANGE_CONFIG[range];
  return clockLabels(count, step, start);
}

/** Overview main telemetry chart: one keyed series per tab. */
export function overviewSeries(range: TimeRange): { cpu: MetricPoint[]; memory: MetricPoint[]; network: MetricPoint[] } {
  const labels = rangeLabels(range);
  const seed = RANGE_SEEDS[range];
  return {
    cpu: toPoints(walk(seed * 3 + 1, labels.length, 16, 64), labels),
    memory: toPoints(walk(seed * 3 + 2, labels.length, 6.8, 12.6), labels),
    network: toPoints(walk(seed * 3 + 3, labels.length, 10, 44), labels),
  };
}

// ---------------------------------------------------------------------------
// Service health + incidents
// ---------------------------------------------------------------------------

export const SERVICES: ServiceHealth[] = [
  { id: "api", name: "API", status: "healthy", latency: "182 ms", availability: "99.99%", lastCheck: "8s ago" },
  { id: "database", name: "Database", status: "healthy", latency: "12 ms", availability: "100%", lastCheck: "8s ago" },
  { id: "redis", name: "Redis", status: "healthy", latency: "4 ms", availability: "100%", lastCheck: "8s ago" },
  { id: "agent-worker", name: "Agent Worker", status: "healthy", latency: "38 ms", availability: "4 instances", lastCheck: "5s ago" },
  { id: "sandbox", name: "Sandbox Service", status: "degraded", latency: "412 ms", availability: "99.2%", lastCheck: "5s ago" },
  { id: "openai", name: "OpenAI", status: "healthy", latency: "142 ms", availability: "99.98%", lastCheck: "11s ago" },
  { id: "anthropic", name: "Anthropic", status: "healthy", latency: "168 ms", availability: "99.99%", lastCheck: "11s ago" },
];

export const INCIDENTS: Incident[] = [
  {
    id: "INC-1042",
    title: "API latency spike",
    severity: "warning",
    services: ["API", "Database"],
    status: "investigating",
    startedAt: "12m ago",
    duration: "Ongoing for 12m",
    updates: [
      { time: "12m ago", status: "investigating", message: "p95 latency elevated to 820 ms on POST endpoints; investigating database connection pool saturation." },
      { time: "9m ago", status: "identified", message: "Slow query on agent_runs identified; EXPLAIN shows a missing index after the last migration." },
      { time: "4m ago", status: "monitoring", message: "Index applied on staging replica; latency recovering. Staying in monitoring until p95 < 400 ms for 10 minutes." },
    ],
  },
  {
    id: "INC-1041",
    title: "Worker timeout increase",
    severity: "critical",
    services: ["Agent Worker"],
    status: "resolved",
    startedAt: "50m ago",
    duration: "Resolved · lasted 18m",
    updates: [
      { time: "50m ago", status: "investigating", message: "Tool execution timeouts climbing on worker-01 (71% CPU, 6 active jobs)." },
      { time: "40m ago", status: "identified", message: "Runaway npm install loop in sandbox snapshot cache; caching layer pinned to previous image." },
      { time: "32m ago", status: "resolved", message: "Cache rolled back, timeouts back to baseline. Incident resolved." },
    ],
  },
  {
    id: "INC-1040",
    title: "Sandbox provisioning failures",
    severity: "warning",
    services: ["Sandbox Service"],
    status: "monitoring",
    startedAt: "2h ago",
    duration: "Ongoing for 2h 4m",
    updates: [
      { time: "2h ago", status: "investigating", message: "2% of sandbox provisions fail with image pull timeouts from the registry." },
      { time: "1h ago", status: "identified", message: "Registry CDN node degraded in sgp-1; traffic rerouted." },
      { time: "35m ago", status: "monitoring", message: "Failure rate back under 0.2%; monitoring overnight." },
    ],
  },
  {
    id: "INC-1039",
    title: "Database failover drill",
    severity: "info",
    services: ["Database"],
    status: "resolved",
    startedAt: "Yesterday",
    duration: "Resolved · lasted 22m",
    updates: [
      { time: "Yesterday", status: "monitoring", message: "Planned failover drill to the standby region; brief write pauses expected." },
      { time: "Yesterday", status: "resolved", message: "Drill completed, promotion took 22s. No action required." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Agent runs
// ---------------------------------------------------------------------------

const runSteps = {
  cloneDone: { label: "Repository cloned", state: "done" },
  agentsRead: { label: "AGENTS.md read", state: "done" },
  inspected: { label: "Project inspected", state: "done" },
  edited: { label: "Files edited", state: "done" },
  npmInstall: { label: "npm install", state: "failed" },
  review: { label: "Review posted", state: "done" },
  diffLoaded: { label: "Diff loaded", state: "done" },
  modelRequest: { label: "model.request", state: "failed" },
  testing: { label: "Running tests", state: "running" },
  docs: { label: "Docs updated", state: "done" },
} as const;

export const RUNS: PreviewAgentRun[] = [
  {
    id: "run_9AF31",
    user: "Alex",
    agent: "Frontend Engineer",
    provider: "OpenAI",
    model: "GPT-5.6",
    tokensIn: "84k",
    tokensOut: "12k",
    cost: "$1.84",
    duration: "2m 14s",
    status: "failed",
    startedAt: "2m ago",
    repository: "stealth-console",
    traceId: "tr_5QQ44",
    steps: [runSteps.cloneDone, runSteps.agentsRead, runSteps.inspected, runSteps.edited, runSteps.npmInstall],
    error: "Command timed out after 120 seconds.",
  },
  {
    id: "run_8BF21",
    user: "Sarah",
    agent: "Code Reviewer",
    provider: "Anthropic",
    model: "Claude Sonnet 4.5",
    tokensIn: "21k",
    tokensOut: "3k",
    cost: "$0.42",
    duration: "48s",
    status: "failed",
    startedAt: "5m ago",
    repository: "stealth-admin-ui",
    traceId: "tr_1KB47",
    steps: [runSteps.cloneDone, runSteps.diffLoaded, runSteps.modelRequest],
    error: "ProviderRateLimitError: Anthropic rate limit exceeded (retry 5/5).",
  },
  {
    id: "run_711AC",
    user: "John",
    agent: "Backend Engineer",
    provider: "OpenAI",
    model: "GPT-5.6",
    tokensIn: "12k",
    tokensOut: "—",
    cost: "$0.08",
    duration: "2m 06s",
    status: "running",
    startedAt: "Now",
    repository: "stealth-docs-site",
    traceId: "tr_6MX18",
    steps: [runSteps.cloneDone, runSteps.inspected, { label: "Files edited", state: "running" }],
  },
  {
    id: "run_6DD08",
    user: "Mia",
    agent: "Docs Writer",
    provider: "Anthropic",
    model: "Claude Haiku 4.5",
    tokensIn: "8k",
    tokensOut: "4k",
    cost: "$0.06",
    duration: "1m 12s",
    status: "completed",
    startedAt: "9m ago",
    repository: "stealth-docs-site",
    traceId: "tr_2WN90",
    steps: [runSteps.cloneDone, runSteps.docs],
  },
  {
    id: "run_5EF74",
    user: "Alex",
    agent: "QA Agent",
    provider: "OpenAI",
    model: "GPT-5.6 mini",
    tokensIn: "31k",
    tokensOut: "6k",
    cost: "$0.31",
    duration: "3m 45s",
    status: "completed",
    startedAt: "12m ago",
    repository: "stealth-console",
    traceId: "tr_4HT77",
    steps: [runSteps.cloneDone, { label: "Tests generated", state: "done" }, { label: "Test run passed", state: "done" }],
  },
  {
    id: "run_4CA19",
    user: "Leo",
    agent: "Frontend Engineer",
    provider: "Anthropic",
    model: "Claude Sonnet 4.5",
    tokensIn: "—",
    tokensOut: "—",
    cost: "—",
    duration: "—",
    status: "queued",
    startedAt: "1m ago",
    repository: "stealth-admin-ui",
    traceId: "—",
    steps: [],
  },
  {
    id: "run_3BQ62",
    user: "Sarah",
    agent: "Backend Engineer",
    provider: "OpenAI",
    model: "GPT-5.6",
    tokensIn: "96k",
    tokensOut: "18k",
    cost: "$2.10",
    duration: "4m 51s",
    status: "completed",
    startedAt: "26m ago",
    repository: "stealth-console",
    traceId: "tr_3GD52",
    steps: [runSteps.cloneDone, runSteps.inspected, runSteps.edited, { label: "Tests passed", state: "done" }],
  },
  {
    id: "run_2XN37",
    user: "John",
    agent: "Code Reviewer",
    provider: "OpenAI",
    model: "GPT-5.6 mini",
    tokensIn: "17k",
    tokensOut: "2k",
    cost: "$0.14",
    duration: "58s",
    status: "completed",
    startedAt: "41m ago",
    repository: "stealth-admin-ui",
    traceId: "tr_2JD83",
    steps: [runSteps.cloneDone, runSteps.diffLoaded, runSteps.review],
  },
  {
    id: "run_1VK83",
    user: "Mia",
    agent: "Frontend Engineer",
    provider: "OpenAI",
    model: "GPT-5.6",
    tokensIn: "44k",
    tokensOut: "9k",
    cost: "$0.96",
    duration: "2m 27s",
    status: "failed",
    startedAt: "1h ago",
    repository: "stealth-docs-site",
    traceId: "tr_1AF06",
    steps: [runSteps.cloneDone, { label: "Sandbox provisioned", state: "failed" }],
    error: "SandboxProvisionError: sandbox image pull failed (registry timeout).",
  },
];

// ---------------------------------------------------------------------------
// Infrastructure — hosts, fleet resource charts, workers
// ---------------------------------------------------------------------------

export const HOSTS: Host[] = [
  {
    id: "host-01",
    name: "production-01",
    status: "online",
    os: "Ubuntu 24.04",
    ip: "10.0.12.21",
    region: "sgp-1",
    cpu: 42,
    memory: 61,
    storage: 49,
    memoryTotalGb: 16,
    storageTotalGb: 250,
    uptime: "32d 4h",
    workers: 2,
    jobs: 4,
  },
  {
    id: "host-02",
    name: "production-02",
    status: "online",
    os: "Ubuntu 24.04",
    ip: "10.0.12.22",
    region: "sgp-1",
    cpu: 21,
    memory: 38,
    storage: 66,
    memoryTotalGb: 16,
    storageTotalGb: 250,
    uptime: "32d 4h",
    workers: 1,
    jobs: 2,
  },
  {
    id: "host-03",
    name: "worker-01",
    status: "online",
    os: "Ubuntu 24.04",
    ip: "10.0.12.31",
    region: "sgp-1",
    cpu: 71,
    memory: 83,
    storage: 38,
    memoryTotalGb: 16,
    storageTotalGb: 500,
    uptime: "12d 9h",
    workers: 1,
    jobs: 6,
  },
];

const INFRA_LABELS = clockLabels(60, 1, 12 * 60);

export const INFRA_SERIES: ResourceSeries[] = [
  {
    id: "cpu",
    label: "CPU Usage",
    unit: "%",
    tone: "accent",
    current: "45%",
    peak: "78%",
    average: "41%",
    data: toPoints(walk(201, 60, 18, 78), INFRA_LABELS),
  },
  {
    id: "memory",
    label: "Memory Usage",
    unit: "GB",
    tone: "info",
    current: "29.1 GB",
    peak: "34.2 GB",
    average: "27.8 GB",
    data: toPoints(walk(202, 60, 22, 34), INFRA_LABELS),
  },
  {
    id: "disk",
    label: "Disk Usage",
    unit: "%",
    tone: "muted",
    current: "51%",
    peak: "51%",
    average: "50%",
    data: toPoints(walk(203, 60, 49, 52, 0.04), INFRA_LABELS),
  },
  {
    id: "network",
    label: "Network Throughput",
    unit: "MB/s",
    tone: "warning",
    current: "62 MB/s",
    peak: "141 MB/s",
    average: "58 MB/s",
    data: toPoints(walk(204, 60, 24, 141, 0.3), INFRA_LABELS),
  },
];

/** Small per-host CPU history for the host detail strip. */
export const HOST_CPU_HISTORY: Record<string, number[]> = Object.fromEntries(
  HOSTS.map((host, index) => [host.id, walk(210 + index * 7, 30, Math.max(8, host.cpu - 22), Math.min(96, host.cpu + 22))]),
);

export const WORKERS: Worker[] = [
  {
    id: "wk-01",
    name: "worker-01",
    host: "worker-01",
    status: "busy",
    cpu: 71,
    memoryUsed: "6.6 / 8 GB",
    jobs: 6,
    heartbeat: "2s ago",
    uptime: "12d 9h",
    currentRun: "run_711AC",
    queue: 3,
  },
  {
    id: "wk-02",
    name: "worker-02",
    host: "production-01",
    status: "online",
    cpu: 42,
    memoryUsed: "4.8 / 8 GB",
    jobs: 3,
    heartbeat: "3s ago",
    uptime: "32d 4h",
    currentRun: "run_5EF74",
    queue: 1,
  },
  {
    id: "wk-03",
    name: "worker-03",
    host: "production-01",
    status: "online",
    cpu: 17,
    memoryUsed: "2.4 / 8 GB",
    jobs: 1,
    heartbeat: "5s ago",
    uptime: "32d 4h",
    queue: 0,
  },
  {
    id: "wk-04",
    name: "worker-04",
    host: "production-02",
    status: "online",
    cpu: 28,
    memoryUsed: "3.1 / 8 GB",
    jobs: 2,
    heartbeat: "4s ago",
    uptime: "21d 1h",
    currentRun: "run_3BQ62",
    queue: 0,
  },
];

export const WORKER_CPU_HISTORY: Record<string, number[]> = Object.fromEntries(
  WORKERS.map((worker, index) => [worker.id, walk(230 + index * 5, 30, Math.max(6, worker.cpu - 20), Math.min(95, worker.cpu + 18))]),
);

// ---------------------------------------------------------------------------
// Platform — providers and legacy preview-only usage/status data
// ---------------------------------------------------------------------------

export const PROVIDERS: Provider[] = [
  { id: "prov_openai", name: "OpenAI", status: "healthy", latency: "142 ms", requestsToday: "48.2k", uptime: "99.98%", models: ["GPT-5.6", "GPT-5.6 mini"] },
  { id: "prov_anthropic", name: "Anthropic", status: "healthy", latency: "168 ms", requestsToday: "21.4k", uptime: "99.99%", models: ["Claude Sonnet 4.5", "Claude Haiku 4.5"] },
  { id: "prov_google", name: "Google", status: "healthy", latency: "203 ms", requestsToday: "6.8k", uptime: "99.95%", models: ["Gemini 3 Pro"] },
];

export const MODEL_USAGE: ModelUsage[] = [
  { id: "mu_01", model: "GPT-5.6", provider: "OpenAI", requests: "31.4k", tokens: "48.6M", avgLatency: "182 ms", errorRate: "0.31%", costToday: "$246.10" },
  { id: "mu_02", model: "GPT-5.6 mini", provider: "OpenAI", requests: "16.8k", tokens: "11.2M", avgLatency: "96 ms", errorRate: "0.12%", costToday: "$38.40" },
  { id: "mu_03", model: "Claude Sonnet 4.5", provider: "Anthropic", requests: "14.1k", tokens: "17.8M", avgLatency: "214 ms", errorRate: "0.44%", costToday: "$94.70" },
  { id: "mu_04", model: "Claude Haiku 4.5", provider: "Anthropic", requests: "7.3k", tokens: "4.1M", avgLatency: "88 ms", errorRate: "0.09%", costToday: "$12.20" },
  { id: "mu_05", model: "Gemini 3 Pro", provider: "Google", requests: "6.8k", tokens: "6.4M", avgLatency: "203 ms", errorRate: "0.51%", costToday: "$21.40" },
];
