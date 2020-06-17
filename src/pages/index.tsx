import React, { Suspense, useMemo } from 'react';
import { Link, RouteComponentProps } from '@reach/router';

import styles from './page.module.css';
import LascauxLogoPath from './lascaux-logo.jpg';
import IconImagePolaroid from '../icons/fa/image-polaroid.svg';

import { db } from '../db/db';
import { newDate, newId } from '../db/fields';
import { useDexieArray } from '../db/useDexie';
import { newDna } from '../drawlets/fiver/fiver';
import { Layout } from '../ui/Layout';

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

export function IndexPage(props: RouteComponentProps) {
  const addDrawing = async () => {
    const id = newId();
    await db.drawings.add({
      id,
      createdAt: newDate(),
      dna: newDna(),
    });
    props.navigate?.(`/drawings/${id}`);
  };

  return (
    <Layout className={styles.root}>
      <div className={styles.column}>
        <h2>Local Drawings</h2>
        <p>Drawings are saved in your browser's local storage.</p>
        <p>
          <button onClick={addDrawing}>New Drawing</button>
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
      </div>
    </Layout>
  );
}
