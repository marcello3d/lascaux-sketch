import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './DrawletApp.module.css';
import { useAppendChild } from '../react-hooks/useAppendChild';
import classNames from 'classnames';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import useEventEffect from '../react-hooks/useEventEffect';
import { Layout } from '../pages/modules/Layout';
import { Header } from '../pages/modules/Header';
import FileDownloadIcon from '../icons/fa/file-download.svg';
import { Icon } from '../ui/Icon';
import { downloadFile, filenameDate } from '../ui/download';
import { LascauxDomInstance, LascauxUiState } from '../lascaux/Drawlet';
import DrawingModel from '../lascaux/data-model/DrawingModel';
import createLascauxDomInstance from '../lascaux/browser/setup-canvas-bridge';
import { db } from '../db/db';
import { newDate } from '../db/fields';

import LayerPlusIcon from '../icons/fa/layer-plus.svg';
import PenSquareIcon from '../icons/fa/pen-square.svg';
import SquareIcon from '../icons/fa/square.svg';
import PlayIcon from '../icons/fa/play.svg';
import PauseIcon from '../icons/fa/pause.svg';
import UndoIcon from '../icons/fa/undo.svg';
import RedoIcon from '../icons/fa/redo.svg';
import { rgbaColorPalette } from './color-palette';
import { addLayer } from '../lascaux/DrawingDocUtil';
import {
  Brush,
  DrawingDoc,
  Id,
  ROOT_USER,
  UserMode,
} from '../lascaux/DrawingDoc';
import produce from 'immer';
import { toCssRgbaColor } from '../lascaux/util/parse-color';

function useUpdateMode<K extends keyof UserMode & string>(
  canvasInstance: LascauxDomInstance,
  updateObject: LascauxUiState,
  field: K,
): [
  UserMode[K],
  (newValue: UserMode[K]) => void,
  (newValue: UserMode[K]) => void,
] {
  const mode = updateObject.doc.users[ROOT_USER];
  const value = mode[field];
  const [tempValue, setTempValue] = useState<UserMode[K] | undefined>(value);
  const setValue = useCallback(
    (alpha: UserMode[K]) => {
      canvasInstance.updateDoc(
        produce((doc) => {
          doc.users[ROOT_USER][field] = alpha;
        }),
      );
      setTempValue(undefined);
    },
    [canvasInstance, field],
  );

  return [tempValue ?? value, setTempValue, setValue];
}

function useUpdateBrush<K extends keyof Brush & string>(
  canvasInstance: LascauxDomInstance,
  updateObject: LascauxUiState,
  field: K,
): [Brush[K], (newValue: Brush[K]) => void, (newValue: Brush[K]) => void] {
  const mode = updateObject.doc.users[ROOT_USER];
  const value = mode.brushes[mode.brush][field];
  const [tempValue, setTempValue] = useState<Brush[K] | undefined>(value);
  const setValue = useCallback(
    (alpha: Brush[K]) => {
      canvasInstance.updateDoc(
        produce((doc) => {
          doc.users[ROOT_USER][field] = alpha;
        }),
      );
      setTempValue(undefined);
    },
    [canvasInstance, field],
  );

  return [tempValue ?? value, setTempValue, setValue];
}

type Props = {
  drawingId: string;
  drawingModel: DrawingModel;
};

export function DrawletApp({ drawingId, drawingModel }: Props) {
  const drawletContainerRef = useRef<HTMLDivElement>(null);
  const [updateObjectState, setUpdateObject] = useState<LascauxUiState | null>(
    null,
  );

  const canvasInstance = useMemo(
    () => createLascauxDomInstance(drawingModel, setUpdateObject),
    [drawingModel],
  );

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

  const updateObject = updateObjectState || canvasInstance.getUiState();
  useLayoutEffect(() => canvasInstance.subscribe(), [canvasInstance]);

  useAppendChild(drawletContainerRef, drawingModel.editCanvas.dom);

  const downloadPng = useCallback(() => {
    canvasInstance.getPng().then((blob) => {
      downloadFile(blob, `Lascaux Sketch ${filenameDate()}.png`);
    });
  }, [canvasInstance]);

  const [brushSize, setTempBrushSize, setBrushSize] = useUpdateBrush(
    canvasInstance,
    updateObject,
    'size',
  );
  const [brushOpacity, setTempBrushOpacity, setBrushOpacity] = useUpdateBrush(
    canvasInstance,
    updateObject,
    'opacity',
  );
  const [brushSpacing, setTempBrushSpacing, setBrushSpacing] = useUpdateBrush(
    canvasInstance,
    updateObject,
    'spacing',
  );
  const [
    brushHardness,
    setTempBrushHardness,
    setBrushHardness,
  ] = useUpdateBrush(canvasInstance, updateObject, 'hardness');
  const setScale = useCallback((scale) => canvasInstance.setScale(scale), [
    canvasInstance,
  ]);
  const selectedColor = updateObject.doc.users[ROOT_USER].color;
  const colorButtons = useMemo(
    () =>
      rgbaColorPalette.map((color, index) => {
        const selected = color === selectedColor;
        return (
          <Button
            key={index}
            onClick={() =>
              canvasInstance.updateDoc(
                produce((doc) => {
                  doc.users[ROOT_USER].color = color;
                }),
              )
            }
            className={styles.colorButton}
            style={{
              backgroundColor: toCssRgbaColor(color),
              border: selected ? 'solid 2px white' : `solid 2px ${color}`,
            }}
          />
        );
      }),
    [canvasInstance, selectedColor],
  );
  const seek = useCallback(
    (cursor: number) => {
      canvasInstance.seekTo(cursor);
    },
    [canvasInstance],
  );

  const togglePlay = useCallback(() => {
    canvasInstance.setPlaying(!updateObject.playing);
  }, [canvasInstance, updateObject.playing]);
  const onAddLayer = useCallback(() => {
    canvasInstance.updateDoc((doc) => addLayer(doc));
  }, [canvasInstance]);
  const undo = useCallback(() => {
    if (updateObject.undo) {
      canvasInstance.addGoto(updateObject.undo);
    }
  }, [canvasInstance, updateObject.undo]);
  const redo = useCallback(() => {
    if (updateObject.redo) {
      canvasInstance.addGoto(updateObject.redo);
    }
  }, [canvasInstance, updateObject.redo]);

  const sizeSlider = useMemo(
    () => (
      <Slider
        min={1}
        max={100}
        value={brushSize}
        onChange={setTempBrushSize}
        onAfterChange={setBrushSize}
      />
    ),
    [brushSize, setBrushSize, setTempBrushSize],
  );
  const opacitySlider = useMemo(
    () => (
      <Slider
        min={0.01}
        max={1.0}
        step={0.01}
        value={brushOpacity}
        onChange={setTempBrushOpacity}
        onAfterChange={setBrushOpacity}
      />
    ),
    [brushOpacity, setBrushOpacity, setTempBrushOpacity],
  );
  const spacingSlider = useMemo(
    () => (
      <Slider
        min={0.005}
        max={0.25}
        step={0.005}
        value={brushSpacing}
        onChange={setTempBrushSpacing}
        onAfterChange={setBrushSpacing}
      />
    ),
    [brushSpacing, setBrushSpacing, setTempBrushSpacing],
  );
  const hardnessSlider = useMemo(
    () => (
      <Slider
        min={0.0}
        max={1.0}
        step={0.01}
        value={brushHardness}
        onChange={setTempBrushHardness}
        onAfterChange={setBrushHardness}
      />
    ),
    [brushHardness, setBrushHardness, setTempBrushHardness],
  );
  const zoomSlider = useMemo(
    () => (
      <Slider
        min={0.1}
        step={0.05}
        marks={[1]}
        max={5}
        value={updateObject.transform.scale}
        onChange={setScale}
      />
    ),
    [setScale, updateObject.transform.scale],
  );
  const playbackSlider = useMemo(
    () => (
      <Slider
        min={0}
        step={1}
        max={updateObject.strokeCount}
        value={updateObject.cursor}
        onChange={seek}
        className={styles.cursorSlider}
      />
    ),
    [updateObject.strokeCount, updateObject.cursor, seek],
  );

  const onChangeLayer = useCallback(
    (layerId: string) => {
      canvasInstance.updateDoc(
        produce((doc) => {
          doc.users[ROOT_USER].layer = layerId;
        }),
      );
    },
    [canvasInstance],
  );
  const layers = useMemo(() => {
    return updateObject.doc.artboard.rootLayers.map((id) => (
      <Layer
        key={id}
        id={id}
        user={ROOT_USER}
        doc={updateObject.doc}
        onChange={onChangeLayer}
      />
    ));
  }, [onChangeLayer, updateObject.doc]);

  const onEraseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      canvasInstance.updateDoc(
        produce((doc) => {
          const mode = doc.users[ROOT_USER];
          mode.brushes[mode.brush].mode = event.target.checked
            ? 'erase'
            : 'paint';
        }),
      );
    },
    [canvasInstance],
  );

  const mode = updateObject.doc.users[ROOT_USER];
  const brush = mode.brushes[mode.brush];

  const currentColorStyle = useMemo(
    () => ({ backgroundColor: toCssRgbaColor(mode.color) }),
    [mode.color],
  );
  return (
    <Layout
      header={
        <Header>
          <Button onClick={downloadPng}>
            <Icon file={FileDownloadIcon} alt="download" />
            Save PNG
          </Button>
        </Header>
      }
      footer={false}
      className={styles.root}
    >
      <div className={styles.tools}>
        <Button disabled={updateObject.strokeCount === 0} onClick={togglePlay}>
          <Icon
            file={updateObject.playing ? PauseIcon : PlayIcon}
            alt={updateObject.playing ? 'Pause' : 'Play'}
          />
        </Button>
        {playbackSlider}
        <Button disabled={updateObject.undo === undefined} onClick={undo}>
          <Icon file={UndoIcon} alt="Undo icon" />
          Undo
        </Button>
        <Button disabled={updateObject.redo === undefined} onClick={redo}>
          <Icon file={RedoIcon} alt="Redo icon" />
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
        <div className={styles.colorButtons}>
          <div className={styles.currentColor} style={currentColorStyle} />
          {colorButtons}
        </div>
        <label className={styles.toolLabel}>
          Size <span className={styles.value}>{brushSize}</span>
        </label>
        {sizeSlider}
        <label className={styles.toolLabel}>
          Opacity{' '}
          <span className={styles.value}>
            {(brushOpacity * 100).toFixed(0)}%
          </span>
        </label>
        {opacitySlider}
        <label className={styles.toolLabel}>
          Spacing{' '}
          <span className={styles.value}>{brushSpacing.toFixed(2)}x</span>
        </label>
        {spacingSlider}
        <label className={styles.toolLabel}>
          Hardness{' '}
          <span className={styles.value}>
            {(brushHardness * 100).toFixed(0)}%
          </span>
        </label>
        {hardnessSlider}
        <label className={styles.toolLabel}>
          Zoom{' '}
          <span className={styles.value}>
            {(updateObject.transform.scale * 100).toFixed(0)}%
          </span>
        </label>
        {zoomSlider}
        <label className={styles.toolLabel}>Layers</label>
        <span className={styles.layers}>{layers}</span>
        <Button onClick={onAddLayer}>
          <Icon file={LayerPlusIcon} alt="Layer plus icon" />
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
    </Layout>
  );
}

function Layer({
  id,
  doc,
  user,
  onChange,
}: {
  id: string;
  doc: DrawingDoc;
  user: Id;
  onChange: (id: string) => void;
}) {
  const selected = id === doc.users[user].layer;
  const layer = doc.artboard.layers[id];
  const onClick = useCallback(() => {
    if (!selected) {
      onChange(id);
    }
  }, [selected, onChange, id]);
  const name = useMemo(
    () =>
      layer.name ??
      `Layer #${Object.keys(doc.artboard.layers).indexOf(id) + 1}`,
    [layer.name, doc.artboard.layers, id],
  );
  return (
    <>
      <Button
        className={classNames(styles.layer, {
          [styles.layerSelected]: selected,
        })}
        onClick={onClick}
      >
        <Icon
          file={selected ? PenSquareIcon : SquareIcon}
          alt={selected ? 'Selected layer' : 'Unselected layer'}
        />
        <span className={styles.layerName}>{name}</span>
      </Button>
      {layer.type === 'group' &&
        layer.layers.map((id) => (
          <Layer id={id} doc={doc} user={user} onChange={onChange} />
        ))}
    </>
  );
}
