// @vitest-environment jsdom
// The split fixture with the real script: keys move the separator and are kept under `name`; Enter collapses and opens;
// a bound value goes through the page's model. Dragging is the browser test's (jsdom has no pointer capture or layout).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { render } from '@tiaforge-ui/sinter/testing';
import * as script from '../node_modules/@tiavision/sinter-alloy/sinter/components/alloy-split.js';

const PKG = resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(join(PKG, f), 'utf8');
const opts = { components: { 'alloy-split': read('sinter/components/alloy-split.html') }, scripts: { 'alloy-split': script }, strict: true };
const key = (el: Element, k: string, shiftKey = false) =>
  el.dispatchEvent(new (el.ownerDocument.defaultView!.KeyboardEvent)('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
const sep = (root: Element, id: string) => root.querySelector<HTMLElement>(`#${id} [role="separator"]`)!;
const size = (root: Element, id: string) => root.querySelector<HTMLElement>(`#${id} .alloy-split`)!.style.getPropertyValue('--al-size');

beforeEach(() => localStorage.clear());

test('the separator: its role, value and bounds, the pane it controls', async () => {
  const { root } = await render(read('fixtures/split.html'), opts);
  const s = sep(root, 'own');
  expect([s.getAttribute('aria-orientation'), s.getAttribute('aria-valuenow'), s.getAttribute('aria-valuemin'), s.getAttribute('aria-valuemax')]).toEqual(['vertical', '200', '120', '360']);
  expect(s.getAttribute('aria-controls')).toBe('folders');
  expect(s.tabIndex).toBe(0);
  expect(size(root, 'own')).toBe('200px');
  expect(sep(root, 'column').getAttribute('aria-orientation')).toBe('horizontal');
});

test('keys move it, the size is kept under its name and comes back', async () => {
  const { root, settle } = await render(read('fixtures/split.html'), opts);
  const s = sep(root, 'own');
  key(s, 'ArrowRight');
  key(s, 'ArrowRight', true);
  await settle();
  expect(s.getAttribute('aria-valuenow')).toBe('280');
  expect(localStorage.getItem('sn:alloy-split:fixture')).toBe('280');
  key(s, 'End');
  await settle();
  expect(size(root, 'own')).toBe('360px');
  const again = await render(read('fixtures/split.html'), opts);
  await again.settle();
  expect(sep(again.root, 'own').getAttribute('aria-valuenow')).toBe('360');
});

test('Enter collapses to min and opens to the size it had', async () => {
  const { root, settle } = await render(read('fixtures/split.html'), opts);
  const s = sep(root, 'own');
  key(s, 'ArrowRight');
  key(s, 'Enter');
  await settle();
  expect(s.getAttribute('aria-valuenow')).toBe('120');
  key(s, 'Enter');
  await settle();
  expect(s.getAttribute('aria-valuenow')).toBe('216');
});

test('a bound value: the page\'s state follows (a reversed split: ArrowLeft grows the end pane), nothing is kept', async () => {
  const { root, settle } = await render(read('fixtures/split.html'), opts);
  const s = sep(root, 'model');
  key(s, 'ArrowLeft');
  await settle();
  expect(root.querySelector('#width')!.textContent).toBe('316');
  expect(s.getAttribute('aria-valuenow')).toBe('316');
  expect(localStorage.length).toBe(0);
});
