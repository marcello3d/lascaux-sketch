import { db, DbDrawing } from '../../db/db';
import { useDexieArray, useDexieItem } from '../../db/useDexie';
import React, { useMemo } from 'react';
import { Link } from '@reach/router';
import styles from './DrawingGrid.module.css';
import { Icon } from '../../ui/Icon';
import IconImagePolaroid from '../../icons/fa/image-polaroid.svg';
import { useBlobAsUrl } from '../../react-hooks/useBlobAsUrl';

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
  return (
    <Link to={`drawings/${id}`} className={styles.drawing}>
      <div className={styles.icon}>
        <DrawingThumbnail drawingId={id} />
      </div>
      <div className={styles.name}>{name}</div>
      <div className={styles.size}>
        {width} ⨉ {height}
      </div>
      <div className={styles.date}>{new Date(createdAt).toLocaleString()}</div>
    </Link>
  );
}

export function DrawingThumbnail({ drawingId }: { drawingId: string }) {
  const blob = useDexieItem(db.thumbnails, drawingId)?.thumbnail;
  const url = useBlobAsUrl(blob);
  if (url) {
    return (
      <img
        src={url}
        width={100}
        height={100}
        alt="Drawing thumbnail"
        className={styles.icon}
      />
    );
  }
  return <Icon file={IconImagePolaroid} alt="Drawing icon" />;
}
