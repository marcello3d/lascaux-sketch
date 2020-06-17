import { RouteComponentProps } from '@reach/router';
import React from 'react';
import styles from './error.module.css';
import SwatchBookIcon from '../icons/fa/swatchbook.svg';
import { Layout } from '../ui/Layout';
import { Icon } from '../ui/Icon';

export function NotFoundPage(props: RouteComponentProps) {
  return (
    <Layout className={styles.root}>
      <h1>
        <Icon file={SwatchBookIcon} alt="Not found icon" />
        Huh.
      </h1>
      <p>
        <b>{props.uri}</b> not found :(
      </p>
    </Layout>
  );
}
