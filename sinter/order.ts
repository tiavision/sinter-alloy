// Pure helpers over a Move (sinter.types.ts): what an app's optimistic change and request body need.
// They take the list the move was made in, typed by the app's own items, so the result keeps that type.
import type { BoardMove, Move } from './sinter.types.js';

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
  return midway(after[move.to - 1]?.[field], after[move.to + 1]?.[field]);
}

/** Halfway between two sort values, one past the one that is there, 0 with neither; equal ones stay equal. */
export function midway(a: unknown, b: unknown): number {
  const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const prev = num(a), next = num(b);
  if (prev == null && next == null) return 0;
  if (prev == null) return next! - 1;
  if (next == null) return prev + 1;
  return prev === next ? prev : (prev + next) / 2;
}

// ── Boards: one list of items, each in a group (its column) ────────────────────────────────────────────────────

/** The keys of the target column after a board move, in order: the `order` a board's save sends. */
export function columnAfter<T>(list: readonly T[], move: BoardMove, keyOf: KeyOf<T>, group: keyof T & string): string[] {
  const rest = list.filter((x) => String(x[group]) === move.toGroup && keyOf(x) !== move.key).map(keyOf);
  rest.splice(Math.max(0, Math.min(move.to, rest.length)), 0, move.key);
  return rest;
}

/** The moved item's new sort value in its target column: halfway between its new neighbours' there. */
export function rankIn<T>(list: readonly T[], move: BoardMove, keyOf: KeyOf<T>, group: keyof T & string, field: keyof T & string): number {
  const rest = list.filter((x) => String(x[group]) === move.toGroup && keyOf(x) !== move.key);
  return midway(rest[move.to - 1]?.[field], rest[move.to]?.[field]);
}

/**
 * The list after a board move, for items kept in state: the item gets its new group and sits right after its new
 * `after` neighbour (or before `before`, or last when its column was empty). Sort fields are not touched.
 */
export function regroup<T>(list: readonly T[], move: BoardMove, keyOf: KeyOf<T>, group: keyof T & string): T[] {
  const item = list.find((x) => keyOf(x) === move.key);
  if (!item) return list.slice();
  const out = list.filter((x) => x !== item);
  const moved = { ...item, [group]: move.toGroup } as T;
  const at = move.after != null ? out.findIndex((x) => keyOf(x) === move.after) + 1
    : move.before != null ? out.findIndex((x) => keyOf(x) === move.before) : out.length;
  out.splice(at < 0 ? out.length : at, 0, moved);
  return out;
}

/** The item a move is about, by its key (undefined when the list no longer has it). */
export function moved<T>(list: readonly T[], move: Move, keyOf: KeyOf<T>): T | undefined {
  return list.find((x) => keyOf(x) === move.key);
}
