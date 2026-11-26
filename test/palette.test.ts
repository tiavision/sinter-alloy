// The palette's ranking and recent list: pure. collect() is the browser test's (it reads a document).
import { expect, test } from 'vitest';
import { rank, remember, score, withRecent } from '../sinter/palette.js';

const cmds = [
  { id: 'a', label: 'Refresh mail', group: 'Actions' },
  { id: 'b', label: 'Receipts', group: 'Go to' },
  { id: 'c', label: 'Recurring: Team sync', group: 'Go to' },
  { id: 'd', label: 'Switch theme', keywords: 'dark light' },
  { id: 'e', label: 'Météo' },
];

test('score: the start of the label, of a word, inside, an abbreviation; every word must match', () => {
  expect(score('rec', 'Receipts')).toBeGreaterThan(score('rec', 'Team recurring'));
  expect(score('rec', 'Team recurring')).toBeGreaterThan(score('ec', 'Receipts'));
  expect(score('rm', 'Refresh mail')).toBeGreaterThan(0);
  expect(score('zz', 'Refresh mail')).toBe(0);
  expect(score('team sync', 'Recurring: Team sync')).toBeGreaterThan(0);
  expect(score('team zz', 'Recurring: Team sync')).toBe(0);
  expect(score('meteo', 'Météo')).toBeGreaterThan(0);
});

test('rank: best first, keywords count, ties keep their order', () => {
  expect(rank('rec', cmds).map((c) => c.id)).toEqual(['b', 'c']);
  expect(rank('dark', cmds).map((c) => c.id)).toEqual(['d']);
  expect(rank('re', cmds, 1).map((c) => c.id)).toEqual(['a']);
});

test('recent: picked ones first under their own heading, as the page has them now, else as kept; five at most', () => {
  expect(withRecent(cmds, [{ id: 'c', label: 'old name' }], 'Recent').slice(0, 2)).toEqual([{ ...cmds[2], group: 'Recent' }, cmds[0]]);
  const remote = { id: 'remote:x', label: 'Invoice', href: '/m/1' };
  expect(withRecent(cmds, [remote], 'Recent')[0]).toEqual({ ...remote, group: 'Recent' });
  const ids = (l: { id: string }[]) => l.map((c) => c.id);
  const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id }));
  expect(ids(remember(five, { id: 'c', label: 'c', group: 'Go to' }))).toEqual(['c', 'a', 'b', 'd', 'e']);
  expect(remember(five, { id: 'f', label: 'f', group: 'Go to' })[0]).toEqual({ id: 'f', label: 'f' });
  expect(remember(five, { id: 'f', label: 'f' })).toHaveLength(5);
});
