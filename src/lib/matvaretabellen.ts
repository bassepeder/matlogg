import { db } from './db';
import { t } from './i18n';
import type { Food } from './types';

export interface MvtRow {
  id: string;
  n: string;
  en?: string;
  g?: string;
  k: number;
  p: number;
  c: number;
  f: number;
  fi?: number;
  su?: number;
  sf?: number;
  sa?: number;
  po?: [string, number][];
  kw?: string;
}

export function fromMvtRow(r: MvtRow): Food {
  const food: Food = {
    id: `mvt:${r.id}`,
    source: 'matvaretabellen',
    name: r.n,
    altName: r.en,
    per100: { kcal: r.k, protein: r.p, carbs: r.c, fat: r.f },
    keywords: r.kw,
  };
  if (r.fi != null) food.per100.fiber = r.fi;
  if (r.su != null) food.per100.sugar = r.su;
  if (r.sf != null) food.per100.satFat = r.sf;
  if (r.sa != null) food.per100.salt = r.sa;
  if (r.po) food.portions = r.po.map(([label, grams]) => ({ label, grams }));
  return food;
}

export interface MvtTable {
  foods: Food[];
  byId: Map<string, Food>;
  fetchedAt?: string;
}

let pending: Promise<MvtTable> | null = null;

export function loadMatvaretabellen(): Promise<MvtTable> {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/matvaretabellen.json`)
    .then((res) => {
      if (!res.ok) throw new Error(t('mvt.loadError', { status: res.status }));
      return res.json() as Promise<{ fetchedAt?: string; foods: MvtRow[] }>;
    })
    .then((data) => {
      const foods = data.foods.map(fromMvtRow);
      return { foods, byId: new Map(foods.map((f) => [f.id, f])), fetchedAt: data.fetchedAt };
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

export async function getFood(id: string): Promise<Food | undefined> {
  if (id.startsWith('mvt:')) return (await loadMatvaretabellen()).byId.get(id);
  return db.foods.get(id);
}
