import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { SettingsProvider } from "./hooks/useSettings";
import { ThemeProvider } from "./hooks/useTheme";
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
                  <Toaster
                    theme="dark"
                    position="bottom-right"
                    toastOptions={{
                      style: {
                        background: "rgba(17,20,29,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff",
                        backdropFilter: "blur(12px)",
                        borderRadius: "16px",
                      },
                    }}
                  />
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
