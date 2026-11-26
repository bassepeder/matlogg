import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mealForTime } from './dates';
import { countMealEntries, db, getSettings, removeMeal, saveMeals } from './db';
import { DEFAULT_MEALS, mealLabel, mealOptions, type Entry, type Meal } from './types';

const entry = (meal: string): Entry => ({
  date: '2026-11-26',
  meal,
  foodId: 'x',
  name: 'Test',
  source: 'quick',
  grams: 100,
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
  createdAt: Date.now(),
});

const supper: Meal = { id: 'custom-supper', name: 'Kveldsmat' };

beforeEach(async () => {
  await db.entries.clear();
  await db.settings.clear();
});

describe('meal labels', () => {
  it('uses the translated name for built-in meals and the typed name for custom ones', () => {
    const meals = [...DEFAULT_MEALS, supper];
    expect(mealLabel('breakfast', meals)).toBe('Breakfast');
    expect(mealLabel('custom-supper', meals)).toBe('Kveldsmat');
  });

  it('prefers a renamed built-in meal', () => {
    expect(mealLabel('breakfast', [{ id: 'breakfast', name: 'Morning' }])).toBe('Morning');
  });

  it('keeps an unknown current meal in the picker options', () => {
    expect(mealOptions(DEFAULT_MEALS, 'gone').map((o) => o.id)).toEqual(['breakfast', 'lunch', 'dinner', 'snacks', 'gone']);
  });
});

describe('mealForTime', () => {
  it('falls back to the last meal when the time-based built-in meal was removed', () => {
    const meals = [{ id: 'breakfast' }, supper];
    expect(mealForTime(new Date(2026, 0, 1, 7, 0), meals)).toBe('breakfast');
    expect(mealForTime(new Date(2026, 0, 1, 12, 0), meals)).toBe('custom-supper');
  });
});

describe('removeMeal', () => {
  it('moves entries to the chosen meal before removing it', async () => {
    await saveMeals([...DEFAULT_MEALS, supper]);
    await db.entries.bulkAdd([entry('custom-supper'), entry('custom-supper'), entry('lunch')]);
    expect(await countMealEntries('custom-supper')).toBe(2);

    await removeMeal('custom-supper', 'dinner');

    expect((await getSettings()).meals?.map((m) => m.id)).toEqual(['breakfast', 'lunch', 'dinner', 'snacks']);
    expect(await countMealEntries('custom-supper')).toBe(0);
    expect(await countMealEntries('dinner')).toBe(2);
  });

  it('refuses to remove a meal with entries without somewhere to move them', async () => {
    await db.entries.add(entry('snacks'));
    await expect(removeMeal('snacks')).rejects.toThrow();
    expect(await countMealEntries('snacks')).toBe(1);
  });

  it('removes an empty meal directly', async () => {
    await removeMeal('snacks');
    expect((await getSettings()).meals?.map((m) => m.id)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('keeps at least one meal', async () => {
    await saveMeals([{ id: 'breakfast' }]);
    await expect(removeMeal('breakfast')).rejects.toThrow();
  });
});
