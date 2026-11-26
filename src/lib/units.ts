import type { Food, Portion } from './types';

export function unitsFor(food: Food): Portion[] {
  const units: Portion[] = [{ label: 'g', grams: 1 }];
  for (const p of food.portions ?? []) {
    if (p.grams > 0 && !units.some((u) => u.label === p.label)) units.push(p);
  }
  if (food.packageGrams && food.packageGrams > 0) units.push({ label: 'package', grams: food.packageGrams });
  if (food.per100.kcal > 0) units.push({ label: '__kcal', grams: 100 / food.per100.kcal });
  if (food.per100.protein > 0) units.push({ label: '__protein', grams: 100 / food.per100.protein });
  return units;
}

export function isNutrientUnit(label: string): boolean {
  return label === '__kcal' || label === '__protein';
}

export function defaultQuantity(label: string, currentGrams: number, food: Food): string {
  if (label === 'g') return String(Math.round(currentGrams || 100));
  if (label === '__kcal') return String(Math.round(((currentGrams || 100) * food.per100.kcal) / 100));
  if (label === '__protein') return String(Math.round(((currentGrams || 100) * food.per100.protein) / 100));
  return '1';
}
