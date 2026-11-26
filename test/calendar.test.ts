// The calendar's dates, grids, names, parsing and keys: pure.
import { expect, test } from 'vitest';
import {
  addDays, addMonths, dayKey, firstWeekday, formatDate, isDate, monthGrid, monthKey, monthTitle, parseDate, pickRange,
  presets, weekdays, yearMonths,
} from '../sinter/calendar.js';

test('dates: real ones only; days and months added in UTC, month ends kept', () => {
  expect(isDate('2026-02-28')).toBe(true);
  expect(isDate('2026-02-30')).toBe(false);
  expect(isDate('26-1-1')).toBe(false);
  expect(addDays('2026-03-28', 3)).toBe('2026-03-31'); // across the change to summer time: still whole days
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  expect(addMonths('2026-01-15', -13)).toBe('2024-12-15');
});

test('the week starts on the language\'s first day: Monday in German and British English, Sunday in American', () => {
  expect(firstWeekday('de')).toBe(1);
  expect(firstWeekday('en-GB')).toBe(1);
  expect(firstWeekday('en-US')).toBe(0);
  expect(weekdays('de').map((d) => d.short)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  expect(weekdays('en-US')[0]).toEqual({ short: 'Su', long: 'Sunday' });
});

test('the month grid: whole weeks around the month, in the language\'s week', () => {
  const de = monthGrid('2026-11', 'de');
  expect(de).toHaveLength(6); // 1 Nov 2026 is a Sunday: the first German week starts on Monday 26 Oct
  expect(de[0]![0]).toEqual({ iso: '2026-10-26', day: 26, inMonth: false });
  expect(de[0]![6]).toEqual({ iso: '2026-11-01', day: 1, inMonth: true });
  const us = monthGrid('2026-11', 'en-US');
  expect(us).toHaveLength(5);
  expect(us[0]![0]!.iso).toBe('2026-11-01');
  expect(us.flat().filter((d) => d.inMonth)).toHaveLength(30);
  expect(monthTitle('2026-11', 'de')).toBe('November 2026');
});

test('typed dates in the language\'s order; formatted as it writes them', () => {
  expect(parseDate('10.11.2026', 'de')).toBe('2026-11-10');
  expect(parseDate('11/10/2026', 'en-US')).toBe('2026-11-10');
  expect(parseDate('10/11/2026', 'en-GB')).toBe('2026-11-10');
  expect(parseDate('10.11.26', 'de')).toBe('2026-11-10');
  expect(parseDate('2026-11-10', 'en-US')).toBe('2026-11-10');
  expect(parseDate('31.02.2026', 'de')).toBeNull();
  expect(parseDate('soon', 'de')).toBeNull();
  expect(formatDate('2026-11-10', 'de')).toBe('10.11.2026');
  expect(formatDate('', 'de')).toBe('');
});

test('keys in the day grid and the month grid', () => {
  expect(dayKey('2026-11-10', 'ArrowDown', false, 1)).toBe('2026-11-17');
  expect(dayKey('2026-11-10', 'PageUp', false, 1)).toBe('2026-10-10');
  expect(dayKey('2026-11-10', 'PageDown', true, 1)).toBe('2027-11-10');
  expect(dayKey('2026-11-10', 'Home', false, 1)).toBe('2026-11-09'); // Tuesday → Monday
  expect(dayKey('2026-11-10', 'End', false, 0)).toBe('2026-11-14'); // → Saturday in a Sunday week
  expect(dayKey('2026-11-10', 'x', false, 1)).toBeNull();
  expect(monthKey('2026-01', 'ArrowLeft')).toBe('2025-12');
  expect(monthKey('2026-11', 'ArrowDown')).toBe('2027-02');
  expect(monthKey('2026-11', 'End')).toBe('2026-12');
  expect(yearMonths(2026, 'de')[2]!.name).toMatch(/^Mär/);
});

test('ranges: a first pick starts, a second ends, an earlier day becomes the start; presets', () => {
  let r = pickRange({ start: '', end: '', open: false }, '2026-11-16');
  expect(r).toEqual({ start: '2026-11-16', end: '', open: true });
  r = pickRange(r, '2026-11-10');
  expect(r).toEqual({ start: '2026-11-10', end: '2026-11-16', open: false });
  expect(presets('2026-11-26')).toEqual([
    { id: 'last7', start: '2026-11-20', end: '2026-11-26' },
    { id: 'last30', start: '2026-10-28', end: '2026-11-26' },
    { id: 'month', start: '2026-11-01', end: '2026-11-30' },
    { id: 'lastMonth', start: '2026-10-01', end: '2026-10-31' },
  ]);
});
