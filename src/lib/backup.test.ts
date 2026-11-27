import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { importBackup, parseBackup } from './backup';
import { db } from './db';
import type { Entry } from './types';

const e = (id: number, name: string, createdAt: number): Entry => ({
  id, date: '2026-11-27', meal: 'lunch', foodId: name, name, source: 'custom', grams: 100,
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 }, createdAt,
});
const backup = (entries: Entry[]) =>
  parseBackup(JSON.stringify({ app: 'matlogg', version: 1, exportedAt: '2026-11-20T10:00:00Z', entries, foods: [], settings: [] }));

beforeEach(() => db.entries.clear());

describe('restoring a backup', () => {
  it('keeps entries already on the device, even when their ids clash', async () => {
    await db.entries.bulkAdd([e(1, 'New phone breakfast', 5000), e(2, 'New phone lunch', 6000)]);
    const r = await importBackup(backup([e(1, 'Old dinner', 1000), e(2, 'Old snack', 2000)]));
    expect(r).toEqual({ added: 2, skipped: 0 });
    expect((await db.entries.toArray()).map((x) => x.name).sort()).toEqual(['New phone breakfast', 'New phone lunch', 'Old dinner', 'Old snack']);
  });

  it('skips what is already there, so restoring twice adds nothing', async () => {
    const b = backup([e(1, 'Old dinner', 1000), e(2, 'Old snack', 2000)]);
    await importBackup(b);
    expect(await importBackup(b)).toEqual({ added: 0, skipped: 2 });
    expect(await db.entries.count()).toBe(2);
  });
});
