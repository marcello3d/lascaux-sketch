import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawletApp.module.css';
import { useAppendChild } from '../react-hooks/useAppendChild';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import useEventEffect from '../react-hooks/useEventEffect';
import { Icon } from '../ui/Icon';
import { LascauxDomInstance, LascauxUiState } from '../lascaux/Drawlet';
import DrawingModel from '../lascaux/data-model/DrawingModel';
import createLascauxDomInstance from '../lascaux/browser/setup-canvas-bridge';
import { db } from '../db/db';
import { newDate, newId } from '../db/fields';

import { addLayer } from '../lascaux/DrawingDocUtil';
import { Brush, Color, UserMode } from '../lascaux/DrawingDoc';
import { LayerList } from './LayerList';
import { ColorChooser } from './ColorChooser';
import { useMousetrap } from '../react-hooks/useMousetrap';
import { IconsUrls } from './IconUrls';

type Props = {
  drawingModel: DrawingModel;
  lascauxDomRef?: MutableRefObject<LascauxDomInstance | null>;
  iconUrls: IconsUrls;
};

const numberFormat = new Intl.NumberFormat();

export function PlaybackApp({ drawingModel, lascauxDomRef, iconUrls }: Props) {
  const drawletContainerRef = useRef<HTMLDivElement>(null);
  const [updateObjectState, setUpdateObject] = useState<LascauxUiState | null>(
    null,
  );

  const canvasInstance = useMemo(
    () => createLascauxDomInstance(drawingModel, setUpdateObject, false),
    [drawingModel],
  );
  useEffect(() => {
    if (lascauxDomRef) {
      lascauxDomRef.current = canvasInstance;
    }
  }, [canvasInstance, lascauxDomRef]);

  const { cursor, playing, strokeCount } =
    updateObjectState || canvasInstance.getUiState();

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const seek = useCallback(
    (cursor: number) => {
      canvasInstance.seekTo(cursor);
    },
    [canvasInstance],
  );

  const togglePlay = useCallback(() => {
    canvasInstance.setPlaying(!playing);
  }, [canvasInstance, playing]);

  return (
    <div className={styles.root}>
      <div
        ref={drawletContainerRef}
        touch-action="none"
        className={styles.canvasContainer}
      />
      <div className={styles.status}>
        <Button disabled={strokeCount === 0} onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Slider
          label="Drawing Playback"
          min={0}
          step={1}
          max={strokeCount}
          value={cursor}
          valueLabel={numberFormat.format(cursor)}
          onChange={seek}
          className={styles.cursorSlider}
        />
      </div>
    </div>
  );
}
