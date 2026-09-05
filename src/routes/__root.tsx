import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-code-pro";
import "@/styles/global.css";
import { queryClient } from "@/vite/query-client";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "Stealth Console — deploy, monitor, and manage your services." },
      { title: "Stealth Console" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/stealth-mark.png" }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <LazyMotion features={domAnimation}>
            <Outlet />
          </LazyMotion>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
