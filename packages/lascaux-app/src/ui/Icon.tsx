import React, { useMemo } from 'react';
import styles from './Icon.module.css';
import classNames from 'classnames';

type Props = {
  file: string;
  alt: string;
  className?: string;
};

export function Icon({ file, alt, className }: Props) {
  const style = useMemo(
    () => ({
      WebkitMask: `url(${file}) no-repeat center`,
      mask: `url(${file}) no-repeat center`,
    }),
    [file],
  );
  return (
    <span
      title={alt}
      className={classNames(styles.icon, className)}
      style={style}
    />
  );
}
