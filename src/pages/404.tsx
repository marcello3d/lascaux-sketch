import { RouteComponentProps } from '@reach/router';
import React from 'react';
import styles from './error.module.css';
import SwatchBookIcon from '../icons/fa/swatchbook.svg';

export function NotFoundPage(props: RouteComponentProps) {
  return (
    <div className={styles.root}>
      <h1>
        <img src={SwatchBookIcon} alt="Sad tear" className={styles.icon} /> Huh.
      </h1>
      <p>
        <b>{props.uri}</b> not found :(
      </p>
    </div>
  );
}
