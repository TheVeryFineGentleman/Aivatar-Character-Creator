/**
 * Crash-shield. Renders a calm fallback instead of a blank screen when a child
 * throws — and gives users a one-click reset.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-ink-950">
        <div className="max-w-md w-full bg-ink-900/80 border border-white/8 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-danger/15 border border-danger/25 flex items-center justify-center text-danger mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-ink-50/55 mb-1">Die App hat einen unerwarteten Fehler entdeckt.</p>
          <p className="text-xs text-ink-50/40 mb-6 font-mono break-all">{error.message}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset} iconLeft={<RefreshCw className="w-4 h-4" />}>Erneut versuchen</Button>
            <Button variant="secondary" iconLeft={<Home className="w-4 h-4" />} onClick={() => { window.location.href = "/"; }}>
              Zur Startseite
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
