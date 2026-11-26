// The script of <alloy-board>: pointer drags and keyboard moves of its cards, within a column and between columns. It
// reads the boxes and writes only the component's state; a drop emits `move` (cancelable) and, with `resource` and
// `save`, saves it through the page's store. The decisions are ../board.ts, the request ../order.ts and ../save.ts.
import { capture } from '../pointer.js';
import { instance, type App } from '@tiaforge-ui/sinter';
import { AlloyBoardComponent } from './alloy-board.html';
import { BOARD_ENGLISH, cardIndex, cardLine, columnTotal, crossCard, dropCard, liftCard, placeAt, stepCard, type BoardDrag, type Column } from '../board.js';
import { columnAfter, rankIn } from '../order.js';
import { savedFields, saveTarget, type Handle } from '../save.js';
import type { BoardMove, BoardText, Move } from '../sinter.types.js';

const EDGE = 40, SPEED = 14;

interface Box { group: string; left: number; right: number; rows: Array<{ top: number; height: number }> }
interface PointerDrag {
  id: number;
  startX: number; startY: number; x: number; y: number;
  boxes: Box[];
  scroller: Element | null; scroll0: number;
  strip: Element; strip0: number;
  frame: number;
}

export class AlloyBoard extends AlloyBoardComponent {
  #stop = new AbortController();
  #drag: BoardDrag | null = null;
  #pointer: PointerDrag | null = null;
  #refocus: string | null = null;
  #queue: Promise<unknown> = Promise.resolve();

  connected() {
    const signal = this.#stop.signal, root = this.root;
    this.state.instructions = this.#text().instructions;
    root.addEventListener('pointerdown', (e) => this.#down(e), { signal });
    root.addEventListener('click', (e) => {
      const key = handleKey(e.target);
      if (key == null || e.detail !== 0) return;
      e.preventDefault();
      if (this.#drag && this.#drag.key === key && this.state.via === 'keyboard') this.#finish('keyboard');
      else this.#start(key, 'keyboard');
    }, { signal });
    root.addEventListener('keydown', (e) => this.#key(e), { signal });
    root.addEventListener('focusout', (e) => {
      if (this.state.via === 'keyboard' && !root.contains(e.relatedTarget as Node | null)) this.#cancel();
    }, { signal });
  }

  propsChanged() {
    this.state.instructions = this.#text().instructions;
    const d = this.#drag;
    if (d) {
      const now = liftCard(this.#columns(), d.key);
      if (!now) this.#cancel(false);
      else this.#drag = { ...d, fromGroup: now.fromGroup, from: now.from };
    }
    const key = this.#refocus;
    if (key != null && this.#columns().some((c) => c.keys.includes(key))) {
      this.#refocus = null;
      requestAnimationFrame(() => this.#handle(key)?.focus());
    }
  }

  disconnected() {
    this.#stop.abort();
    if (this.#pointer) cancelAnimationFrame(this.#pointer.frame);
  }

  /** the columns' keys, in order, as the markup shows them */
  #columns(): Column[] {
    const { lists, listKey, items, keyOf, group } = this.props;
    return lists.map((l) => {
      const g = listKey(l);
      return { group: g, keys: items.filter((x) => String(x[group]) === g).map(keyOf) };
    });
  }
  #text = (): BoardText => ({ ...BOARD_ENGLISH, ...this.props.text });
  #name = (key: string): string => {
    const item = this.props.items.find((x) => this.props.keyOf(x) === key);
    return item !== undefined && this.props.nameOf ? this.props.nameOf(item) : key;
  };
  #listName = (group: string): string => {
    const l = this.props.lists.find((x) => this.props.listKey(x) === group);
    return l !== undefined && this.props.listName ? this.props.listName(l) : group;
  };
  #handle = (key: string): HTMLElement | null =>
    [...this.root.querySelectorAll<HTMLElement>('li[data-al-key] > .al-handle')].find((b) => b.parentElement!.dataset.alKey === key) ?? null;

  #start(key: string, via: Move['via']) {
    if (this.props.disabled) return;
    const cols = this.#columns(), d = liftCard(cols, key);
    if (!d) return;
    this.#drag = d;
    this.state.lifted = key;
    this.state.via = via;
    this.state.dx = 0;
    this.state.dy = 0;
    this.#line();
    if (via === 'keyboard') this.state.status = this.#text().lifted(this.#name(key), this.#listName(d.fromGroup), d.from + 1, columnTotal(d, cols));
  }

  #line() {
    const d = this.#drag, cols = this.#columns();
    let lineKey = '', lineSide = '', lineGroup = '';
    if (d) {
      lineGroup = d.toGroup;
      const keys = cols.find((c) => c.group === d.toGroup)?.keys ?? [];
      keys.forEach((k, i) => {
        const side = cardLine(d, d.toGroup, i, keys.length);
        if (side) { lineKey = k; lineSide = side; }
      });
    }
    this.state.lineKey = lineKey;
    this.state.lineSide = lineSide;
    this.state.lineGroup = lineGroup;
  }

  #reset() {
    this.#drag = null;
    if (this.#pointer) cancelAnimationFrame(this.#pointer.frame);
    this.#pointer = null;
    Object.assign(this.state, { lifted: '', via: '', dx: 0, dy: 0, lineKey: '', lineSide: '', lineGroup: '' });
  }

  #cancel(announce = true) {
    const d = this.#drag;
    if (!d) return;
    this.#reset();
    if (announce) this.state.status = this.#text().cancelled(this.#name(d.key), this.#listName(d.fromGroup), d.from + 1);
  }

  #finish(via: Move['via']) {
    const d = this.#drag;
    if (!d) return;
    const cols = this.#columns(), move = dropCard(d, cols, via), total = columnTotal(d, cols);
    this.#reset();
    const t = this.#text(), name = this.#name(d.key);
    if (!move) {
      if (via === 'keyboard') this.state.status = t.cancelled(name, this.#listName(d.fromGroup), d.from + 1);
      return;
    }
    this.state.status = t.dropped(name, this.#listName(move.toGroup), move.to + 1, total);
    if (via === 'keyboard') this.#refocus = d.key;
    if (this.emit('move', move)) this.#save(move);
  }

  /** `resource` and `save`: the card's group and rank at once, then PUT <save> { group, order } */
  #save(move: BoardMove) {
    const { resource, group } = this.props;
    if (!resource) return;
    const app = mounted(this.root);
    if (!app) return;
    const res = app.resource(resource);
    // sinter 0.23's handle has `src` and `order`; 0.22's has neither (its type too)
    const target = saveTarget(res as unknown as Handle, this.props, location.href);
    if (!target) return;
    const { url, field, descending } = target;
    const list = res.value() as readonly Record<string, unknown>[];
    const keyOf = (x: object) => res.keyOf(x as Record<string, unknown>);
    if (!list.some((x) => keyOf(x) === move.key)) return;
    const order = columnAfter(list, move, keyOf, group);
    const rank = rankIn(list, move, keyOf, group, field, descending);
    const send = () => app.request(url, { method: 'PUT', body: { group: move.toGroup, order } });
    const run = () => (this.#queue = this.#queue.then(send, send));
    app.optimistic(() => res.merge(move.key, { [group]: move.toGroup, [field]: rank }), run).then(
      (answer) => {
        this.state.error = '';
        for (const [key, fields] of savedFields(answer, keyOf, [group, field])) if (res.has(key)) res.merge(key, fields);
      },
      (error: unknown) => {
        if (this.emit('sort-error', { move, error })) this.state.error = this.#text().failed;
      },
    );
  }

  #key(e: KeyboardEvent) {
    const d = this.#drag;
    if (!d) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.#cancel();
      return;
    }
    if (this.state.via !== 'keyboard' || handleKey(e.target) !== d.key || e.altKey || e.ctrlKey || e.metaKey) return;
    const cols = this.#columns();
    const vertical = ({ ArrowUp: -1, ArrowDown: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[e.key];
    const across = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key];
    if (vertical === undefined && across === undefined) return;
    e.preventDefault();
    this.#drag = vertical !== undefined ? stepCard(d, cols, vertical) : crossCard(d, cols, across!);
    this.#line();
    const n = this.#drag;
    this.state.status = this.#text().moved(this.#name(n.key), this.#listName(n.toGroup), cardIndex(n) + 1, columnTotal(n, cols));
  }

  #down(e: PointerEvent) {
    const key = handleKey(e.target);
    if (key == null || e.button !== 0 || this.#drag) return;
    const handle = asElement(e.target)?.closest<HTMLElement>('.al-handle') ?? null;
    e.preventDefault();
    capture(handle, e.pointerId);
    const strip = this.root.querySelector('.al-columns') ?? this.root;
    const scroller = scrollParent(this.root);
    this.#pointer = {
      id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, boxes: this.#measure(),
      scroller, scroll0: scroller?.scrollTop ?? 0, strip, strip0: strip.scrollLeft, frame: 0,
    };
    this.#start(key, 'pointer');
    const target: HTMLElement = handle ?? (this.root as HTMLElement);
    const off = new AbortController(), opts = { signal: AbortSignal.any([this.#stop.signal, off.signal]) };
    const end = (commit: boolean) => {
      off.abort();
      if (commit) this.#finish('pointer');
      else this.#cancel(false);
    };
    target.addEventListener('pointermove', (ev) => {
      const p = this.#pointer;
      if (!p || ev.pointerId !== p.id) return;
      p.x = ev.clientX;
      p.y = ev.clientY;
      this.#schedule();
    }, opts);
    target.addEventListener('pointerup', (ev) => ev.pointerId === this.#pointer?.id && end(true), opts);
    target.addEventListener('pointercancel', (ev) => ev.pointerId === this.#pointer?.id && end(false), opts);
    document.addEventListener('keydown', (ev) => ev.key === 'Escape' && this.#pointer && end(false), opts);
  }

  /** the columns' lists and their rows, where they are now */
  #measure(): Box[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-al-group]')].map((col) => {
      const r = col.getBoundingClientRect();
      const rows = [...col.querySelectorAll<HTMLElement>('li[data-al-key]')].map((li) => {
        const b = li.getBoundingClientRect();
        return { top: b.top, height: b.height };
      });
      return { group: col.dataset.alGroup!, left: r.left, right: r.right, rows };
    });
  }

  #schedule() {
    const p = this.#pointer;
    if (p && !p.frame) p.frame = requestAnimationFrame(() => this.#frame());
  }

  #frame() {
    const p = this.#pointer, d = this.#drag;
    if (!p || !d) return;
    p.frame = 0;
    let scrolling = false;
    const nudge = (el: Element, pos: number, lo: number, hi: number, prop: 'scrollTop' | 'scrollLeft') => {
      const by = pos < lo + EDGE ? -SPEED * (1 - (pos - lo) / EDGE) : pos > hi - EDGE ? SPEED * (1 - (hi - pos) / EDGE) : 0;
      if (!by) return;
      const before = el[prop];
      el[prop] += Math.round(by);
      scrolling ||= el[prop] !== before;
    };
    if (p.scroller) { const b = p.scroller.getBoundingClientRect(); nudge(p.scroller, p.y, b.top, b.bottom, 'scrollTop'); }
    { const b = p.strip.getBoundingClientRect(); nudge(p.strip, p.x, b.left, b.right, 'scrollLeft'); }
    const sy = (p.scroller?.scrollTop ?? 0) - p.scroll0, sx = p.strip.scrollLeft - p.strip0;
    this.state.dx = p.x - p.startX + sx;
    this.state.dy = p.y - p.startY + sy;
    const boxes = p.boxes.map((b) => ({ ...b, left: b.left - sx, right: b.right - sx, rows: b.rows.map((r) => ({ top: r.top - sy, height: r.height })) }));
    const place = placeAt(boxes, p.x, p.y);
    if (place) this.#drag = { ...d, toGroup: place.group, at: place.at };
    this.#line();
    if (scrolling) this.#schedule();
  }
}

function mounted(el: Element): App | null {
  for (let n: Node | null = el; n; n = n.parentNode) {
    try { return instance(n as Element | Document); } catch { /* not a mount root */ }
  }
  return null;
}

function asElement(t: EventTarget | null): Element | null {
  return t && typeof (t as Element).closest === 'function' ? (t as Element) : null;
}

function handleKey(t: EventTarget | null): string | null {
  const h = asElement(t)?.closest('.al-handle');
  return (h?.parentElement as HTMLElement | null)?.dataset.alKey ?? null;
}

function scrollParent(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}
