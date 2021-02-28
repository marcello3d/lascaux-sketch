/* eslint-env jest */
import SnapshotMap from './SnapshotMap';
import { Skips } from './GotoMap';

describe('SnapshotMap addSnapshot basic', () => {
  it('empty', () => {
    const indexes: number[] = [];
    new SnapshotMap(indexes);
    expect(indexes).toEqual([]);
  });
  it('one snapshot', () => {
    const indexes: number[] = [];
    const map = new SnapshotMap(indexes);
    map.addSnapshot(0);
    expect(indexes).toEqual([0]);
  });
  it('two snapshots', () => {
    const indexes: number[] = [];
    const map = new SnapshotMap(indexes);
    map.addSnapshot(1);
    map.addSnapshot(3);
    expect(indexes).toEqual([1, 3]);
  });
  it('out of order snapshots', () => {
    const indexes: number[] = [];
    const map = new SnapshotMap(indexes);
    map.addSnapshot(3);
    map.addSnapshot(1);
    expect(indexes).toEqual([1, 3]);
  });
  it('do not add a duplicate', () => {
    const indexes: number[] = [];
    const map = new SnapshotMap(indexes);
    map.addSnapshot(3);
    map.addSnapshot(3);
    expect(indexes).toEqual([3]);
  });
});

describe('SnapshotMap getNearestSnapshotIndex', () => {
  it('basic gets', () => {
    const map = new SnapshotMap([1, 3]);
    const skips: Skips = [];
    expect(map.getNearestSnapshotIndex(0, skips)).toEqual(0);
    expect(map.getNearestSnapshotIndex(1, skips)).toEqual(1);
    expect(map.getNearestSnapshotIndex(2, skips)).toEqual(1);
    expect(map.getNearestSnapshotIndex(3, skips)).toEqual(3);
    expect(map.getNearestSnapshotIndex(4, skips)).toEqual(3);
  });
  it('get with skips', () => {
    const map = new SnapshotMap([1, 3]);
    const skips: Skips = [[0, 1]];
    expect(map.getNearestSnapshotIndex(0, skips)).toEqual(0);
    expect(map.getNearestSnapshotIndex(1, skips)).toEqual(0);
    expect(map.getNearestSnapshotIndex(2, skips)).toEqual(0);
    expect(map.getNearestSnapshotIndex(3, skips)).toEqual(3);
    expect(map.getNearestSnapshotIndex(4, skips)).toEqual(3);
  });
  it('get with skips', () => {
    const map = new SnapshotMap();
    map.addSnapshot(1);
    map.addSnapshot(3);
    const skips: Skips = [[2, 3]];
    expect(map.getNearestSnapshotIndex(0, skips)).toEqual(0);
    expect(map.getNearestSnapshotIndex(1, skips)).toEqual(1);
    expect(map.getNearestSnapshotIndex(2, skips)).toEqual(1);
    expect(map.getNearestSnapshotIndex(3, skips)).toEqual(1);
    expect(map.getNearestSnapshotIndex(4, skips)).toEqual(1);
  });
});
