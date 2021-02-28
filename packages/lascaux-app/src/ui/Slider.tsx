import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';

import styles from './Slider.module.css';
import { clamp } from '../lascaux/util/clipping';
import useEventEffect from '../react-hooks/useEventEffect';

type Props = {
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  valueLabel?: string;
  marks?: number[];
  onChange: (value: number) => void;
  onAfterChange?: (value: number) => void;
  className?: string;
};

export function Slider({
  className,
  label,
  min,
  max,
  step = 1,
  marks,
  value,
  valueLabel = String(value),
  onChange,
  onAfterChange,
}: Props) {
  const [dragRect, setDragging] = useState<DOMRect | undefined>(undefined);
  const scale = 1 / step;

  const computeValue = useCallback(
    (event: React.MouseEvent | MouseEvent, rect: DOMRect) => {
      const rawValue = ((event.clientX - rect.x) / rect.width) * (max - min);
      return clamp(Math.floor(rawValue * scale) / scale + min, min, max);
    },
    [max, min, scale],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.focus();
      const rect = event.currentTarget.getBoundingClientRect();
      setDragging(rect);
      onChange(computeValue(event, rect));
    },
    [computeValue, onChange],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let newValue = value;
      const stepAmount = step * (event.shiftKey ? 10 : 1);
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          newValue += stepAmount;
          break;
        case 'PageUp':
          newValue += stepAmount * 10;
          break;
        case 'PageDown':
          newValue -= stepAmount * 10;
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue -= stepAmount;
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
      }
      newValue = clamp(newValue, min, max);
      if (value !== newValue) {
        onChange(newValue);
      }
    },
    [max, min, onChange, step, value],
  );

  const onKeyUp = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowDown':
          onAfterChange?.(value);
          break;
      }
    },
    [onAfterChange, value],
  );

  useEventEffect(
    dragRect ? window : undefined,
    'pointermove',
    (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (dragRect) {
        onChange(computeValue(event, dragRect));
      }
    },
    { capture: true },
  );
  const onPointerUp = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onAfterChange && dragRect) {
      onAfterChange(computeValue(event, dragRect));
    }
    setDragging(undefined);
  };
  useEventEffect(dragRect ? window : undefined, 'pointerup', onPointerUp, {
    capture: true,
  });
  useEventEffect(dragRect ? window : undefined, 'pointercancel', onPointerUp, {
    capture: true,
  });
  useEventEffect(
    dragRect ? window : undefined,
    'touchmove',
    (event: MouseEvent) => {
      event.preventDefault();
    },
    { passive: false },
  );

  const thumbStyle = useMemo(
    () => ({
      left: `${clamp((100 * (value - min)) / (max - min), 0, 100)}%`,
    }),
    [max, min, value],
  );
  const markDivs = useMemo(
    () =>
      marks?.map((mark) => (
        <div
          key={mark}
          className={styles.mark}
          style={{
            left: `${clamp((100 * (mark - min)) / (max - min), 0, 100)}%`,
          }}
        />
      )),
    [marks, max, min],
  );

  return (
    <div
      className={classNames(styles.slider, className)}
      role="slider"
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueLabel}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      tabIndex={0}
    >
      <div className={styles.thumb} style={thumbStyle} />
      <div className={styles.label}>{label}</div>
      <div className={styles.valueLabel}>{valueLabel}</div>
      {markDivs}
    </div>
  );
}
