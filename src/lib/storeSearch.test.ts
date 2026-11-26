import { describe, expect, it } from 'vitest';
import type { LookupResult } from './lookup';
import { withoutSaved } from './storeSearch';
import type { Food } from './types';

const food = (ean: string, name: string): Food => ({
  id: `ean:${ean}`,
  source: 'vetduat',
  ean,
  name,
  per100: { kcal: 46, protein: 6, carbs: 4.8, fat: 0.2 },
});

describe('withoutSaved', () => {
  it('drops store results that are already saved on the device', () => {
    const kakao = food('7038010068157', 'Yt Proteinmelk Kakao');
    const fettfri = food('7038010068133', 'Yt Proteinmelk Fettfri');
    const results: LookupResult[] = [{ food: fettfri }, { food: kakao }];
    expect(withoutSaved(results, [kakao]).map((r) => r.food?.name)).toEqual(['Yt Proteinmelk Fettfri']);
  });

  it('matches partial results by barcode', () => {
    const saved = { ...food('123', 'Saved'), id: 'custom:abc' };
    expect(withoutSaved([{ partial: { ean: '123', name: 'Saved' } }], [saved])).toEqual([]);
  });
});
