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
import { MOUSETRAP_MOD } from './keyboard';

function useUpdateBrush<K extends keyof Brush & string>(
  canvasInstance: LascauxDomInstance,
  { brush, brushes }: UserMode,
  field: K,
): [Brush[K], (newValue: Brush[K]) => void, (newValue: Brush[K]) => void] {
  const value = brushes[brush][field];
  const [tempValue, setTempValue] = useState<Brush[K] | undefined>(value);
  const setValue = useCallback(
    (alpha: Brush[K]) => {
      canvasInstance.mutateMode((draft) => {
        draft.brushes[brush][field] = alpha;
      });
      setTempValue(undefined);
    },
    [canvasInstance, field, brush],
  );

  return [tempValue ?? value, setTempValue, setValue];
}

type Props = {
  drawingId: string;
  drawingModel: DrawingModel;
  saveButton?: React.ReactNode;
  lascauxDomRef?: MutableRefObject<LascauxDomInstance | null>;
  iconUrls: IconsUrls;
};

const numberFormat = new Intl.NumberFormat();

export function DrawletApp({
  drawingId,
  drawingModel,
  lascauxDomRef,
  saveButton,
  iconUrls,
}: Props) {
  const drawletContainerRef = useRef<HTMLDivElement>(null);
  const [updateObjectState, setUpdateObject] = useState<LascauxUiState | null>(
    null,
  );

  const canvasInstance = useMemo(
    () => createLascauxDomInstance(drawingModel, setUpdateObject),
    [drawingModel],
  );
  useEffect(() => {
    if (lascauxDomRef) {
      lascauxDomRef.current = canvasInstance;
    }
  }, [canvasInstance, lascauxDomRef]);

  useEffect(() => {
    return () => {
      canvasInstance.getPng().then((thumbnail) =>
        db.thumbnails.put({
          drawingId,
          thumbnail,
          updatedAt: newDate(),
        }),
      );
    };
  }, [canvasInstance, drawingId]);
  useEventEffect(
    canvasInstance.dom,
    'touchmove',
    (event: MouseEvent) => {
      event.preventDefault();
    },
    { passive: false },
  );

  const {
    artboard,
    mode,
    redo,
    cursor,
    transform,
    playing,
    undo,
    strokeCount,
  } = updateObjectState || canvasInstance.getUiState();

  useLayoutEffect(() => canvasInstance.subscribe(), [canvasInstance]);

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const [brushSize, setTempBrushSize, setBrushSize] = useUpdateBrush(
    canvasInstance,
    mode,
    'size',
  );
  const [brushFlow, setTempBrushFlow, setBrushFlow] = useUpdateBrush(
    canvasInstance,
    mode,
    'flow',
  );
  const [brushSpacing, setTempBrushSpacing, setBrushSpacing] = useUpdateBrush(
    canvasInstance,
    mode,
    'spacing',
  );
  const [
    brushHardness,
    setTempBrushHardness,
    setBrushHardness,
  ] = useUpdateBrush(canvasInstance, mode, 'hardness');
  const setZoomScale = useCallback((scale) => canvasInstance.setScale(scale), [
    canvasInstance,
  ]);
  const zoomIn = useCallback(() => {
    canvasInstance.setScale(transform.scale + 0.25);
    return false;
  }, [canvasInstance, transform]);
  const zoomOut = useCallback(() => {
    canvasInstance.setScale(transform.scale - 0.25);
    return false;
  }, [canvasInstance, transform]);
  const zoomTo100 = useCallback(() => {
    canvasInstance.setScale(1);
    return false;
  }, [canvasInstance]);

  const seek = useCallback(
    (cursor: number) => {
      canvasInstance.seekTo(cursor);
    },
    [canvasInstance],
  );

  const togglePlay = useCallback(() => {
    canvasInstance.setPlaying(!playing);
  }, [canvasInstance, playing]);
  const onAddLayer = useCallback(() => {
    const newLayerId = newId();
    canvasInstance.mutateArtboard((draft) => {
      addLayer(draft, newLayerId);
    });
    canvasInstance.mutateMode((draft) => {
      draft.layer = newLayerId;
    });
  }, [canvasInstance]);
  const onUndo = useCallback(() => {
    if (undo) {
      canvasInstance.addGoto(undo);
    }
    return false;
  }, [canvasInstance, undo]);
  const onRedo = useCallback(() => {
    if (redo) {
      canvasInstance.addGoto(redo);
    }
    return false;
  }, [canvasInstance, redo]);

  const onSelectLayer = useCallback(
    (layerId: string) => {
      canvasInstance.mutateMode((draft) => {
        draft.layer = layerId;
      });
    },
    [canvasInstance],
  );
  const onRenameLayer = useCallback(
    (layerId: string, newName: string) => {
      canvasInstance.mutateArtboard((draft) => {
        draft.layers[layerId].name = newName;
      });
    },
    [canvasInstance],
  );
  const chooseEraser = useCallback(
    () =>
      canvasInstance.mutateMode((draft) => {
        draft.brushes[draft.brush].mode = 'erase';
      }),
    [canvasInstance],
  );
  const chooseBrush = useCallback(
    () =>
      canvasInstance.mutateMode((draft) => {
        draft.brushes[draft.brush].mode = 'paint';
      }),
    [canvasInstance],
  );
  const onEraseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      canvasInstance.mutateMode((draft) => {
        draft.brushes[draft.brush].mode = event.target.checked
          ? 'erase'
          : 'paint';
      });
    },
    [canvasInstance],
  );

  const onChangeColor = useCallback(
    (color: Color) =>
      canvasInstance.mutateMode((draft) => {
        draft.color = color;
      }),
    [canvasInstance],
  );
  const brush = mode.brushes[mode.brush];

  useMousetrap(`${MOUSETRAP_MOD}+z`, onUndo);
  useMousetrap(`${MOUSETRAP_MOD}+shift+z`, onRedo);
  useMousetrap(`${MOUSETRAP_MOD}+=`, zoomIn);
  useMousetrap(`${MOUSETRAP_MOD}+-`, zoomOut);
  useMousetrap(`${MOUSETRAP_MOD}+0`, zoomTo100);
  useMousetrap('b', chooseBrush);
  useMousetrap('e', chooseEraser);

  return (
    <div className={styles.root}>
      <div className={styles.tools}>
        {saveButton}
        <Button disabled={strokeCount === 0} onClick={togglePlay}>
          <Icon
            file={playing ? iconUrls.pause : iconUrls.play}
            alt={playing ? 'Pause' : 'Play'}
          />
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
        <Button disabled={undo === undefined} onClick={onUndo}>
          <Icon file={iconUrls.undo} alt="Undo icon" />
          Undo
        </Button>
        <Button disabled={redo === undefined} onClick={onRedo}>
          <Icon file={iconUrls.redo} alt="Redo icon" />
          Redo
        </Button>
      </div>
      <div className={styles.left}>
        <div>
          <label className={styles.toolLabel}>Color</label>
          <label className={styles.value}>
            <input
              type="checkbox"
              checked={brush.mode === 'erase'}
              onChange={onEraseChange}
            />{' '}
            Erase
          </label>
        </div>
        <ColorChooser color={mode.color} onChangeColor={onChangeColor} />
        <Slider
          label="Size"
          min={1}
          max={100}
          value={brushSize}
          valueLabel={`${brushSize}px`}
          onChange={setTempBrushSize}
          onAfterChange={setBrushSize}
        />
        <Slider
          label="Opacity"
          min={0.01}
          max={1.0}
          step={0.01}
          value={brushFlow}
          valueLabel={`${(brushFlow * 100).toFixed(0)}%`}
          onChange={setTempBrushFlow}
          onAfterChange={setBrushFlow}
        />
        <Slider
          label="Spacing"
          min={0.005}
          max={0.25}
          step={0.005}
          value={brushSpacing}
          valueLabel={`${brushSpacing.toFixed(2)}x`}
          onChange={setTempBrushSpacing}
          onAfterChange={setBrushSpacing}
        />
        <Slider
          label="Hardness"
          min={0.0}
          max={1.0}
          step={0.01}
          value={brushHardness}
          valueLabel={`${(brushHardness * 100).toFixed(0)}%`}
          onChange={setTempBrushHardness}
          onAfterChange={setBrushHardness}
        />
        <Slider
          label="Zoom"
          min={0.1}
          step={0.05}
          marks={[1]}
          max={5}
          value={transform.scale}
          valueLabel={`${(transform.scale * 100).toFixed(0)}%`}
          onChange={setZoomScale}
        />
        <label className={styles.toolLabel}>Layers</label>
        <span className={styles.layers}>
          <LayerList
            ids={artboard.rootLayers}
            artboard={artboard}
            mode={mode}
            onSelectLayer={onSelectLayer}
            onRenameLayer={onRenameLayer}
            iconUrls={iconUrls}
          />
        </span>
        <Button onClick={onAddLayer}>
          <Icon file={iconUrls.layerPlus} alt="Layer plus icon" />
          Add Layer
        </Button>
        <label className={styles.toolLabel}>Diagnostics</label>
        <p className={styles.diagInfo}>{canvasInstance.getInfo()}</p>
        <p>
          build{' '}
          <a
            href={`https://github.com/marcello3d/lascaux-sketch/commit/${process.env.REACT_APP_GIT_SHA}`}
          >
            {(process.env.REACT_APP_GIT_SHA ?? 'unknown').slice(0, 8)}
          </a>
        </p>
      </div>
      <div
        ref={drawletContainerRef}
        touch-action="none"
        className={styles.canvasContainer}
      />
      <div className={styles.right} />
      <div className={styles.status} />
    </div>
  );
}
