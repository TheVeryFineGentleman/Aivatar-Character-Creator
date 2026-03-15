import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ============= GLOBAL ERROR HANDLERS =============
// Catch unhandled errors before they cause silent page reloads
window.addEventListener("error", (event) => {
  console.error(
    `🔴 [GLOBAL ERROR ${new Date().toISOString()}]`,
    event.message,
    "\nFile:", event.filename,
    "\nLine:", event.lineno,
    "\nStack:", event.error?.stack
  );
});

window.addEventListener("unhandledrejection", (event) => {
  console.error(
    `🔴 [UNHANDLED PROMISE ${new Date().toISOString()}]`,
    event.reason?.message || event.reason,
    "\nStack:", event.reason?.stack
  );
});

console.log(`🟢 App mounted at ${new Date().toISOString()}`);

createRoot(document.getElementById("root")!).render(<App />);
