import { actionCreatorFactory } from 'typescript-fsa';

const actionCreator = actionCreatorFactory();

export const newDrawing = actionCreator<{
  width: number;
  height: number;
}>('NEW_DRAWING');
