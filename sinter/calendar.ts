// Calendar dates for the pickers, pure: ISO strings `YYYY-MM-DD` (a date with no time and no time zone: the same day
// for every reader) and months `YYYY-MM`. Arithmetic in UTC, so no time zone or daylight saving moves a day. Names and
// the first day of the week come from the page's language (Intl), whatever the browser's.

export interface Day {
  iso: string;
  day: number;
  /** in the month shown (the grid starts and ends with neighbouring months' days) */
  inMonth: boolean;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function toUTC(iso: string): Date | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCMonth() === +m[2]! - 1 ? d : null; // 2026-02-30 is not a date
}
export const isoOf = (d: Date): string => `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const isDate = (s: unknown): boolean => typeof s === 'string' && toUTC(s) !== null;

export function addDays(iso: string, n: number): string {
  const d = toUTC(iso)!;
  d.setUTCDate(d.getUTCDate() + n);
  return isoOf(d);
}

/** The same day `n` months on, the month's last day where it has fewer (31 March + 1 month: 30 April). */
export function addMonths(iso: string, n: number): string {
  const d = toUTC(iso)!, day = d.getUTCDate();
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return isoOf(first);
}

export const monthOf = (iso: string): string => iso.slice(0, 7);
export const firstOf = (month: string): string => `${month}-01`;
export const clampDate = (iso: string, min?: string | null, max?: string | null): string =>
  min && iso < min ? min : max && iso > max ? max : iso;

/** The first day of the week for a language: 0 Sunday … 6 Saturday (Intl's weekInfo where the browser has it). */
export function firstWeekday(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info) return info.firstDay % 7;
  } catch { /* an unknown tag */ }
  // without weekInfo: Sunday where the region (or the language's usual one) starts the week on Sunday, else Monday
  const region = (() => { try { return new Intl.Locale(locale).maximize().region; } catch { return undefined; } })();
  return region && ['US', 'CA', 'MX', 'BR', 'JP', 'KR', 'TW', 'IL', 'PH', 'IN', 'ZA', 'AU'].includes(region) ? 0 : 1;
}

/** The weekday names in the week's order: narrow-ish short names ('Mo', 'Tu' / 'Mo', 'Di'), and the long ones. */
export function weekdays(locale: string): Array<{ short: string; long: string }> {
  const first = firstWeekday(locale);
  const short = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  // 2023-01-01 was a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2023, 0, 1 + ((first + i) % 7)));
    return { short: short.format(d).replace(/\.$/, '').slice(0, 2), long: long.format(d) };
  });
}

/** The month's grid: whole weeks from the week of its first day to the week of its last, six weeks at most. */
export function monthGrid(month: string, locale: string): Day[][] {
  const first = toUTC(firstOf(month))!;
  const start = addDays(firstOf(month), -((first.getUTCDay() - firstWeekday(locale) + 7) % 7));
  const weeks: Day[][] = [];
  for (let w = 0, d = start; w < 6; w++) {
    const week: Day[] = [];
    for (let i = 0; i < 7; i++, d = addDays(d, 1)) week.push({ iso: d, day: +d.slice(8), inMonth: monthOf(d) === month });
    if (!week.some((x) => x.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

/** "November 2026" / "November 2026" in the language. */
export const monthTitle = (month: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toUTC(firstOf(month))!);

/** A day's full name, for its button: "Tuesday, 10 November 2026". */
export const dayLabel = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(toUTC(iso)!);

/** A date as the language writes it short ("10.11.2026", "11/10/2026"): what the field shows and reads back. */
export const formatDate = (iso: string, locale: string): string =>
  isDate(iso) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(toUTC(iso)!) : '';

/**
 * A typed date in the language's order of day, month and year (from Intl): "10.11.2026", "11/10/2026", "10 11 26"
 * (a two-digit year in this century), or an ISO date. Null when it is not a date.
 */
export function parseDate(text: string, locale: string): string | null {
  const t = text.trim();
  if (isDate(t)) return t;
  const nums = t.match(/\d+/g);
  if (!nums || nums.length !== 3) return null;
  const order = new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(2026, 10, 10)))
    .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year').map((p) => p.type);
  const v: Record<string, number> = {};
  order.forEach((k, i) => (v[k] = +nums[i]!));
  if (v.year! < 100) v.year! += 2000;
  const iso = `${pad(v.year!, 4)}-${pad(v.month!)}-${pad(v.day!)}`;
  return isDate(iso) ? iso : null;
}

/** Arrow keys in a day grid: the day the focus moves to, or null for another key. */
export function dayKey(iso: string, key: string, shift: boolean, firstDay: number): string | null {
  switch (key) {
    case 'ArrowLeft': return addDays(iso, -1);
    case 'ArrowRight': return addDays(iso, 1);
    case 'ArrowUp': return addDays(iso, -7);
    case 'ArrowDown': return addDays(iso, 7);
    case 'PageUp': return shift ? addMonths(iso, -12) : addMonths(iso, -1);
    case 'PageDown': return shift ? addMonths(iso, 12) : addMonths(iso, 1);
    case 'Home': return addDays(iso, -((toUTC(iso)!.getUTCDay() - firstDay + 7) % 7));
    case 'End': return addDays(iso, 6 - ((toUTC(iso)!.getUTCDay() - firstDay + 7) % 7));
    default: return null;
  }
}

/** A range's next state after a pick: a first pick starts it, a second ends it (the earlier one first). */
export function pickRange(range: { start: string; end: string; open: boolean }, iso: string): { start: string; end: string; open: boolean } {
  if (!range.open) return { start: iso, end: '', open: true };
  return iso < range.start ? { start: iso, end: range.start, open: false } : { start: range.start, end: iso, open: false };
}

/** The ranges the range picker offers, relative to `today`. */
export function presets(today: string): Array<{ id: 'last7' | 'last30' | 'month' | 'lastMonth'; start: string; end: string }> {
  const first = firstOf(monthOf(today));
  const prev = addMonths(first, -1);
  return [
    { id: 'last7', start: addDays(today, -6), end: today },
    { id: 'last30', start: addDays(today, -29), end: today },
    { id: 'month', start: first, end: addDays(addMonths(first, 1), -1) },
    { id: 'lastMonth', start: prev, end: addDays(first, -1) },
  ];
}

/** The page's language as the element sees it (`lang` on it or above it), for scripts; 'en' without one. */
export const langOf = (el: Element): string => el.closest('[lang]')?.getAttribute('lang') || 'en';

/** Today in the reader's own time zone, as an ISO date. */
export function todayIso(now = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** A month a key moves to in a month grid (3 columns): ←/→ one, ↑/↓ three, PageUp/PageDown a year, Home/End the year's ends. */
export function monthKey(month: string, key: string): string | null {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const at = (yy: number, mm: number) => {
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  switch (key) {
    case 'ArrowLeft': return at(y, m - 1);
    case 'ArrowRight': return at(y, m + 1);
    case 'ArrowUp': return at(y, m - 3);
    case 'ArrowDown': return at(y, m + 3);
    case 'PageUp': return at(y - 1, m);
    case 'PageDown': return at(y + 1, m);
    case 'Home': return at(y, 1);
    case 'End': return at(y, 12);
    default: return null;
  }
}

/** The twelve months of a year: `{ month: 'YYYY-MM', name }`, names in the language. */
export function yearMonths(year: number, locale: string): Array<{ month: string; name: string }> {
  const f = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => ({ month: `${String(year).padStart(4, '0')}-${String(i + 1).padStart(2, '0')}`, name: f.format(new Date(Date.UTC(year, i, 1))) }));
}
