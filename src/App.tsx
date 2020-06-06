import React, { Suspense } from 'react';

import styles from './App.module.css';
import useEventEffect from './react-hooks/useEventEffect';

import { Link, RouteComponentProps, Router } from '@reach/router';
import { NotFoundPage } from './pages/404';
import { IndexPage } from './pages';
import { DrawingPage } from './pages/drawing';
import { LoadingPage } from './pages/loading';

const LazyDiag = React.lazy(() => import('./pages/diag'));
const Diag = (_: RouteComponentProps) => <LazyDiag />;

export function App() {
  const target = document.body;
  useEventEffect(
    target,
    'touchmove',
    (event: MouseEvent) => {
      event.preventDefault();
    },
    { passive: false },
  );

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <Link to="/">Lascaux Sketch 2</Link> by{' '}
        <a href="https://marcello.cellosoft.com/">marcello</a>
      </header>
      <Suspense fallback={<LoadingPage />}>
        <Router className={styles.main}>
          <Diag path="diag" />
          <IndexPage path="/" />
          <DrawingPage path="drawings/:drawingId" />
          <NotFoundPage default />
        </Router>
      </Suspense>
    </div>
  );
}
