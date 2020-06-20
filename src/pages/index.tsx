import React, { ChangeEvent, Suspense, useCallback, useState } from 'react';
import { Link, RouteComponentProps } from '@reach/router';

import styles from './index.module.css';
import LascauxLogoPath from './lascaux-logo.jpg';
import PizzaSliceIcon from '../icons/fa/pizza-slice.svg';

import { db } from '../db/db';
import { newDate, newId } from '../db/fields';
import { Layout } from '../ui/Layout';
import { newDna } from '../lascaux/dna';
import classNames from 'classnames';
import { DrawingGrid } from '../ui/DrawingGrid';
import { Icon } from '../ui/Icon';

function validSize(input: string): number | undefined {
  if (!/^\d+$/.test(input)) {
    return undefined;
  }
  const n = parseInt(input, 10);
  if (n < 8 || n > 4096) {
    return undefined;
  }
  return n;
}

export function IndexPage({ navigate }: RouteComponentProps) {
  const [stringWidth, setWidth] = useState('512');
  const [stringHeight, setHeight] = useState('512');
  const onWidthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setWidth(event.target.value),
    [],
  );
  const onHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setHeight(event.target.value),
    [],
  );
  const width = validSize(stringWidth);
  const height = validSize(stringHeight);
  const addDrawing = useCallback(
    async (event: React.SyntheticEvent) => {
      event.preventDefault();
      if (width === undefined || height === undefined) {
        return;
      }
      const id = newId();
      await db.drawings.add({
        id,
        createdAt: newDate(),
        dna: newDna(width, height),
      });
      navigate?.(`/drawings/${id}`);
    },
    [width, height, navigate],
  );

  return (
    <Layout className={styles.root}>
      <div className={styles.column}>
        <h2>Local Drawings</h2>
        <p>Drawings are saved in your browser's local storage.</p>
        <form onSubmit={addDrawing}>
          <button
            onClick={addDrawing}
            disabled={!(width !== undefined && height !== undefined)}
          >
            <Icon
              file={PizzaSliceIcon}
              alt="Pizza slice icon for new drawing button"
            />
            New Drawing
          </button>{' '}
          Size:{' '}
          <input
            className={classNames(styles.input, {
              [styles.invalid]: width === undefined,
            })}
            value={stringWidth}
            inputMode="numeric"
            onChange={onWidthChange}
          />
          {' ⨉ '}
          <input
            className={classNames(styles.input, {
              [styles.invalid]: height === undefined,
            })}
            value={stringHeight}
            inputMode="numeric"
            onChange={onHeightChange}
          />
        </form>
        <Suspense fallback={<p>Retrieving…</p>}>
          <DrawingGrid />
        </Suspense>
      </div>
      <div className={styles.column}>
        <p>
          <img
            src={LascauxLogoPath}
            alt="Original Lascaux Sketch logo circa 2002"
            width={300}
            height={170}
          />
        </p>
        <h2>About</h2>
        <p>
          Lascaux Sketch was originally a Java Applet I wrote back in{' '}
          <a href="https://web.archive.org/web/20041009175410/http://www.cellosoft.com/sketchstudio/">
            2002
          </a>{' '}
          used on <a href="https://2draw.net/">2draw.net</a>. This is a new
          version built from the ground up using TypeScript and WebGL.
        </p>
        <h2>Diagnostics</h2>
        <p>
          Check out <Link to="/diag">diagnostics</Link> to see how Lascaux
          Sketch handles your input device (tablet/mouse/touch screen)
        </p>

        <h2>Changelog</h2>

        <h3>2020-06-20</h3>
        <ul>
          <li>Improve UI, add icons</li>
          <li>Fix bugs where drawing list does not update</li>
          <li>Prevent accidental dots when pinch zooming</li>
        </ul>

        <h3>2020-06-19</h3>
        <ul>
          <li>Add thumbnails</li>
          <li>Block swipe back/forward on Chrome while drawing</li>
        </ul>

        <h3>2020-06-18</h3>
        <ul>
          <li>Canvas size option</li>
        </ul>

        <h3>2020-06-16</h3>
        <ul>
          <li>Added "Save PNG" button</li>
        </ul>

        <h3>2020-06-14</h3>
        <ul>
          <li>Version to header</li>
          <li>Code/deployment reorganization</li>
        </ul>

        <h3>2020-06-13</h3>
        <ul>
          <li>Support for float16 (if float32 is not available)</li>
          <li>Faster undo after reloading drawing</li>
        </ul>

        <h3>2020-06-09</h3>
        <ul>
          <li>Click to add a dot</li>
          <li>Brush spacing and hardness sliders</li>
          <li>
            <a href="https://sentry.io">Sentry</a> error tracking
          </li>
          <li>Smoother brush rendering</li>
        </ul>

        <h3>2020-06-06</h3>
        <ul>
          <li>First public release!</li>
          <li>Save drawings to local storage</li>
          <li>Loading screen</li>
        </ul>
      </div>
    </Layout>
  );
}
