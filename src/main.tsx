import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import App from "./App.tsx";

// Forward uncaught webview errors to the Tauri dev terminal for debugging.
const report = (m: string) => invoke("report_error", { message: m }).catch(() => {});
window.addEventListener("error", (e) =>
  report(`${e.message}\n${e.error?.stack ?? `${e.filename}:${e.lineno}`}`)
);
window.addEventListener("unhandledrejection", (e) =>
  report(`REJECTION: ${e.reason?.stack ?? String(e.reason)}`)
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
