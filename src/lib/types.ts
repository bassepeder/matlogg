import { getLang, t } from './i18n';

export type MealId = string;

// A meal in the diary. Built-in meals have no name until renamed, so they follow the app language.
export interface Meal {
  id: MealId;
  name?: string;
}

const BUILT_IN = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
type BuiltInMeal = (typeof BUILT_IN)[number];

export const DEFAULT_MEALS: Meal[] = BUILT_IN.map((id) => ({ id }));

export function isBuiltInMeal(id: MealId): id is BuiltInMeal {
  return (BUILT_IN as readonly string[]).includes(id);
}

export function builtInMealLabel(id: BuiltInMeal): string {
  return t(`meal.${id}`);
}

export function mealLabel(id: MealId, meals: Meal[]): string {
  const name = meals.find((m) => m.id === id)?.name?.trim();
  if (name) return name;
  return isBuiltInMeal(id) ? builtInMealLabel(id) : id;
}

// Built-in names are lowercased mid-sentence in Norwegian; names the user typed are kept as written.
export function mealInSentence(id: MealId, meals: Meal[]): string {
  const label = mealLabel(id, meals);
  const custom = !!meals.find((m) => m.id === id)?.name?.trim() || !isBuiltInMeal(id);
  return getLang() === 'nb' && !custom ? label.toLocaleLowerCase('nb') : label;
}

// Picker options for the meal list, keeping a current value that is no longer in the list.
export function mealOptions(meals: Meal[], current?: MealId): { id: MealId; label: string }[] {
  const list = current && !meals.some((m) => m.id === current) ? [...meals, { id: current }] : meals;
  return list.map((m) => ({ id: m.id, label: mealLabel(m.id, meals) }));
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  satFat?: number;
  salt?: number;
}

export type FoodSource = 'matvaretabellen' | 'openfoodfacts' | 'vetduat' | 'custom' | 'recipe';

export function sourceLabel(source: FoodSource | 'quick'): string {
  return t(`source.${source}`);
}

export interface Portion {
  label: string;
  grams: number;
}

export interface Ingredient {
  foodId: string;
  name: string;
  brand?: string;
  source?: FoodSource;
  grams: number;
  quantity?: number;
  unitLabel?: string;
  unitGrams?: number;
  per100: Nutrients;
}

export interface Food {
  id: string;
  source: FoodSource;
  name: string;
  altName?: string;
  brand?: string;
  ean?: string;
  per100: Nutrients;
  portions?: Portion[];
  packageGrams?: number;
  image?: string;
  keywords?: string;
  updatedAt?: number;
  ingredients?: Ingredient[];
  servings?: number;
  cookedGrams?: number;
}

export interface Entry {
  id?: number;
  date: string;
  meal: MealId;
  foodId: string;
  name: string;
  brand?: string;
  source: FoodSource | 'quick';
  grams: number;
  quantity?: number;
  unitLabel?: string;
  unitGrams?: number;
  per100: Nutrients;
  createdAt: number;
}

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  carbsAuto?: boolean;
}

export interface Settings {
  id: 'app';
  goals: Goals;
  vetduatProxyUrl?: string;
  meals?: Meal[];
}
