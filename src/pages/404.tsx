import { RouteComponentProps } from '@reach/router';
import React from 'react';
import styles from './page.module.css';

export function NotFoundPage(props: RouteComponentProps) {
  return <div className={styles.root}>Not found :(</div>;
}
