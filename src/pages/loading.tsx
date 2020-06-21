import styles from './loading.module.css';
import React from 'react';
import { Layout } from './modules/Layout';

export function LoadingPage() {
  return (
    <Layout className={styles.root}>
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
    </Layout>
  );
}
