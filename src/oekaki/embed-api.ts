/**
 * window.lascaux2: a small API for the page around the 2draw.net editor
 * (`new LascauxSketch2(...)`), e.g. the 2draw iPad app's Apple Pencil palette.
 *
 *   lascaux2.tools(): { id, label, selected }[]
 *       'brush' (Brush) and 'eraser' (Eraser): the one brush, painting or
 *       erasing (the Erase checkbox). Exactly one is selected.
 *   lascaux2.setTool(id): boolean
 *       'eraser' turns erasing on, 'brush' turns it off; false for an
 *       unknown id.
 *   lascaux2.colors(): { hex, selected }[]
 *       The current colour first ('#rrggbb', selected: true), then the
 *       editor's 16 palette swatches, selected when equal to the current one.
 *   lascaux2.setColor(hex): boolean
 *       '#rrggbb' (or '#rgb'); false (and nothing changes) for anything else.
 *   lascaux2.canUndo(), canRedo(): boolean; undo(), redo(): boolean (false
 *       when there was nothing to undo / redo).
 *   lascaux2.onChange(cb): () => void
 *       cb() when the tool, the colour, canUndo or canRedo changes; returns
 *       the unsubscribe.
 *
 * Set once the editor has loaded the drawing and is on screen (not when the
 * LascauxSketch2 constructor returns: the drawing loads first), then the
 * window gets a 'lascaux2ready' event. One per page: a later editor replaces
 * it, and it is removed when its editor goes away.
 */
import { LascauxDomInstance, LascauxUiState } from '../lascaux/Drawlet';
import { Color } from '../lascaux/DrawingDoc';
import parseColor from '../lascaux/util/parse-color';
import { hexColorPalette } from '../lascaux-ui/color-palette';

export type Lascaux2Tool = { id: string; label: string; selected: boolean };
export type Lascaux2Color = { hex: string; selected: boolean };
export type Lascaux2Api = {
  tools(): Lascaux2Tool[];
  setTool(id: string): boolean;
  colors(): Lascaux2Color[];
  setColor(hex: string): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
  onChange(callback: () => void): () => void;
};

declare global {
  interface Window {
    lascaux2?: Lascaux2Api;
  }
}

const TOOLS = [
  { id: 'brush', label: 'Brush', mode: 'paint' },
  { id: 'eraser', label: 'Eraser', mode: 'erase' },
] as const;

function toHex([r, g, b]: Color): string {
  const byte = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function brushMode(state: LascauxUiState) {
  const { brushes, brush } = state.mode;
  return brushes[brush]?.mode ?? 'paint';
}

function changeKey(state: LascauxUiState): string {
  return [
    brushMode(state),
    toHex(state.mode.color),
    state.undo !== undefined,
    state.redo !== undefined,
  ].join();
}

/** Installs window.lascaux2 for this editor; returns the uninstall. */
export function installEmbedApi(instance: LascauxDomInstance): () => void {
  const state = () => instance.getUiState();
  const listeners = new Set<() => void>();
  let lastKey = changeKey(state());
  const unlisten = instance.listen((uiState) => {
    const key = changeKey(uiState);
    if (key !== lastKey) {
      lastKey = key;
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.error('lascaux2.onChange listener failed', error);
        }
      });
    }
  });

  const api: Lascaux2Api = {
    tools() {
      const mode = brushMode(state());
      return TOOLS.map(({ id, label, mode: toolMode }) => ({
        id,
        label,
        selected: toolMode === mode,
      }));
    },
    setTool(id) {
      const tool = TOOLS.find((t) => t.id === id);
      if (!tool) {
        return false;
      }
      instance.mutateMode((draft) => {
        draft.brushes[draft.brush].mode = tool.mode;
      });
      return true;
    },
    colors() {
      const current = toHex(state().mode.color);
      return [
        { hex: current, selected: true },
        ...hexColorPalette.map((hex) => ({
          hex,
          selected: hex.toLowerCase() === current,
        })),
      ];
    },
    setColor(hex) {
      const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
      const full = short
        ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
        : hex;
      if (!/^#[0-9a-f]{6}$/i.test(full)) {
        return false;
      }
      const color = parseColor(full);
      instance.mutateMode((draft) => {
        draft.color = color;
      });
      return true;
    },
    canUndo: () => state().undo !== undefined,
    canRedo: () => state().redo !== undefined,
    undo() {
      const { undo } = state();
      if (undo === undefined) {
        return false;
      }
      instance.addGoto(undo);
      return true;
    },
    redo() {
      const { redo } = state();
      if (redo === undefined) {
        return false;
      }
      instance.addGoto(redo);
      return true;
    },
    onChange(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };

  window.lascaux2 = api;
  window.dispatchEvent(new Event('lascaux2ready'));
  return () => {
    unlisten();
    listeners.clear();
    if (window.lascaux2 === api) {
      delete window.lascaux2;
    }
  };
}
