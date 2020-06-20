import { db, DbDrawing } from '../db/db';
import { useDexieArray, useDexieItem } from '../db/useDexie';
import React, { useMemo } from 'react';
import { Link } from '@reach/router';
import styles from './DrawingGrid.module.css';
import { Icon } from './Icon';
import IconImagePolaroid from '../icons/fa/image-polaroid.svg';

const sortedDrawings = db.drawings.orderBy('createdAt').reverse();

export function DrawingGrid() {
  const drawings = useDexieArray(db.drawings, sortedDrawings);
  const items = useMemo(
    () =>
      drawings.map((drawing) => (
        <DrawingButton key={drawing.id} {...drawing} />
      )),
    [drawings],
  );
  return <div className={styles.list}>{items}</div>;
}

export function DrawingButton({
  id,
  name = 'Untitled',
  createdAt,
  dna: { width, height },
}: DbDrawing) {
  const blob = useDexieItem(db.thumbnails, id)?.thumbnail;
  const url = useMemo(() => blob && window.URL.createObjectURL(blob), [blob]);
  return (
    <Link to={`drawings/${id}`} className={styles.drawing}>
      {url ? (
        <img
          src={url}
          width={100}
          height={100}
          alt="Drawing thumbnail"
          className={styles.icon}
        />
      ) : (
        <div className={styles.icon}>
          <Icon file={IconImagePolaroid} alt="Drawing icon" />
        </div>
      )}
      <div className={styles.name}>{name}</div>
      <div className={styles.size}>
        {width} ⨉ {height}
      </div>
      <div className={styles.date}>{new Date(createdAt).toLocaleString()}</div>
    </Link>
  );
}
