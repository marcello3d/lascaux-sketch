import React, { Suspense, useMemo } from 'react';
import { Link, RouteComponentProps } from '@reach/router';
import styles from './page.module.css';
import { db } from '../db/db';
import { newDate, newId } from '../db/fields';
import { useDexieArray } from '../db/useDexie';
import { newDna } from '../drawlets/fiver/fiver';

const sortedDrawings = db.drawings.orderBy('createdAt');
function Drawings() {
  const drawings = useDexieArray(db.drawings, sortedDrawings);
  const items = useMemo(
    () =>
      drawings.map(({ id, createdAt }) => (
        <li key={id}>
          <Link to={`drawings/${id}`}>{id}</Link> -{' '}
          {new Date(createdAt).toLocaleString()}
        </li>
      )),
    [drawings],
  );

  return <ul>{items}</ul>;
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
    <div className={styles.root}>
      <h2>Index page</h2>
      <Suspense fallback={<p>Loading…</p>}>
        <Drawings />
      </Suspense>
      <p>
        <button onClick={addDrawing}>New Drawing</button>
      </p>
    </div>
  );
}
