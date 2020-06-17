import styles from './header.module.css';
import { Link } from '@reach/router';
import React from 'react';

type Props = {
  children?: React.ReactNode;
};
export function Header({ children }: Props) {
  return (
    <header className={styles.head}>
      <div className={styles.logo}>
        <Link to="/">Lascaux Sketch 2</Link> by{' '}
        <a href="https://marcello.cellosoft.com/">marcello</a>
      </div>
      <div className={styles.middle}>{children}</div>
      <div className={styles.version}>
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
      </div>
    </header>
  );
}
