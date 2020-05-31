export type AppState = {
  drawings: Record<string, Drawing>;
};
export type Drawing = {
  width: number;
  height: number;
};
