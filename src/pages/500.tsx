import React from 'react';
import styles from './error.module.css';
import PooStormIcon from '../icons/fa/poo-storm.svg';
import { Layout } from '../ui/Layout';
import { Icon } from '../ui/Icon';

type Props = {
  error: Error;
};
export function InternalErrorPage({ error }: Props) {
  return (
    <Layout className={styles.root}>
      <h1>
        <Icon file={PooStormIcon} alt="Error icon" />
        Apologies, we've had an error!
      </h1>
      <h2>{error.toString()}</h2>
      <pre>{error.stack}</pre>
      <p>
        <a href="/">Restart page</a>
      </p>
    </Layout>
  );
}
