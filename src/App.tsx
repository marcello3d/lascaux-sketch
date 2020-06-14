import React, { Suspense, useMemo } from 'react';

import styles from './App.module.css';

import { Link, RouteComponentProps, Router } from '@reach/router';
import { NotFoundPage } from './pages/404';
import { IndexPage } from './pages';
import { DrawingPage } from './pages/drawing';
import { LoadingPage } from './pages/loading';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { InternalErrorPage } from './pages/500';

const LazyDiag = React.lazy(() => import('./pages/diag'));
const Diag = (_: RouteComponentProps) => <LazyDiag />;

export function App() {
  const size = useMemo(() => {
    if ('standalone' in navigator) {
      return {
        // Hack to get around the fact that
        '--app-height': `${window.innerHeight}px`,
      } as React.CSSProperties;
    }
    return {};
  }, []);
  return (
    <div className={styles.root} style={size}>
      <header className={styles.head}>
        <Link to="/">Lascaux Sketch 2</Link> by{' '}
        <a href="https://marcello.cellosoft.com/">marcello</a>
      </header>
      <ErrorBoundary
        fallback={(error) => (
          <div className={styles.main}>
            <InternalErrorPage error={error} />
          </div>
        )}
      >
        <Suspense fallback={<LoadingPage />}>
          <Router className={styles.main}>
            <Diag path="diag" />
            <IndexPage path="/" />
            <DrawingPage path="drawings/:drawingId" />
            <NotFoundPage default />
          </Router>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
