import styles from './Layout.module.css';
import { Header } from './Header';
import React, { useMemo } from 'react';
import classNames from 'classnames';
import { Footer } from './Footer';

const defaultHeader = <Header />;

type Props = {
  className?: string;
  header?: React.ReactNode;
  footer?: boolean;
  children: React.ReactNode;
};

export function Layout({
  className,
  header = defaultHeader,
  children,
  footer = true,
}: Props) {
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
      {footer && <Footer />}
    </div>
  );
}
