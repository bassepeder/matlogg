import Dexie, { type EntityTable } from 'dexie';
import type { BodyEntry } from './body';
import { DEFAULT_MEALS, type Entry, type Food, type Meal, type MealId, type Settings } from './types';

export const db = new Dexie('matlogg') as Dexie & {
  entries: EntityTable<Entry, 'id'>;
  foods: EntityTable<Food, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  body: EntityTable<BodyEntry, 'date'>;
};

db.version(1).stores({
  entries: '++id, date, createdAt, foodId',
  foods: 'id, ean, updatedAt',
  settings: 'id',
});

// Weight and measurements, one record per day.
db.version(2).stores({
  body: 'date',
});

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  goals: { kcal: 2000, protein: 130, carbs: 220, fat: 67 },
};

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...stored, goals: { ...DEFAULT_SETTINGS.goals, ...stored?.goals } };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'app' });
}

export interface RecentFood {
  entry: Entry;
  count: number;
}

export async function recentFoods(scanLimit = 500): Promise<RecentFood[]> {
  const latest = await db.entries.orderBy('createdAt').reverse().limit(scanLimit).toArray();
  const byFood = new Map<string, RecentFood>();
  for (const entry of latest) {
    // Quick adds and ingredients from shared recipes (no food id) have no food to log again.
    if (entry.source === 'quick' || !entry.foodId) continue;
    const seen = byFood.get(entry.foodId);
    if (!seen) byFood.set(entry.foodId, { entry, count: 1 });
    else {
      seen.count++;
      // Prefer an amount the user chose over one scaled from a recipe.
      if (seen.entry.group && !entry.group) seen.entry = entry;
    }
  }
  return [...byFood.values()];
}

// How many times each recipe was logged, from the most recent entries.
export async function recipeUsage(scanLimit = 3000): Promise<Map<string, number>> {
  const latest = await db.entries.orderBy('createdAt').reverse().limit(scanLimit).toArray();
  const groups = new Map<string, string>();
  for (const e of latest) if (e.group && e.recipeId) groups.set(e.group, e.recipeId);
  const counts = new Map<string, number>();
  for (const id of groups.values()) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

export async function copyEntries(entries: Entry[], date: string): Promise<void> {
  const now = Date.now();
  const groups = new Map<string, string>();
  const regroup = (g: string) => groups.get(g) ?? groups.set(g, `${g.split('@')[0]}@${now}-${groups.size}`).get(g)!;
  await db.entries.bulkAdd(
    entries.map(({ id: _id, ...e }, i) => ({ ...e, date, createdAt: now + i, ...(e.group ? { group: regroup(e.group) } : {}) })),
  );
}

// Yesterday's entries that are not already in `already`, matched by food, name and amount.
const entryKey = (e: Entry) => `${e.foodId}|${e.name}|${Math.round(e.grams * 10)}`;

export function notYetCopied(from: Entry[], already: Entry[]): Entry[] {
  const left = new Map<string, number>();
  for (const e of already) left.set(entryKey(e), (left.get(entryKey(e)) ?? 0) + 1);
  return from.filter((e) => {
    const n = left.get(entryKey(e)) ?? 0;
    if (n > 0) left.set(entryKey(e), n - 1);
    return n === 0;
  });
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Wipes everything this app stores on the device: the IndexedDB database and its localStorage keys.
export async function deleteAllData(): Promise<void> {
  await db.delete();
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('matlogg.')) localStorage.removeItem(key);
  } catch {
  }
}

function currentMeals(s: Settings): Meal[] {
  return s.meals?.length ? s.meals : DEFAULT_MEALS;
}

export async function saveMeals(meals: Meal[]): Promise<void> {
  if (!meals.length) throw new Error('At least one meal is required');
  await saveSettings({ meals });
}

export function countMealEntries(id: MealId): Promise<number> {
  return db.entries.filter((e) => e.meal === id).count();
}

// Removes a meal. Entries logged under it are moved to `moveTo`, which is required when there are any.
export async function removeMeal(id: MealId, moveTo?: MealId): Promise<void> {
  await db.transaction('rw', db.entries, db.settings, async () => {
    const s = await getSettings();
    const meals = currentMeals(s);
    const rest = meals.filter((m) => m.id !== id);
    if (!rest.length) throw new Error('At least one meal is required');
    const entries = db.entries.filter((e) => e.meal === id);
    if (await entries.count()) {
      if (!moveTo || !rest.some((m) => m.id === moveTo)) throw new Error('Choose a meal to move the entries to');
      await entries.modify({ meal: moveTo });
    }
    await db.settings.put({ ...s, meals: rest, id: 'app' });
  });
}
