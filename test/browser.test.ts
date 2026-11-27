// The fixture pages built as an app (sinter with the library, temper with its icons) and used in Chromium under a
// strict CSP (`script-src 'self'`, `style-src 'self'`, Trusted Types; below), against a small API: a mouse drag and a
// keyboard move save the order themselves (PUT /api/tasks/order), a refused order goes back with the note, a touch
// drag from the handle works, and a page that applies the move itself sends its own request. Any CSP violation,
// console error or page error fails the test.
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { chromium, devices, firefox, webkit, type Browser, type BrowserContextOptions, type Page } from 'playwright';

/** The engine: BROWSER=chromium (default), firefox or webkit (Safari's). CI runs all three. */
const engine = { chromium, firefox, webkit }[(process.env.BROWSER ?? 'chromium') as 'chromium' | 'firefox' | 'webkit'];
if (!engine) throw new Error(`BROWSER must be chromium, firefox or webkit, not ${process.env.BROWSER}`);
/** A phone: touch, a narrow screen (Firefox has no mobile mode, only touch at that size). */
const phone: BrowserContextOptions = engine === firefox ? (({ isMobile: _, ...rest }) => rest)(devices['Pixel 7']) : devices['Pixel 7'];
import sinter from '@tiaforge-ui/sinter/vite';
import temper from '@tiaforge-ui/temper/vite';
import { app, PKG } from './app.js';

// what a sinter app with temper's icons needs and no more: sinter's Speculation Rules (this app has no swaps) and temper's
// icons, which are data: SVG masks
// no inline script at all (the app is built without sinter's prefetching, whose speculation rules are inline and need
// a keyword WebKit does not know)
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; require-trusted-types-for 'script'";
const a = app();
const dist = join(a.root, 'dist');
const START = [{ id: 'a', title: 'Alpha', rank: 0 }, { id: 'b', title: 'Beta', rank: 1 }, { id: 'c', title: 'Gamma', rank: 2 }];
let tasks = structuredClone(START);
const CARDS = [
  { id: 'a', title: 'Alpha', status: 'todo', rank: 0 }, { id: 'b', title: 'Beta', status: 'todo', rank: 1 },
  { id: 'c', title: 'Gamma', status: 'doing', rank: 0 },
];
let cards = structuredClone(CARDS);
let refuse = false;
/** ms the mock server waits before answering a write (overlapping saves) */
let slow = 0;
const writes: Array<[string, string, unknown]> = [];
let server: Server;
let base: string;
let browser: Browser;

beforeAll(async () => {
  await build({
    root: a.root, logLevel: 'silent',
    plugins: [
      sinter({ libraries: ['@tiavision/sinter-alloy'], prefetch: false }),
      temper({ paths: [join(PKG, 'sinter/components'), a.root], icons: { lucide: true } }),
    ],
    build: {
      outDir: dist, emptyOutDir: true,
      rollupOptions: { input: Object.fromEntries(['index', 'manual', 'text', 'board', 'board-state', 'split', 'dates', 'palette', 'virtual', 'page-saved'].map((n) => [n, join(a.root, `${n}.html`)])) },
    },
  });
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = (status: number, v: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(v)); };
      if (url.pathname === '/api/tasks' && req.method === 'GET') return json(200, tasks);
      if (url.pathname === '/api/cards' && req.method === 'GET') return json(200, cards);
      if (url.pathname === '/api/people') {
        const limit = Number(url.searchParams.get('limit') ?? 100), after = url.searchParams.get('after');
        const from = after ? Number(after.slice(1)) + 1 : 0;
        const people = Array.from({ length: Math.max(0, Math.min(limit, 2000 - from)) }, (_, i) => {
          const n = from + i;
          return { id: `p${n}`, name: `Person ${n}`, note: n % 7 === 0 ? 'A longer row: a note that makes this one taller than the others.' : null };
        });
        return json(200, { people, total: 2000 });
      }
      if (url.pathname === '/api/commands') {
        const q = (url.searchParams.get('q') ?? '').toLowerCase();
        return json(200, [{ id: 'inv', label: 'Invoice #2405', href: '/split/', group: 'Messages' }, { id: 'team', label: 'Team sync', group: 'Events' }]
          .filter((c) => c.label.toLowerCase().includes(q)));
      }
      if (url.pathname.startsWith('/api/') && slow && !(req as { waited?: boolean }).waited) {
        (req as { waited?: boolean }).waited = true;
        writes.push([req.method!, url.pathname, body ? JSON.parse(body) : null]);
        const again = () => req.emit('end');
        return void setTimeout(again, slow);
      }
      if (url.pathname.startsWith('/api/')) {
        if (!(req as { waited?: boolean }).waited) writes.push([req.method!, url.pathname, body ? JSON.parse(body) : null]);
        if (refuse) return json(500, { error: 'no' });
        if (url.pathname === '/api/cards/order') {
          const { group, order } = JSON.parse(body) as { group: string; order: string[] };
          cards = [...cards.filter((c) => !order.includes(c.id)), ...order.map((id, rank) => ({ ...cards.find((c) => c.id === id)!, status: group, rank }))];
          return json(200, { cards });
        }
        if (url.pathname === '/api/tasks/order') {
          const order = (JSON.parse(body) as { order: string[] }).order;
          tasks = order.map((id, rank) => ({ ...tasks.find((t) => t.id === id)!, rank }));
          return json(200, { tasks });
        }
        res.statusCode = 204;
        return res.end();
      }
      let path = url.pathname;
      if (path.endsWith('/')) path += 'index.html';
      try {
        const file = readFileSync(join(dist, path));
        const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : 'application/octet-stream';
        res.setHeader('Content-Type', type);
        // the split's first frame needs its style attribute (alloy-split.html, "CSP"); `?strict` serves it without
        if (type === 'text/html') res.setHeader('Content-Security-Policy', path.startsWith('/split/') && !url.searchParams.has('strict') ? CSP + "; style-src-attr 'unsafe-inline'" : CSP);
        res.end(file);
      } catch { res.statusCode = 404; res.end(); }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  browser = await engine.launch();
}, 180_000);
afterAll(async () => {
  await browser?.close();
  server?.close();
  if (!process.env.KEEP_APP) a.remove();
});
beforeEach(() => {
  tasks = structuredClone(START);
  cards = structuredClone(CARDS);
  refuse = false;
  slow = 0;
  writes.length = 0;
});

/** a tab on `path` that records policy violations and console and page errors */
async function open(path: string, options = {}): Promise<{ page: Page; check: () => Promise<void> }> {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    // Chromium's note when a navigation (a range written to the URL twice in a row) interrupts the last one's view
    // transition: the page is right, the transition is skipped
    if (m.type() === 'error' && !m.text().includes('500') && !m.text().startsWith('Transition was aborted because of invalid state')) errors.push(m.text());
  });
  page.on('pageerror', (e) => {
    // Chromium: a cross-document view transition (temper's) interrupted by the next navigation rejects its `ready`,
    // left unhandled somewhere (reported to sinter; still seen with sinter #125, which catches its own `ready`)
    if (e.message.startsWith('Transition was aborted because of invalid state')) return;
    errors.push(`uncaught: ${e.message}${e.stack ? ' @ ' + e.stack.split('\n').slice(0, 3).join(' / ') : ''}`);
  });
  await page.addInitScript(() => {
    (window as unknown as { __v: string[] }).__v = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __v: string[] }).__v.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(base + path);
  await page.waitForSelector('li[data-al-key], [role="separator"], .alloy-date, .alloy-palette, .alloy-virtual');
  // the scripts have connected: a handle has its description, or (a split page) the page module has loaded
  await page.waitForFunction(() => !!document.querySelector('.al-handle[aria-description]') || !document.querySelector('.al-handle'));
  await page.waitForLoadState('networkidle');
  return { page, check: async () => {
    const violations = await page.evaluate(() => (window as unknown as { __v: string[] }).__v);
    expect(violations, `CSP violations:\n${violations.join('\n')}`).toEqual([]);
    expect(errors, `console or page errors:\n${errors.join('\n')}`).toEqual([]);
    await ctx.close();
  } };
}
/**
 * A touch drag through `points` (page coordinates). Chromium gets real touch input (CDP); Firefox and WebKit have no
 * way to drive a touch drag, so they get the pointer events a touch makes (pointerType 'touch'), sent to the element
 * the touch starts on, as pointer capture would.
 */
async function touchDrag(page: Page, points: Array<{ x: number; y: number }>) {
  if (engine === chromium) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]!] });
    for (const p of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await page.evaluate(async (points) => {
    const target = document.elementFromPoint(points[0]!.x, points[0]!.y)!;
    const send = (type: string, p: { x: number; y: number }) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      clientX: p.x, clientY: p.y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1,
    }));
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    send('pointerdown', points[0]!);
    for (const p of points.slice(1)) { await frame(); send('pointermove', p); }
    await frame();
    send('pointerup', points.at(-1)!);
  }, points);
}

const order = (p: Page) => p.$$eval('li[data-al-key]', (rows) => rows.map((r) => r.getAttribute('data-al-key')));
const handle = (p: Page, name: string) => p.locator(`button.al-handle[aria-label="Move ${name}"]`);
async function settled(p: Page, want: string[]) {
  await expect.poll(() => order(p), { timeout: 3000 }).toEqual(want);
}

test('a mouse drag saves the order itself: the row moves at once, the server gets the whole order', async () => {
  const { page, check } = await open('');
  const from = (await handle(page, 'Gamma').boundingBox())!;
  const to = (await page.locator('li[data-al-key="a"]').boundingBox())!;
  expect(from.width).toBeGreaterThan(10); // the grip icon is served: the handle has a size
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + (to.y + 3 - from.y - from.height / 2) * i / 8);
  await expect.poll(() => page.locator('li[data-tm-drop="before"]').getAttribute('data-al-key')).toBe('a');
  await page.mouse.up();
  await settled(page, ['c', 'a', 'b']);
  await expect.poll(() => writes).toEqual([['PUT', '/api/tasks/order', { order: ['c', 'a', 'b'] }]]);
  // saved: a reload shows it
  await page.reload();
  await page.waitForSelector('li[data-al-key]');
  expect(await order(page)).toEqual(['c', 'a', 'b']);
  await check();
});

test('a keyboard move saves too; a refused one goes back with the note', async () => {
  const { page, check } = await open('');
  await handle(page, 'Alpha').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  await page.keyboard.press('Space');
  await settled(page, ['b', 'c', 'a']);
  // the handle gets the focus back once the row has moved (the next frame)
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Move Alpha');
  refuse = true;
  await page.keyboard.press('Space');
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  await settled(page, ['b', 'c', 'a']);
  await expect.poll(() => page.locator('.alloy-sortable [role="alert"]').textContent()).toBe('The new order could not be saved.');
  expect(writes.map((w) => w[2])).toEqual([{ order: ['b', 'c', 'a'] }, { order: ['a', 'b', 'c'] }]);
  await check();
});

// ── the same list saved two ways: by the component (index.html) and by the page (page-saved.html) ──

for (const [how, path, note] of [
  ['the component saves', '', '.alloy-sortable [role="alert"]'],
  ['the page saves', 'page-saved/', 'main > [role="alert"]'],
] as const) {
  test(`${how}: three fast moves while the server is slow end in the order shown, saved in that order`, async () => {
    const { page, check } = await open(path);
    slow = 300;
    const move = async (name: string, key: string) => {
      await handle(page, name).focus();
      await page.keyboard.press('Space');
      await page.keyboard.press(key);
      await page.keyboard.press('Space');
      // the component gives the moved row's handle the focus back a frame later: as a person would, wait for it
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe(`Move ${name}`);
    };
    // each move shows at once; the next starts before the server has answered the last (300 ms), so they overlap
    await move('Alpha', 'End');
    await settled(page, ['b', 'c', 'a']);
    await move('Beta', 'End');
    await settled(page, ['c', 'a', 'b']);
    await move('Gamma', 'End');
    await settled(page, ['a', 'b', 'c']);
    expect(writes.length).toBeLessThan(3); // still in flight: not all have been answered (the mock records on arrival)
    await expect.poll(() => writes.length, { timeout: 5000 }).toBe(3);
    // the last order sent is the order shown, and the server ends with it
    expect(writes.at(-1)![2]).toEqual({ order: ['a', 'b', 'c'] });
    await expect.poll(() => tasks.map((t) => t.id), { timeout: 5000 }).toEqual(['a', 'b', 'c']);
    await page.waitForTimeout(500);
    expect(await order(page)).toEqual(['a', 'b', 'c']);
    await check();
  });

  test(`${how}: a refused order goes back, with a note`, async () => {
    const { page, check } = await open(path);
    refuse = true;
    await handle(page, 'Alpha').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('End');
    await page.keyboard.press('Space');
    await expect.poll(() => writes.length).toBe(1);
    await settled(page, ['a', 'b', 'c']);
    await expect.poll(() => page.locator(note).count()).toBe(1);
    await check();
  });
}

test('a touch drag from the handle moves a row on a phone', async () => {
  const { page, check } = await open('', phone);
  const from = (await handle(page, 'Alpha').boundingBox())!;
  const to = (await page.locator('li[data-al-key="c"]').boundingBox())!;
  const x = from.x + from.width / 2, y0 = from.y + from.height / 2, y1 = to.y + to.height - 3;
  await touchDrag(page, Array.from({ length: 9 }, (_, i) => ({ x, y: y0 + (y1 - y0) * i / 8 })));
  await settled(page, ['b', 'c', 'a']);
  await check();
});

test('a page that applies the move itself sends its own request (another API shape)', async () => {
  const { page, check } = await open('manual/');
  await handle(page, 'Beta').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await settled(page, ['b', 'a', 'c']);
  await expect.poll(() => writes).toEqual([['POST', '/api/tasks/move', { id: 'b', after: null }]]);
  await check();
});

// ── the board ──

const board = (p: Page) => p.$$eval('[data-al-group]', (cols) => Object.fromEntries(cols.map((c) =>
  [(c as HTMLElement).dataset.alGroup, [...c.querySelectorAll('li[data-al-key]')].map((li) => li.getAttribute('data-al-key'))])));

/** drags `from`'s centre to (x, y) in small steps, checking `during` before letting go */
async function drag(p: Page, from: { x: number; y: number; width: number; height: number }, x: number, y: number, during?: () => Promise<void>) {
  const sx = from.x + from.width / 2, sy = from.y + from.height / 2;
  await p.mouse.move(sx, sy);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(sx + (x - sx) * i / 10, sy + (y - sy) * i / 10);
  await during?.();
  await p.mouse.up();
}

test('board: a mouse drag to another column moves the card at once and saves that column', async () => {
  const { page, check } = await open('board/');
  const from = (await handle(page, 'Alpha').boundingBox())!;
  const target = (await page.locator('li[data-al-key="c"]').boundingBox())!;
  await drag(page, from, target.x + target.width / 2, target.y + 3, async () => {
    expect(await page.locator('li[data-al-lifted="pointer"]').getAttribute('data-al-key')).toBe('a');
    await expect.poll(() => page.locator('li[data-tm-drop="before"]').getAttribute('data-al-key')).toBe('c');
  });
  await expect.poll(() => board(page)).toEqual({ todo: ['b'], doing: ['a', 'c'], done: [] });
  await expect.poll(() => writes).toEqual([['PUT', '/api/cards/order', { group: 'doing', order: ['a', 'c'] }]]);
  await page.reload();
  await page.waitForSelector('li[data-al-key]');
  expect(await board(page)).toEqual({ todo: ['b'], doing: ['a', 'c'], done: [] });
  await check();
});

test('board: an empty column is outlined and takes the card', async () => {
  const { page, check } = await open('board/');
  const from = (await handle(page, 'Beta').boundingBox())!;
  const done = (await page.locator('[data-al-group="done"] ul').boundingBox())!;
  await drag(page, from, done.x + done.width / 2, done.y + done.height / 2, async () => {
    await expect.poll(() => page.locator('[data-al-group="done"] ul').getAttribute('data-tm-drop')).toBe('inside');
  });
  await expect.poll(() => board(page)).toEqual({ todo: ['a'], doing: ['c'], done: ['b'] });
  await expect.poll(() => writes).toEqual([['PUT', '/api/cards/order', { group: 'done', order: ['b'] }]]);
  await check();
});

test('board over state: keyboard across columns, no request', async () => {
  const { page, check } = await open('board-state/');
  await handle(page, 'Write the brief').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect.poll(() => board(page)).toEqual({ todo: [], doing: ['2', '3'], done: ['1'] });
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Move Write the brief');
  expect(writes).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'board-state.png') });
  await check();
});

// ── split panes ──

const box = (p: Page, sel: string) => p.locator(sel).boundingBox().then((b) => b!);

test('split: a mouse drag resizes the pane, the size is kept for the next visit, a double-click puts it back', async () => {
  const { page, check } = await open('split/');
  const sep = page.locator('#own [role="separator"]');
  const s = await box(page, '#own [role="separator"]');
  const nav = await box(page, '#folders');
  expect(Math.round(nav.width)).toBe(200);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(s.x + s.width / 2 + 60 * i / 6, s.y + s.height / 2);
  await expect.poll(() => page.locator('#own .alloy-split').evaluate((el) => el.classList.contains('dragging'))).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => Math.round((await box(page, '#folders')).width)).toBe(260);
  expect(await sep.getAttribute('aria-valuenow')).toBe('260');
  // past max: clamped
  const s2 = await box(page, '#own [role="separator"]');
  await page.mouse.move(s2.x + s2.width / 2, s2.y + s2.height / 2);
  await page.mouse.down();
  await page.mouse.move(s2.x + 500, s2.y + s2.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => sep.getAttribute('aria-valuenow')).toBe('360');
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('#own [role="separator"]'));
  await expect.poll(async () => Math.round((await box(page, '#folders')).width)).toBe(360);
  await page.locator('#own [role="separator"]').dblclick();
  await expect.poll(async () => Math.round((await box(page, '#folders')).width)).toBe(200);
  await page.evaluate(() => localStorage.clear());
  await check();
});

test('split: keys, a reversed split bound to the page\'s state, a column split', async () => {
  const { page, check } = await open('split/');
  await page.locator('#model [role="separator"]').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(() => page.locator('#width').textContent()).toBe('380');
  expect(Math.round((await box(page, '#model aside')).width)).toBe(380);
  // the column split: the end pane is the sized one; dragging up grows it
  const s = await box(page, '#column [role="separator"]');
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 - 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.locator('#column [role="separator"]').getAttribute('aria-valuenow')).toBe('160');
  await check();
});

test('split: a touch drag on the separator', async () => {
  const { page, check } = await open('split/', phone);
  const s = await box(page, '#own [role="separator"]');
  const x0 = s.x + s.width / 2, y = s.y + s.height / 2;
  await touchDrag(page, Array.from({ length: 6 }, (_, i) => ({ x: x0 + 40 * i / 5, y })));
  await expect.poll(() => page.locator('#own [role="separator"]').getAttribute('aria-valuenow')).toBe('240');
  await check();
});

test('split under style-src \'self\' alone: the first frame\'s size attribute is blocked, the page module applies it', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const violations: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Content[- ]Security[- ]Policy/.test(m.text())) violations.push(m.text()); });
  await page.goto(base + 'split/?strict');
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => Math.round((await page.locator('#folders').boundingBox())!.width)).toBe(200);
  await page.locator('#own [role="separator"]').focus();
  await page.keyboard.press('End');
  await expect.poll(async () => Math.round((await page.locator('#folders').boundingBox())!.width)).toBe(360);
  expect(violations).toEqual([]);
  await page.evaluate(() => localStorage.clear());
  await ctx.close();
});

// ── date, range and month pickers ──

/** How far the furthest of the buttons' text is from its button's centre, in px (temper's menu rows start-align). */
const offCentre = (pop: import('playwright').Locator, sel: string) => pop.evaluate((el, sel) => Math.max(0, ...[...el.querySelectorAll(sel)].map((b) => {
  const r = document.createRange(); r.selectNodeContents(b);
  const t = r.getBoundingClientRect(), bb = b.getBoundingClientRect();
  return Math.abs(t.left + t.width / 2 - (bb.left + bb.width / 2));
})), sel);

test('date: the value in the page\'s language, the calendar under the field, keys pick a day', async () => {
  const { page, check } = await open('dates/');
  const input = page.locator('#date input');
  expect(await input.inputValue()).toBe('Nov 10, 2026');
  const toggle = page.locator('#date button[aria-haspopup]');
  await toggle.click();
  const pop = page.locator('#date [popover]');
  await expect.poll(() => pop.evaluate((el) => el.matches(':popover-open'))).toBe(true);
  await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('true');
  // under the field, starting where it starts (not under the button at its end), once it has finished opening (temper
  // scales it in, which moves its box meanwhile; on a slow machine the transition may not have started yet)
  const f = (await page.locator('#date [data-tm-field]').boundingBox())!;
  await expect.poll(async () => Math.abs((await pop.boundingBox())!.x - f.x)).toBeLessThan(1);
  expect((await pop.boundingBox())!.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
  // the value's day has the focus; a Sunday-first American week; marks and today
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-al-day'))).toBe('2026-11-10');
  expect(await page.locator('#date th').first().textContent()).toBe('Su');
  expect(await page.locator('#date [data-al-day="2026-11-12"]').evaluate((el) => el.classList.contains('marked'))).toBe(true);
  expect(await offCentre(pop, 'button[data-al-day]')).toBeLessThan(1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#due').textContent()).toBe('2026-11-18');
  expect(await input.inputValue()).toBe('Nov 18, 2026');
  expect(await pop.evaluate((el) => el.matches(':popover-open'))).toBe(false);
  // PageDown: the next month
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-al-day'))).toBe('2026-11-18');
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.locator('#date .al-title').textContent()).toBe('December 2026');
  await page.keyboard.press('Escape');
  // the focus goes back to the button that opened it
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup'))).toBe('dialog');
  // typed in the language's order; a text that is no date is marked and changes nothing
  await input.fill('12/24/2026');
  await input.press('Tab');
  await expect.poll(() => page.locator('#due').textContent()).toBe('2026-12-24');
  await input.fill('soon');
  await input.press('Tab');
  expect(await input.getAttribute('aria-invalid')).toBe('true');
  expect(await page.locator('#due').textContent()).toBe('2026-12-24');
  await check();
});

test('range: two picks write the URL\'s parameters; presets; Clear removes them', async () => {
  const { page, check } = await open('dates/');
  const toggle = page.locator('#url button[aria-haspopup]');
  expect(await toggle.textContent()).toBe('Any time');
  await toggle.click();
  const day = (iso: string) => page.locator(`#url [data-al-day="${iso}"]`);
  // the grid opens on today\'s month: go to November 2026 by typing nothing, clicking the month buttons
  const title = page.locator('#url .al-title');
  for (let i = 0; i < 36 && (await title.textContent()) !== 'November 2026'; i++) {
    await page.locator(`#url button.${(await title.textContent())! > 'November 2026' ? 'al-prev' : 'al-next'}`).click();
  }
  await day('2026-11-16').click();
  expect(await page.locator('#url .al-hint').textContent()).toBe('Now pick the last day');
  await day('2026-11-12').hover();
  expect(await day('2026-11-14').evaluate((el) => el.classList.contains('between'))).toBe(true);
  const said: string[] = [];
  page.on('console', (m) => said.push(`${m.type()}: ${m.text()}`));
  await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
  await day('2026-11-10').click();
  if (process.env.RANGE_DEBUG) {
    await page.waitForTimeout(500);
    console.log('range navigation kept the document:', await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true));
  }
  try {
    await expect.poll(() => page.locator('#url-range').textContent()).toBe('2026-11-10/2026-11-16');
  } catch (e) {
    // what the page was at, for a failure seen only on CI's WebKit
    console.log('range diagnostics', JSON.stringify({
      url: page.url(), toggle: await toggle.textContent(), hint: await page.locator('#url .al-hint').textContent().catch(() => null),
      open: await page.locator('#url [popover]').evaluate((el) => el.matches(':popover-open')),
      picked: await page.$$eval('#url [data-al-day].picked, #url [data-al-day][aria-selected="true"]', (els) => els.map((x) => x.getAttribute('data-al-day'))),
      navigation: await page.evaluate(() => typeof (window as unknown as { navigation?: unknown }).navigation), said,
      sameDocument: await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true),
    }));
    throw e;
  }
  expect(new URL(page.url()).search).toBe('?start=2026-11-10&end=2026-11-16');
  expect(await toggle.textContent()).toBe('Nov 10, 2026 – Nov 16, 2026');
  await toggle.click();
  await page.locator('#url [data-al-preset="clear"]').click();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  // a range the page applies itself: a preset
  await page.locator('#state button[aria-haspopup]').click();
  await page.locator('#state [data-al-preset="last7"]').click();
  await expect.poll(() => page.locator('#period').textContent()).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/);
  await check();
});

test('month: a year of months, keys move and pick', async () => {
  const { page, check } = await open('dates/');
  const toggle = page.locator('#month button[aria-haspopup]');
  expect(await toggle.textContent()).toBe('November 2026');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-al-month'))).toBe('2026-11');
  expect(await offCentre(page.locator('#month [popover]'), '.al-months > button')).toBeLessThan(1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('#month .al-title').textContent()).toBe('2027');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#month-out').textContent()).toBe('2027-01');
  expect(await toggle.textContent()).toBe('January 2027');
  await check();
});

// ── command palette ──

test('palette: Ctrl+K opens it with the page\'s own commands; typing ranks; Enter follows a link', async () => {
  const { page, check } = await open('palette/');
  await page.keyboard.press('Control+k');
  const dialog = page.locator('.alloy-palette dialog');
  await expect.poll(() => dialog.evaluate((d) => (d as HTMLDialogElement).open)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('combobox');
  const labels = () => page.$$eval('.alloy-palette [role="option"] [data-tm-truncate]', (els) => els.map((e) => e.textContent));
  await expect.poll(labels).toEqual(['Switch theme', 'Overview', 'Board', 'Split panes', 'Refresh mail']);
  await page.keyboard.type('boa');
  await expect.poll(labels).toEqual(['Board']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/board\/$/);
  await check();
});

test('palette: a page button runs, a page command emits pick, the server\'s answers join, recent first', async () => {
  const { page, check } = await open('palette/');
  const dialog = page.locator('.alloy-palette dialog');
  const labels = () => page.$$eval('.alloy-palette [role="option"] [data-tm-truncate]', (els) => els.map((e) => e.textContent));
  // the button: its shortcut shown, clicked when picked; the focus goes back
  await page.locator('.alloy-palette > button').click();
  await page.keyboard.type('refresh');
  await expect.poll(labels).toEqual(['Refresh mail']);
  expect(await page.locator('.alloy-palette [role="option"] kbd').textContent()).toBe('R');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#refreshed').textContent()).toBe('1');
  expect(await dialog.evaluate((d) => (d as HTMLDialogElement).open)).toBe(false);
  // the server: after a pause, its answers ranked with the rest
  await page.keyboard.press('Control+k');
  await page.keyboard.type('team');
  await expect.poll(labels).toEqual(['Team sync']);
  expect(await page.locator('.alloy-palette [role="option"] .al-group').textContent()).toBe('Events');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#picked').textContent()).toBe('remote:team');
  // recent: the last two picks first
  await page.keyboard.press('Control+k');
  await expect.poll(async () => (await labels()).slice(0, 2)).toEqual(['Team sync', 'Refresh mail']);
  expect(await page.locator('.alloy-palette [role="option"] .al-group').first().textContent()).toBe('Recent');
  await page.keyboard.press('Escape');
  await expect.poll(() => dialog.evaluate((d) => (d as HTMLDialogElement).open)).toBe(false);
  await page.evaluate(() => localStorage.clear());
  await check();
});

// ── long list ──

test('virtual: only the rows in view render; scrolling loads the next pages and keeps the scrollbar right', async () => {
  const { page, check } = await open('virtual/');
  const list = page.locator('.alloy-virtual');
  await expect.poll(() => page.locator('#loaded').textContent()).toBe('100');
  const rendered = () => page.locator('.alloy-virtual [role="listitem"]').count();
  expect(await rendered()).toBeLessThan(30);
  const first = page.locator('.alloy-virtual [role="listitem"]').first();
  expect([await first.getAttribute('aria-posinset'), await first.getAttribute('aria-setsize')]).toEqual(['1', '2000']);
  // the scroll height stands for all 100 loaded rows, not the ones rendered
  expect(await list.evaluate((el) => el.scrollHeight)).toBeGreaterThan(100 * 35);
  // to the end of what is loaded: the next page comes (once), the window follows
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect.poll(() => page.locator('#loaded').textContent()).toBe('200');
  await expect.poll(async () => Number(await page.locator('.alloy-virtual [role="listitem"]').last().getAttribute('aria-posinset'))).toBeGreaterThan(90);
  expect(await rendered()).toBeLessThan(30);
  // scrolling a long way in steps renders the rows there, and asks for more as it goes
  for (let n = 300; n <= 500; n += 100) {
    await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect.poll(() => page.locator('#loaded').textContent()).toBe(String(n));
  }
  // back to the top: the first row again
  await list.evaluate((el) => (el.scrollTop = 0));
  await expect.poll(() => page.locator('.alloy-virtual [role="listitem"]').first().getAttribute('aria-posinset')).toBe('1');
  await check();
});

test('virtual: scrolling a little renders nothing; a row that grows keeps the view where it was', async () => {
  const { page, check } = await open('virtual/');
  const list = page.locator('.alloy-virtual');
  await expect.poll(() => page.locator('#loaded').textContent()).toBe('100');
  await list.evaluate((el) => (el.scrollTop = 40 * 30));
  await expect.poll(() => page.locator('.alloy-virtual [role="listitem"]').first().getAttribute('aria-posinset')).not.toBe('1');
  await page.waitForTimeout(100);
  // a couple of rows either way stay within the rows rendered: no change to the page at all (no render per frame)
  const changes = await list.evaluate(async (el) => {
    let n = 0;
    const mo = new MutationObserver((l) => (n += l.length));
    mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    for (const dy of [20, 20, -40, 30, -30]) {
      el.scrollTop += dy;
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    }
    mo.disconnect();
    return n;
  });
  expect(changes).toBe(0);
  // a row above the view grows: the rows in view stay where they were on screen
  const shown = page.locator('.alloy-virtual [role="listitem"]').nth(8);
  const before = await shown.evaluate((el) => [el.getAttribute('aria-posinset'), el.getBoundingClientRect().top] as const);
  await page.locator('.alloy-virtual [role="listitem"]').first().evaluate((el) => ((el as HTMLElement).style.paddingBlock = '30px'));
  await page.waitForTimeout(150);
  const row = page.locator(`.alloy-virtual [role="listitem"][aria-posinset="${before[0]}"]`);
  expect(Math.abs((await row.evaluate((el) => el.getBoundingClientRect().top)) - before[1])).toBeLessThan(1);
  await check();
});
