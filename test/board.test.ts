// The board's state machine and helpers: pure.
import { expect, test } from 'vitest';
import { cardIndex, cardLine, columnTotal, crossCard, dropCard, liftCard, placeAt, stepCard } from '../sinter/board.js';
import { columnAfter, rankIn, regroup } from '../sinter/order.js';
import { savedFields } from '../sinter/save.js';
import type { BoardMove } from '../sinter/sinter.types.js';

const cols = [{ group: 'todo', keys: ['a', 'b'] }, { group: 'doing', keys: ['c'] }, { group: 'done', keys: [] }];
const cards = [
  { id: 'a', status: 'todo', rank: 0 }, { id: 'b', status: 'todo', rank: 1 },
  { id: 'c', status: 'doing', rank: 0 },
];
const id = (c: { id: string }) => c.id;

test('within a column: as the sortable', () => {
  const d = liftCard(cols, 'a')!;
  expect(d).toEqual({ key: 'a', fromGroup: 'todo', from: 0, toGroup: 'todo', at: 0 });
  expect(dropCard(stepCard(d, cols, 1), cols, 'keyboard')).toEqual(
    { key: 'a', from: 0, to: 1, after: 'b', before: null, via: 'keyboard', fromGroup: 'todo', toGroup: 'todo' });
  expect(dropCard(d, cols, 'keyboard')).toBeNull();
  expect(stepCard(stepCard(d, cols, 1), cols, 1)).toEqual(stepCard(d, cols, 1)); // stops at the end
});

test('across columns: same index where it fits, the end otherwise; an empty column takes it at 0', () => {
  let d = stepCard(liftCard(cols, 'b')!, cols, 0);
  d = crossCard(d, cols, 1);
  expect(d.toGroup).toBe('doing');
  expect(cardIndex(d)).toBe(1); // 'doing' has one card: index 1 is after it
  expect(columnTotal(d, cols)).toBe(2);
  expect(dropCard(d, cols, 'keyboard')).toEqual(
    { key: 'b', from: 1, to: 1, after: 'c', before: null, via: 'keyboard', fromGroup: 'todo', toGroup: 'doing' });
  d = crossCard(d, cols, 1);
  expect([d.toGroup, cardIndex(d)]).toEqual(['done', 0]);
  expect(cardLine(d, 'done', 0, 0)).toBeNull(); // the empty column is outlined instead
  expect(crossCard(d, cols, 1)).toEqual(d); // no column further right
  // back home, at its own place: no move
  d = crossCard(crossCard(d, cols, -1), cols, -1);
  expect(d.toGroup).toBe('todo');
  expect(dropCard({ ...d, at: 1 }, cols, 'keyboard')).toBeNull();
});

test('the line: before the row at the place, after the last row at the end, not next to the card itself', () => {
  const d = { ...liftCard(cols, 'a')!, toGroup: 'doing', at: 0 };
  expect(cardLine(d, 'doing', 0, 1)).toBe('before');
  expect(cardLine({ ...d, at: 1 }, 'doing', 0, 1)).toBe('after');
  expect(cardLine(d, 'todo', 0, 2)).toBeNull();
  expect(cardLine({ ...d, toGroup: 'todo', at: 1 }, 'todo', 1, 2)).toBeNull();
});

test('the pointer: the column under x (else the nearest), the place by y', () => {
  const boxes = [
    { group: 'todo', left: 0, right: 100, rows: [{ top: 0, height: 40 }, { top: 50, height: 40 }] },
    { group: 'doing', left: 120, right: 220, rows: [] },
  ];
  expect(placeAt(boxes, 50, 60)).toEqual({ group: 'todo', at: 1 });
  expect(placeAt(boxes, 150, 10)).toEqual({ group: 'doing', at: 0 });
  expect(placeAt(boxes, 115, 10)!.group).toBe('doing'); // in the gap: the nearest by centre
  expect(placeAt([], 0, 0)).toBeNull();
});

test('helpers: the target column\'s order, the rank between neighbours there, and regroup for state', () => {
  const mv: BoardMove = { key: 'b', from: 1, to: 0, after: null, before: 'c', via: 'pointer', fromGroup: 'todo', toGroup: 'doing' };
  expect(columnAfter(cards, mv, id, 'status')).toEqual(['b', 'c']);
  expect(rankIn(cards, mv, id, 'status', 'rank')).toBe(-1);
  expect(rankIn(cards, { ...mv, to: 1, after: 'c', before: null }, id, 'status', 'rank')).toBe(1);
  expect(rankIn(cards, { ...mv, toGroup: 'done', to: 0, before: null }, id, 'status', 'rank')).toBe(0);
  expect(regroup(cards, mv, id, 'status').map((c) => `${c.id}:${c.status}`)).toEqual(['a:todo', 'b:doing', 'c:doing']);
  expect(regroup(cards, { ...mv, to: 1, after: 'c', before: null }, id, 'status').map((c) => c.id)).toEqual(['a', 'c', 'b']);
  expect(regroup(cards, { ...mv, toGroup: 'done', to: 0, before: null }, id, 'status').at(-1)).toEqual({ id: 'b', status: 'done', rank: 1 });
  expect(cards[1]!.status).toBe('todo'); // the input untouched
});

test('savedFields: the group and rank of an answer\'s cards, by key', () => {
  expect(savedFields({ cards: [{ id: 'b', status: 'doing', rank: 0, title: 'x' }, { id: 'c' }] }, (x) => (x as { id: string }).id, ['status', 'rank']))
    .toEqual([['b', { status: 'doing', rank: 0 }]]);
  expect(savedFields(null, (x) => String(x), ['rank'])).toEqual([]);
});
