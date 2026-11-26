// The split's decisions: pure.
import { expect, test } from 'vitest';
import { clamp, dragSize, keySize, kept, toggle } from '../sinter/split.js';

const b = { min: 100, max: 400 };
const row = { step: 16, direction: 'row' as const, reverse: false };

test('keys: arrows by a step (Shift: four), the direction\'s own arrows, reversed for an end pane, Home and End', () => {
  expect(keySize(200, 'ArrowRight', false, b, row)).toBe(216);
  expect(keySize(200, 'ArrowLeft', true, b, row)).toBe(136);
  expect(keySize(200, 'ArrowDown', false, b, row)).toBeNull(); // not a row split's key
  expect(keySize(200, 'ArrowDown', false, b, { ...row, direction: 'column' })).toBe(216);
  expect(keySize(200, 'ArrowRight', false, b, { ...row, reverse: true })).toBe(184);
  expect(keySize(390, 'ArrowRight', true, b, row)).toBe(400);
  expect(keySize(200, 'Home', false, b, row)).toBe(100);
  expect(keySize(200, 'End', false, b, row)).toBe(400);
  expect(keySize(200, 'a', false, b, row)).toBeNull();
});

test('drag: the start size moved by the distance, clamped; reversed for an end pane', () => {
  expect(dragSize(200, 50, b, false)).toBe(250);
  expect(dragSize(200, 50, b, true)).toBe(150);
  expect(dragSize(200, -500, b, false)).toBe(100);
  expect(clamp(123.6, b)).toBe(124);
});

test('Enter: collapse to min remembering the size, then back; from min, back to initial', () => {
  expect(toggle(250, null, 200, b)).toEqual({ size: 100, remembered: 250 });
  expect(toggle(100, 250, 200, b)).toEqual({ size: 250, remembered: null });
  expect(toggle(100, null, 200, b)).toEqual({ size: 200, remembered: null });
});

test('kept: a stored number within bounds, nothing else', () => {
  expect(kept('260', b)).toBe(260);
  expect(kept('9000', b)).toBe(400);
  expect(kept('"x"', b)).toBeNull();
  expect(kept(null, b)).toBeNull();
});
