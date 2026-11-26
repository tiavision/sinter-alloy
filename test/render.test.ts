// @vitest-environment jsdom
// The fixture page rendered with sinter's testing module and the component's real script: a keyboard move emits
// `move`, the page's optimistic merge puts the row in its new place before the server answers, the request carries
// the new order, and a refused request puts the row back. jsdom lays nothing out, so the pointer is the browser
// test's (test/browser.test.ts).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { memoryStorage, mockRequests, render, type RouteResponse } from '@tiaforge-ui/sinter/testing';
import * as alloy from '../sinter/index.js';
import * as script from '../node_modules/@tiavision/sinter-alloy/sinter/components/alloy-sortable.js';

const PKG = resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(join(PKG, f), 'utf8');
const components = { 'alloy-sortable': read('sinter/components/alloy-sortable.html') };
const scripts = { 'alloy-sortable': script };
const page = read('fixtures/index.html');
const manual = read('fixtures/manual.html');
const TASKS = [{ id: 'a', title: 'Alpha', rank: 0 }, { id: 'b', title: 'Beta', rank: 1 }, { id: 'c', title: 'Gamma', rank: 2 }];
const shown = (root: Element) => [...root.querySelectorAll('li[data-al-key]')].map((li) => li.getAttribute('data-al-key'));

function key(el: Element, k: string) {
  const w = el.ownerDocument.defaultView!;
  el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}
/** a keyboard press on a button: a click with detail 0 */
function press(el: HTMLElement) {
  const w = el.ownerDocument.defaultView!;
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
}

/** a response held until `release()`: what the page shows while the request runs */
function held(res: { status: number; body?: unknown }) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { route: async () => { await gate; return res; }, release };
}

/** a script's state write renders on the next task; `settle()` would also wait for a held request */
const tick = () => new Promise((r) => setTimeout(r, 0));

async function mount(order: RouteResponse, html = page) {
  const requests = mockRequests({ 'GET /api/tasks': TASKS, 'PUT /api/tasks/order': order, 'POST /api/tasks/move': order });
  const r = await render(html, { components, scripts, requests, helpers: { alloy }, storage: memoryStorage(), strict: true });
  await r.settle();
  const handle = (k: string) => r.root.querySelector<HTMLElement>(`li[data-al-key="${k}"] > .al-handle`)!;
  return { ...r, requests, handle };
}

test('the list renders with a handle per row, labelled and described', async () => {
  const { root, handle } = await mount({ status: 204 });
  expect(shown(root)).toEqual(['a', 'b', 'c']);
  expect(handle('b').getAttribute('aria-label')).toBe('Move Beta');
  expect(handle('b').getAttribute('aria-description')).toMatch(/Space to pick up/);
  expect(root.querySelector('[role="list"]')!.getAttribute('aria-label')).toBe('Tasks');
});

test('keyboard: pick up, move down twice, drop: the row moves at once and the new order is sent', async () => {
  const res = held({ status: 204 });
  const { root, handle, flush, settle, requests } = await mount(res.route);
  const status = () => root.querySelector('[role="status"]')!.textContent;
  handle('a').focus();
  press(handle('a'));
  await tick(); flush();
  expect(handle('a').getAttribute('aria-pressed')).toBe('true');
  expect(status()).toBe('Picked up Alpha. Position 1 of 3.');
  key(handle('a'), 'ArrowDown');
  key(handle('a'), 'ArrowDown');
  key(handle('a'), 'ArrowDown'); // past the end: stays last
  await tick(); flush();
  expect(status()).toBe('Alpha: position 3 of 3.');
  expect(root.querySelector('li[data-al-key="c"]')!.getAttribute('data-al-line')).toBe('after');
  press(handle('a'));
  await tick(); flush();
  // optimistic: moved before the server has answered
  expect(shown(root)).toEqual(['b', 'c', 'a']);
  expect(status()).toBe('Dropped Alpha at position 3 of 3.');
  const put = requests.calls.find((c) => c.method === 'PUT')!;
  expect(put.body).toEqual({ order: ['b', 'c', 'a'] });
  res.release();
  await settle();
  expect(shown(root)).toEqual(['b', 'c', 'a']);
  expect(root.querySelector('[data-al-lifted]')).toBeNull();
});

test('a refused request puts the row back', async () => {
  const res = held({ status: 500, body: 'no' });
  const { root, handle, flush, settle } = await mount(res.route);
  press(handle('c'));
  await tick(); flush();
  key(handle('c'), 'Home');
  press(handle('c'));
  await tick(); flush();
  expect(shown(root)).toEqual(['c', 'a', 'b']);
  res.release();
  await settle();
  expect(shown(root)).toEqual(['a', 'b', 'c']);
  expect(root.querySelector('.alloy-sortable [role="alert"]')!.textContent).toBe('The new order could not be saved.');
});

test('the server\'s answer (renumbered) replaces the fraction the optimistic change wrote', async () => {
  // the server renumbers the order it was sent and answers the list
  const answer: RouteResponse = (call) => ({ tasks: (call.body as { order: string[] }).order.map((id, rank) => ({ ...TASKS.find((t) => t.id === id)!, rank })) });
  const { root, handle, settle } = await mount(answer);
  const ranks = () => [...root.querySelectorAll('li[data-al-key]')].map((li) => li.getAttribute('data-al-key'));
  press(handle('b'));
  await settle();
  key(handle('b'), 'ArrowUp');
  press(handle('b'));
  await settle();
  expect(ranks()).toEqual(['b', 'a', 'c']);
  // a second move is computed from the integers: b to the end lands after c (rank 3), not between fractions
  press(handle('b'));
  await settle();
  key(handle('b'), 'End');
  press(handle('b'));
  await settle();
  expect(ranks()).toEqual(['a', 'c', 'b']);
});

test('moves made before an answer are sent one after another, each with the order it made', async () => {
  const res = held({ status: 204 });
  const { root, handle, flush, settle, requests } = await mount(res.route);
  press(handle('a')); await tick(); flush();
  key(handle('a'), 'End'); press(handle('a')); await tick(); flush();
  press(handle('b')); await tick(); flush();
  key(handle('b'), 'End'); press(handle('b')); await tick(); flush();
  expect(shown(root)).toEqual(['c', 'a', 'b']);
  // the second waits for the first's answer
  expect(requests.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ order: ['b', 'c', 'a'] }]);
  res.release();
  await settle();
  expect(requests.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ order: ['b', 'c', 'a'] }, { order: ['c', 'a', 'b'] }]);
});

test('without resource and save the page applies the move: another API shape', async () => {
  const { root, handle, settle, requests } = await mount({ status: 204 }, manual);
  press(handle('c'));
  await settle();
  key(handle('c'), 'Home');
  press(handle('c'));
  await settle();
  expect(shown(root)).toEqual(['c', 'a', 'b']);
  expect(requests.calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.path, c.body])).toEqual([['POST', '/api/tasks/move', { id: 'c', after: null }]]);
});

test('Escape puts the row back without a request; dropping where it was sends nothing', async () => {
  const { root, handle, settle, requests } = await mount({ status: 204 });
  press(handle('b'));
  await settle();
  key(handle('b'), 'ArrowUp');
  key(handle('b'), 'Escape');
  await settle();
  expect(root.querySelector('[role="status"]')!.textContent).toBe('Move cancelled. Beta is back at position 2.');
  press(handle('b'));
  await settle();
  press(handle('b'));
  await settle();
  expect(shown(root)).toEqual(['a', 'b', 'c']);
  expect(requests.calls.filter((c) => c.method === 'PUT')).toEqual([]);
});

test('items from state, another language: the page applies the move itself', async () => {
  const r = await render(read('fixtures/text.html'), { components, scripts, helpers: { alloy }, strict: true });
  await r.settle();
  const h = (k: string) => r.root.querySelector<HTMLElement>(`li[data-al-key="${k}"] > .al-handle`)!;
  expect(h('Privat').getAttribute('aria-label')).toBe('Privat verschieben');
  press(h('Reisen'));
  await r.settle();
  key(h('Reisen'), 'ArrowUp');
  press(h('Reisen'));
  await r.settle();
  expect(shown(r.root)).toEqual(['Arbeit', 'Reisen', 'Privat']);
});
