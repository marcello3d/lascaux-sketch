/* global describe, it, expect */

import {
  DRAW_START_EVENT,
  DRAW_EVENT,
  DRAW_END_EVENT,
  MODE_EVENT,
  GOTO_EVENT
} from '../events'

import DrawingModel from '../DrawingModel'
import MemoryStorageModel from '../MemoryStorageModel'

import {
  DrawOs,
  initializeCommand,
  handleCommand
} from '../mock-drawlet'

function makeDrawingModel (strokes, editing = false, snapshotStrokeCount, initialRangeMetadata = null) {
  return new Promise((resolve, reject) => {
    const model = new DrawingModel({
      dna: {
        width: 16,
        height: 16
      },
      editable: editing,
      DrawOs,
      storageModel: new MemoryStorageModel(null, initialRangeMetadata),
      initializeCommand,
      handleCommand,
      snapshotStrokeCount
    })
    model.onceLoaded((error) => {
      if (error) {
        return reject(error)
      }
      // Need to use callback
      if (strokes) {
        addStrokes(model, strokes)
      }
      resolve(model)
    })
  })
}

function addStrokes (model, strokes) {
  strokes.forEach((stroke) => model.addStroke(stroke[1], stroke[0], stroke[2]))
  model.flush()
}

function canvasGoto (canvas, index) {
  return new Promise((resolve, reject) => {
    canvas.goto(index, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function synchronizeCanvas (canvas, index) {
  return new Promise((resolve, reject) => {
    canvas.gotoEnd((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

describe('DrawingModel', () => {
  it('empty DrawingModel', async () => {
    const {
      _strokeCount,
      _drawingCursor,
      _gotoMap: { _gotoMap }
    } = await makeDrawingModel()
    expect({
      _strokeCount,
      _drawingCursor,
      _gotoMap
    }).toEqual({
      _strokeCount: 0,
      _drawingCursor: 0,
      _gotoMap: {}
    })
  })
  it('three strokes', async () => {
    const {
      _strokeCount,
      _drawingCursor,
      _gotoMap: { _gotoMap }
    } = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, 'draw3']
    ])
    expect({
      _strokeCount,
      _drawingCursor,
      _gotoMap
    }).toEqual({
      _strokeCount: 3,
      _drawingCursor: 3,
      _gotoMap: {}
    })
  })
  it('strokes with a goto', async () => {
    const {
      _strokeCount,
      _drawingCursor,
      _gotoMap: { _gotoMap }
    } = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 0]
    ])
    expect({
      _strokeCount,
      _drawingCursor,
      _gotoMap
    }).toEqual({
      _strokeCount: 3,
      _drawingCursor: 0,
      _gotoMap: { 2: 0 }
    })
  })
  it('strokes with a goto 2', async () => {
    const {
      _strokeCount,
      _drawingCursor,
      _gotoMap: { _gotoMap }
    } = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 0],
      [3, 'draw3']
    ])
    expect({
      _strokeCount,
      _drawingCursor,
      _gotoMap
    }).toEqual({
      _strokeCount: 4,
      _drawingCursor: 4,
      _gotoMap: { 2: 0 }
    })
  })
  it('strokes with a mode shift', async () => {
    const {
      _strokeCount,
      _drawingCursor,
      _gotoMap: { _gotoMap }
    } = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 0],
      [3, '%mode1']
    ])
    expect({
      _strokeCount,
      _drawingCursor,
      _gotoMap
    }).toEqual({
      _strokeCount: 4,
      _drawingCursor: 0,
      _gotoMap: { 2: 0 }
    })
  })
})
describe('DrawingModel.getRangeMetadata', () => {
  it('empty', async () => {
    const model = await makeDrawingModel([])
    expect(model.getMetadata()).toEqual({
      gotos: [],
      keys: [],
      modes: [-1, {
        color: 'R',
        random: 0.6419982359109891
      }],
      strokes: 0
    })
  })
  it('basic', async () => {
    const model = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2']
    ])
    expect(model.getMetadata()).toEqual({
      gotos: [],
      keys: [],
      modes: [-1, {
        color: 'R',
        random: 0.6419982359109891
      }],
      strokes: 2
    })
  })
  it('goto', async () => {
    const model = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 0],
      [3, '%mode1', 'hi']
    ])
    expect(model.getMetadata()).toEqual({
      gotos: [2, 0],
      keys: [],
      modes: [
        -1, {
          color: 'R',
          random: 0.6419982359109891
        },
        3, { mode1: 'hi' }
      ],
      strokes: 4
    })
  })
})

describe('DrawingModel snapshots', async () => {
  it('draw draw', async () => {
    const { _storageModel: { snapshots, snapshotLinks } } = await makeDrawingModel([
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, DRAW_END_EVENT, {
        x: 1,
        y: 0
      }],
      [4, DRAW_START_EVENT, {
        x: 5,
        y: 0
      }], // draw again
      [5, DRAW_EVENT, {
        x: 5,
        y: 1
      }],
      [6, DRAW_END_EVENT, {
        x: 5,
        y: 1
      }]
    ], true)
    expect(snapshots).toEqual({})
    expect(snapshotLinks).toEqual({})
  })
  it('two batches', async () => {
    const model = await makeDrawingModel([
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, DRAW_END_EVENT, {
        x: 1,
        y: 0
      }],
      [4, MODE_EVENT, { color: 'B' }],
      [5, DRAW_START_EVENT, {
        x: 5,
        y: 0
      }], // draw again
      [6, DRAW_EVENT, {
        x: 5,
        y: 1
      }],
      [7, DRAW_END_EVENT, {
        x: 5,
        y: 1
      }]
    ], true)
    model.snapshot()
    addStrokes(model, [
      [8, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [9, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [10, DRAW_END_EVENT, {
        x: 1,
        y: 0
      }],
      [11, DRAW_START_EVENT, {
        x: 5,
        y: 0
      }], // draw again
      [12, DRAW_EVENT, {
        x: 5,
        y: 1
      }],
      [13, DRAW_END_EVENT, {
        x: 6,
        y: 1
      }]
    ])
    expect(model._storageModel.snapshots).toMatchSnapshot()
    expect(model._storageModel.snapshotLinks).toMatchSnapshot()
  })
  it('tiles test', async () => {
    const model = await makeDrawingModel([], true, 1)

    model.addStroke(DRAW_START_EVENT, 1, {
      x: 0,
      y: 0
    })
    model.addStroke(DRAW_START_EVENT, 2, {
      x: 5,
      y: 0
    })
    model.addStroke(DRAW_START_EVENT, 3, {
      x: 1,
      y: 5
    })

    expect(model._storageModel.snapshots).toMatchSnapshot()
    expect(model._storageModel.snapshotLinks).toMatchSnapshot()
  })
})

describe('DrawingModel modeMap', () => {
  it('empty', async () => {
    const model = await makeDrawingModel([], true)
    expect(model.getMetadata()).toEqual({
      gotos: [],
      keys: [],
      modes: [-1, {
        color: 'R',
        random: 0.6419982359109891
      }],
      strokes: 0
    })
  })
  it('basic', async () => {
    const model = await makeDrawingModel([
      [0, 'start', {}],
      [1, 'drag', {}]
    ], true)
    expect(model.getMetadata()).toEqual({
      gotos: [],
      keys: [0],
      modes: [-1, {
        color: 'R',
        random: 0.6419982359109891
      }],
      strokes: 2
    })
  })
  it('goto', async () => {
    const model = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 0],
      [3, '%mode1', 1]
    ], true)
    expect(model.getMetadata()).toEqual({
      gotos: [2, 0],
      keys: [],
      modes: [
        -1, {
          color: 'R',
          random: 0.6419982359109891
        },
        3, { mode1: 1 }
      ],
      strokes: 4
    })
  })
})

describe('DrawingModel errors', () => {
  it('goto 2,2 should fail', async () => {
    expect(await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 2]
    ])).toBeTruthy()
  })
  it('goto 2,3 should fail', async () => {
    expect(await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 3]
    ])).toBeTruthy()
  })
})

describe('DrawingModel._planGoto', () => {
  it('basic', async () => {
    const model = await makeDrawingModel([
      [0, 'draw1'],
      [1, 'draw2'],
      [2, GOTO_EVENT, 0],
      [3, 'draw3'],
      [4, GOTO_EVENT, 0]
    ])
    expect(model._planGoto(4, 2))
      .toEqual({
        target: 2,
        revert: 0,
        skips: []
      })
    expect(model._planGoto(0, 4))
      .toEqual({
        target: 4,
        skips: [[0, 1]]
      })
    expect(model._planGoto(2, 3))
      .toEqual({
        target: 0,
        revert: 0,
        skips: []
      })
    expect(model._planGoto(2, 4))
      .toEqual({
        target: 4,
        revert: 0,
        skips: [[0, 1]]
      })
    expect(model._planGoto(2, 5))
      .toEqual({
        target: 0,
        revert: 0,
        skips: []
      })
    expect(model._planGoto(4, 5))
      .toEqual({
        target: 0,
        revert: 0,
        skips: []
      })
  })
})

describe('DrawingModel undo/redo', () => {
  it('empty', async () => {
    const model = await makeDrawingModel([])
    expect(model.computeUndo()).toEqual(false)
    expect(model.computeRedo()).toEqual(false)
  })
  it('draw', async () => {
    const model = await makeDrawingModel([
      [1, DRAW_START_EVENT],
      [2, DRAW_EVENT]
    ])
    expect(model.computeUndo()).toEqual(0)
    expect(model.computeRedo()).toEqual(false)
  })
  it('draw, undo', async () => {
    const model = await makeDrawingModel([
      [1, DRAW_START_EVENT],
      [2, DRAW_EVENT],
      [3, GOTO_EVENT, 0]
    ])
    expect(model.computeUndo()).toEqual(false)
    expect(model.computeRedo()).toEqual(2)
  })
  it('draw, undo, draw', async () => {
    const model = await makeDrawingModel([
      [0, DRAW_START_EVENT], // draw
      [1, DRAW_EVENT],
      [2, GOTO_EVENT, 0], // undo draw
      [3, DRAW_START_EVENT], // draw again
      [4, DRAW_EVENT]
    ])
    expect(model.getMetadata()).toEqual({
      gotos: [2, 0],
      keys: [0, 3],
      modes: [-1, {
        color: 'R',
        random: 0.6419982359109891
      }],
      strokes: 5
    })
    expect(model.computeRedo()).toEqual(false)
    expect(model.computeUndo()).toEqual(0)
  })
  it('draw, draw, undo, undo, redo, redo', async () => {
    const model = await makeDrawingModel([
      [0, DRAW_START_EVENT], // draw
      [1, DRAW_EVENT],
      [2, DRAW_START_EVENT], // draw
      [3, DRAW_EVENT]
    ])
    expect(model.drawingCursor).toEqual(4)
    expect(model.computeRedo()).toBe(false)
    expect(model.computeUndo()).toEqual(2)

    model.addStroke(GOTO_EVENT, 4, model.computeUndo())
    expect(model.drawingCursor).toEqual(2)
    expect(model.computeRedo()).toEqual(4)
    expect(model.computeUndo()).toEqual(0)

    model.addStroke(GOTO_EVENT, 5, model.computeUndo())
    expect(model.drawingCursor).toEqual(0)
    expect(model.computeRedo()).toEqual(2)
    expect(model.computeUndo()).toBe(false)

    model.addStroke(GOTO_EVENT, 6, model.computeRedo())
    expect(model.drawingCursor).toEqual(2)
    expect(model.computeRedo()).toEqual(4)
    expect(model.computeUndo()).toEqual(0)

    model.addStroke(GOTO_EVENT, 7, model.computeRedo())

    expect(model.drawingCursor).toEqual(4)
    expect(model.computeRedo()).toBe(false)
    expect(model.computeUndo()).toEqual(2)
  })
  it('%color, draw, undo', async () => {
    const model = await makeDrawingModel([
      [0, '%color', 'B'], // draw
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }]
    ], true)
    expect(model.drawingCursor).toEqual(2)
    expect(model.computeRedo()).toBe(false)
    expect(model.computeUndo()).toEqual(1)
    expect(model.editCanvas.mode)
      .toEqual({
        'color': 'B',
        'random': 0.6419982359109891
      })

    model.addStroke(GOTO_EVENT, 2, 0)
    expect(model.drawingCursor).toEqual(0)
    expect(model.computeRedo()).toEqual(2)
    expect(model.computeUndo()).toBe(false)
    expect(model.editCanvas.mode)
      .toEqual({
        'color': 'B',
        'random': 0.6419982359109891
      })
  })
  it('test two gotos', async () => {
    const model = await makeDrawingModel([
      [1, DRAW_START_EVENT], // draw
      [2, DRAW_EVENT],
      [3, GOTO_EVENT, 0], // undo all drawing
      [4, DRAW_START_EVENT], // draw again
      [5, DRAW_EVENT],
      [6, GOTO_EVENT, 3] // undo
    ])
    expect(model.computeRedo()).toEqual(5)
    expect(model.computeUndo()).toEqual(false)
  })
  it('test two adjacent gotos', async () => {
    const model = await makeDrawingModel([
      [1, DRAW_START_EVENT],
      [2, DRAW_EVENT],
      [3, GOTO_EVENT, 0],
      [4, GOTO_EVENT, 1]
    ])
    expect(model.computeRedo()).toEqual(false)
    expect(model.computeUndo()).toEqual(0)
  })
})

describe('DrawingModel goto', async () => {
  it('gotoEnd', async () => {
    const model = await makeDrawingModel([], true)
    const canvas = model.createCanvas()
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, DRAW_END_EVENT, {
        x: 1,
        y: 0
      }],
      [4, MODE_EVENT, { color: 'B' }],
      [5, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw again
      [6, DRAW_EVENT, {
        x: 5,
        y: 1
      }],
      [7, DRAW_END_EVENT, {
        x: 5,
        y: 1
      }]
    ])
    canvas.gotoEnd(() => {
      expect(canvas.cursor).toEqual(7)
      expect(canvas.toDataUrl()).toEqual(`
BBBBBB--------------------------
------BBBBBB--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    })
  })
  it('play forward', async () => {
    const model = await makeDrawingModel([], true)
    const canvas = model.createCanvas()
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, MODE_EVENT, { color: 'B' }],
      [4, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw again
      [5, DRAW_EVENT, {
        x: 5,
        y: 1
      }]
    ])
    await canvasGoto(canvas, 1)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 2)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 3)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 4)
    expect(canvas.toDataUrl()).toEqual(`
BBRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 5)
    expect(canvas.toDataUrl()).toEqual(`
BBBBBB--------------------------
------BBBBBB--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })
  it('rewind', async () => {
    const model = await makeDrawingModel([], true)
    const canvas = model.createCanvas()
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, MODE_EVENT, { color: 'B' }],
      [4, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw again
      [5, DRAW_EVENT, {
        x: 5,
        y: 1
      }]
    ])
    canvas.gotoEnd()
    expect(canvas.toDataUrl()).toEqual(`
BBBBBB--------------------------
------BBBBBB--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 1)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    canvas.gotoEnd()
    expect(canvas.toDataUrl()).toEqual(`
BBBBBB--------------------------
------BBBBBB--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 4)
    expect(canvas.toDataUrl()).toEqual(`
BBRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })

  it('rewind and draw', async () => {
    const model = await makeDrawingModel([], true)
    const canvas = model.editCanvas
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }],
      [2, DRAW_EVENT, {
        x: 2,
        y: 0
      }],
      [3, DRAW_EVENT, {
        x: 6,
        y: 0
      }]
    ])
    canvas.gotoEnd()
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRRRR------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    console.log('------')
    await canvasGoto(canvas, 2)
    console.log('------')
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRR--------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    addStrokes(model, [
      [4, DRAW_START_EVENT, {
        x: 0,
        y: 1
      }],
      [5, DRAW_EVENT, {
        x: 3,
        y: 1
      }],
      [6, DRAW_EVENT, {
        x: 6,
        y: 1
      }]
    ])
    canvas.gotoEnd()
    expect(canvas.cursor).toEqual(7)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRR--------------------------
RRRRRRRRRRRRRR------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })

  it('undos', async () => {
    const model = await makeDrawingModel([], true)
    const canvas = model.createCanvas()
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, GOTO_EVENT, 0],
      [4, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw again
      [5, DRAW_EVENT, {
        x: 5,
        y: 1
      }]
    ])
    canvas.gotoEnd()
    expect(canvas.cursor).toEqual(5)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRR--------------------------
------RRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 1)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 2)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 3)
    expect(canvas.cursor).toEqual(0)
    expect(canvas.toDataUrl()).toEqual(`
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    await canvasGoto(canvas, 4)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })
  it('undos with snapshots', async () => {
    const model = await makeDrawingModel([], true, 1)
    const canvas = model.createCanvas()
    addStrokes(model, [
      // - 0 -
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      // - 1 -
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      // - 2 -
      [3, GOTO_EVENT, 0],
      // - 3 -
      [4, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw again
      // - 4 -
      [5, DRAW_EVENT, {
        x: 10,
        y: 4
      }]
      // - 5 -
    ])
    canvas.gotoEnd()

    expect(canvas.cursor).toEqual(5)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
----RRRR------------------------
--------RRRRRR------------------
--------------RRRR--------------
------------------RRRR----------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 1)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 2)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 3)
    expect(canvas.cursor).toEqual(0)
    expect(canvas.toDataUrl()).toEqual(`
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    await canvasGoto(canvas, 4)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })
  it('undos 2', async () => {
    const model = await makeDrawingModel([], true, 2)
    const canvas = model.createCanvas()
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw
      [2, DRAW_EVENT, {
        x: 1,
        y: 0
      }],
      [3, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }], // draw again
      [4, DRAW_EVENT, {
        x: 5,
        y: 1
      }],
      [5, GOTO_EVENT, 2] // undo last line
    ])
    expect(model._storageModel.snapshots).toMatchSnapshot()
    expect(model._storageModel.snapshotLinks).toMatchSnapshot()

    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 1)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 5)
    expect(canvas.cursor).toEqual(2)
    await canvasGoto(canvas, 2)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 3)
    expect(canvas.cursor).toEqual(3)
    expect(canvas.toDataUrl()).toEqual(`
RRRR----------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    await canvasGoto(canvas, 4)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRR--------------------------
------RRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })
  it('undos and modes', async () => {
    const model = await makeDrawingModel([], true, 2)
    const canvas = model.createCanvas()
    addStrokes(model, [
      [1, DRAW_START_EVENT, {
        x: 0,
        y: 0
      }]
    ])
    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    addStrokes(model, [
      [2, DRAW_EVENT, {
        x: 5,
        y: 0
      }]
    ])

    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    addStrokes(model, [
      [3, DRAW_EVENT, {
        x: 5,
        y: 5
      }]
    ])

    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(3)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
----------RR--------------------
----------RR--------------------
----------RR--------------------
----------RR--------------------
----------RR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    addStrokes(model, [
      [4, GOTO_EVENT, 2] // undo last line
    ])
    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    addStrokes(model, [
      [5, MODE_EVENT, { color: 'B' }]
    ])

    console.log(canvas._drawing._modeMap.getMode(5))

    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(5)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    addStrokes(model, [
      [6, DRAW_EVENT, {
        x: 5,
        y: 5
      }]
    ])

    await synchronizeCanvas(canvas)
    expect(canvas.cursor).toEqual(6)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRBB--------------------
----------BB--------------------
----------BB--------------------
----------BB--------------------
----------BB--------------------
----------BB--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 1)
    expect(canvas.cursor).toEqual(1)
    expect(canvas.toDataUrl()).toEqual(`
RR------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 4)
    expect(canvas.cursor).toEqual(2)
    await canvasGoto(canvas, 2)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
    await canvasGoto(canvas, 3)
    expect(canvas.cursor).toEqual(3)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
----------RR--------------------
----------RR--------------------
----------RR--------------------
----------RR--------------------
----------RR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    await canvasGoto(canvas, 4)
    expect(canvas.cursor).toEqual(2)
    expect(canvas.toDataUrl()).toEqual(`
RRRRRRRRRRRR--------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })
  it('undos and snapshots', async () => {
    const model = await makeDrawingModel([], true)
    const canvas = model.createCanvas()
    // - 0 -
    model.addStroke(DRAW_START_EVENT, 1, {
      x: 0,
      y: 0
    }) // draw 0,0
    model.snapshot()
    // - 1 -
    model.addStroke(DRAW_EVENT, 2, {
      x: 1,
      y: 0
    }) // draw  1,0
    // - 2 -
    model.addStroke(DRAW_EVENT, 3, {
      x: 2,
      y: 0
    }) // draw 2,0
    // - 3 -
    model.addStroke(GOTO_EVENT, 4, 1) // undo all but 0,0
    // - 4 -
    model.addStroke(DRAW_START_EVENT, 5, {
      x: 3,
      y: 0
    }) // draw again 3,0
    // - 5 -
    model.snapshot()
    model.addStroke(DRAW_EVENT, 6, {
      x: 4,
      y: 0
    }) // draw 4, 0
    // - 6 -
    expect(model._storageModel.snapshots).toMatchSnapshot()
    expect(model._storageModel.snapshotLinks).toMatchSnapshot()

    await canvasGoto(canvas, 5)
    expect(canvas.toDataUrl()).toEqual(`
RR----RR------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    await canvasGoto(canvas, 6)
    expect(canvas.toDataUrl()).toEqual(`
RR----RRRR----------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)

    await canvasGoto(canvas, 5)
    expect(canvas.toDataUrl()).toEqual(`
RR----RR------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------
--------------------------------`)
  })
})

describe('pre-existing storagemodel', () => {
  it('basic 4 stroke', async () => {
    // draw 0
    // draw 1
    // draw 2
    // draw 3
    const model = await makeDrawingModel(null, true, undefined, {
      ranges: [[0, 3]],
      gotos: [],
      modes: [],
      keys: [0, 1, 2, 3]
    })
    expect(model.drawingCursor).toEqual(4)
    expect(model.computeUndo()).toEqual(3)
    expect(model.computeRedo()).toEqual(false)
  })
  it('basic 2 stroke + undo', async () => {
    // draw 0
    // draw 1
    const model = await makeDrawingModel(null, true, undefined, {
      ranges: [[0, 2]],
      gotos: [2, 1],
      modes: [],
      keys: [0, 1]
    })
    expect(model.drawingCursor).toEqual(1)
    expect(model.computeUndo()).toEqual(0)
    expect(model.computeRedo()).toEqual(2)
  })
  it('basic 2 stroke + undo + undo', async () => {
    // draw 0
    // draw 1
    const model = await makeDrawingModel(null, true, undefined, {
      ranges: [[0, 3]],
      gotos: [2, 1, 3, 0],
      modes: [],
      keys: [0, 1]
    })
    expect(model.drawingCursor).toEqual(0)
    expect(model.computeUndo()).toEqual(false)
    expect(model.computeRedo()).toEqual(1)
  })
  it('basic 2 stroke + undo + undo + redo', async () => {
    // draw 0
    // draw 1
    const model = await makeDrawingModel(null, true, undefined, {
      ranges: [[0, 4]],
      gotos: [2, 1, 3, 0, 4, 1],
      modes: [],
      keys: [0, 1]
    })
    expect(model.drawingCursor).toEqual(1)
    expect(model.computeUndo()).toEqual(0)
    expect(model.computeRedo()).toEqual(2)
  })
  it('basic 2 stroke + undo + undo + redo + redo', async () => {
    // draw 0
    // draw 1
    const model = await makeDrawingModel(null, true, undefined, {
      ranges: [[0, 5]],
      gotos: [2, 1, 3, 0, 4, 1, 5, 2],
      modes: [],
      keys: [0, 1]
    })
    expect(model.drawingCursor).toEqual(2)
    expect(model.computeUndo()).toEqual(1)
    expect(model.computeRedo()).toEqual(false)
  })
  it('basic 2 stroke + undo + undo + redo + redo', async () => {
    // draw 0
    // draw 1
    const model = await makeDrawingModel(null, true, undefined, {
      ranges: [[0, 5]],
      gotos: [2, 1, 3, 0, 4, 1, 5, 2],
      modes: [],
      keys: [0, 1]
    })
    expect(model.drawingCursor).toEqual(2)
    expect(model.computeUndo()).toEqual(1)
    expect(model.computeRedo()).toEqual(false)
  })
})
