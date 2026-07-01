import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  /** Short label shown in the fallback ("Analytics", "Chart", etc.). */
  label?: string;
  /** Approximate height used for the fallback panel so layout doesn't jump. */
  height?: number;
  /** Optional custom fallback. When provided, `label`/`height` are ignored. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Component-level error boundary. Keeps a single failing panel from taking
 * down the whole dashboard, and gives the user a "try again" affordance
 * instead of a blank area.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Preserve full error for Server Logs / Lovable capture.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.label ?? "panel", error, info);
    reportLovableError(error, {
      boundary: "component_error_boundary",
      label: this.props.label,
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ error, reset: this.reset });

    const { label = "This section", height = 200 } = this.props;
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 rounded-lg border border-negative/40 bg-negative/5 p-4 text-sm"
        style={{ minHeight: height }}
      >
        <div className="flex items-center gap-2 font-medium text-negative">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {label} failed to render
        </div>
        <p className="text-muted-foreground">
          {friendlyMessage(error)}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium hover:bg-accent"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }
}

function friendlyMessage(error: Error): string {
  const raw = error.message?.trim();
  if (!raw) return "An unexpected error occurred. Try refreshing the page.";
  // Trim overly-technical prefixes / stack markers so users see something readable.
  if (raw.length > 240) return raw.slice(0, 237) + "…";
  return raw;
}
