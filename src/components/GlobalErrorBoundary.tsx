import React from 'react';
import { AlertCircle, Home, RefreshCw, RotateCcw } from 'lucide-react';
import { flushClientErrors, redactClientErrorText, reportClientError } from '../lib/errorTelemetry';
import { getTelemetrySessionId } from '../lib/pageTelemetry';

export interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional boundary label recorded as telemetry `operation` when no component frame is present. */
  name?: string;
  /** Optional home handler (defaults to navigating to `/`). */
  onGoHome?: () => void;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  sessionId: string;
}

function extractComponentName(componentStack?: string | null, fallback?: string): string {
  if (componentStack) {
    const m = /^\s*at\s+([A-Za-z0-9_$.]+)/m.exec(componentStack);
    if (m?.[1]) return m[1].slice(0, 120);
  }
  return fallback || 'AppRoot';
}

/**
 * Top-level React ErrorBoundary that reports scrubbed render crashes to `/api/telemetry/client-errors`
 * and shows a calm, accessible recovery card without exposing raw stack traces.
 */
class GlobalErrorBoundary extends React.Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      sessionId: getTelemetrySessionId(),
    };
  }

  static getDerivedStateFromError(): Partial<GlobalErrorBoundaryState> {
    return {
      hasError: true,
      sessionId: getTelemetrySessionId(),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const componentName = extractComponentName(info?.componentStack, this.props.name);
    const componentStack = info?.componentStack
      ? redactClientErrorText(info.componentStack, 800)
      : undefined;

    reportClientError({
      source: 'web_react',
      severity: 'critical',
      category: 'react_boundary',
      errorCode: error?.name || 'REACT_RENDER_ERROR',
      operation: componentName,
      message: error?.message || 'React render error',
      stack: error?.stack || info?.componentStack || undefined,
      meta: componentStack ? { componentStack } : undefined,
    });
    void flushClientErrors();
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    }
  };

  private handleReturnHome = (): void => {
    this.setState({ hasError: false });
    if (this.props.onGoHome) {
      this.props.onGoHome();
      return;
    }
    if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
      window.location.assign('/');
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <section
          role="alert"
          aria-live="assertive"
          aria-labelledby="global-error-title"
          data-testid="global-error-boundary"
          className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900/90 p-6 text-center text-gray-200 shadow-2xl"
        >
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-300" aria-hidden="true" />
          <h1 id="global-error-title" className="text-xl font-semibold text-white">
            Something went wrong on this screen
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            We hit an unexpected problem displaying this view. Your account and chart details are safe.
          </p>
          <p className="mt-3 text-xs text-gray-400" data-testid="error-boundary-ref">
            Reference ID: <span className="font-mono text-gray-300">{this.state.sessionId}</span>
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleReturnHome}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Return home
            </button>
          </div>
        </section>
      </div>
    );
  }
}

export default GlobalErrorBoundary;
