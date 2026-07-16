import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div
          className="max-w-lg w-full rounded-lg border border-border bg-card p-6"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
        >
          <h1
            className="font-display text-xl font-bold mb-2"
            style={{ color: "#F40009" }}
          >
            Something went wrong
          </h1>
          <p className="text-sm mb-4" style={{ color: "#666" }}>
            The app hit an unexpected error. Try reloading the page. If it
            keeps happening, contact your administrator.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48 mb-4 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: "#006039" }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
