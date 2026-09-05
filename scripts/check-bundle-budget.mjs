import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const rawLimits = {
  entry: 460 * 1024,
  entryGzip: 145 * 1024,
  browserAPI: 180 * 1024,
  routeChunk: 50 * 1024,
};

const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));
if (files.length === 0) {
  throw new Error("No JavaScript assets found. Run `npm run build` before checking the bundle budget.");
}

const sizes = await Promise.all(files.map(async (file) => {
  const path = join(assetsDirectory.pathname, file);
  const content = await readFile(path);
  return { file, bytes: (await stat(path)).size, gzipBytes: gzipSync(content).byteLength };
}));

const entry = sizes.find(({ file }) => /^index-[^/]+\.js$/.test(file));
const browserAPI = sizes.find(({ file }) => file.startsWith("browser-api-"));
const routeChunks = sizes.filter(({ file }) => file.includes("-route-"));
const failures = [];

function check(label, actual, limit) {
  if (actual > limit) failures.push(`${label} is ${format(actual)}, limit is ${format(limit)}`);
}

if (!entry) failures.push("entry chunk (index-*.js) was not generated");
else {
  check("entry chunk", entry.bytes, rawLimits.entry);
  check("entry chunk gzip", entry.gzipBytes, rawLimits.entryGzip);
}
if (browserAPI) check("browser API chunk", browserAPI.bytes, rawLimits.browserAPI);
const largestRoute = routeChunks.reduce((largest, current) => current.bytes > (largest?.bytes ?? 0) ? current : largest, null);
if (largestRoute) check(`largest route chunk (${largestRoute.file})`, largestRoute.bytes, rawLimits.routeChunk);

for (const item of sizes.toSorted((left, right) => right.bytes - left.bytes).slice(0, 5)) {
  console.log(`${item.file}: ${format(item.bytes)} raw, ${format(item.gzipBytes)} gzip`);
}

if (failures.length) {
  console.error("\nBundle budget exceeded:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Bundle budget passed.");
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
