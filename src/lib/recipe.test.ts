import { describe, expect, it } from 'vitest';
import { buildRecipeFood, rawWeight, recipeTotals } from './recipe';
import { decodeFood, encodeFood } from './share';
import type { Ingredient } from './types';

const ingredients: Ingredient[] = [
  { foodId: 'mvt:01.100', name: 'Cottage cheese', grams: 200, per100: { kcal: 98, protein: 13, carbs: 2, fat: 4.3 } },
  { foodId: 'mvt:13.001', name: 'Eple', grams: 150, quantity: 1, unitLabel: 'stk', unitGrams: 150, per100: { kcal: 52, protein: 0.3, carbs: 11, fat: 0.2 } },
  { foodId: 'custom:pb', name: 'Peanøttsmør', grams: 20, per100: { kcal: 620, protein: 25, carbs: 12, fat: 50 } },
];

describe('recipes', () => {
  it('adds up the ingredients', () => {
    expect(rawWeight(ingredients)).toBe(370);
    const total = recipeTotals(ingredients);
    expect(total.kcal).toBeCloseTo(196 + 78 + 124); // 398
    expect(total.protein).toBeCloseTo(26 + 0.45 + 5);
  });

  it('gives values per 100 g of the finished dish, a serving size and the whole recipe', () => {
    const food = buildRecipeFood({ id: 'recipe:1', name: 'Cottage cheese med eple & peanøttsmør', ingredients, servings: 2 });
    expect(food.source).toBe('recipe');
    expect(food.per100.kcal).toBeCloseTo((398 / 370) * 100);
    expect(food.portions).toEqual([
      { label: 'serving', grams: 185 },
      { label: 'recipe', grams: 370 },
    ]);
  });

  it('uses the cooked weight when given, so 100 g of the dish is denser', () => {
    const food = buildRecipeFood({ id: 'recipe:1', name: 'Gryte', ingredients, servings: 1, cookedGrams: 300 });
    expect(food.per100.kcal).toBeCloseTo((398 / 300) * 100);
    expect(food.portions).toEqual([{ label: 'recipe', grams: 300 }]);
  });

  it('shares the ingredient list and keeps only portable food ids', () => {
    const food = buildRecipeFood({ id: 'recipe:1', name: 'Bolle', ingredients, servings: 2 });
    const back = decodeFood(encodeFood(food))!;
    expect(back.source).toBe('recipe');
    expect(back.servings).toBe(2);
    expect(back.ingredients?.map((i) => i.foodId)).toEqual(['mvt:01.100', 'mvt:13.001', '']);
    expect(back.ingredients?.[1]).toMatchObject({ name: 'Eple', quantity: 1, unitLabel: 'stk', grams: 150 });
    expect(back.per100.kcal).toBeCloseTo(food.per100.kcal);
  });
});
