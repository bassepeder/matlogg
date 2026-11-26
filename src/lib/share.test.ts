import { describe, expect, it } from 'vitest';
import { decodeFood, encodeFood } from './share';
import type { Food } from './types';

const food: Food = {
  id: 'custom:abc',
  source: 'custom',
  name: 'Cottage cheese med eple & peanøttsmør',
  brand: 'Hjemmelaget',
  per100: { kcal: 142, protein: 9.8, carbs: 8.1, fat: 7.6, sugar: 6 },
  portions: [{ label: 'bolle', grams: 250 }],
  updatedAt: 1,
};

describe('share links', () => {
  it('round-trips a food, including æøå and symbols, without its id', () => {
    const data = encodeFood(food);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/); // safe in a URL without escaping
    expect(decodeFood(data)).toEqual({
      source: 'custom',
      name: 'Cottage cheese med eple & peanøttsmør',
      brand: 'Hjemmelaget',
      ean: undefined,
      per100: { kcal: 142, protein: 9.8, carbs: 8.1, fat: 7.6, sugar: 6 },
      portions: [{ label: 'bolle', grams: 250 }],
      packageGrams: undefined,
    });
  });

  it('rejects broken or tampered data', () => {
    expect(decodeFood('not-base64!!')).toBeNull();
    expect(decodeFood('')).toBeNull();
    const bad = btoa(JSON.stringify({ v: 1, name: 'X', per100: { kcal: 'lots', protein: 1, carbs: 1, fat: 1 } }));
    expect(decodeFood(bad)).toBeNull();
    const negative = btoa(JSON.stringify({ v: 1, name: 'X', per100: { kcal: -5, protein: 1, carbs: 1, fat: 1 } }));
    expect(decodeFood(negative)).toBeNull();
  });

  it('drops invalid optional fields instead of trusting them', () => {
    const data = btoa(
      JSON.stringify({
        v: 1,
        name: '  Bolle  ',
        ean: 'javascript:alert(1)',
        per100: { kcal: 300, protein: 8, carbs: 50, fat: 7, salt: 'x' },
        portions: [{ label: 'stk', grams: 60 }, { label: 'bad', grams: -1 }],
      }),
    );
    const f = decodeFood(data)!;
    expect(f.name).toBe('Bolle');
    expect(f.ean).toBeUndefined();
    expect(f.per100.salt).toBeUndefined();
    expect(f.portions).toEqual([{ label: 'stk', grams: 60 }]);
  });
});
