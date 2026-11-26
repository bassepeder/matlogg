import { db, newId } from './db';
import { t } from './i18n';
import type { Food, Ingredient, Nutrients, Portion } from './types';

interface SharedFood {
  v: 1;
  name: string;
  brand?: string;
  ean?: string;
  per100: Nutrients;
  portions?: Portion[];
  packageGrams?: number;
  ingredients?: Ingredient[];
  servings?: number;
  cookedGrams?: number;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeFood(food: Food): string {
  const shared: SharedFood = {
    v: 1,
    name: food.name,
    brand: food.brand,
    ean: food.ean,
    per100: food.per100,
    portions: food.portions,
    packageGrams: food.packageGrams,
    ingredients: food.ingredients?.map((i) => ({ ...i, foodId: i.foodId.startsWith('mvt:') ? i.foodId : '' })),
    servings: food.servings,
    cookedGrams: food.cookedGrams,
  };
  return toBase64Url(JSON.stringify(shared));
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function cleanNutrients(n: Partial<Nutrients> | undefined): Nutrients | null {
  if (!n || ![n.kcal, n.protein, n.carbs, n.fat].every(isNum)) return null;
  const out: Nutrients = { kcal: n.kcal!, protein: n.protein!, carbs: n.carbs!, fat: n.fat! };
  for (const k of ['sugar', 'fiber', 'satFat', 'salt'] as const) if (isNum(n[k])) out[k] = n[k];
  return out;
}

function cleanIngredient(i: Partial<Ingredient>): Ingredient | null {
  const per100 = cleanNutrients(i?.per100);
  if (!per100 || typeof i.name !== 'string' || !i.name.trim() || !isNum(i.grams) || i.grams <= 0) return null;
  const hasUnit = typeof i.unitLabel === 'string' && isNum(i.quantity) && isNum(i.unitGrams);
  return {
    foodId: typeof i.foodId === 'string' && /^mvt:[\w.]+$/.test(i.foodId) ? i.foodId : '',
    name: i.name.trim().slice(0, 200),
    brand: typeof i.brand === 'string' ? i.brand.slice(0, 100) || undefined : undefined,
    grams: i.grams,
    quantity: hasUnit ? i.quantity : undefined,
    unitLabel: hasUnit ? i.unitLabel!.slice(0, 60) : undefined,
    unitGrams: hasUnit ? i.unitGrams : undefined,
    per100,
  };
}

export function decodeFood(data: string): Omit<Food, 'id'> | null {
  try {
    const s = JSON.parse(fromBase64Url(data)) as Partial<SharedFood>;
    if (s.v !== 1 || typeof s.name !== 'string' || !s.name.trim()) return null;
    const per100 = cleanNutrients(s.per100);
    if (!per100) return null;

    const ingredients = Array.isArray(s.ingredients)
      ? s.ingredients.slice(0, 100).map(cleanIngredient).filter((i): i is Ingredient => i !== null)
      : [];
    const isRecipe = ingredients.length > 0;

    const portions = Array.isArray(s.portions)
      ? s.portions
          .filter((p) => p && typeof p.label === 'string' && isNum(p.grams) && p.grams > 0)
          .slice(0, 20)
          .map((p) => ({ label: p.label.slice(0, 60), grams: p.grams }))
      : undefined;

    return {
      source: isRecipe ? 'recipe' : 'custom',
      ...(isRecipe && {
        ingredients,
        servings: isNum(s.servings) && s.servings >= 1 ? Math.round(s.servings) : 1,
        cookedGrams: isNum(s.cookedGrams) && s.cookedGrams > 0 ? s.cookedGrams : undefined,
      }),
      name: s.name.trim().slice(0, 200),
      brand: typeof s.brand === 'string' ? s.brand.slice(0, 100) || undefined : undefined,
      ean: typeof s.ean === 'string' && /^\d{8,14}$/.test(s.ean) ? s.ean : undefined,
      per100,
      portions: portions?.length ? portions : undefined,
      packageGrams: isNum(s.packageGrams) && s.packageGrams > 0 ? s.packageGrams : undefined,
    };
  } catch {
    return null;
  }
}

export function shareUrl(food: Food): string {
  const base = new URL(import.meta.env.BASE_URL, location.origin).href;
  return `${base}#/import?f=${encodeFood(food)}`;
}

export async function saveSharedFood(food: Omit<Food, 'id'>): Promise<Food> {
  const prefix = food.source === 'recipe' ? 'recipe' : 'custom';
  let id = food.ean ? `ean:${food.ean}` : `${prefix}:${newId()}`;
  if (await db.foods.get(id)) id = `${prefix}:${newId()}`;
  const saved: Food = { ...food, id, updatedAt: Date.now() };
  await db.foods.put(saved);
  return saved;
}

export async function shareFood(food: Food): Promise<boolean> {
  const url = shareUrl(food);
  try {
    if (navigator.share) {
      await navigator.share({ title: food.name, text: t('share.text', { name: food.name }), url });
      return false;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false;
  }
  await navigator.clipboard?.writeText(url).catch(() => undefined);
  return true;
}
