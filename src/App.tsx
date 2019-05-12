import React, { useCallback, useMemo } from 'react';

import styles from './App.module.css';
import useEventEffect from './react-hooks/useEventEffect';
import { useDispatch, useMappedState } from 'redux-react-hook';
import { getCurrentPage, getDrawing } from './app/selectors';
import { AppState } from './app/state';
import { navigateToPage, newDrawing } from './app/actions';
import DrawletApp from './DrawletApp';
import { getDrawingModel } from './drawlets/drawlet-cache';

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
      <main className={styles.main}>
        <Router />
      </main>
    </div>
  );
}

function Router() {
  const page = useMappedState(getCurrentPage);
  switch (page.type) {
    case 'drawing':
      return <DrawingPage id={page.drawingId} />;
    case 'index':
      return <IndexPage />;
    default:
      return <NotFoundPage />;
  }
}

function DrawingPage({ id }: { id: string }) {
  const drawing = useMappedState(
    useCallback((state) => getDrawing(state, id), [id]),
  );
  if (drawing === undefined) {
    throw new Error('Drawing not found');
  }
  const drawingModel = getDrawingModel(id, drawing);
  return <DrawletApp drawingModel={drawingModel} />;
}

function Drawings() {
  const drawings = useMappedState((state: AppState) => state.drawings);
  const dispatch = useDispatch();
  const items = useMemo(
    () =>
      Object.entries(drawings).map(([drawingId, { width, height }]) => (
        <li key={drawingId}>
          <button
            onClick={() =>
              dispatch(navigateToPage({ type: 'drawing', drawingId }))
            }
          >
            {drawingId}: {width}x{height}
          </button>
        </li>
      )),
    [drawings, dispatch],
  );

  return <ul>{items}</ul>;
}

function IndexPage() {
  const dispatch = useDispatch();
  const addDrawing = () => dispatch(newDrawing({ width: 500, height: 500 }));

  return (
    <div>
      <h2>Index page</h2>
      <Drawings />
      <p>
        <button onClick={addDrawing}>New Drawing</button>
      </p>
    </div>
  );
}

function NotFoundPage() {
  return <div>Not found :(</div>;
}
