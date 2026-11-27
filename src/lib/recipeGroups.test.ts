import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { copyEntries, db, recentFoods, recipeUsage } from './db';
import { recipeEntries } from './recipe';
import type { Entry, Food } from './types';
import { groupEntries } from '../views/DiaryView';
import { recentAmount } from '../views/AddView';

const recipe: Food = {
  id: 'recipe:bowl',
  source: 'recipe',
  name: 'Bowl',
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
  ingredients: [
    { foodId: 'mvt:a', name: 'A', grams: 200, per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 } },
    { foodId: 'mvt:b', name: 'B', grams: 100, quantity: 1, unitLabel: 'stk', unitGrams: 100, per100: { kcal: 50, protein: 1, carbs: 1, fat: 1 } },
  ],
};
const log = (date: string, at: number, grams = 300) => recipeEntries(recipe, grams, { date, meal: 'lunch', createdAt: at });
const single = (foodId: string, at: number, grams = 100): Entry => ({
  date: '2026-11-27', meal: 'lunch', foodId, name: foodId, source: 'custom', grams,
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 }, createdAt: at,
});

beforeEach(() => db.entries.clear());

describe('recipe groups', () => {
  it('tags each logging of a recipe as its own group', () => {
    const [a, b] = [log('2026-11-27', 1000), log('2026-11-27', 2000)];
    expect(a.every((e) => e.group === a[0].group && e.recipeId === 'recipe:bowl' && e.recipeName === 'Bowl')).toBe(true);
    expect(a[0].group).not.toBe(b[0].group);
  });

  it('shows single lines and groups in the order they were logged', () => {
    const r = log('2026-11-27', 1000);
    const items = groupEntries([single('x', 500), ...r, single('y', 3000)]);
    expect(items.map((i) => (Array.isArray(i) ? i.map((e) => e.name) : i.name))).toEqual(['x', ['A', 'B'], 'y']);
  });

  it('gives copied recipe lines a new group, kept together', async () => {
    const y = log('2026-11-26', 1000);
    await copyEntries(y, '2026-11-27');
    const today = await db.entries.where('date').equals('2026-11-27').toArray();
    expect(new Set(today.map((e) => e.group)).size).toBe(1);
    expect(today[0].group).not.toBe(y[0].group);
    expect(today[0].group!.startsWith('recipe:bowl@')).toBe(true);
  });

  it('counts how often each recipe was eaten, once per logging', async () => {
    await db.entries.bulkAdd([...log('2026-11-26', 1000), ...log('2026-11-27', 2000), single('x', 3000)]);
    expect([...(await recipeUsage())]).toEqual([['recipe:bowl', 2]]);
  });
});

describe('recent foods from recipes', () => {
  it('prefers an amount the user chose over a recipe-scaled one', async () => {
    await db.entries.bulkAdd([single('mvt:a', 500, 150), ...log('2026-11-27', 1000, 100)]);
    const a = (await recentFoods()).find((r) => r.entry.foodId === 'mvt:a')!;
    expect(a.entry.grams).toBe(150);
    expect(a.count).toBe(2);
  });

  it('rounds recipe-scaled amounts to 5 g or half a unit', () => {
    const [a, b] = log('2026-11-27', 1000, 100); // a: 66.7 g, b: 0.33 stk
    expect(recentAmount(a).grams).toBe(65);
    expect(recentAmount(b)).toMatchObject({ quantity: 0.5, grams: 50 });
    const own = single('x', 1, 66.7);
    expect(recentAmount(own)).toBe(own);
  });
});
