/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromMvtRow, type MvtRow } from './matvaretabellen';
import { buildIndex, normalize, searchFoods } from './search';
import type { Food } from './types';

const table = JSON.parse(readFileSync(new URL('../../public/data/matvaretabellen.json', import.meta.url), 'utf8')) as {
  foods: MvtRow[];
};
const index = buildIndex(table.foods.map(fromMvtRow));
const names = (q: string, n = 5) => searchFoods(index, q, { limit: n }).map((f) => f.name);

describe('normalize', () => {
  it('strips accents but keeps æ, ø and å', () => {
    expect(normalize('Crème Fraîche')).toBe('creme fraiche');
    expect(normalize('Blåbær, rå')).toBe('blåbær, rå');
    expect(normalize('Brød')).toBe('brød');
  });
});

describe('searchFoods on Matvaretabellen', () => {
  it('ranks foods whose name starts with the query first', () => {
    expect(names('egg')[0]).toMatch(/^Egg/);
  });

  it('requires every word to match', () => {
    const results = names('egg kokt', 10);
    expect(results[0]).toBe('Egg, kokt');
    for (const r of results) expect(normalize(r)).toMatch(/egg/);
  });

  it('does not match on substrings of keywords', () => {
    // "Kokt skinke" has the keyword "kjøttpålegg", which contains "egg".
    expect(names('egg kokt', 50)).not.toContain('Kokt skinke');
  });

  it('finds Norwegian compound words in names by substring', () => {
    const food = (name: string): Food => ({ id: name, source: 'custom', name, per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 } });
    const small = buildIndex([food('Grovbrød'), food('Brunost'), food('Brødskive')]);
    expect(searchFoods(small, 'brød').map((f) => f.name)).toEqual(['Brødskive', 'Grovbrød']);
  });

  it('matches English names too', () => {
    expect(names('rolled oats')).toContain('Havregryn');
  });

  it('applies a boost for preferred foods', () => {
    const mine: Food = {
      id: 'custom:1',
      source: 'custom',
      name: 'Eggerøre min',
      per100: { kcal: 150, protein: 10, carbs: 1, fat: 11 },
    };
    const both = buildIndex([mine, ...table.foods.map(fromMvtRow)]);
    const top = searchFoods(both, 'egg', { boost: (f) => (f.source === 'custom' ? 100 : 0) })[0];
    expect(top.id).toBe('custom:1');
  });
});
