import styles from './Layout.module.css';
import { Header } from './header';
import React, { useMemo } from 'react';
import classNames from 'classnames';

const defaultHeader = <Header />;

type Props = {
  className?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
};

export function Layout({ className, header = defaultHeader, children }: Props) {
  const size = useMemo(() => {
    if ('standalone' in navigator) {
      return {
        // Hack to get around the fact that
        '--app-height': `${window.innerHeight}px`,
      } as React.CSSProperties;
    }
    return {};
  }, []);
  return (
    <div className={styles.root} style={size}>
      {header}
      <main className={classNames(styles.main, className)}>{children}</main>
    </div>
  );
}
