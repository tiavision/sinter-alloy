// The script of <alloy-virtual>: follows the scroll, writes the window into state (the markup renders
// items.slice(start, end) between two spacers), keeps the first row in view where it was when heights or the list
// change, and emits `end` near the last loaded row. The arithmetic is ../virtual.ts.
//
// Scrolling is the hot path, so it reads nothing from the DOM but the scroll position, and renders only when the view
// comes near the edge of the rows rendered:
// - the rows' heights come from a ResizeObserver (sizes measured by the browser's own layout, no forced layout), which
//   a MutationObserver attaches to each row sinter adds;
// - the offsets are computed again only when the items or a height change, not per frame;
// - only a new `items` array is a change of props (a page's `keyOf: (x) => x.id` is a new function at every render);
// - the window moves when fewer than half the overscan rows are left beyond the view, by a whole overscan;
// - rows not measured yet are estimated from those measured, so new rows rarely change the spacers.
import { AlloyVirtualComponent } from './alloy-virtual.html';
import { layout, nearEnd, rowAt, windowAt } from '../virtual.js';

/** a row's whole height: padding and borders change it too (the observer's default, the content box, misses them) */
const BORDER: ResizeObserverOptions = { box: 'border-box' };

export class AlloyVirtual extends AlloyVirtualComponent {
  #stop = new AbortController();
  #frame = 0;
  #resize: ResizeObserver | null = null;
  #rows: MutationObserver | null = null;
  #heights = new Map<string, number>();
  #items: readonly unknown[] | null = null;
  #keys: string[] = [];
  #index = new Map<string, number>();
  #offsets: number[] = [];
  #total = 0;
  /** the offsets need computing again (new items, a new height) */
  #stale = true;
  /** the first row in view and how far the view's top is below its top, from before the change */
  #anchor: { key: string; delta: number } | null = null;
  #viewport = 0;
  /** the list's length when `end` was last emitted: once per length */
  #asked = -1;

  connected() {
    const root = this.root, signal = this.#stop.signal;
    root.addEventListener('scroll', () => this.#schedule(), { signal, passive: true });
    if (typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver((entries) => this.#resized(entries));
      this.#resize.observe(root);
      // the rows sinter adds are observed as they come (the observer reports each one's size once, then its changes)
      this.#rows = new MutationObserver((records) => {
        for (const r of records) {
          for (const n of r.addedNodes) if (n instanceof HTMLElement && n.hasAttribute('data-al-index')) this.#resize!.observe(n, BORDER);
          for (const n of r.removedNodes) if (n instanceof HTMLElement && n.hasAttribute('data-al-index')) this.#resize!.unobserve(n);
        }
      });
      this.#rows.observe(root, { childList: true });
      for (const row of root.querySelectorAll<HTMLElement>('[data-al-index]')) this.#resize.observe(row, BORDER);
    }
    this.#viewport = root.clientHeight;
    this.#take();
    this.#schedule();
  }

  propsChanged() {
    if (this.props.items === this.#items) return;
    this.#remember();
    this.#take();
    this.#schedule();
  }

  disconnected() {
    this.#stop.abort();
    this.#resize?.disconnect();
    this.#rows?.disconnect();
    cancelAnimationFrame(this.#frame);
  }

  /** the sum of the heights measured, for the estimate */
  #measured = 0;

  /** the height of a row not measured yet: the rows measured so far, on average (rounded, so it settles), else the
   * prop's guess. A wrong guess would change the spacers, and render again, at every row that comes into view. */
  #estimate = () => (this.#heights.size ? Math.round(this.#measured / this.#heights.size) : (this.props.estimate ?? 48));
  #overscan = () => this.props.overscan ?? 8;

  /** the items' keys, once per items array */
  #take() {
    const items = this.props.items;
    this.#items = items;
    this.#keys = items.map((x) => this.props.keyOf(x));
    this.#index = new Map(this.#keys.map((k, i) => [k, i]));
    this.#stale = true;
  }

  #resized(entries: ResizeObserverEntry[]) {
    let changed = false;
    for (const e of entries) {
      if (e.target === this.root) {
        const h = this.root.clientHeight; // layout is done when the observer runs: no forced layout
        if (h !== this.#viewport) { this.#viewport = h; changed = true; }
        continue;
      }
      const size = e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height;
      const key = this.#keys[Number((e.target as HTMLElement).dataset.alIndex)];
      if (key == null || !(size > 0) || this.#heights.get(key) === size) continue;
      if (!changed) this.#remember();
      this.#measured += size - (this.#heights.get(key) ?? 0);
      this.#heights.set(key, size);
      this.#stale = changed = true;
    }
    if (changed) this.#update(); // in the same frame: the observer runs after layout, before paint
  }

  /** the first row in view, from the offsets as they are (before they change) */
  #remember() {
    if (this.#anchor || this.#stale || !this.#offsets.length) return;
    const top = this.root.scrollTop;
    if (top <= 0) return;
    const i = rowAt(this.#offsets, this.#total, top);
    const key = this.#keys[i];
    if (key != null) this.#anchor = { key, delta: top - this.#offsets[i]! };
  }

  #schedule() {
    this.#frame ||= requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  }

  #update() {
    const root = this.root, n = this.#keys.length;
    if (this.#stale) {
      ({ offsets: this.#offsets, total: this.#total } = layout(this.#keys, this.#heights, this.#estimate()));
      this.#stale = false;
    }
    const a = this.#anchor;
    this.#anchor = null;
    if (a) {
      const i = this.#index.get(a.key);
      if (i !== undefined) {
        const want = Math.max(0, this.#offsets[i]! + a.delta);
        if (Math.abs(root.scrollTop - want) > 0.5) root.scrollTop = want;
      }
    }
    const top = root.scrollTop, overscan = this.#overscan(), s = this.state;
    const first = n ? rowAt(this.#offsets, this.#total, top) : 0;
    const last = n ? rowAt(this.#offsets, this.#total, top + Math.max(this.#viewport, 1)) : 0;
    // the rows rendered still reach past the view by half the overscan each side: only the spacers may need changing
    const margin = Math.ceil(overscan / 2);
    const covered = s.end <= n && s.start <= Math.max(0, first - margin) && s.end >= Math.min(n, last + 1 + margin);
    const w = covered
      ? { start: s.start, end: s.end, top: this.#offsets[s.start] ?? 0, bottom: this.#total - (s.end < n ? this.#offsets[s.end]! : this.#total) }
      : windowAt(this.#offsets, this.#total, top, this.#viewport, overscan);
    if (s.start !== w.start || s.end !== w.end || s.top !== w.top || s.bottom !== w.bottom) Object.assign(s, w);
    if (nearEnd(w, n, overscan) && this.#asked !== n) {
      this.#asked = n;
      this.emit('end', n);
    }
  }
}
