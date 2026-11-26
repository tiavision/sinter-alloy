// @vitest-environment jsdom
// The board fixtures rendered with the real script: a keyboard move across columns moves the card at once and saves
// the target column; the answer's values are applied; a refused save rolls back with the note; cards in state move by
// the page's own handler. The pointer is the browser test's.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { mockRequests, render, type RouteResponse } from '@tiaforge-ui/sinter/testing';
import * as alloy from '../sinter/index.js';
import * as script from '../node_modules/@tiavision/sinter-alloy/sinter/components/alloy-board.js';

const PKG = resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(join(PKG, f), 'utf8');
const components = { 'alloy-board': read('sinter/components/alloy-board.html') };
const scripts = { 'alloy-board': script };
const CARDS = [
  { id: 'a', title: 'Alpha', status: 'todo', rank: 0 }, { id: 'b', title: 'Beta', status: 'todo', rank: 1 },
  { id: 'c', title: 'Gamma', status: 'doing', rank: 0 },
];
/** each column's keys, as shown */
const board = (root: Element) => Object.fromEntries([...root.querySelectorAll<HTMLElement>('[data-al-group]')]
  .map((col) => [col.dataset.alGroup, [...col.querySelectorAll('li[data-al-key]')].map((li) => li.getAttribute('data-al-key'))]));
const w = (el: Element) => el.ownerDocument.defaultView!;
const key = (el: Element, k: string) => el.dispatchEvent(new (w(el).KeyboardEvent)('keydown', { key: k, bubbles: true, cancelable: true }));
const press = (el: HTMLElement) => el.dispatchEvent(new (w(el).MouseEvent)('click', { bubbles: true, cancelable: true, detail: 0 }));
const tick = () => new Promise((r) => setTimeout(r, 0));

function held(res: RouteResponse) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { route: (async (call: never, req: never) => { await gate; return typeof res === 'function' ? res(call, req) : res; }) as RouteResponse, release };
}
/** the server: sets the card's group and renumbers the column it was sent */
const server: RouteResponse = (call) => {
  const { group, order } = call.body as { group: string; order: string[] };
  return { cards: order.map((id, rank) => ({ ...CARDS.find((c) => c.id === id)!, status: group, rank })) };
};

async function mount(save: RouteResponse) {
  const requests = mockRequests({ 'GET /api/cards': CARDS, 'PUT /api/cards/order': save });
  const r = await render(read('fixtures/board.html'), { components, scripts, requests, helpers: { alloy }, strict: true });
  await r.settle();
  const handle = (k: string) => r.root.querySelector<HTMLElement>(`li[data-al-key="${k}"] > .al-handle`)!;
  return { ...r, requests, handle };
}

test('the columns render from the cards\' group; headers count them', async () => {
  const { root } = await mount({ status: 204 });
  expect(board(root)).toEqual({ todo: ['a', 'b'], doing: ['c'], done: [] });
  expect([...root.querySelectorAll('[data-al-group] header [data-badge]')].map((b) => b.textContent)).toEqual(['2', '1', '0']);
});

test('keyboard across columns: announced with the column, the card moves at once, the target column is saved', async () => {
  const res = held(server);
  const { root, handle, flush, settle, requests } = await mount(res.route);
  const status = () => root.querySelector('.alloy-board [role="status"]')!.textContent;
  press(handle('b'));
  await tick(); flush();
  expect(status()).toBe('Picked up Beta in To do. Position 2 of 2.');
  key(handle('b'), 'ArrowRight');
  await tick(); flush();
  expect(status()).toBe('Beta: Doing, position 2 of 2.');
  expect(root.querySelector('li[data-al-key="c"]')!.getAttribute('data-al-line')).toBe('after');
  key(handle('b'), 'ArrowUp');
  key(handle('b'), 'ArrowRight');
  await tick(); flush();
  expect(root.querySelector('[data-al-group="done"] ul')!.getAttribute('data-al-line')).toBe('empty');
  key(handle('b'), 'ArrowLeft');
  press(handle('b'));
  await tick(); flush();
  expect(board(root)).toEqual({ todo: ['a'], doing: ['b', 'c'], done: [] }); // before the answer
  expect(status()).toBe('Dropped Beta in Doing at position 1 of 2.');
  expect(requests.calls.find((c) => c.method === 'PUT')!.body).toEqual({ group: 'doing', order: ['b', 'c'] });
  res.release();
  await settle();
  expect(board(root)).toEqual({ todo: ['a'], doing: ['b', 'c'], done: [] });
});

test('to an empty column, and a refused save puts the card back with the note', async () => {
  const res = held({ status: 500, body: 'no' });
  const { root, handle, flush, settle } = await mount(res.route);
  press(handle('a'));
  key(handle('a'), 'ArrowRight');
  key(handle('a'), 'ArrowRight');
  press(handle('a'));
  await tick(); flush();
  expect(board(root)).toEqual({ todo: ['b'], doing: ['c'], done: ['a'] });
  res.release();
  await settle();
  expect(board(root)).toEqual({ todo: ['a', 'b'], doing: ['c'], done: [] });
  expect(root.querySelector('.alloy-board [role="alert"]')!.textContent).toBe('The move could not be saved.');
});

test('cards in state: the page applies the move itself; its own column headers', async () => {
  const r = await render(read('fixtures/board-state.html'), { components, scripts, helpers: { alloy }, strict: true });
  await r.settle();
  expect([...r.root.querySelectorAll('[data-al-group] h2')].map((h) => h.textContent)).toEqual(['todo (1)', 'doing (2)', 'done (0)']);
  const h = (k: string) => r.root.querySelector<HTMLElement>(`li[data-al-key="${k}"] > .al-handle`)!;
  press(h('3'));
  key(h('3'), 'ArrowRight');
  press(h('3'));
  await r.settle();
  expect(board(r.root)).toEqual({ todo: ['1'], doing: ['2'], done: ['3'] });
  expect(h('3').getAttribute('aria-pressed')).toBe('false');
});
