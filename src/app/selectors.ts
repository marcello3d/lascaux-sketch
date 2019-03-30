import { AppState, Drawing } from './state';

export function getCurrentPage(state: AppState) {
  return state.page;
}

export function getDrawing(state: AppState, id: string): Drawing | undefined {
  return state.drawings[id];
}
