import { describe, expect, it } from 'vitest';
import type { Entry } from './types';
import { isoWeek, weekDays, weekStart, weekStats } from './week';

const e = (date: string, kcal: number, protein = 0): Entry => ({
  date, meal: 'lunch', foodId: 'x', name: 'x', source: 'custom', grams: 100,
  per100: { kcal, protein, carbs: 0, fat: 0 }, createdAt: 0,
});

describe('weeks', () => {
  it('start on Monday', () => {
    expect(weekStart('2026-11-27')).toBe('2026-11-23'); // Friday
    expect(weekStart('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(weekStart('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(weekDays('2026-11-23')).toHaveLength(7);
    expect(weekDays('2026-11-23')[6]).toBe('2026-11-29');
  });

  it('crosses months and years', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });

  it('have ISO week numbers', () => {
    expect(isoWeek('2026-11-27')).toBe(48);
    expect(isoWeek('2026-01-01')).toBe(1); // a Thursday
    expect(isoWeek('2027-01-01')).toBe(53); // a Friday, still in 2026's last week
    expect(isoWeek('2025-12-29')).toBe(1); // a Monday, already 2026's week 1
  });
});

describe('week stats', () => {
  const entries = [e('2026-11-23', 2000, 100), e('2026-11-24', 1500), e('2026-11-24', 500, 50), e('2026-11-27', 800), e('2026-11-20', 9999)];

  it('totals each day of the week', () => {
    const s = weekStats(entries, '2026-11-23', '2026-11-27');
    expect(s.days.map((d) => Math.round(d.totals.kcal))).toEqual([2000, 2000, 0, 0, 800, 0, 0]);
    expect(s.days.map((d) => d.logged)).toEqual([true, true, false, false, true, false, false]);
  });

  it('averages only finished days with entries, leaving out empty days and today', () => {
    const s = weekStats(entries, '2026-11-23', '2026-11-27');
    expect(s.counted).toBe(2);
    expect(s.average).toMatchObject({ kcal: 2000, protein: 75 });
  });

  it('has no average before any day is finished', () => {
    expect(weekStats([e('2026-11-23', 500)], '2026-11-23', '2026-11-23').average).toBeNull();
  });
});
