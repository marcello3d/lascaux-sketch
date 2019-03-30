import React, { useCallback, useMemo } from 'react';
import DrawingApp from './DrawingApp';

import styles from './App.module.css';
import useEventEffect from './react-hooks/useEventEffect';
import { useDispatch, useMappedState } from 'redux-react-hook';
import { getCurrentPage, getDrawing } from './app/selectors';
import { AppState } from './app/state';
import { navigateToPage, newDrawing } from './app/actions';
import { getCanvas2d } from './draw/canvas';

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
  const dispatch = useDispatch();
  const page = useMappedState(getCurrentPage);

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        Sketchperiment 2 by{' '}
        <a href="https://marcello.cellosoft.com/">marcello</a>
        {page.type !== 'index' && (
          <button onClick={() => dispatch(navigateToPage({ type: 'index' }))}>
            Back
          </button>
        )}
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
  const canvas2d = getCanvas2d(id, drawing);
  return <DrawingApp canvas2d={canvas2d} />;
}

function IndexPage() {
  const drawings = useMappedState((state: AppState) => state.drawings);
  const dispatch = useDispatch();
  const items = useMemo(() => {
    return Object.entries(drawings).map(([drawingId, { width, height }]) => (
      <li>
        <button
          onClick={() =>
            dispatch(navigateToPage({ type: 'drawing', drawingId }))
          }
        >
          {drawingId}: {width}x{height}
        </button>
      </li>
    ));
  }, [drawings]);

  const addDrawing = () => dispatch(newDrawing({ width: 500, height: 500 }));

  return (
    <div>
      <h2>Index page</h2>
      <ul>{items}</ul>
      <p>
        <button onClick={addDrawing}>New Drawing</button>
      </p>
    </div>
  );
}

function NotFoundPage() {
  return <div>Not found :(</div>;
}
