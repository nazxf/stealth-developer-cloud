import { readdir, readFile } from "node:fs/promises";

const openapiSource = await readFile("packages/openapi/openapi.yaml", "utf8");

const methods = /\br(?:\.With\([^)]*\))*\.(Get|Post|Put|Patch|Delete)\("([^"]+)"/;
const normalizePath = (value) => value.replace(/\{[^}]+\}/g, "{}").replace(/\/\*/, "/{}");
const serverOperations = new Set();
const httpapiFiles = (await readdir("services/api/internal/httpapi"))
  .filter((file) => file.endsWith(".go"))
  .sort();

for (const file of httpapiFiles) {
  const source = await readFile(`services/api/internal/httpapi/${file}`, "utf8");
  // The server constructor owns the /v1 group, while route modules are
  // registered from inside it. Their declarations therefore inherit /v1.
  let inV1RouteGroup = false;
  for (const line of source.split("\n")) {
    if (file === "server.go" && line.includes('r.Route("/v1"')) {
      inV1RouteGroup = true;
      continue;
    }
    const match = line.match(methods);
    if (match) {
      const method = match[1].toUpperCase();
      const path = inV1RouteGroup || file === "routes.go" ? `/v1${match[2]}` : match[2];
      serverOperations.add(`${method} ${normalizePath(path)}`);
    }
    if (file === "server.go" && inV1RouteGroup && /^\s*}\)\s*$/.test(line)) {
      inV1RouteGroup = false;
    }
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
