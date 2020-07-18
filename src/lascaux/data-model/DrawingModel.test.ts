import DrawingModel from './DrawingModel';
import { newDoc } from '../fiver';

jest.mock('../webgl/GlDrawingContext');

function mockDrawingModel({
  snapshotStrokeCount,
}: {
  snapshotStrokeCount?: number;
}) {
  const storageModel = {
    addSnapshot: jest.fn(() => undefined),
    addStroke: jest.fn(),
    flush: jest.fn(),
    getSnapshot: jest.fn(),
    getSnapshotLink: jest.fn(),
    getStroke: jest.fn(),
    replay: jest.fn(),
  };
  const events: string[] = [];
  const drawing = new DrawingModel({
    doc: newDoc(512, 512),
    storageModel,
    handleCommand: (mode, state, ctx, event, payload) => {
      events.push(
        `${drawing.editCanvas.cursor}: ${event} ${JSON.stringify(
          payload,
        ).replace(/"/g, '')}`,
      );
    },
    snapshotStrokeCount,
  });
  return { events, drawing };
}

describe('DrawingModel', () => {
  it('records some events', async () => {
    const { events, drawing } = mockDrawingModel({});
    drawing.addStroke('%cursor', 0, { type: 'pen' });
    drawing.addStroke('start', 0, { x: 0, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 0 });
    drawing.addStroke('draw', 0, { x: 100, y: 100 });
    drawing.addStroke('end', 0, {});
    await drawing.flush();
    expect(events).toMatchInlineSnapshot(`
      Array [
        "2: start {x:0,y:0}",
        "3: draw {x:100,y:0}",
        "4: draw {x:100,y:100}",
        "5: end {}",
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
        "2: start {x:0,y:0}",
        "3: draw {x:100,y:0}",
        "4: draw {x:100,y:100}",
        "5: end {}",
        "6: start {x:0,y:0}",
        "7: draw {x:100,y:0}",
        "8: draw {x:100,y:100}",
        "9: end {}",
      ]
    `);
  });
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
        "2: start {x:0,y:0}",
        "3: draw {x:100,y:0}",
        "4: draw {x:100,y:100}",
        "5: end {}",
        "7: start {x:0,y:0}",
        "8: draw {x:100,y:0}",
        "9: draw {x:100,y:100}",
        "10: end {}",
      ]
    `);
  });
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
        "2: start {x:0,y:0}",
        "3: draw {x:100,y:0}",
        "4: draw {x:100,y:100}",
        "5: end {}",
        "7: start {x:0,y:0}",
        "8: draw {x:100,y:100}",
        "9: end {}",
      ]
    `);
  });
});
