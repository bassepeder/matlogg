import { mergeBody, type BodyEntry } from './body';
import { db } from './db';
import { t } from './i18n';
import type { Entry, Food, Settings } from './types';

interface Backup {
  app: 'matlogg';
  version: 1;
  exportedAt: string;
  entries: Entry[];
  foods: Food[];
  settings: Settings[];
  /** Weight and measurements; missing in backups from before they existed. */
  body: BodyEntry[];
}

export async function exportBackup(): Promise<{ filename: string; blob: Blob }> {
  const data: Backup = {
    app: 'matlogg',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: await db.entries.toArray(),
    foods: await db.foods.toArray(),
    settings: await db.settings.toArray(),
    body: await db.body.toArray(),
  };
  const date = data.exportedAt.slice(0, 10);
  return {
    filename: `matlogg-backup-${date}.json`,
    blob: new Blob([JSON.stringify(data)], { type: 'application/json' }),
  };
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as Partial<Backup>;
  if (data.app !== 'matlogg' || !Array.isArray(data.entries) || !Array.isArray(data.foods)) {
    throw new Error(t('settings.notBackup'));
  }
  return { ...data, settings: data.settings ?? [], body: Array.isArray(data.body) ? data.body : [] } as Backup;
}

// The same logged item on two devices: entry ids are only local counters, so they can't be used.
const sameEntry = (e: Entry) => [e.date, e.meal, e.foodId, e.name, e.grams, e.createdAt].join('|');

// Adds the backup's diary entries next to what is already on the device, skipping ones it already
// has, so restoring onto a phone in use never overwrites newer entries. Foods are matched by id.
// Weigh-ins are matched by day, keeping whichever was changed last.
export async function importBackup(backup: Backup): Promise<{ added: number; skipped: number; body: number }> {
  return db.transaction('rw', [db.entries, db.foods, db.settings, db.body], async () => {
    await db.foods.bulkPut(backup.foods);
    const have = new Set((await db.entries.toArray()).map(sameEntry));
    const fresh = backup.entries.filter((e) => !have.has(sameEntry(e)) && have.add(sameEntry(e)));
    await db.entries.bulkAdd(fresh.map(({ id: _id, ...e }) => e));
    if (backup.settings.length) await db.settings.bulkPut(backup.settings);
    const body = mergeBody(await db.body.toArray(), backup.body);
    await db.body.bulkPut(body.put);
    return { added: fresh.length, skipped: backup.entries.length - fresh.length, body: body.put.length };
  });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
