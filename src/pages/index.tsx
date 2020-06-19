import React, {
  ChangeEvent,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Link, RouteComponentProps } from '@reach/router';
import raw from 'raw.macro';

import styles from './index.module.css';
import LascauxLogoPath from './lascaux-logo.jpg';
import IconImagePolaroid from '../icons/fa/image-polaroid.svg';

import { db } from '../db/db';
import { newDate, newId } from '../db/fields';
import { useDexieArray } from '../db/useDexie';
import { Layout } from '../ui/Layout';
import { newDna } from '../lascaux/dna';
import classNames from 'classnames';

const changelog = raw('../../CHANGELOG.md');

const sortedDrawings = db.drawings.orderBy('createdAt').reverse();
function Drawings() {
  const drawings = useDexieArray(db.drawings, sortedDrawings);
  const items = useMemo(
    () =>
      drawings.map(({ id, name = 'Untitled drawing', createdAt }) => (
        <li key={id}>
          <img
            src={IconImagePolaroid}
            width={20}
            height={20}
            alt="Drawing icon"
          />
          <div>
            <Link to={`drawings/${id}`}>{name}</Link>
            <span className={styles.date}>
              {new Date(createdAt).toLocaleString()}
            </span>
          </div>
        </li>
      )),
    [drawings],
  );

  return <ul className={styles.list}>{items}</ul>;
}

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
  const addDrawing = useCallback(async () => {
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
  }, [width, height, navigate]);

  return (
    <Layout className={styles.root}>
      <div className={styles.column}>
        <h2>Local Drawings</h2>
        <p>Drawings are saved in your browser's local storage.</p>
        <p>
          <button
            onClick={addDrawing}
            disabled={!(width !== undefined && height !== undefined)}
          >
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
        </p>
        <Suspense fallback={<p>Retrieving…</p>}>
          <Drawings />
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
        <pre>{changelog}</pre>
      </div>
    </Layout>
  );
}
