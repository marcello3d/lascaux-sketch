import styles from './loading.module.css';
import React from 'react';

export function LoadingPage() {
  return (
    <div className={styles.root}>
      <div className={styles.icon}>
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
    </div>
  );
}
