// Pure helpers over a Move (sinter.types.ts): what an app's optimistic change and request body need.
// They take the list the move was made in, typed by the app's own items, so the result keeps that type.
import type { Move } from './sinter.types.js';

type KeyOf<T> = (item: T) => string;

/** The list with the move applied: a new array, the input untouched. */
export function reorder<T>(list: readonly T[], move: Move): T[] {
  const out = list.slice();
  if (move.from < 0 || move.from >= out.length) return out;
  const [item] = out.splice(move.from, 1);
  out.splice(Math.max(0, Math.min(move.to, out.length)), 0, item as T);
  return out;
}

/** The keys in their new order, for an API that takes the whole order (`{ ids: [...] }`). */
export function keysAfter<T>(list: readonly T[], move: Move, keyOf: KeyOf<T>): string[] {
  return reorder(list, move).map(keyOf);
}

/**
 * A value of the list's sort field that puts the moved item at its new place: halfway between its new
 * neighbours' values, one less than the first or one more than the last. With it, the optimistic change is
 * one `merge(item, { [field]: between(…) })` on a resource that has `order="<field>"`: the store sorts the
 * item into place, and the rollback of a failed request is that one layer dropped.
 *
 * Neighbours with equal values (a list that was never ordered, every value 0) cannot be split: the value is
 * still placed by the store's tie rule (arrival order), so the server's answer, which renumbers, decides.
 */
export function between<T>(list: readonly T[], move: Move, field: keyof T & string): number {
  const after = reorder(list, move);
  const value = (i: number): number | null => {
    const v = i >= 0 && i < after.length ? Number(after[i]![field]) : NaN;
    return Number.isFinite(v) ? v : null;
  };
  const prev = value(move.to - 1), next = value(move.to + 1);
  if (prev == null && next == null) return 0;
  if (prev == null) return next! - 1;
  if (next == null) return prev + 1;
  return prev === next ? prev : (prev + next) / 2;
}

/** The item a move is about, by its key (undefined when the list no longer has it). */
export function moved<T>(list: readonly T[], move: Move, keyOf: KeyOf<T>): T | undefined {
  return list.find((x) => keyOf(x) === move.key);
}
