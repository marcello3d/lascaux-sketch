import { useDispatch, useSelector } from 'react-redux';
import React, { useCallback, useMemo } from 'react';
import { AppState } from '../app/state';
import { newDrawing } from '../app/actions';
import { Link, RouteComponentProps } from '@reach/router';
import styles from './page.module.css';

function Drawings() {
  const drawings = useSelector(
    useCallback((state: AppState) => state.drawings, []),
  );
  const items = useMemo(
    () =>
      Object.entries(drawings).map(([drawingId, { width, height }]) => (
        <li key={drawingId}>
          <Link to={`drawings/${drawingId}`}>{drawingId}</Link>
        </li>
      )),
    [drawings],
  );

  return <ul>{items}</ul>;
}

export function IndexPage(props: RouteComponentProps) {
  const dispatch = useDispatch();
  const addDrawing = () => dispatch(newDrawing({ width: 500, height: 500 }));

  return (
    <div className={styles.root}>
      <h2>Index page</h2>
      <Drawings />
      <p>
        <button onClick={addDrawing}>New Drawing</button>
      </p>
    </div>
  );
}
