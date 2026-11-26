// The types alloy's components name in their props and events. An app names them in its own
// declarations by re-exporting them from its src/sinter.types.ts:
// `export type { Move, SortableText } from '@tiavision/sinter-alloy'`.

/**
 * One item moved within an <alloy-sortable>: the `move` event's detail.
 *
 * `from` and `to` are indexes in the list as it was when the move started: the item at `from` is now
 * at `to` (so `to` counts the list without the item, as `Array.prototype.splice` would put it back).
 * `after` and `before` are the keys of its new neighbours, `null` at an end: an API that takes
 * "put it after X" needs nothing else.
 */
export interface Move {
  key: string;
  from: number;
  to: number;
  after: string | null;
  before: string | null;
  /** how the move was made: a pointer drag, or the keyboard */
  via: 'pointer' | 'keyboard';
}

/**
 * The words <alloy-sortable> says: the handle's label and description, and what the live region
 * announces while an item is moved. English by default; an app in another language passes its own
 * messages. `name` is the item's name (`nameOf`), `position` counts from 1.
 */
export interface SortableText {
  /** the handle's accessible name: "Move Work" */
  handle: (name: string) => string;
  /** the handle's description: how to move with the keyboard */
  instructions: string;
  lifted: (name: string, position: number, total: number) => string;
  moved: (name: string, position: number, total: number) => string;
  dropped: (name: string, position: number, total: number) => string;
  cancelled: (name: string, position: number) => string;
  /** the alert line when a saved order is refused (the row has gone back) */
  failed: string;
}

/** `sort-error`'s detail: the move that was rolled back, and why (the request's error). */
export interface SortError {
  move: Move;
  error: unknown;
}

/**
 * One card moved on an <alloy-board>: the `move` event's detail. `from` is its index in its old column, `to` its index
 * in the new one (counted without it); `after` and `before` are its new neighbours' keys in that column.
 */
export interface BoardMove extends Move {
  fromGroup: string;
  toGroup: string;
}

/** The words <alloy-board> says; `list` is the column's name, `position` counts from 1 within it. */
export interface BoardText {
  handle: (name: string) => string;
  instructions: string;
  lifted: (name: string, list: string, position: number, total: number) => string;
  moved: (name: string, list: string, position: number, total: number) => string;
  dropped: (name: string, list: string, position: number, total: number) => string;
  cancelled: (name: string, list: string, position: number) => string;
  failed: string;
}

/** `sort-error`'s detail on a board. */
export interface BoardError {
  move: BoardMove;
  error: unknown;
}

/** A day of a calendar grid (alloy-date, alloy-range). */
export interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** A weekday's names, in the page's language. */
export interface WeekdayName {
  short: string;
  long: string;
}

/** The words of <alloy-date>: its button, the month buttons, a typed date that is not one. */
export interface DateText {
  open: string;
  prev: string;
  next: string;
  invalid: string;
}

/** The words of <alloy-range>: its button with no range, the presets, the month buttons, the hint while picking. */
export interface RangeText {
  placeholder: string;
  prev: string;
  next: string;
  pickEnd: string;
  clear: string;
  last7: string;
  last30: string;
  month: string;
  lastMonth: string;
}

/** A range: two ISO dates, `''` for none. */
export interface DateRange {
  start: string;
  end: string;
}

/** The words of <alloy-month>. */
export interface MonthText {
  open: string;
  prev: string;
  next: string;
}

/**
 * A command of <alloy-palette>: what it lists and runs. `href`: a link it follows (sinter's navigate()); without one,
 * picking it emits `pick` for the page. `group` titles it ("Go to", "Actions", a search's kinds).
 */
export interface PaletteCommand {
  id: string;
  label: string;
  group?: string;
  keywords?: string;
  href?: string;
  /** shown as keys, e.g. "R" or "Ctrl+K" */
  shortcut?: string;
}

/** The words of <alloy-palette>. */
export interface PaletteText {
  open: string;
  placeholder: string;
  empty: string;
  recent: string;
  pages: string;
  actions: string;
  results: string;
}
