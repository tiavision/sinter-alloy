// The state machine of <alloy-board>, apart from the DOM: columns of keys, the card lifted, the column and place it
// would drop at, and the BoardMove a drop makes. A column's insertion point counts the column as it is shown (with the
// lifted card in it when it is its own column), as sortable.ts does for one list.
import type { BoardMove, BoardText, Move } from './sinter.types.js';

export const BOARD_ENGLISH: BoardText = {
  handle: (name) => `Move ${name}`,
  instructions: 'Press Space to pick up, the arrow keys to move within and between columns, Space to drop, Escape to cancel.',
  lifted: (name, list, position, total) => `Picked up ${name} in ${list}. Position ${position} of ${total}.`,
  moved: (name, list, position, total) => `${name}: ${list}, position ${position} of ${total}.`,
  dropped: (name, list, position, total) => `Dropped ${name} in ${list} at position ${position} of ${total}.`,
  cancelled: (name, list, position) => `Move cancelled. ${name} is back in ${list} at position ${position}.`,
  failed: 'The move could not be saved.',
};

export interface Column {
  group: string;
  keys: readonly string[];
}

export interface BoardDrag {
  key: string;
  fromGroup: string;
  /** its index in its own column */
  from: number;
  toGroup: string;
  /** insertion point in the target column as shown: 0…keys.length */
  at: number;
}

const column = (cols: readonly Column[], group: string) => cols.find((c) => c.group === group);

export function liftCard(cols: readonly Column[], key: string): BoardDrag | null {
  for (const c of cols) {
    const from = c.keys.indexOf(key);
    if (from >= 0) return { key, fromGroup: c.group, from, toGroup: c.group, at: from };
  }
  return null;
}

const same = (d: BoardDrag) => d.toGroup === d.fromGroup;

/** The index the card ends up at in its target column (counted without it). */
export const cardIndex = (d: BoardDrag): number => (same(d) && d.at > d.from ? d.at - 1 : d.at);

/** The last index the card can take in `group`: its own column has it already. */
function lastIndex(cols: readonly Column[], d: BoardDrag, group: string): number {
  const n = column(cols, group)?.keys.length ?? 0;
  return group === d.fromGroup ? n - 1 : n;
}

/** The insertion point for the card to end up at `index` in `group`. */
function pointIn(d: BoardDrag, group: string, index: number): number {
  return group === d.fromGroup && index >= d.from ? index + 1 : index;
}

/** Up and down within the target column (−1, +1, ±Infinity for its ends). */
export function stepCard(d: BoardDrag, cols: readonly Column[], by: number): BoardDrag {
  const last = lastIndex(cols, d, d.toGroup);
  const index = Math.max(0, Math.min(last, Number.isFinite(by) ? cardIndex(d) + by : by < 0 ? 0 : last));
  return { ...d, at: pointIn(d, d.toGroup, index) };
}

/** Left or right to the neighbouring column (−1, +1), at the same index or that column's end. */
export function crossCard(d: BoardDrag, cols: readonly Column[], by: number): BoardDrag {
  const i = cols.findIndex((c) => c.group === d.toGroup);
  const next = cols[Math.max(0, Math.min(cols.length - 1, i + by))];
  if (!next || next.group === d.toGroup) return d;
  const index = Math.min(cardIndex(d), lastIndex(cols, d, next.group));
  return { ...d, toGroup: next.group, at: pointIn(d, next.group, index) };
}

/** The card's drop target under a pointer: the column whose box holds `x` (else the nearest), the place by `y`. */
export function placeAt(
  boxes: ReadonlyArray<{ group: string; left: number; right: number; rows: ReadonlyArray<{ top: number; height: number }> }>,
  x: number, y: number,
): { group: string; at: number } | null {
  if (!boxes.length) return null;
  const hit = boxes.find((b) => x >= b.left && x < b.right)
    ?? boxes.reduce((a, b) => (Math.abs((b.left + b.right) / 2 - x) < Math.abs((a.left + a.right) / 2 - x) ? b : a));
  let at = hit.rows.length;
  for (let i = 0; i < hit.rows.length; i++) if (y < hit.rows[i]!.top + hit.rows[i]!.height / 2) { at = i; break; }
  return { group: hit.group, at };
}

/** The BoardMove a drop makes, or null when the card stays where it was. */
export function dropCard(d: BoardDrag, cols: readonly Column[], via: Move['via']): BoardMove | null {
  const to = cardIndex(d);
  if (same(d) && to === d.from) return null;
  const rest = (column(cols, d.toGroup)?.keys ?? []).filter((k) => k !== d.key);
  return { key: d.key, from: d.from, to, after: rest[to - 1] ?? null, before: rest[to] ?? null, via, fromGroup: d.fromGroup, toGroup: d.toGroup };
}

/** The drop line on row `i` of `group` (count rows), or on the empty column itself ('empty'). */
export function cardLine(d: BoardDrag | null, group: string, i: number, count: number): 'before' | 'after' | null {
  if (!d || d.toGroup !== group || i >= count) return null;
  if (same(d) && (d.at === d.from || d.at === d.from + 1)) return null;
  if (d.at === i) return 'before';
  if (d.at === count && i === count - 1) return 'after';
  return null;
}

/** The size of the target column with the card in it, for the announcements. */
export const columnTotal = (d: BoardDrag, cols: readonly Column[]): number => lastIndex(cols, d, d.toGroup) + 1;
