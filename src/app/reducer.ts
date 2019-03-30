import { reducerWithInitialState } from 'typescript-fsa-reducers';
import { produce } from 'immer';
import shortid from 'shortid';
import { navigateToPage, newDrawing } from './actions';
import { AppState } from './state';
import { Canvas2d } from '../draw/canvas';

const initialState: AppState = {
  drawings: {},
  page: {
    type: 'index',
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
  .case(
    navigateToPage,
    produce((draft, page) => {
      draft.page = page;
    }),
  )
  .build();
