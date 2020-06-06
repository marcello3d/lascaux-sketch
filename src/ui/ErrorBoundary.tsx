import React, { ErrorInfo } from 'react';

type Props = { children: React.ReactNode };
type State = { error?: Error };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Got error: `, error);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return <h1>Something went wrong! ${error.message}</h1>;
    }

    return this.props.children;
  }
}
