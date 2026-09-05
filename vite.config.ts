import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL?.trim() || "http://127.0.0.1:8080";
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/v1": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure: stripBrowserOrigin,
        },
        "/healthz": { target: apiTarget, changeOrigin: true, secure: false, configure: stripBrowserOrigin },
        "/readyz": { target: apiTarget, changeOrigin: true, secure: false, configure: stripBrowserOrigin },
        "/metrics": { target: apiTarget, changeOrigin: true, secure: false, configure: stripBrowserOrigin },
      },
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
  };
});

function stripBrowserOrigin(proxy: { on: (event: string, listener: (...args: unknown[]) => void) => void }) {
  // Vite dev proxy is same-origin from the browser. Removing Origin before
  // forwarding keeps local development independent from production's explicit
  // CONSOLE_CORS_ORIGINS allowlist; cross-origin production calls still use Go
  // CORS directly through VITE_API_URL.
  proxy.on("proxyReq", (...args: unknown[]) => {
    const request = args[0] as { removeHeader?: (name: string) => void } | undefined;
    request?.removeHeader?.("origin");
  });
}
