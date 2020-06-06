import styles from './loading.module.css';
import Spinner from 'react-spinkit';
import React from 'react';

export function LoadingPage() {
  return (
    <div className={styles.root}>
      <Spinner name="cube-grid" overrideSpinnerClassName={styles.icon} />
    </div>
  );
}
