import { addDays, fromISODate, toISODate } from './dates';
import { entryNutrients, sum } from './nutrition';
import type { Entry, Nutrients } from './types';

// Monday of the week `iso` falls in (weeks run Monday to Sunday, as in Norway).
export function weekStart(iso: string): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ISO 8601 week number: the week with the year's first Thursday is week 1.
export function isoWeek(iso: string): number {
  const [y, m, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // the Thursday of this week
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

export interface DayStats {
  iso: string;
  totals: Nutrients;
  logged: boolean;
  /** Today or later: still being eaten, so left out of the averages. */
  open: boolean;
}

export interface WeekStats {
  days: DayStats[];
  /** Average per finished day that has entries; null when there is none yet. */
  average: Nutrients | null;
  counted: number;
}

// A day with nothing logged is treated as not tracked rather than as zero calories, so it
// doesn't drag the average down. Today is left out too, since it isn't over yet.
export function weekStats(entries: Entry[], start: string, today: string): WeekStats {
  const days = weekDays(start).map((iso) => {
    const list = entries.filter((e) => e.date === iso);
    return { iso, totals: sum(list.map(entryNutrients)), logged: list.length > 0, open: iso >= today };
  });
  const counted = days.filter((d) => d.logged && !d.open);
  const total = sum(counted.map((d) => d.totals));
  const n = counted.length;
  const average = n
    ? { kcal: total.kcal / n, protein: total.protein / n, carbs: total.carbs / n, fat: total.fat / n }
    : null;
  return { days, average, counted: n };
}
