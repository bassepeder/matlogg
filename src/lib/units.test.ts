import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { copyEntries, db } from './db';
import type { Entry, Food } from './types';
import { defaultQuantity, unitsFor } from './units';

const powder: Food = {
  id: 'custom:whey',
  source: 'custom',
  name: 'Proteinpulver',
  per100: { kcal: 380, protein: 80, carbs: 6, fat: 4 },
  portions: [{ label: 'scoop', grams: 30 }],
};

describe('log by calories or protein', () => {
  it('offers kcal and protein as units sized so that 1 unit = 1 kcal / 1 g protein', () => {
    const units = unitsFor(powder);
    expect(units.map((u) => u.label)).toEqual(['g', 'scoop', '__kcal', '__protein']);
    const protein = units.find((u) => u.label === '__protein')!;
    expect(30 * protein.grams).toBeCloseTo(37.5); // 30 g protein = 37.5 g powder
    const kcal = units.find((u) => u.label === '__kcal')!;
    expect(200 * kcal.grams).toBeCloseTo(52.63, 1);
  });

  it('skips a nutrient the food has none of', () => {
    const oil: Food = { id: 'x', source: 'custom', name: 'Olje', per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 } };
    expect(unitsFor(oil).map((u) => u.label)).toEqual(['g', '__kcal']);
  });

  it('starts a new unit from the current amount', () => {
    expect(defaultQuantity('__protein', 37.5, powder)).toBe('30');
    expect(defaultQuantity('__kcal', 100, powder)).toBe('380');
    expect(defaultQuantity('scoop', 50, powder)).toBe('1');
  });
});

describe('copyEntries', () => {
  it('copies a meal to another day as new entries', async () => {
    const base: Omit<Entry, 'id'> = {
      date: '2026-11-25',
      meal: 'breakfast',
      foodId: 'mvt:05.003',
      name: 'Havregryn',
      source: 'matvaretabellen',
      grams: 60,
      per100: { kcal: 369, protein: 14, carbs: 57, fat: 7 },
      createdAt: 1,
    };
    const id = await db.entries.add(base);
    const original = (await db.entries.get(id))!;
    await copyEntries([original], '2026-11-26');
    const today = await db.entries.where('date').equals('2026-11-26').toArray();
    expect(today).toHaveLength(1);
    expect(today[0].id).not.toBe(id);
    expect(today[0]).toMatchObject({ name: 'Havregryn', grams: 60, meal: 'breakfast' });
    expect(await db.entries.where('date').equals('2026-11-25').count()).toBe(1);
  });
});
