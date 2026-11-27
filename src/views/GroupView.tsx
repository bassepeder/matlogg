import { useLiveQuery } from 'dexie-react-hooks';
import { useLayoutEffect, useState } from 'react';
import { MealPicker, TopBar } from '../components/Layout';
import { db } from '../lib/db';
import { useMeals } from '../lib/hooks';
import { portionLabel, t } from '../lib/i18n';
import { entryNutrients, fmt, fmtKcal, parseNum, scale, sum, toInput } from '../lib/nutrition';
import { groupDishGrams, scaleGroup } from '../lib/recipe';
import { backToDiary } from '../lib/router';
import { isNutrientUnit, unitsFor } from '../lib/units';
import { mealOptions, type Food, type MealId } from '../lib/types';

// Changes the amount (and meal) of a whole recipe logged as ingredient lines, or deletes all of it.
export function GroupView({ date, group }: { date: string; group: string }) {
  const meals = useMeals();
  const data = useLiveQuery(async () => {
    const entries = await db.entries.where('date').equals(date).filter((e) => e.group === group).sortBy('createdAt');
    const recipeId = entries[0]?.recipeId;
    const recipe = recipeId ? await db.foods.get(recipeId) : undefined;
    return { entries, recipe };
  }, [date, group]);

  const entries = data?.entries ?? [];
  const recipe = data?.recipe;
  const name = entries[0]?.recipeName ?? '';
  const total = sum(entries.map(entryNutrients));
  const dishGrams = groupDishGrams(entries, recipe);
  // Without the recipe (deleted since), the lines themselves describe the dish.
  const food: Food = recipe ?? {
    id: group,
    source: 'recipe',
    name,
    per100: dishGrams > 0 ? scale(total, (100 * 100) / dishGrams) : total,
  };
  const units = unitsFor(food);

  const [qty, setQty] = useState('');
  const [unitIdx, setUnitIdx] = useState(0);
  const [meal, setMeal] = useState<MealId>('');
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (ready || !data || !entries.length) return;
    const serving = units.findIndex((u) => u.label === 'serving');
    if (serving > 0) {
      setUnitIdx(serving);
      setQty(toInput(roundAmount(dishGrams / units[serving].grams, 'serving')));
    } else {
      setQty(toInput(roundAmount(dishGrams, 'g')));
    }
    setMeal(entries[0].meal);
    setReady(true);
  }, [ready, data, entries, units, dishGrams]);

  if (data && !entries.length) {
    return (
      <>
        <TopBar title={t('group.title')} />
        <main className="page">
          <p className="empty">{t('log.entryGone')}</p>
        </main>
      </>
    );
  }
  if (!ready) return <TopBar title={t('group.title')} />;

  const unit = units[unitIdx] ?? units[0];
  const quantity = parseNum(qty);
  const grams = quantity != null && quantity > 0 ? quantity * unit.grams : 0;
  const factor = dishGrams > 0 ? grams / dishGrams : 0;
  const amount = scale(total, factor * 100);

  async function save() {
    if (factor <= 0) return;
    await db.entries.bulkPut(scaleGroup(entries, factor, meal));
    backToDiary(date);
  }

  async function remove() {
    if (!confirm(t('group.confirmDelete', { name }))) return;
    await db.entries.bulkDelete(entries.map((e) => e.id!).filter((id) => id != null));
    backToDiary(date);
  }

  return (
    <>
      <TopBar title={t('group.title')} />
      <main className="page with-action">
        <section className="food-head">
          <div>
            <h1>{name}</h1>
            <p className="muted">{entries.map((e) => e.name).join(', ')}</p>
          </div>
        </section>

        <section className="card">
          <label className="field-label" htmlFor="qty">
            {t('log.amount')}
          </label>
          <div className="amount-row">
            <input
              id="qty"
              className="input"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-label={t('log.quantity')}
            />
            <select
              className="input"
              value={unitIdx}
              onChange={(e) => {
                const i = Number(e.target.value);
                const next = units[i];
                setUnitIdx(i);
                // Keep the same amount, shown in the new unit.
                if (grams > 0) setQty(toInput(roundAmount(grams / next.grams, next.label)));
              }}
              aria-label={t('log.unit')}
            >
              {units.map((u, i) => (
                <option key={u.label} value={i}>
                  {u.label === 'g' ? t('unit.grams') : isNutrientUnit(u.label) ? portionLabel(u.label) : `${portionLabel(u.label)} (${fmt(u.grams)} g)`}
                </option>
              ))}
            </select>
          </div>
          {unit.label !== 'g' && <p className="hint">= {fmt(grams)} g</p>}
          <MealPicker label={t('meal.label')} value={meal} onChange={setMeal} options={mealOptions(meals, meal)} />
        </section>

        <section className="card totals">
          <div>
            <strong>{fmtKcal(amount.kcal)}</strong>
            <span>{t('macro.kcalShort')}</span>
          </div>
          <div className="protein">
            <strong>{fmt(amount.protein)}</strong>
            <span>{t('macro.proteinShort')}</span>
          </div>
          <div className="carbs">
            <strong>{fmt(amount.carbs)}</strong>
            <span>{t('macro.carbsShort')}</span>
          </div>
          <div className="fat">
            <strong>{fmt(amount.fat)}</strong>
            <span>{t('macro.fatShort')}</span>
          </div>
        </section>

        <p className="hint">{t('group.hint')}</p>

        <button className="btn danger-text wide" onClick={remove}>
          {t('group.delete')}
        </button>
      </main>

      <div className="action-bar">
        <button className="btn primary wide" disabled={factor <= 0} onClick={save}>
          {t('common.save')}
        </button>
      </div>
    </>
  );
}

// Whole grams (and kcal or protein), two decimals for servings and other units.
function roundAmount(n: number, label: string): number {
  return label === 'g' || isNutrientUnit(label) ? Math.round(n) : Math.round(n * 100) / 100;
}
