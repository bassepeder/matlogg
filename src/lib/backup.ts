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
}

export async function exportBackup(): Promise<{ filename: string; blob: Blob }> {
  const data: Backup = {
    app: 'matlogg',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: await db.entries.toArray(),
    foods: await db.foods.toArray(),
    settings: await db.settings.toArray(),
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
  return { ...data, settings: data.settings ?? [] } as Backup;
}

export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.entries, db.foods, db.settings, async () => {
    await db.foods.bulkPut(backup.foods);
    await db.entries.bulkPut(backup.entries);
    if (backup.settings.length) await db.settings.bulkPut(backup.settings);
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
