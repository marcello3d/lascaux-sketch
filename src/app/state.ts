export type Page =
  | {
      type: 'index';
    }
  | {
      type: 'drawing';
      drawingId: string;
    };
export type AppState = {
  drawings: Record<string, Drawing>;
  page: Page;
};
export type Drawing = {
  width: number;
  height: number;
};
