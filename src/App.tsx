import React, { useState } from 'react';
import DrawingApp from './DrawingApp';

import styles from './App.module.css';
import useEventEffect from './react-hooks/useEventEffect';
import Measure, { ContentRect } from 'react-measure';

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
  const [{ width, height }, setContentRect] = useState<{
    width: number;
    height: number;
  }>({ width: 10, height: 10 });

  const onResize = ({ bounds }: ContentRect) => {
    if (bounds) {
      const { width, height } = bounds;
      setContentRect({ width, height });
    }
  };
  return (
    <div className={styles.root}>
      <header className={styles.head}>Sketchperiment 1 by <a href="https://marcello.cellosoft.com/">marcello</a></header>
      <Measure bounds onResize={onResize}>
        {({ measureRef }) => (
          <main ref={measureRef} className={styles.main}>
            <DrawingApp width={width} height={height} />
          </main>
        )}
      </Measure>
    </div>
  );
}
