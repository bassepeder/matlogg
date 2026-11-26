import { scale, sum } from './nutrition';
import type { Food, Ingredient, Nutrients, Portion } from './types';

export function recipeTotals(ingredients: Ingredient[]): Nutrients {
  return sum(ingredients.map((i) => scale(i.per100, i.grams)));
}

export function rawWeight(ingredients: Ingredient[]): number {
  return ingredients.reduce((g, i) => g + i.grams, 0);
}

export function recipeWeight(ingredients: Ingredient[], cookedGrams?: number): number {
  return cookedGrams && cookedGrams > 0 ? cookedGrams : rawWeight(ingredients);
}

export function buildRecipeFood(input: {
  id: string;
  name: string;
  ingredients: Ingredient[];
  servings: number;
  cookedGrams?: number;
}): Food {
  const weight = recipeWeight(input.ingredients, input.cookedGrams);
  const total = recipeTotals(input.ingredients);
  const per100 = weight > 0 ? scale(total, (100 * 100) / weight) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const servings = Math.max(1, Math.round(input.servings));

  const portions: Portion[] = [];
  if (servings > 1) portions.push({ label: 'serving', grams: weight / servings });
  portions.push({ label: 'recipe', grams: weight });

  return {
    id: input.id,
    source: 'recipe',
    name: input.name,
    per100,
    portions,
    ingredients: input.ingredients,
    servings,
    cookedGrams: input.cookedGrams && input.cookedGrams > 0 ? input.cookedGrams : undefined,
    updatedAt: Date.now(),
  };
}
