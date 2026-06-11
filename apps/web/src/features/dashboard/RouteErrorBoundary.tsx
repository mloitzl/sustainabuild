'use client';

import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onRetry: () => void;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown route query error',
    };
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: undefined });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-xl border border-red-700 bg-red-950/30 p-6">
          <h2 className="text-lg font-semibold text-red-200">Dashboard data failed to load</h2>
          <p className="mt-2 text-sm text-red-100">{this.state.message ?? 'Please retry.'}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            Retry loading dashboard
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
