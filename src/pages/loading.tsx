import styles from './loading.module.css';
import React from 'react';

export function LoadingPage() {
  return (
    <div className={styles.root}>
      <div className={styles['sk-cube-grid']}>
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
      <div>Loading…</div>
    </div>
  );
}
