/* eslint-env jest */

import AsciiCanvas from '../ascii-canvas'

describe('AsciiCanvas', () => {
  it('can render to string', () => {
    expect(new AsciiCanvas(10, 10).toString()).toEqual(`
--------------------
--------------------
--------------------
--------------------
--------------------
--------------------
--------------------
--------------------
--------------------
--------------------`)
  })
  it('can setPixel', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(canvas.setPixel(0, 0, 'R')).toBeTruthy()
    expect(canvas.toString()).toEqual(`
RR--------
----------
----------
----------
----------`)
  })
  it('can setPixel multiple times', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(canvas.setPixel(0, 0, 'R')).toBeTruthy()
    expect(canvas.setPixel(3, 2, 'G')).toBeTruthy()
    expect(canvas.setPixel(1, 1, 'B')).toBeTruthy()
    expect(canvas.setPixel(0, 0, 'L')).toBeTruthy()
    expect(canvas.toString()).toEqual(`
LL--------
--BB------
------GG--
----------
----------`)
  })
  it('can setPixels off canvas', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(canvas.setPixel(-1, 0, 'R')).toBeFalsy()
    expect(canvas.setPixel(3, -2, 'G')).toBeFalsy()
    expect(canvas.setPixel(100, 1, 'B')).toBeFalsy()
    expect(canvas.setPixel(0, 100, 'L')).toBeFalsy()
    expect(canvas.toString()).toEqual(`
----------
----------
----------
----------
----------`)
  })
  it('can setPixel same multiple times', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(canvas.setPixel(0, 0, 'R')).toBeTruthy()
    expect(canvas.setPixel(0, 0, 'R')).toBeFalsy()
    expect(canvas.setPixel(0, 0, 'G')).toBeTruthy()
    expect(canvas.toString()).toEqual(`
GG--------
----------
----------
----------
----------`)
  })
  it('can getPixel', () => {
    const canvas = new AsciiCanvas(5, 5)
    canvas.setPixel(0, 0, 'R')
    canvas.setPixel(3, 2, 'G')
    canvas.setPixel(1, 1, 'B')
    canvas.setPixel(0, 0, 'L')
    expect(canvas.getPixel(1, 1)).toEqual('B')
  })
  it('can getPixels off canvas', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(canvas.getPixel(-2, 0, 'R')).toBe(undefined)
    expect(canvas.getPixel(0, -2, 'R')).toBe(undefined)
    expect(canvas.getPixel(5, 0, 'R')).toBe(undefined)
    expect(canvas.getPixel(0, 5, 'R')).toBe(undefined)
  })
})

describe('AsciiCanvas tiles', () => {
  it('can getPixels', () => {
    const canvas = new AsciiCanvas(5, 5)
    canvas.setPixel(0, 0, 'R')
    canvas.setPixel(3, 2, 'G')
    canvas.setPixel(1, 1, 'B')
    expect(canvas.getPixels(0, 0, 2, 2)).toEqual(`
RR--
--BB`)
    expect(canvas.getPixels(1, 1, 3, 2)).toEqual(`
BB----
----GG`)
  })

  it('can putPixels', () => {
    const canvas = new AsciiCanvas(5, 5)
    canvas.putPixels(0, 0, 2, 2, `
RR--
--BB`)
    canvas.putPixels(1, 1, 3, 2, `
BB----
----GG`)
    expect(canvas.toString()).toEqual(`
RR--------
--BB------
------GG--
----------
----------`)
  })

  it('fails on bad getPixels', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(() => canvas.getPixels(-1, 0, 2, 2)).toThrow('invalid tile')
    expect(() => canvas.getPixels(0, -1, 2, 2)).toThrow('invalid tile')
    expect(() => canvas.getPixels(3, 3, 3, 3)).toThrow('invalid tile')
    expect(() => canvas.getPixels(5, 0, 2, 2)).toThrow('invalid tile')
    expect(() => canvas.getPixels(0, 5, 2, 2)).toThrow('invalid tile')
    expect(() => canvas.getPixels(0, 0, 0, 0)).toThrow('invalid tile')
    expect(() => canvas.getPixels(0, 0, -10, 0)).toThrow('invalid tile')
    expect(() => canvas.getPixels(0, 0, 0, -10)).toThrow('invalid tile')
  })
  it('fails on bad putPixels', () => {
    const canvas = new AsciiCanvas(5, 5)
    expect(() => canvas.putPixels(-1, 0, 2, 2, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(0, -1, 2, 2, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(3, 3, 3, 3, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(5, 0, 2, 2, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(0, 5, 2, 2, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(0, 0, 0, 0, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(0, 0, -10, 0, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(0, 0, 0, -10, '')).toThrow('invalid tile')
    expect(() => canvas.putPixels(0, 0, 2, 2, `
RR--
--B`)).toThrow('invalid tile data')
    expect(() => canvas.putPixels(0, 0, 2, 2, `
RR--
--BBB`)).toThrow('invalid tile data')
  })
})
