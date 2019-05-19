import React, { CSSProperties, ReactNode, useCallback } from 'react';

export function Button({
  onClick,
  children,
  disabled,
  style,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const handler = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      onClick();
    },
    [onClick],
  );
  return (
    <button
      onClick={handler}
      onTouchStart={handler}
      className={className}
      style={style}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
