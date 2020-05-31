import { reducerWithInitialState } from 'typescript-fsa-reducers';
import { produce } from 'immer';
import shortid from 'shortid';
import { newDrawing } from './actions';
import { AppState } from './state';

const drawingId = shortid();
const initialState: AppState = {
  drawings: {
    [drawingId]: { width: 1024, height: 1024 },
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
    }),
  )
  .build();
