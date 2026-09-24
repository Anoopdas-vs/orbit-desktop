import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Orbit Error Boundary] Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-orbit-bg p-8">
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">Something went wrong</h1>
            <p className="text-sm text-slate-400">
              Orbit encountered an unexpected error. Your data and audit logs are safe.
            </p>
            {this.state.error && (
              <pre className="text-xs text-red-300 bg-slate-950 rounded-lg p-4 overflow-auto max-h-32 text-left font-mono">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
