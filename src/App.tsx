import React from 'react';

import styles from './App.module.css';
import useEventEffect from './react-hooks/useEventEffect';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { reducer } from './app/reducer';

import { Router } from '@reach/router';
import { Diag } from './pages/diag';
import { NotFoundPage } from './pages/404';
import { IndexPage } from './pages';
import { DrawingPage } from './pages/drawing';

const store = createStore(
  reducer,
  // @ts-ignore
  window.__REDUX_DEVTOOLS_EXTENSION__?.(),
);

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
    <Provider store={store}>
      <div className={styles.root}>
        <header className={styles.head}>
          Sketchperiment 3 by{' '}
          <a href="https://marcello.cellosoft.com/">marcello</a>
        </header>
        <Router className={styles.main}>
          <Diag path="diag" />
          <IndexPage path="/" />
          <DrawingPage path="drawings/:drawingId" />
          <NotFoundPage default />
        </Router>
      </div>
    </Provider>
  );
}
