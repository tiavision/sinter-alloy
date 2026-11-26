// The README's screenshots: each component in the built preview (preview/dist), light and dark, at 2x, into
// docs/screenshots/<name>-<light|dark>.png. `npm run screenshots` builds the preview first.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = (name, scheme) => resolve(root, `docs/screenshots/${name}-${scheme}.png`);
const server = await preview({ configFile: resolve(root, 'preview/vite.config.ts'), preview: { port: 4793, strictPort: true } });
const url = 'http://localhost:4793/';
const browser = await chromium.launch();
const pad = 16;

/** Hides every element that neither holds nor sits inside one of these, so a shot shows only its component. */
const isolate = (page, locators) => Promise.all(locators.map((l) => l.evaluate((el) => el.setAttribute('data-shot', '')))).then(() =>
  page.evaluate(() => {
    const keep = [...document.querySelectorAll('[data-shot]')];
    for (const el of document.body.querySelectorAll('*')) {
      if (!keep.some((k) => k.contains(el) || el.contains(k))) el.style.visibility = 'hidden';
    }
  }));

/** Scrolls an element near the top of the view, so what opens under it has room. */
const toTop = (locator) => locator.evaluate((el) => { el.scrollIntoView({ block: 'start' }); scrollBy(0, -48); });

/** A screenshot of the area around these elements (popovers included, which an element shot would cut off). */
async function shoot(page, file, ...locators) {
  await isolate(page, locators);
  const measure = () => Promise.all(locators.map((l) => l.boundingBox()));
  // a pick or a focus may have scrolled the page: bring the area's top back into view
  const top = Math.min(...(await measure()).map((b) => b.y));
  await page.evaluate((dy) => scrollBy(0, dy), top - 2 * pad);
  await page.waitForTimeout(100);
  const boxes = await measure();
  const x = Math.min(...boxes.map((b) => b.x)) - pad, y = Math.min(...boxes.map((b) => b.y)) - pad;
  const r = Math.max(...boxes.map((b) => b.x + b.width)) + pad, btm = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
  await page.screenshot({ path: file, clip: { x: Math.max(0, x), y: Math.max(0, y), width: r - Math.max(0, x), height: btm - Math.max(0, y) } });
}

const shots = {
  async sortable(page) {
    const list = page.locator('#h-sortable').locator('xpath=ancestor::section').locator('article.demo');
    await toTop(list);
    return [list];
  },
  async board(page) {
    const board = page.locator('.alloy-board');
    await toTop(board);
    return [board];
  },
  async split(page) {
    const box = page.locator('.split-box');
    await toTop(box);
    await page.locator('.split-box [role=separator]').focus();
    return [box];
  },
  async date(page) {
    const field = page.locator('.alloy-date').first();
    await toTop(field);
    await page.locator('button[data-icon=calendar][aria-haspopup=dialog]').first().click();
    const pop = page.locator('[popover]:popover-open');
    await pop.waitFor();
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-al-day'));
    await page.evaluate(() => document.activeElement.blur()); // the picked day, without the focus ring
    return [field, pop];
  },
  async range(page) {
    const section = page.locator('#h-range').locator('xpath=ancestor::section');
    const toggle = section.locator('[aria-haspopup=dialog]').nth(1);
    await toTop(toggle);
    await toggle.click();
    const pop = page.locator('[popover]:popover-open');
    await pop.waitFor();
    await pop.locator('[data-al-day="2026-11-09"]').click();
    await pop.locator('[data-al-day="2026-11-19"]').hover();
    await page.waitForTimeout(150);
    return [toggle, pop];
  },
  async palette(page) {
    await page.keyboard.press('Control+k');
    const dialog = page.locator('dialog[open]');
    await dialog.waitFor();
    await page.keyboard.type('s');
    return [dialog];
  },
  async virtual(page) {
    const box = page.locator('.list-box');
    await toTop(box);
    const list = box.locator('.alloy-virtual');
    await list.evaluate((el) => { el.scrollTop = 240 * 44; });
    await page.waitForTimeout(300);
    // start the view on a whole row
    await list.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const row = [...el.querySelectorAll('[role=listitem]')].find((r) => r.getBoundingClientRect().top >= top - 1);
      el.scrollTop += row.getBoundingClientRect().top - top;
    });
    await page.waitForTimeout(300);
    return [box];
  },
};

try {
  for (const scheme of ['light', 'dark']) {
    for (const [name, setup] of Object.entries(shots)) {
      const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme });
      await page.goto(url);
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-sn-ready') || document.readyState === 'complete');
      await page.waitForTimeout(400);
      const targets = await setup(page);
      await page.waitForTimeout(600); // popovers and dialogs fade in
      await shoot(page, out(name, scheme), ...targets);
      await page.close();
      console.log(`docs/screenshots/${name}-${scheme}.png`);
    }
  }
} finally {
  await browser.close();
  server.httpServer.close();
}
