import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { SettingsProvider } from "./hooks/useSettings";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { ProjectsProvider } from "./hooks/useProjects";
import { TutorialsProvider } from "./hooks/useTutorials";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

/** Toasts folgen dem Theme: die Farben kommen aus denselben Flächen-Variablen
 *  wie der Rest der App, sonst klebte auf der hellen Oberfläche eine schwarze
 *  Box. `theme` muss mit — sonst zeichnet sonner seine eigenen Bedienelemente
 *  (Schließen-Kreuz) weiterhin für den falschen Untergrund. */
function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        style: {
          background: "rgb(var(--c-ink-900) / 0.96)",
          border: "1px solid rgb(var(--c-white) / 0.10)",
          color: "rgb(var(--c-ink-50))",
          backdropFilter: "blur(12px)",
          borderRadius: "16px",
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SettingsProvider>
              <AuthProvider>
                <ProjectsProvider>
                  <TutorialsProvider>
                  <App />
                  <AppToaster />
                  </TutorialsProvider>
                </ProjectsProvider>
              </AuthProvider>
            </SettingsProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
