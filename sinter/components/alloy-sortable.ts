// The script of <alloy-sortable>: pointer drags and keyboard moves of its rows. It reads the rows' boxes and
// writes only the component's state (the lifted row, its offset, the drop line, the live region's text); a drop
// emits `move` and the page changes the list. The decisions are ../sortable.ts, pure.
import { capture } from '../pointer.js';
import { instance, type App } from '@tiaforge-ui/sinter';
import { AlloySortableComponent } from './alloy-sortable.html';
import { ENGLISH, drop, finalIndex, lift, lineAt, pointAt, step, type Drag } from '../sortable.js';
import { saved, saveOrder, saveTarget, type Handle } from '../save.js';
import type { Move, SortableText } from '../sinter.types.js';

/** how close to a scrolling box's edge (px) the pointer scrolls it, and how fast at the edge (px per frame) */
const EDGE = 40, SPEED = 14;

interface PointerDrag {
  id: number;
  startY: number;
  y: number;
  /** the rows' boxes when the drag started, and the scroll position they were measured at */
  rows: Array<{ top: number; height: number }>;
  scroller: Element | null;
  scroll0: number;
  frame: number;
}

export class AlloySortable extends AlloySortableComponent {
  #stop = new AbortController();
  #drag: Drag | null = null;
  #pointer: PointerDrag | null = null;
  /** the key whose handle takes the focus once the page has moved its row (a keyboard drop) */
  #refocus: string | null = null;
  /** the saves in flight: each request waits for the one before it, so the server sees the orders in turn */
  #queue: Promise<unknown> = Promise.resolve();

  connected() {
    const signal = this.#stop.signal, root = this.root;
    this.state.instructions = this.#text().instructions;
    root.addEventListener('pointerdown', (e) => this.#down(e), { signal });
    // a keyboard press on a handle is a click with no pointer (detail 0): pick up, or drop
    root.addEventListener('click', (e) => {
      const key = handleKey(e.target);
      if (key == null || e.detail !== 0) return;
      e.preventDefault();
      if (this.#drag && this.#drag.key === key && this.state.via === 'keyboard') this.#finish('keyboard');
      else this.#start(key, 'keyboard');
    }, { signal });
    root.addEventListener('keydown', (e) => this.#key(e), { signal });
    // leaving the list with the keyboard puts the row back
    root.addEventListener('focusout', (e) => {
      if (this.state.via === 'keyboard' && !root.contains(e.relatedTarget as Node | null)) this.#cancel();
    }, { signal });
  }

  propsChanged() {
    this.state.instructions = this.#text().instructions;
    const keys = this.#keys();
    // the lifted row went (a server event removed it): nothing to move
    if (this.#drag && !keys.includes(this.#drag.key)) this.#cancel(false);
    else if (this.#drag) this.#drag = { ...this.#drag, from: keys.indexOf(this.#drag.key) };
    const key = this.#refocus;
    if (key != null && keys.includes(key)) {
      this.#refocus = null;
      // after sinter has moved the row: a moved element loses the focus in some browsers
      requestAnimationFrame(() => this.#handle(key)?.focus({ preventScroll: false }));
    }
  }

  disconnected() {
    this.#stop.abort();
    if (this.#pointer) cancelAnimationFrame(this.#pointer.frame);
  }

  #keys = (): string[] => this.props.items.map((x) => this.props.keyOf(x));
  #text = (): SortableText => ({ ...ENGLISH, ...this.props.text });
  #name = (key: string): string => {
    const item = this.props.items.find((x) => this.props.keyOf(x) === key);
    return item !== undefined && this.props.nameOf ? this.props.nameOf(item) : key;
  };
  #handle = (key: string): HTMLElement | null =>
    [...this.root.querySelectorAll<HTMLElement>('li[data-al-key] > .al-handle')].find((b) => b.parentElement!.dataset.alKey === key) ?? null;

  #start(key: string, via: Move['via']) {
    if (this.props.disabled) return;
    const keys = this.#keys(), d = lift(keys, key);
    if (!d) return;
    this.#drag = d;
    this.state.lifted = key;
    this.state.via = via;
    this.state.dy = 0;
    this.#line();
    if (via === 'keyboard') this.state.status = this.#text().lifted(this.#name(key), d.from + 1, keys.length);
  }

  #line() {
    const d = this.#drag, keys = this.#keys();
    let lineKey = '', lineSide = '';
    keys.forEach((k, i) => {
      const side = lineAt(d, i, keys.length);
      if (side) { lineKey = k; lineSide = side; }
    });
    this.state.lineKey = lineKey;
    this.state.lineSide = lineSide;
  }

  #reset() {
    this.#drag = null;
    if (this.#pointer) cancelAnimationFrame(this.#pointer.frame);
    this.#pointer = null;
    this.state.lifted = '';
    this.state.via = '';
    this.state.dy = 0;
    this.state.lineKey = '';
    this.state.lineSide = '';
  }

  #cancel(announce = true) {
    const d = this.#drag;
    if (!d) return;
    this.#reset();
    if (announce) this.state.status = this.#text().cancelled(this.#name(d.key), d.from + 1);
  }

  #finish(via: Move['via']) {
    const d = this.#drag;
    if (!d) return;
    const keys = this.#keys(), move = drop(d, keys, via);
    this.#reset();
    const t = this.#text(), name = this.#name(d.key);
    if (!move) {
      if (via === 'keyboard') this.state.status = t.cancelled(name, d.from + 1);
      return;
    }
    this.state.status = t.dropped(name, move.to + 1, keys.length);
    if (via === 'keyboard') this.#refocus = d.key;
    // a page that handles the move itself prevents it; otherwise, with `resource` and `save`, the component saves it
    if (this.emit('move', move)) this.#save(move);
  }

  /** The round trip of a move (`resource`, `save`): an optimistic merge of the sort field, then the new order. */
  #save(move: Move) {
    const { resource } = this.props;
    if (!resource) return;
    const app = mounted(this.root);
    if (!app) return;
    const res = app.resource(resource);
    // sinter 0.23's handle has `src` and `order`; 0.22's has neither (its type too)
    const target = saveTarget(res as unknown as Handle, this.props, location.href);
    if (!target) return;
    const { url, field, descending } = target;
    const order = saveOrder(res.value() as readonly object[], move, (x) => res.keyOf(x), field, descending);
    if (!order) return;
    const send = () => app.request(url, { method: 'PUT', body: { order: order.keys } });
    const run = () => (this.#queue = this.#queue.then(send, send));
    app.optimistic(() => res.merge(move.key, { [field]: order.value } as Record<string, unknown>), run).then(
      (answer) => {
        this.state.error = '';
        // the server's values (renumbered) over the fractions the change wrote
        for (const [key, value] of saved(answer, (x) => res.keyOf(x), field)) if (res.has(key)) res.merge(key, { [field]: value } as Record<string, unknown>);
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
      e.stopPropagation(); // the row goes back; a dialog around the list stays open
      this.#cancel();
      return;
    }
    if (this.state.via !== 'keyboard' || handleKey(e.target) !== d.key) return;
    const by = ({ ArrowUp: -1, ArrowDown: 1, Home: -Infinity, End: Infinity } as Record<string, number>)[e.key];
    if (by === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const keys = this.#keys();
    this.#drag = step(d, keys, by);
    this.#line();
    this.state.status = this.#text().moved(this.#name(d.key), finalIndex(this.#drag) + 1, keys.length);
  }

  #down(e: PointerEvent) {
    const key = handleKey(e.target);
    if (key == null || e.button !== 0 || this.#drag) return;
    const handle = asElement(e.target)?.closest<HTMLElement>('.al-handle') ?? null;
    e.preventDefault();
    capture(handle, e.pointerId);
    const rows = [...this.root.querySelectorAll<HTMLElement>('li[data-al-key]')].map((li) => {
      const r = li.getBoundingClientRect();
      return { top: r.top, height: r.height };
    });
    const scroller = scrollParent(this.root);
    this.#pointer = { id: e.pointerId, startY: e.clientY, y: e.clientY, rows, scroller, scroll0: scroller?.scrollTop ?? 0, frame: 0 };
    this.#start(key, 'pointer');
    const signal = this.#stop.signal, target: HTMLElement = handle ?? (this.root as HTMLElement);
    const off = new AbortController(), opts = { signal: AbortSignal.any([signal, off.signal]) };
    const end = (commit: boolean) => {
      off.abort();
      if (commit) this.#finish('pointer');
      else this.#cancel(false);
    };
    target.addEventListener('pointermove', (ev) => {
      const p = this.#pointer;
      if (!p || ev.pointerId !== p.id) return;
      p.y = ev.clientY;
      this.#schedule();
    }, opts);
    target.addEventListener('pointerup', (ev) => ev.pointerId === this.#pointer?.id && end(true), opts);
    target.addEventListener('pointercancel', (ev) => ev.pointerId === this.#pointer?.id && end(false), opts);
    // Escape while dragging
    document.addEventListener('keydown', (ev) => ev.key === 'Escape' && this.#pointer && end(false), opts);
  }

  #schedule() {
    const p = this.#pointer;
    if (p && !p.frame) p.frame = requestAnimationFrame(() => this.#frame());
  }

  /** one frame of a pointer drag: scroll near an edge, follow the pointer, place the line */
  #frame() {
    const p = this.#pointer, d = this.#drag;
    if (!p || !d) return;
    p.frame = 0;
    let scrolling = false;
    if (p.scroller) {
      const box = p.scroller.getBoundingClientRect();
      const by = p.y < box.top + EDGE ? -SPEED * (1 - (p.y - box.top) / EDGE) : p.y > box.bottom - EDGE ? SPEED * (1 - (box.bottom - p.y) / EDGE) : 0;
      if (by) {
        const before = p.scroller.scrollTop;
        p.scroller.scrollTop += Math.round(by);
        scrolling = p.scroller.scrollTop !== before;
      }
    }
    const scrolled = (p.scroller?.scrollTop ?? 0) - p.scroll0;
    this.state.dy = p.y - p.startY + scrolled;
    const rows = p.rows.map((r) => ({ top: r.top - scrolled, height: r.height }));
    this.#drag = { ...d, at: pointAt(rows, p.y) };
    this.#line();
    if (scrolling) this.#schedule();
  }
}

/** The key of the row whose handle `t` is in, or null. */
function handleKey(t: EventTarget | null): string | null {
  const h = asElement(t)?.closest('.al-handle');
  return (h?.parentElement as HTMLElement | null)?.dataset.alKey ?? null;
}

/** The sinter app the component is mounted in: the document's, or the nearest mount root above it (a test's). */
function mounted(el: Element): App | null {
  for (let n: Node | null = el; n; n = n.parentNode) {
    try { return instance(n as Element | Document); } catch { /* not a mount root */ }
  }
  return null;
}

/** `t` as an element (no `instanceof`: the element may be another window's, a frame's or a test's). */
function asElement(t: EventTarget | null): Element | null {
  return t && typeof (t as Element).closest === 'function' ? (t as Element) : null;
}

/** The nearest box around `el` that scrolls vertically (null: the page's own scroll is not followed). */
function scrollParent(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}
