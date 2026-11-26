// The script of <alloy-virtual>: measures the rows rendered, follows the scroll, writes the window into state (the
// markup renders items.slice(start, end) between two spacers), keeps the first row in view where it was when heights or
// the list change, and emits `end` near the last loaded row. The arithmetic is ../virtual.ts.
import { AlloyVirtualComponent } from './alloy-virtual.html';
import { layout, nearEnd, windowAt } from '../virtual.js';

export class AlloyVirtual extends AlloyVirtualComponent {
  #stop = new AbortController();
  #heights = new Map<string, number>();
  #frame = 0;
  #resize: ResizeObserver | null = null;
  /** the list's length when `end` was last emitted: once per length */
  #asked = -1;
  /** the first row in view and how far its top is above the box's top: kept when heights or rows change */
  #anchor: { key: string; delta: number } | null = null;

  connected() {
    const root = this.root, signal = this.#stop.signal;
    root.addEventListener('scroll', () => this.#schedule(false), { signal, passive: true });
    if (typeof ResizeObserver === 'function') {
      // rows that change height (images, wrapping at a new width) and the box itself
      this.#resize = new ResizeObserver(() => this.#schedule(true));
      this.#resize.observe(root);
    }
    this.#schedule(true);
  }

  propsChanged() {
    this.#schedule(true);
  }

  disconnected() {
    this.#stop.abort();
    this.#resize?.disconnect();
    cancelAnimationFrame(this.#frame);
  }

  #keys = (): string[] => this.props.items.map((x) => this.props.keyOf(x));
  #estimate = () => this.props.estimate ?? 48;
  #overscan = () => this.props.overscan ?? 6;

  #schedule(keep: boolean) {
    if (keep) this.#remember();
    this.#frame ||= requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  }

  /** the first row in view, before something moves it */
  #remember() {
    if (this.#anchor) return;
    const root = this.root, top = root.getBoundingClientRect().top;
    for (const row of root.querySelectorAll<HTMLElement>('[data-al-index]')) {
      const r = row.getBoundingClientRect();
      if (r.bottom > top) {
        const key = this.#keyAt(+row.dataset.alIndex!);
        if (key != null) this.#anchor = { key, delta: r.top - top };
        return;
      }
    }
  }

  #keyAt = (i: number): string | null => {
    const it = this.props.items[i];
    return it === undefined ? null : this.props.keyOf(it);
  };

  #update() {
    const root = this.root, keys = this.#keys();
    // measure what is rendered now; observe new rows for later changes
    let changed = false;
    for (const row of root.querySelectorAll<HTMLElement>('[data-al-index]')) {
      const key = this.#keyAt(+row.dataset.alIndex!);
      if (key == null) continue;
      const h = row.getBoundingClientRect().height;
      if (h > 0 && this.#heights.get(key) !== h) { this.#heights.set(key, h); changed = true; }
      this.#resize?.observe(row);
    }
    const { offsets, total } = layout(keys, this.#heights, this.#estimate());
    // the anchor row back where it was
    const a = this.#anchor;
    this.#anchor = null;
    if (a) {
      const i = keys.indexOf(a.key);
      if (i >= 0) {
        const want = offsets[i]! - a.delta;
        if (Math.abs(root.scrollTop - want) > 0.5 && (changed || root.scrollTop > 0)) root.scrollTop = Math.max(0, want);
      }
    }
    const w = windowAt(offsets, total, root.scrollTop, root.clientHeight, this.#overscan());
    const s = this.state;
    if (s.start !== w.start || s.end !== w.end || s.top !== w.top || s.bottom !== w.bottom) {
      Object.assign(s, w);
      // the rows just rendered get measured on the next frame
      this.#schedule(false);
    }
    if (nearEnd(w, keys.length, this.#overscan()) && this.#asked !== keys.length) {
      this.#asked = keys.length;
      this.emit('end', keys.length);
    }
  }
}
