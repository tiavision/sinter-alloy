// The helpers an app's optimistic change and request body use, and the component's state machine: pure.
import { expect, test } from 'vitest';
import { between, keysAfter, moved, reorder } from '../sinter/order.js';
import { drop, finalIndex, lift, lineAt, pointAt, step } from '../sinter/sortable.js';
import type { Move } from '../sinter/sinter.types.js';

const rows = [{ id: 'a', rank: 0 }, { id: 'b', rank: 1 }, { id: 'c', rank: 2 }, { id: 'd', rank: 3 }];
const keys = rows.map((r) => r.id);
const mv = (from: number, to: number): Move => {
  const rest = keys.filter((_, i) => i !== from);
  return { key: keys[from]!, from, to, after: rest[to - 1] ?? null, before: rest[to] ?? null, via: 'pointer' };
};

test('reorder and keysAfter put the item at `to`, the input untouched', () => {
  expect(keysAfter(rows, mv(0, 2), (r) => r.id)).toEqual(['b', 'c', 'a', 'd']);
  expect(keysAfter(rows, mv(3, 0), (r) => r.id)).toEqual(['d', 'a', 'b', 'c']);
  expect(reorder(rows, mv(1, 1)).map((r) => r.id)).toEqual(keys);
  expect(rows.map((r) => r.id)).toEqual(keys);
});

test('between: halfway between the new neighbours, past an end by one', () => {
  expect(between(rows, mv(0, 2), 'rank')).toBe(2.5); // between c (2) and d (3)
  expect(between(rows, mv(3, 0), 'rank')).toBe(-1); // before a (0)
  expect(between(rows, mv(0, 3), 'rank')).toBe(4); // after d (3)
  expect(between([{ id: 'x', rank: 5 }], { ...mv(0, 0), key: 'x' }, 'rank')).toBe(0);
  // ties cannot be split: the server's renumbering decides
  expect(between([{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }, { id: 'c', rank: 0 }], mv(0, 1), 'rank')).toBe(0);
});

test('between sorts the item into place when merged into a list ordered by the field', () => {
  for (let from = 0; from < 4; from++) for (let to = 0; to < 4; to++) {
    const m = mv(from, to);
    const merged = rows.map((r) => (r.id === m.key ? { ...r, rank: between(rows, m, 'rank') } : r));
    const sorted = merged.toSorted((x, y) => x.rank - y.rank).map((r) => r.id);
    expect(sorted, `${from} → ${to}`).toEqual(keysAfter(rows, m, (r) => r.id));
  }
});

test('moved finds the item by key', () => {
  expect(moved(rows, mv(2, 0), (r) => r.id)).toBe(rows[2]);
  expect(moved([], mv(2, 0), (r: { id: string }) => r.id)).toBeUndefined();
});

test('the keyboard steps through every place and stops at the ends', () => {
  let d = lift(keys, 'b')!;
  expect(d).toEqual({ key: 'b', from: 1, at: 1 });
  d = step(d, keys, 1);
  expect(finalIndex(d)).toBe(2);
  expect(drop(d, keys, 'keyboard')).toEqual({ key: 'b', from: 1, to: 2, after: 'c', before: 'd', via: 'keyboard' });
  d = step(d, keys, Infinity);
  expect(finalIndex(d)).toBe(3);
  expect(step(d, keys, 1)).toEqual(d);
  d = step(d, keys, -Infinity);
  expect(drop(d, keys, 'keyboard')).toEqual({ key: 'b', from: 1, to: 0, after: null, before: 'a', via: 'keyboard' });
  // back where it started: no move
  expect(drop(step(d, keys, 1), keys, 'keyboard')).toBeNull();
  expect(lift(keys, 'zz')).toBeNull();
});

test('the pointer picks the place by the rows\' middles; the line shows it, not next to the item', () => {
  const boxes = [0, 30, 60, 90].map((top) => ({ top, height: 30 }));
  expect(pointAt(boxes, -5)).toBe(0);
  expect(pointAt(boxes, 20)).toBe(1);
  expect(pointAt(boxes, 200)).toBe(4);
  const d = lift(keys, 'a')!;
  expect(lineAt({ ...d, at: 0 }, 0, 4)).toBeNull();
  expect(lineAt({ ...d, at: 1 }, 1, 4)).toBeNull();
  expect(lineAt({ ...d, at: 3 }, 3, 4)).toBe('before');
  expect(lineAt({ ...d, at: 4 }, 3, 4)).toBe('after');
  expect(lineAt({ ...d, at: 4 }, 2, 4)).toBeNull();
});
