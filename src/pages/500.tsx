import React from 'react';
import styles from './error.module.css';
import PooStormIcon from '../icons/fa/poo-storm.svg';

type Props = {
  error: Error;
};
export function InternalErrorPage({ error }: Props) {
  return (
    <div className={styles.root}>
      <h1>
        <img src={PooStormIcon} alt="Sad tear" className={styles.icon} />{' '}
        Apologies, we've had an error!
      </h1>
      <h2>{error.toString()}</h2>
      <pre>{error.stack}</pre>
      <p>
        <a href="/">Restart page</a>
      </p>
    </div>
  );
}
