import { locale } from './i18n';
import type { Entry, Goals, Nutrients } from './types';

const OPTIONAL = ['sugar', 'fiber', 'satFat', 'salt'] as const;

export const EMPTY: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  };
  for (const k of OPTIONAL) {
    const v = per100[k];
    if (v != null) out[k] = v * f;
  }
  return out;
}

export function entryNutrients(entry: Entry): Nutrients {
  return scale(entry.per100, entry.grams);
}

export function sum(list: Nutrients[]): Nutrients {
  const out: Nutrients = { ...EMPTY };
  for (const n of list) {
    out.kcal += n.kcal;
    out.protein += n.protein;
    out.carbs += n.carbs;
    out.fat += n.fat;
    for (const k of OPTIONAL) {
      const v = n[k];
      if (v != null) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export function kcalFromMacros(n: { protein?: number; carbs?: number; fat?: number; fiber?: number }): number {
  return 4 * (n.protein ?? 0) + 4 * (n.carbs ?? 0) + 9 * (n.fat ?? 0) + 2 * (n.fiber ?? 0);
}

export function parseNum(input: string | null | undefined): number | undefined {
  if (input == null) return undefined;
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function carbsFromRest(g: Pick<Goals, 'kcal' | 'protein' | 'fat'>): number {
  return Math.max(0, Math.round((g.kcal - 4 * g.protein - 9 * g.fat) / 4));
}

export function resolveGoals(g: Goals): Goals {
  return g.carbsAuto ? { ...g, carbs: carbsFromRest(g) } : g;
}

const formatters = new Map<string, Intl.NumberFormat>();
function nf(digits: 0 | 1): Intl.NumberFormat {
  const key = `${locale()}:${digits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(), { maximumFractionDigits: digits });
    formatters.set(key, f);
  }
  return f;
}

export function fmt(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '–';
  return Math.abs(n) >= 10 ? nf(0).format(n) : nf(1).format(n);
}

export function fmtKcal(n: number): string {
  return nf(0).format(Math.round(n));
}

export function toInput(n: number | undefined): string {
  if (n == null) return '';
  const s = String(Math.round(n * 10) / 10);
  return locale() === 'nb-NO' ? s.replace('.', ',') : s;
}
