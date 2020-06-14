import React, { ErrorInfo } from 'react';
import * as Sentry from '@sentry/browser';

type Props = {
  fallback: (error: Error) => React.ReactNode;
  children: React.ReactNode;
};
type State = {
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error(error, errorInfo);
    Sentry.captureException(error);
  }
  render() {
    const { error } = this.state;
    if (error) {
      return this.props.fallback(error);
    }
    return this.props.children;
  }
}
