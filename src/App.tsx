import React, { Suspense } from 'react';

import styles from './App.module.css';
import useEventEffect from './react-hooks/useEventEffect';

import { Router } from '@reach/router';
import { Diag } from './pages/diag';
import { NotFoundPage } from './pages/404';
import { IndexPage } from './pages';
import { DrawingPage } from './pages/drawing';

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
        Sketchperiment 3 by{' '}
        <a href="https://marcello.cellosoft.com/">marcello</a>
      </header>
      <Suspense fallback={<div>Twiddling thumbs…</div>}>
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
