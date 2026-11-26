// The round trip <alloy-sortable> makes itself (props `resource` and `save`), apart from the DOM so it is unit-tested:
// what the optimistic change writes and what the request sends, and what an answer gives back.
import { between, keysAfter } from './order.js';
import type { Move } from './sinter.types.js';

/**
 * The new order of a list after `move`: every key in order (the request's `order`) and the moved item's new value of
 * the sort field (the optimistic change). Null when the list no longer has the item.
 */
export function saveOrder<T extends object>(list: readonly T[], move: Move, keyOf: (item: T) => string, field: string):
  { keys: string[]; value: number } | null {
  if (!list.some((x) => keyOf(x) === move.key)) return null;
  return { keys: keysAfter(list, move, keyOf), value: between(list, move, field as keyof T & string) };
}

/**
 * The sort values an answer gives, by key: the answer is the list (an array of items), or an object holding one
 * (`{ folders: [...] }`); items without the field are skipped. Anything else (no body, another shape) gives none.
 */
export function saved(answer: unknown, keyOf: (item: object) => string, field: string): Array<[string, number]> {
  const list = Array.isArray(answer) ? answer
    : answer && typeof answer === 'object' ? Object.values(answer).find(Array.isArray) : undefined;
  if (!list) return [];
  return list.flatMap((x): Array<[string, number]> => {
    if (!x || typeof x !== 'object') return [];
    const v = Number((x as Record<string, unknown>)[field]);
    try { return Number.isFinite(v) ? [[keyOf(x), v]] : []; } catch { return []; }
  });
}
