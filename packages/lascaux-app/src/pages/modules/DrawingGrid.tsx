import { db, DbDrawing } from '../../db/db';
import React, { useCallback, useMemo } from 'react';
import { Link } from '@reach/router';
import styles from './DrawingGrid.module.css';
import { Icon } from '../../ui/Icon';
import IconImagePolaroid from '../../icons/fa/image-polaroid.svg';
import { useBlobAsUrl } from '../../react-hooks/useBlobAsUrl';

import {
  useDexieArray,
  useDexieItem,
  useDexieItemUpdate,
} from '../../db/useDexie';
import { EditName } from '../../ui/EditName';

const sortedDrawings = db.drawings.orderBy('createdAt').reverse();

export function DrawingGrid() {
  const drawings = useDexieArray(db.drawings, sortedDrawings);
  const groups = useMemo(() => {
    const groups: Record<string, DbDrawing[]> = {};
    for (const drawing of drawings) {
      const date = new Date(drawing.createdAt);
      const str = date.toLocaleDateString();
      if (!groups[str]) {
        groups[str] = [];
      }
      groups[str].push(drawing);
    }
    return Object.keys(groups).map((group) => ({
      group,
      drawings: groups[group],
    }));
  }, [drawings]);
  return useMemo(
    () => (
      <>
        {groups.map(({ group, drawings }) => (
          <React.Fragment key={group}>
            <h3>{group}</h3>
            <div className={styles.list}>
              {drawings.map((drawing) => (
                <DrawingButton key={drawing.id} drawingId={drawing.id} />
              ))}
            </div>
          </React.Fragment>
        ))}
      </>
    ),
    [groups],
  );
}

export function DrawingButton({ drawingId }: { drawingId: string }) {
  const drawing = useDexieItem(db.drawings, drawingId);
  const updateDrawing = useDexieItemUpdate(db.drawings, drawingId);
  const changeName = useCallback(
    (name: string) => {
      updateDrawing({ name });
    },
    [updateDrawing],
  );

  if (!drawing) {
    return <></>;
  }
  const {
    name = '',
    createdAt,
    dna: { width, height } = { width: 0, height: 0 },
  } = drawing;
  return (
    <div className={styles.drawing}>
      <Link to={`drawings/${drawingId}`}>
        <div className={styles.icon}>
          <DrawingThumbnail drawingId={drawingId} />
        </div>
      </Link>
      <EditName
        text={name}
        onChangeText={changeName}
        placeholder="Untitled"
        textClassName={styles.name}
        inputClassName={styles.editName}
      />
      <div className={styles.size}>
        {width} ⨉ {height}
      </div>
      <div className={styles.date}>
        {new Date(createdAt).toLocaleTimeString()}
      </div>
    </div>
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
