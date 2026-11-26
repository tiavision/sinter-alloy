// The state machine of <alloy-sortable>, apart from the DOM so that it can be unit-tested: the keys of
// the rows, the item lifted, the place it would drop at, and the Move a drop makes.
import type { Move, SortableText } from './sinter.types.js';

export const ENGLISH: SortableText = {
  handle: (name) => `Move ${name}`,
  instructions: 'Press Space to pick up, the arrow keys to move, Space to drop, Escape to cancel.',
  lifted: (name, position, total) => `Picked up ${name}. Position ${position} of ${total}.`,
  moved: (name, position, total) => `${name}: position ${position} of ${total}.`,
  dropped: (name, position, total) => `Dropped ${name} at position ${position} of ${total}.`,
  cancelled: (name, position) => `Move cancelled. ${name} is back at position ${position}.`,
  failed: 'The new order could not be saved.',
};

/**
 * Where the lifted item would go: an insertion point in the list as it is, 0 (before the first row) to
 * `keys.length` (after the last). The places right before and after the item itself leave it where it is.
 */
export interface Drag {
  key: string;
  from: number;
  /** insertion point, 0…keys.length */
  at: number;
}

export function lift(keys: readonly string[], key: string): Drag | null {
  const from = keys.indexOf(key);
  return from < 0 ? null : { key, from, at: from };
}

/** The index the item ends up at for an insertion point (the list without the item). */
export const finalIndex = (d: Drag): number => (d.at > d.from ? d.at - 1 : d.at);

/** The insertion point for the item to end up at `index` (0…length-1). */
export const pointFor = (d: Drag, index: number): number => (index >= d.from ? index + 1 : index);

/** One step with the keyboard (−1 up, +1 down, ±Infinity: to the first or last place). */
export function step(d: Drag, keys: readonly string[], by: number): Drag {
  const last = keys.length - 1;
  const index = Math.max(0, Math.min(last, Number.isFinite(by) ? finalIndex(d) + by : by < 0 ? 0 : last));
  return { ...d, at: pointFor(d, index) };
}

/** The insertion point under a pointer: the first row whose middle is below `y` (the rows' tops and heights). */
export function pointAt(rows: ReadonlyArray<{ top: number; height: number }>, y: number): number {
  for (let i = 0; i < rows.length; i++) if (y < rows[i]!.top + rows[i]!.height / 2) return i;
  return rows.length;
}

/** The Move a drop makes, or null when the item stays where it was. */
export function drop(d: Drag, keys: readonly string[], via: Move['via']): Move | null {
  const to = finalIndex(d);
  if (to === d.from) return null;
  const rest = keys.filter((k) => k !== d.key);
  return { key: d.key, from: d.from, to, after: rest[to - 1] ?? null, before: rest[to] ?? null, via };
}

/** Which side of row `i` the drop line is drawn on, for the insertion point `at` (null: none). */
export function lineAt(d: Drag | null, i: number, count: number): 'before' | 'after' | null {
  if (!d || d.at === d.from || d.at === d.from + 1) return null;
  if (d.at === i) return 'before';
  if (d.at === count && i === count - 1) return 'after';
  return null;
}
