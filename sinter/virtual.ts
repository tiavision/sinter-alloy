// The long list's window, pure: which rows to render for a scroll position, from the rows' measured heights (an
// estimate for those not measured yet), and the spacers that stand for the rest.

export interface Window {
  start: number;
  end: number;
  /** the height of the rows before `start` and after `end` */
  top: number;
  bottom: number;
}

/** Each row's offset from the top, and the total height: measured heights by key, `estimate` for the others. */
export function layout(keys: readonly string[], heights: ReadonlyMap<string, number>, estimate: number): { offsets: number[]; total: number } {
  const offsets = new Array<number>(keys.length);
  let y = 0;
  for (let i = 0; i < keys.length; i++) {
    offsets[i] = y;
    y += heights.get(keys[i]!) ?? estimate;
  }
  return { offsets, total: y };
}

/** The first row whose bottom is below `y` (binary search over the offsets). */
export function rowAt(offsets: readonly number[], total: number, y: number): number {
  let lo = 0, hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const bottom = mid + 1 < offsets.length ? offsets[mid + 1]! : total;
    bottom <= y ? (lo = mid + 1) : (hi = mid);
  }
  return Math.min(lo, Math.max(0, offsets.length - 1));
}

/** The rows to render for the scroll box at `scrollTop` showing `viewport` px, with `overscan` rows each side. */
export function windowAt(offsets: readonly number[], total: number, scrollTop: number, viewport: number, overscan: number): Window {
  const n = offsets.length;
  if (!n) return { start: 0, end: 0, top: 0, bottom: 0 };
  const first = rowAt(offsets, total, Math.max(0, scrollTop));
  const last = rowAt(offsets, total, scrollTop + Math.max(viewport, 1));
  const start = Math.max(0, first - overscan), end = Math.min(n, last + 1 + overscan);
  return { start, end, top: offsets[start]!, bottom: total - (end < n ? offsets[end]! : total) };
}

/** Whether the window reaches the last `overscan` rows of what is loaded: time to ask for the next page. */
export const nearEnd = (w: Window, n: number, overscan: number): boolean => n > 0 && w.end >= n - overscan;
