// The decisions of <alloy-split>, apart from the DOM: clamping, the keys, a drag, collapsing, and what is kept.

export interface Bounds { min: number; max: number }

export const clamp = (size: number, { min, max }: Bounds): number => Math.round(Math.min(max, Math.max(min, size)));

/**
 * The size after a key on the separator, or null when the key is not the separator's. Arrows move by `step` (Shift: four
 * steps); the arrows that grow the sized pane depend on the direction and on `reverse` (the sized pane after the
 * separator grows the other way). Home and End go to min and max.
 */
export function keySize(size: number, key: string, shift: boolean, b: Bounds, o: { step: number; direction: 'row' | 'column'; reverse: boolean }): number | null {
  const by = o.step * (shift ? 4 : 1);
  const grow: Record<string, number> = o.direction === 'row' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
  const sign = grow[key];
  if (sign !== undefined) return clamp(size + sign * by * (o.reverse ? -1 : 1), b);
  if (key === 'Home') return b.min;
  if (key === 'End') return b.max;
  return null;
}

/** The size during a drag: the size at its start moved by the pointer's distance, the other way for `reverse`. */
export const dragSize = (start: number, delta: number, b: Bounds, reverse: boolean): number => clamp(start + (reverse ? -delta : delta), b);

/**
 * Enter on the separator: collapse to min, remembering the size; again, back to the remembered size (or `initial`
 * when it was at min already).
 */
export function toggle(size: number, remembered: number | null, initial: number, b: Bounds): { size: number; remembered: number | null } {
  if (size > b.min) return { size: b.min, remembered: size };
  return { size: clamp(remembered ?? initial, b), remembered: null };
}

/** The size kept under `name`, if it is a number within bounds (another version may have kept something else). */
export function kept(raw: string | null, b: Bounds): number | null {
  if (raw == null) return null;
  const n = Number(JSON.parse(raw));
  return Number.isFinite(n) ? clamp(n, b) : null;
}
