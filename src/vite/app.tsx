import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { LazyMotion, domAnimation } from "motion/react";
import { queryClient } from "./query-client";
import { router } from "./router";

export function ViteApp() {
  return (
    <LazyMotion features={domAnimation}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LazyMotion>
  );
}
