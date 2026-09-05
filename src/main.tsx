import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-code-pro";
import "./styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ViteApp } from "./vite/app";

const root = document.getElementById("root");
if (!root) throw new Error("Stealth root element is missing");

createRoot(root).render(
  <StrictMode>
    <ViteApp />
  </StrictMode>,
);

