import React, { useCallback, useState } from 'react';
import shortid from 'shortid';
import classNames from 'classnames';

import styles from './Slider.module.css';

type Props = {
  min: number;
  max: number;
  step?: number;
  value: number;
  marks?: number[];
  onChange: (value: number) => void;
  onAfterChange?: (value: number) => void;
  className?: string;
};

export function Slider({
  className,
  min,
  max,
  step = 1,
  marks,
  value,
  onChange,
  onAfterChange,
}: Props) {
  const [linkid] = useState(() => shortid());
  const [dragStart, setDragging] = useState<number | undefined>(undefined);
  const scale = 1 / step;
  const onStartDrag = useCallback(() => setDragging(value), [value]);
  const onEndDrag = useCallback(() => {
    if (value !== dragStart) {
      onAfterChange?.(value);
    }
    setDragging(undefined);
  }, [value, dragStart, onAfterChange]);
  const onChangeInternal = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseInt(event.target.value, 10) / scale);
    },
    [onChange, scale],
  );
  return (
    <>
      <input
        type="range"
        className={classNames(styles.slider, className)}
        min={min * scale}
        max={max * scale}
        step={step * scale}
        value={value * scale}
        onPointerDown={onStartDrag}
        onPointerUp={onEndDrag}
        onChange={onChangeInternal}
        list={marks ? linkid : undefined}
      />
      {marks && (
        <datalist id={linkid}>
          {marks.map((mark) => (
            <option key={mark} value={mark * scale} />
          ))}
        </datalist>
      )}
    </>
  );
}
