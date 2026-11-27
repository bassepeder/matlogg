import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, notYetCopied, recentFoods } from './db';
import type { Entry } from './types';

const e = (foodId: string, grams: number): Entry => ({
  date: '2026-11-26',
  meal: 'breakfast',
  foodId,
  name: foodId,
  source: 'custom',
  grams,
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
  createdAt: 0,
});

describe('copy from yesterday', () => {
  it('offers everything when nothing is logged yet', () => {
    const y = [e('a', 60), e('b', 200)];
    expect(notYetCopied(y, [])).toEqual(y);
  });

  it('leaves out what is already logged today, so a partly filled meal can be topped up', () => {
    expect(notYetCopied([e('a', 60), e('b', 200)], [e('a', 60)])).toEqual([e('b', 200)]);
  });

  it('counts repeats, and treats a different amount as a different entry', () => {
    expect(notYetCopied([e('a', 60), e('a', 60), e('a', 30)], [e('a', 60)])).toEqual([e('a', 60), e('a', 30)]);
  });

  it('offers nothing once all of it has been copied', () => {
    const y = [e('a', 60), e('b', 200)];
    expect(notYetCopied(y, y)).toEqual([]);
  });
});

describe('recent foods', () => {
  it('leaves out ingredients from shared recipes, which have no food to log again', async () => {
    await db.entries.clear();
    await db.entries.bulkAdd([
      { ...e('mvt:1', 100), createdAt: 1 },
      { ...e('', 50), name: 'Delt ingrediens A', createdAt: 2 },
      { ...e('', 30), name: 'Delt ingrediens B', createdAt: 3 },
    ]);
    expect((await recentFoods()).map((r) => r.entry.foodId)).toEqual(['mvt:1']);
  });
});
