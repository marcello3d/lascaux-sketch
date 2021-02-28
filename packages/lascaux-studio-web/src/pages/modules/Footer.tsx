import React from 'react';

import styles from './Footer.module.css';

import GithubIcon from '../../icons/fa/github.svg';
import TwitterIcon from '../../icons/fa/twitter.svg';
import { Icon } from '../../ui/Icon';

type Props = {
  children?: React.ReactNode;
};
export function Footer({ children }: Props) {
  return (
    <footer className={styles.root}>
      Lascaux Sketch ©2020{' '}
      <a href="https://marcello.cellosoft.com/">Marcello Bastea-Forte</a>
      <a href="https://twitter.com/marcello3d/">
        <Icon file={TwitterIcon} alt="Twitter icon" />
      </a>{' '}
      —
      <a href="https://github.com/marcello3d/lascaux-sketch/">
        <Icon file={GithubIcon} alt="Github icon" />
      </a>
      build{' '}
      <a
        href={`https://github.com/marcello3d/lascaux-sketch/commit/${process.env.REACT_APP_GIT_SHA}`}
      >
        {(process.env.REACT_APP_GIT_SHA ?? 'unknown').slice(0, 8)}
      </a>{' '}
      (
      <a
        href={`https://github.com/marcello3d/lascaux-sketch/tree/${process.env.REACT_APP_GIT_BRANCH}`}
      >
        {process.env.REACT_APP_GIT_BRANCH}
      </a>
      )
    </footer>
  );
}
