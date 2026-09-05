import { readFile } from "node:fs/promises";

const serverSource = await readFile("services/api/internal/httpapi/server.go", "utf8");
const openapiSource = await readFile("packages/openapi/openapi.yaml", "utf8");

const methods = /\br(?:\.With\([^)]*\))*\.(Get|Post|Put|Patch|Delete)\("([^"]+)"/;
const normalizePath = (value) => value.replace(/\{[^}]+\}/g, "{}").replace(/\/\*/, "/{}");
const serverOperations = new Set();
let inV1RouteGroup = false;

for (const line of serverSource.split("\n")) {
  if (line.includes('r.Route("/v1"')) {
    inV1RouteGroup = true;
    continue;
  }
  const match = line.match(methods);
  if (match) {
    const method = match[1].toUpperCase();
    const path = inV1RouteGroup ? `/v1${match[2]}` : match[2];
    serverOperations.add(`${method} ${normalizePath(path)}`);
  }
  if (inV1RouteGroup && /^\s*}\)\s*$/.test(line)) {
    inV1RouteGroup = false;
  }
}

const openapiOperations = new Set();
let currentPath = null;
for (const line of openapiSource.split("\n")) {
  const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
  if (pathMatch) {
    currentPath = normalizePath(pathMatch[1]);
    continue;
  }
  const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
  if (methodMatch && currentPath) {
    openapiOperations.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
  }
}

// These infrastructure/publication routes intentionally live outside the
// versioned API contract. The OpenAPI file documents the client-facing API.
const intentionallyUndocumented = new Set(["GET /", "GET /{}", "GET /metrics"]);
const missing = [...serverOperations]
  .filter((operation) => !intentionallyUndocumented.has(operation) && !openapiOperations.has(operation))
  .sort();
const stale = [...openapiOperations]
  .filter((operation) => !serverOperations.has(operation))
  .sort();

if (missing.length || stale.length) {
  if (missing.length) {
    console.error("Go API operations missing from OpenAPI:");
    missing.forEach((operation) => console.error(`  ${operation}`));
  }
  if (stale.length) {
    console.error("OpenAPI operations not registered by the Go API:");
    stale.forEach((operation) => console.error(`  ${operation}`));
  }
  process.exitCode = 1;
} else {
  console.log(`API contract OK: ${serverOperations.size - intentionallyUndocumented.size} versioned operations match OpenAPI.`);
}
