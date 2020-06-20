import styles from './Header.module.css';
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
    </header>
  );
}
