import { db } from './db';
import { lookupBarcode, type LookupResult } from './lookup';

export async function findByBarcode(code: string, vetduatProxy?: string): Promise<LookupResult> {
  const saved = await db.foods.where('ean').equals(code).first();
  if (saved) return { food: saved };
  const result = await lookupBarcode(code, vetduatProxy);
  if (result.food) await db.foods.put(result.food);
  return result;
}
