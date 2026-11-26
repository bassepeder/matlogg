import { locale, t } from './i18n';
import { DEFAULT_MEALS, type Meal, type MealId } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISODate(s).getTime());
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function dayLabel(iso: string, today = todayISO()): string {
  if (iso === today) return t('day.today');
  if (iso === addDays(today, -1)) return t('day.yesterday');
  if (iso === addDays(today, 1)) return t('day.tomorrow');
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(fromISODate(iso));
}

export function monthGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: toISODate(d), inMonth: d.getMonth() === month };
  });
}

export function monthTitle(year: number, month: number): string {
  const s = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  return s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
}

export function weekdayNames(): string[] {
  const f = new Intl.DateTimeFormat(locale(), { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i)));
}

export function mealForTime(d = new Date(), meals: Meal[] = DEFAULT_MEALS): MealId {
  const h = d.getHours() + d.getMinutes() / 60;
  const id = h < 10.5 ? 'breakfast' : h < 14.5 ? 'lunch' : h < 19.5 ? 'dinner' : 'snacks';
  if (meals.some((m) => m.id === id)) return id;
  return meals[meals.length - 1]?.id ?? id;
}
