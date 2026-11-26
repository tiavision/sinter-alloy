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
import { chromium, devices, type Browser, type Page } from 'playwright';
import sinter from '@tiaforge-ui/sinter/vite';
import temper from '@tiaforge-ui/temper/vite';
import { app, PKG } from './app.js';

// what a sinter app with temper's icons needs and no more: sinter's Speculation Rules (this app has no swaps) and temper's
// icons, which are data: SVG masks
const CSP = "default-src 'self'; script-src 'self' 'inline-speculation-rules'; style-src 'self'; img-src 'self' data:; require-trusted-types-for 'script'";
const a = app();
const dist = join(a.root, 'dist');
const START = [{ id: 'a', title: 'Alpha', rank: 0 }, { id: 'b', title: 'Beta', rank: 1 }, { id: 'c', title: 'Gamma', rank: 2 }];
let tasks = structuredClone(START);
let refuse = false;
const writes: Array<[string, string, unknown]> = [];
let server: Server;
let base: string;
let browser: Browser;

beforeAll(async () => {
  await build({
    root: a.root, logLevel: 'silent',
    plugins: [
      sinter({ libraries: ['@tiavision/sinter-alloy'] }),
      temper({ paths: [join(PKG, 'sinter/components'), a.root], icons: { lucide: true } }),
    ],
    build: {
      outDir: dist, emptyOutDir: true,
      rollupOptions: { input: { index: join(a.root, 'index.html'), manual: join(a.root, 'manual.html'), text: join(a.root, 'text.html') } },
    },
  });
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = (status: number, v: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(v)); };
      if (url.pathname === '/api/tasks' && req.method === 'GET') return json(200, tasks);
      if (url.pathname.startsWith('/api/')) {
        writes.push([req.method!, url.pathname, body ? JSON.parse(body) : null]);
        if (refuse) return json(500, { error: 'no' });
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
        if (type === 'text/html') res.setHeader('Content-Security-Policy', CSP);
        res.end(file);
      } catch { res.statusCode = 404; res.end(); }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  browser = await chromium.launch();
}, 180_000);
afterAll(async () => {
  await browser?.close();
  server?.close();
  if (!process.env.KEEP_APP) a.remove();
});
beforeEach(() => {
  tasks = structuredClone(START);
  refuse = false;
  writes.length = 0;
});

/** a tab on `path` that records policy violations and console and page errors */
async function open(path: string, options = {}): Promise<{ page: Page; check: () => Promise<void> }> {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('500')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { __v: string[] }).__v = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __v: string[] }).__v.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(base + path);
  await page.waitForSelector('li[data-al-key]');
  await page.waitForFunction(() => !!document.querySelector('.al-handle[aria-description]')); // the script has connected
  return { page, check: async () => {
    expect(await page.evaluate(() => (window as unknown as { __v: string[] }).__v)).toEqual([]);
    expect(errors).toEqual([]);
    await ctx.close();
  } };
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
  expect(await page.locator('li[data-al-line="before"]').getAttribute('data-al-key')).toBe('a');
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

test('a touch drag from the handle moves a row on a phone', async () => {
  const { page, check } = await open('', devices['Pixel 7']);
  const from = (await handle(page, 'Alpha').boundingBox())!;
  const to = (await page.locator('li[data-al-key="c"]').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const at = (y: number) => [{ x: from.x + from.width / 2, y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from.y + from.height / 2) });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(from.y + from.height / 2 + (to.y + to.height - 3 - from.y - from.height / 2) * i / 8) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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
