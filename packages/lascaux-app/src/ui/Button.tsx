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
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      onClick();
    },
    [onClick],
  );
  return (
    <button
      onPointerUp={handleClick}
      className={className}
      style={style}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
