import React, { Suspense } from 'react';

import './App.css';

import { RouteComponentProps, Router } from '@reach/router';
import { NotFoundPage } from './pages/404';
import { IndexPage } from './pages';
import { DrawingPage } from './pages/drawing';
import { LoadingPage } from './pages/loading';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { InternalErrorPage } from './pages/500';

const LazyDiag = React.lazy(() => import('./pages/diag'));
const DiagPage = (_: RouteComponentProps) => <LazyDiag />;

export function App() {
  return (
    <ErrorBoundary fallback={(error) => <InternalErrorPage error={error} />}>
      <Suspense fallback={<LoadingPage />}>
        <Router>
          <DiagPage path="diag" />
          <IndexPage path="/" />
          <DrawingPage path="drawings/:drawingId" />
          <NotFoundPage default />
        </Router>
      </Suspense>
    </ErrorBoundary>
  );
}
