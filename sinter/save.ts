// The round trip <alloy-sortable> makes itself (props `resource` and `save`), apart from the DOM so it is unit-tested:
// what the optimistic change writes and what the request sends, and what an answer gives back.
import { between, keysAfter } from './order.js';
import type { Move } from './sinter.types.js';

/**
 * The new order of a list after `move`: every key in order (the request's `order`) and the moved item's new value of
 * the sort field (the optimistic change). Null when the list no longer has the item.
 */
export function saveOrder<T extends object>(list: readonly T[], move: Move, keyOf: (item: T) => string, field: string, descending = false):
  { keys: string[]; value: number } | null {
  if (!list.some((x) => keyOf(x) === move.key)) return null;
  return { keys: keysAfter(list, move, keyOf), value: between(list, move, field as keyof T & string, descending) };
}

/**
 * Where a self-saving component saves and which field it changes, from the resource's handle (sinter's `src` and
 * `order`, from 0.23) and the props that override them: the URL is `save`, else `<src>/order` (the list's URL with
 * `/order` added to its path, its query kept); the field is `field`, else the resource's `order` (`-rank` is `rank`,
 * sorted descending), else `sort_order`. No URL (an older sinter, a resource without `src`) is null: nothing is saved.
 */
/** What saveTarget reads of a resource's handle. */
export type Handle = { src?: string | null; order?: string | null };

export function saveTarget(handle: Handle, props: { save?: string; field?: string }, base: string):
  { url: string; field: string; descending: boolean } | null {
  const order = handle.order?.trim() || '';
  const descending = order.startsWith('-');
  const ordered = order.replace(/^[-+]/, '');
  const field = props.field || ordered || 'sort_order';
  let url = props.save || null;
  if (!url && handle.src) {
    const u = new URL(handle.src, base);
    u.pathname = u.pathname.replace(/\/+$/, '') + '/order';
    url = u.origin === new URL(base).origin ? u.pathname + u.search : u.href;
  }
  return url ? { url, field, descending: descending && field === ordered } : null;
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

/** The given fields of each item in an answer (the list, or an object holding it), by key: a board's group and rank. */
export function savedFields(answer: unknown, keyOf: (item: object) => string, fields: readonly string[]): Array<[string, Record<string, unknown>]> {
  const list = Array.isArray(answer) ? answer
    : answer && typeof answer === 'object' ? Object.values(answer).find(Array.isArray) : undefined;
  if (!list) return [];
  return list.flatMap((x): Array<[string, Record<string, unknown>]> => {
    if (!x || typeof x !== 'object') return [];
    const got = Object.fromEntries(fields.filter((f) => f in x).map((f) => [f, (x as Record<string, unknown>)[f]]));
    try { return Object.keys(got).length ? [[keyOf(x), got]] : []; } catch { return []; }
  });
}
