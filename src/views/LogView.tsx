import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useState } from 'react';
import { imageCors } from '../components/FoodRow';
import { Icon } from '../components/Icon';
import { MealPicker, NutrientGrid, TopBar } from '../components/Layout';
import { db } from '../lib/db';
import { mealForTime } from '../lib/dates';
import { useMeals } from '../lib/hooks';
import { getLang, portionLabel, t } from '../lib/i18n';
import { getFood } from '../lib/matvaretabellen';
import { defaultQuantity, isNutrientUnit, unitsFor } from '../lib/units';
import { fmt, fmtKcal, parseNum, scale, toInput } from '../lib/nutrition';
import { backToDiary, push } from '../lib/router';
import { recipeEntries } from '../lib/recipe';
import { mealInSentence, mealOptions, sourceLabel, type Entry, type Food, type FoodSource, type MealId } from '../lib/types';
import { QuickAddView } from './QuickAddView';

export { unitsFor };

// Stands in for a food that no longer exists (deleted, or an ingredient from a shared recipe),
// keeping the unit the entry was logged in so it can still be edited in that unit.
export function foodFromEntry(e: Entry): Food {
  const portions = e.unitLabel && e.unitGrams && e.unitGrams > 0 ? [{ label: e.unitLabel, grams: e.unitGrams }] : undefined;
  return { id: e.foodId, source: e.source === 'quick' ? 'custom' : e.source, name: e.name, brand: e.brand, per100: e.per100, portions };
}

export function per100Values(food: Food) {
  const n = food.per100;
  return [
    { label: t('nutr.energy'), value: `${fmtKcal(n.kcal)} kcal` },
    { label: t('nutr.protein'), value: `${fmt(n.protein)} g` },
    { label: t('nutr.carbs'), value: `${fmt(n.carbs)} g` },
    { label: t('nutr.sugar'), value: n.sugar != null ? `${fmt(n.sugar)} g` : '–' },
    { label: t('nutr.fat'), value: `${fmt(n.fat)} g` },
    { label: t('nutr.satFat'), value: n.satFat != null ? `${fmt(n.satFat)} g` : '–' },
    { label: t('nutr.fiber'), value: n.fiber != null ? `${fmt(n.fiber)} g` : '–' },
    { label: t('nutr.salt'), value: n.salt != null ? `${fmt(n.salt)} g` : '–' },
  ];
}

interface Props {
  date?: string;
  meal?: MealId;
  foodId?: string;
  entryId?: number;
  preset?: { n?: number; u?: string };
}

export function LogView(props: Props) {
  const editing = props.entryId != null;
  const loaded = useLiveQuery(
    async () => ({ entry: props.entryId != null ? await db.entries.get(props.entryId) : undefined }),
    [props.entryId],
  );
  const entry = loaded?.entry;
  const foodId = props.foodId ?? entry?.foodId;

  const [food, setFood] = useState<Food | null | undefined>(undefined);
  useEffect(() => {
    if (!foodId || foodId === 'quick') return;
    let alive = true;
    getFood(foodId).then(
      (f) => alive && setFood(f ?? null),
      () => alive && setFood(null),
    );
    return () => {
      alive = false;
    };
  }, [foodId]);

  const current: Food | undefined = food ?? (entry ? foodFromEntry(entry) : undefined);
  const units = current ? unitsFor(current) : [];

  const [qty, setQty] = useState('');
  const [unitIdx, setUnitIdx] = useState(0);
  const meals = useMeals();
  const [meal, setMeal] = useState<MealId>(props.meal ?? mealForTime(new Date(), meals));
  const [ready, setReady] = useState(false);
  // The amount field as it opened for an existing entry; saving it untouched keeps the exact amount.
  const [opened, setOpened] = useState<{ qty: string; unitIdx: number } | null>(null);

  useLayoutEffect(() => {
    // An entry without a food id (an ingredient from a shared recipe) has no food to wait for; it edits from its own values.
    if (ready || !current || (food === undefined && !!foodId) || (editing && !loaded)) return;
    const pick = (label: string | undefined, grams?: number) =>
      units.findIndex((u) => u.label === label && (grams == null || Math.abs(u.grams - grams) < 0.01));
    if (entry) {
      setMeal(entry.meal);
      const i = entry.unitLabel ? pick(entry.unitLabel, entry.unitGrams) : -1;
      const shown = i > 0 && entry.quantity != null ? { qty: toInput(entry.quantity), unitIdx: i } : { qty: toInput(entry.grams), unitIdx: 0 };
      setUnitIdx(shown.unitIdx);
      setQty(shown.qty);
      setOpened(shown);
    } else if (props.preset?.n != null && pick(props.preset.u) >= 0) {
      setUnitIdx(pick(props.preset.u));
      setQty(toInput(props.preset.n));
    } else if (units.length > 1 && units[1].label !== 'package') {
      setUnitIdx(1);
      setQty('1');
    } else {
      setQty('100');
    }
    setReady(true);
  }, [ready, current, food, foodId, editing, loaded, entry, units, props.preset]);

  if (editing && loaded && !entry) {
    return (
      <>
        <TopBar title={t('log.entry')} />
        <main className="page">
          <p className="empty">{t('log.entryGone')}</p>
        </main>
      </>
    );
  }
  if (entry?.source === 'quick') return <QuickAddView entry={entry} />;

  if (!current) {
    return (
      <>
        <TopBar title={editing ? t('log.edit') : t('log.addFood')} />
        <main className="page">
          <p className="empty">{food === null ? t('log.foodGone') : t('common.loading')}</p>
        </main>
      </>
    );
  }

  const unit = units[unitIdx] ?? units[0];
  // The field shows a rounded amount; if it was left as it opened, keep the entry's exact amount.
  const untouched = !!entry && !!opened && qty === opened.qty && unitIdx === opened.unitIdx;
  const quantity = untouched && entry.quantity != null && unit.label !== 'g' ? entry.quantity : parseNum(qty);
  const grams = untouched ? entry.grams : quantity != null && quantity > 0 ? quantity * unit.grams : 0;
  const amount = scale(current.per100, grams);
  const date = entry?.date ?? props.date!;
  const canEditFood = current.source !== 'matvaretabellen' && food != null;

  async function save() {
    if (!current || grams <= 0) return;
    const isGrams = unit.label === 'g';
    const record: Entry = {
      date,
      meal,
      foodId: current.id,
      name: current.name,
      brand: current.brand,
      source: current.source,
      grams,
      quantity: isGrams ? undefined : quantity,
      unitLabel: isGrams ? undefined : unit.label,
      unitGrams: isGrams ? undefined : unit.grams,
      per100: current.per100,
      createdAt: entry?.createdAt ?? Date.now(),
    };
    if (entry?.id != null) {
      await db.entries.put({ ...entry, ...record, id: entry.id });
    } else if (current.ingredients?.length) {
      // A recipe goes in as its ingredients, so the meal shows what was in it.
      const sources = new Map<string, FoodSource>();
      for (const ing of current.ingredients) {
        if (ing.source || sources.has(ing.foodId)) continue;
        const f = await getFood(ing.foodId).catch(() => undefined);
        if (f) sources.set(ing.foodId, f.source);
      }
      await db.entries.bulkAdd(recipeEntries(current, grams, record, (id) => sources.get(id)));
    } else {
      await db.entries.add(record);
    }
    backToDiary(date);
  }

  async function remove() {
    if (entry?.id == null) return;
    await db.entries.delete(entry.id);
    backToDiary(date);
  }

  return (
    <>
      <TopBar
        title={editing ? t('log.edit') : t('log.addTo', { meal: mealInSentence(meal, meals) })}
        right={
          canEditFood && (
            <button className="icon-btn" aria-label={t('log.editFood')} onClick={() => push(`/food/${encodeURIComponent(current.id)}`)}>
              <Icon name="edit" />
            </button>
          )
        }
      />
      <main className="page with-action">
        <section className="food-head">
          {current.image && <img src={current.image} crossOrigin={imageCors(current.image)} alt="" className="food-image" />}
          <div>
            <h1>{current.name}</h1>
            <p className="muted">
              {[current.brand, getLang() === 'en' ? current.altName : null, sourceLabel(current.source)].filter(Boolean).join(' · ')}
            </p>
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
                setUnitIdx(i);
                setQty(defaultQuantity(units[i].label, grams, current));
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

        <section className="card">
          <h3 className="section-title inline">{t('log.per100')}</h3>
          <NutrientGrid values={per100Values(current)} />
        </section>

        {editing && (
          <button className="btn danger-text wide" onClick={remove}>
            {t('log.delete')}
          </button>
        )}
      </main>

      <div className="action-bar">
        <button className="btn primary wide" disabled={grams <= 0} onClick={save}>
          {editing ? t('common.save') : t('log.addButton', { kcal: fmtKcal(amount.kcal), meal: mealInSentence(meal, meals) })}
        </button>
      </div>
    </>
  );
}
