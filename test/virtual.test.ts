// The long list's window: pure.
import { expect, test } from 'vitest';
import { layout, nearEnd, rowAt, windowAt } from '../sinter/virtual.js';

const keys = Array.from({ length: 100 }, (_, i) => `k${i}`);

test('layout: measured heights where known, the estimate elsewhere', () => {
  const { offsets, total } = layout(keys.slice(0, 4), new Map([['k1', 100]]), 40);
  expect(offsets).toEqual([0, 40, 140, 180]);
  expect(total).toBe(220);
});

test('the window: the rows in view and the overscan, spacers for the rest', () => {
  const { offsets, total } = layout(keys, new Map(), 40);
  expect(rowAt(offsets, total, 0)).toBe(0);
  expect(rowAt(offsets, total, 39.9)).toBe(0);
  expect(rowAt(offsets, total, 40)).toBe(1);
  expect(rowAt(offsets, total, 99999)).toBe(99);
  expect(windowAt(offsets, total, 0, 200, 2)).toEqual({ start: 0, end: 8, top: 0, bottom: 4000 - 320 });
  const w = windowAt(offsets, total, 2000, 200, 2);
  expect(w).toEqual({ start: 48, end: 58, top: 1920, bottom: 4000 - 2320 });
  expect(windowAt([], 0, 0, 200, 2)).toEqual({ start: 0, end: 0, top: 0, bottom: 0 });
});

test('near the end: the last overscan rows of what is loaded', () => {
  expect(nearEnd({ start: 80, end: 96, top: 0, bottom: 0 }, 100, 6)).toBe(true);
  expect(nearEnd({ start: 60, end: 80, top: 0, bottom: 0 }, 100, 6)).toBe(false);
  expect(nearEnd({ start: 0, end: 0, top: 0, bottom: 0 }, 0, 6)).toBe(false);
});
