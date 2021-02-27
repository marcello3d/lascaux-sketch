import { nanoid } from 'nanoid';

export const newId = nanoid;
export const newDate = () => new Date().toISOString();
