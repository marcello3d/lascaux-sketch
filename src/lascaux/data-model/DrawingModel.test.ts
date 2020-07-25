import DrawingModel from './DrawingModel';
import { newDoc } from '../fiver';
import { StorageModel, Stroke, StrokePayload } from './StorageModel';
import { Snap } from '../Drawlet';

jest.mock('../webgl/GlDrawingContext');

function strokeString(index: number, event: string, payload: any) {
  return `${index}: ${event} ${JSON.stringify(payload).replace(/"/g, '')}`;
}

function mockDrawingModel({
  snapshotStrokeCount,
}: {
  snapshotStrokeCount?: number;
}) {
  const events: string[] = [];
  const strokes: Stroke[] = [];
  const snapshots: Snap[] = [];
  const storageModel: StorageModel = {
    addSnapshot: jest.fn((index: number, snapshot: Snap) => {
      events.push(`addSnapshot: ${index}`);
      snapshots[index] = snapshot;
    }),
    addStroke: jest.fn(
      (index: number, type: string, time: number, payload: StrokePayload) => {
        strokes[index] = { type, time, payload };
        events.push(`  addStroke: ${strokeString(index, type, payload)}`);
      },
    ),
    flush: jest.fn(),
    getSnapshot: jest.fn((index: number) => {
      events.push(`getSnapshot: ${index}`);
      return snapshots[index];
    }),
    getSnapshotLink: jest.fn(),
    getStroke: jest.fn((index) => {
      events.push(`  getStroke: ${index}`);
      return strokes[index];
    }),
    replay: jest.fn(),
  };
  const drawing = new DrawingModel({
    doc: newDoc(512, 512),
    storageModel,
    handleCommand: (mode, state, ctx, event, payload) => {
      const index = drawing.editCanvas.cursor;
      events.push(`     handle: ${strokeString(index, event, payload)}`);
    },
    snapshotStrokeCount,
  });
  return { events, storageModel, drawing };
}

describe('DrawingModel.addStroke basic', () => {
  it('records some events', async () => {
    const { events, drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(drawing.strokeCount).toBe(5);
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
      ]
    `);
    drawing.editCanvas.gotoEnd();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
      ]
    `);
  });
  it('adds snapshot', async () => {
    const { events, drawing } = mockDrawingModel({ snapshotStrokeCount: 1 });
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "addSnapshot: 5",
        "     handle: 5: start {x:0,y:0}",
        "  addStroke: 5: start {x:0,y:0}",
        "     handle: 6: draw {x:100,y:0}",
        "  addStroke: 6: draw {x:100,y:0}",
        "     handle: 7: draw {x:100,y:100}",
        "  addStroke: 7: draw {x:100,y:100}",
        "     handle: 8: end {}",
        "  addStroke: 8: end {}",
        "addSnapshot: 9",
      ]
    `);
  });
});

describe('DrawingModel.addStroke gotos', () => {
  it('handles goto', async () => {
    const { events, drawing } = mockDrawingModel({ snapshotStrokeCount: 1 });
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('!goto', 0, 1);
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "addSnapshot: 5",
        "  getStroke: 0",
        "  addStroke: 5: !goto 1",
        "     handle: 6: start {x:0,y:0}",
        "  addStroke: 6: start {x:0,y:0}",
        "     handle: 7: draw {x:100,y:0}",
        "  addStroke: 7: draw {x:100,y:0}",
        "     handle: 8: draw {x:100,y:100}",
        "  addStroke: 8: draw {x:100,y:100}",
        "     handle: 9: end {}",
        "  addStroke: 9: end {}",
        "addSnapshot: 10",
      ]
    `);
  });
  it('throws if attempting to go into the future', async () => {
    const { drawing } = mockDrawingModel({ snapshotStrokeCount: 1 });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('end', 0, {});
    expect(() =>
      drawing.addStroke('!goto', 0, 10),
    ).toThrowErrorMatchingInlineSnapshot(`"target >= source: 10 >= 2"`);
  });
});

describe('CanvasModel.goto', () => {
  it('handles edit after seek', async () => {
    const { events, drawing } = mockDrawingModel({ snapshotStrokeCount: 1 });
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.editCanvas.goto(0);
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "addSnapshot: 5",
        "  addStroke: 5: !goto 0",
        "     handle: 6: start {x:0,y:0}",
        "  addStroke: 6: start {x:0,y:0}",
        "     handle: 7: draw {x:100,y:100}",
        "  addStroke: 7: draw {x:100,y:100}",
        "     handle: 8: end {}",
        "  addStroke: 8: end {}",
        "addSnapshot: 9",
      ]
    `);
  });
  it('handles edit after seek with replay', async () => {
    const { events, drawing } = mockDrawingModel({ snapshotStrokeCount: 100 });
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('start', 0, { x: 10, y: 10 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('!goto', 0, 3);
    drawing.addStroke('start', 0, { x: 20, y: 20 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: end {}",
        "  addStroke: 2: end {}",
        "     handle: 3: start {x:10,y:10}",
        "  addStroke: 3: start {x:10,y:10}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "  getStroke: 0",
        "  getStroke: 1",
        "     handle: 1: start {x:0,y:0}",
        "  getStroke: 2",
        "     handle: 2: end {}",
        "  addStroke: 5: !goto 3",
        "     handle: 6: start {x:20,y:20}",
        "  addStroke: 6: start {x:20,y:20}",
        "     handle: 7: end {}",
        "  addStroke: 7: end {}",
      ]
    `);
  });
  it('handles edit after double seek', async () => {
    const { events, drawing } = mockDrawingModel({ snapshotStrokeCount: 100 });
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('start', 0, { x: 10, y: 10 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('!goto', 0, 3);
    drawing.addStroke('!goto', 0, 0);
    drawing.addStroke('start', 0, { x: 20, y: 20 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: end {}",
        "  addStroke: 2: end {}",
        "     handle: 3: start {x:10,y:10}",
        "  addStroke: 3: start {x:10,y:10}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "  getStroke: 0",
        "  getStroke: 1",
        "     handle: 1: start {x:0,y:0}",
        "  getStroke: 2",
        "     handle: 2: end {}",
        "  addStroke: 5: !goto 3",
        "  addStroke: 6: !goto 0",
        "     handle: 7: start {x:20,y:20}",
        "  addStroke: 7: start {x:20,y:20}",
        "     handle: 8: end {}",
        "  addStroke: 8: end {}",
      ]
    `);
  });
  it('can goto back and forth', async () => {
    const { events, drawing } = mockDrawingModel({ snapshotStrokeCount: 1 });
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.editCanvas.goto(0);
    drawing.editCanvas.goto(5);
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "addSnapshot: 5",
        "getSnapshot: 5",
      ]
    `);
  });
  it('throws if seeking past stroke count', async () => {
    const { drawing } = mockDrawingModel({ snapshotStrokeCount: 1 });
    expect(() =>
      drawing.editCanvas.goto(10),
    ).toThrowErrorMatchingInlineSnapshot(
      `"targetCursor > this.strokeCount (10 > 0)"`,
    );
  });
});

describe('DrawingModel.planGoto', () => {
  it('plans from 0 to 0', () => {
    const { drawing } = mockDrawingModel({});
    expect(drawing.planGoto(0, 0)).toEqual({});
  });
});

describe('weird bug case', () => {
  // What I want to test is how strokes get replayed after rewinding.
  it('replaying', async () => {
    const { events, drawing } = mockDrawingModel({});
    await drawing.addStroke('%cursor', 0, { type: 'pen' });
    await drawing.addStroke('start', 0, { x: 0, y: 0 });
    await drawing.addStroke('draw', 0, { x: 100, y: 0 });
    await drawing.addStroke('draw', 0, { x: 100, y: 100 });
    await drawing.addStroke('end', 0, {});
    await drawing.addStroke('start', 0, { x: 10, y: 10 });
    await drawing.addStroke('draw', 0, { x: 110, y: 10 });
    await drawing.addStroke('draw', 0, { x: 110, y: 110 });
    await drawing.addStroke('end', 0, {});
    await drawing.editCanvas.goto(5);
    await drawing.addStroke('start', 0, { x: 20, y: 20 });
    await drawing.addStroke('draw', 0, { x: 120, y: 120 });
    await drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "  addStroke: 0: %cursor {type:pen}",
        "     handle: 1: start {x:0,y:0}",
        "  addStroke: 1: start {x:0,y:0}",
        "     handle: 2: draw {x:100,y:0}",
        "  addStroke: 2: draw {x:100,y:0}",
        "     handle: 3: draw {x:100,y:100}",
        "  addStroke: 3: draw {x:100,y:100}",
        "     handle: 4: end {}",
        "  addStroke: 4: end {}",
        "     handle: 5: start {x:10,y:10}",
        "  addStroke: 5: start {x:10,y:10}",
        "     handle: 6: draw {x:110,y:10}",
        "  addStroke: 6: draw {x:110,y:10}",
        "     handle: 7: draw {x:110,y:110}",
        "  addStroke: 7: draw {x:110,y:110}",
        "     handle: 8: end {}",
        "  addStroke: 8: end {}",
        "  getStroke: 0",
        "  getStroke: 1",
        "     handle: 1: start {x:0,y:0}",
        "  getStroke: 2",
        "     handle: 2: draw {x:100,y:0}",
        "  getStroke: 3",
        "     handle: 3: draw {x:100,y:100}",
        "  getStroke: 4",
        "     handle: 4: end {}",
        "  addStroke: 9: !goto 5",
        "     handle: 10: start {x:20,y:20}",
        "  addStroke: 10: start {x:20,y:20}",
        "     handle: 11: draw {x:120,y:120}",
        "  addStroke: 11: draw {x:120,y:120}",
        "     handle: 12: end {}",
        "  addStroke: 12: end {}",
      ]
    `);
  });
});

describe('DrawingModel.computeUndo', () => {
  it('has nothing to undo on empty doc', async () => {
    const { drawing } = mockDrawingModel({});
    expect(drawing.computeUndo()).toEqual(undefined);
  });
  it('computes undo properly', async () => {
    const { drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('end', 0, {});
    expect(drawing.computeUndo()).toEqual(3);
  });
});

describe('DrawingModel.computeRedo', () => {
  it('nothing to redo', async () => {
    const { drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    expect(drawing.computeRedo()).toEqual(undefined);
  });
  it('something to redo', async () => {
    const { drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('!goto', 0, 3);
    expect(drawing.computeRedo()).toEqual(5);
  });
  it('after seek', async () => {
    const { drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('!goto', 0, 3);
    await drawing.flush();
    await drawing.editCanvas.goto(4);
    expect(drawing.computeRedo()).toEqual(5);
  });
});

describe('DrawingModel.getInfo', () => {
  it('to return context info', async () => {
    const { drawing } = mockDrawingModel({});
    expect(drawing.getInfo()).toEqual(undefined);
  });
  it('something to redo', async () => {
    const { drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    drawing.addStroke('!goto', 0, 3);
    expect(drawing.computeRedo()).toEqual(5);
  });
});
