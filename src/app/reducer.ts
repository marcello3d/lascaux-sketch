import { reducerWithInitialState } from 'typescript-fsa-reducers';
import { produce } from 'immer';
import shortid from 'shortid';
import { navigateToPage, newDrawing } from './actions';
import { AppState, Page } from './state';

const drawingId = shortid();
const initialState: AppState = {
  drawings: {
    [drawingId]: { width: 1024, height: 1024 },
  },
  page: {
    type: 'drawing',
    drawingId,
  },
};

export const reducer = reducerWithInitialState<AppState>(initialState)
  .case(
    newDrawing,
    produce((draft, { width, height }) => {
      const drawingId = shortid();
      draft.drawings[drawingId] = {
        width,
        height,
      };
      draft.page = {
        type: 'drawing',
        drawingId,
      };
    }),
  )
  .case<Page>(
    navigateToPage,
    produce((draft, page) => {
      draft.page = page;
    }),
  )
  .build();
