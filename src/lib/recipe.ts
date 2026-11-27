import { scale, sum } from './nutrition';
import type { Entry, Food, FoodSource, Ingredient, Nutrients, Portion } from './types';

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

// Splits `grams` of a recipe into one diary entry per ingredient, scaled to that amount, so the
// diary lists what was actually eaten. `sourceOf` fills in sources for ingredients saved without one.
export function recipeEntries(
  recipe: Food,
  grams: number,
  base: Pick<Entry, 'date' | 'meal' | 'createdAt'>,
  sourceOf: (foodId: string) => FoodSource | undefined = () => undefined,
  group: string = `${recipe.id}@${base.createdAt}`,
): Entry[] {
  const ingredients = recipe.ingredients ?? [];
  const weight = recipeWeight(ingredients, recipe.cookedGrams);
  if (!ingredients.length || weight <= 0 || grams <= 0) return [];
  const factor = grams / weight;
  return ingredients.map((ing, i) => ({
    date: base.date,
    meal: base.meal,
    foodId: ing.foodId,
    name: ing.name,
    brand: ing.brand,
    source: ing.source ?? sourceOf(ing.foodId) ?? (ing.foodId.startsWith('mvt:') ? 'matvaretabellen' : 'custom'),
    grams: ing.grams * factor,
    quantity: ing.unitLabel && ing.quantity != null ? ing.quantity * factor : undefined,
    unitLabel: ing.unitLabel && ing.quantity != null ? ing.unitLabel : undefined,
    unitGrams: ing.unitLabel && ing.quantity != null ? ing.unitGrams : undefined,
    per100: ing.per100,
    createdAt: base.createdAt + i,
    group,
    recipeId: recipe.id,
    recipeName: recipe.name,
  }));
}
