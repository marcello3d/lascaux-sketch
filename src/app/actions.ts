import { actionCreatorFactory } from 'typescript-fsa';
import { Page } from './state';


const actionCreator = actionCreatorFactory();

export const newDrawing = actionCreator<{
  width: number;
  height: number;
}>('NEW_DRAWING');
export const navigateToPage = actionCreator<Page>('NAVIGATE_TO_PAGE');

