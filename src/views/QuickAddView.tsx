import { useState } from 'react';
import { MealPicker, TopBar } from '../components/Layout';
import { db } from '../lib/db';
import { mealForTime } from '../lib/dates';
import { useMeals } from '../lib/hooks';
import { t } from '../lib/i18n';
import { kcalFromMacros, parseNum, toInput } from '../lib/nutrition';
import { backToDiary } from '../lib/router';
import { mealInSentence, mealOptions, type Entry, type MealId } from '../lib/types';

export function QuickAddView(props: { date?: string; meal?: MealId; entry?: Entry }) {
  const e = props.entry;
  const [name, setName] = useState(e?.name ?? '');
  const [kcal, setKcal] = useState(toInput(e?.per100.kcal));
  const [protein, setProtein] = useState(e?.per100.protein ? toInput(e.per100.protein) : '');
  const [carbs, setCarbs] = useState(e?.per100.carbs ? toInput(e.per100.carbs) : '');
  const [fat, setFat] = useState(e?.per100.fat ? toInput(e.per100.fat) : '');
  const meals = useMeals();
  const [meal, setMeal] = useState<MealId>(e?.meal ?? props.meal ?? mealForTime(new Date(), meals));
  const date = e?.date ?? props.date!;

  const macros = { protein: parseNum(protein), carbs: parseNum(carbs), fat: parseNum(fat) };
  const hasMacros = Object.values(macros).some((v) => v != null);
  const kcalValue = parseNum(kcal) ?? (hasMacros ? Math.round(kcalFromMacros(macros)) : undefined);
  const negative = kcalValue != null && kcalValue < 0;

  async function save() {
    if (kcalValue == null || kcalValue < 0) return;
    const record: Entry = {
      date,
      meal,
      foodId: 'quick',
      name: name.trim(),
      source: 'quick',
      grams: 100,
      per100: { kcal: kcalValue, protein: macros.protein ?? 0, carbs: macros.carbs ?? 0, fat: macros.fat ?? 0 },
      createdAt: e?.createdAt ?? Date.now(),
    };
    if (e?.id != null) await db.entries.put({ ...record, id: e.id });
    else await db.entries.add(record);
    backToDiary(date);
  }

  async function remove() {
    if (e?.id == null) return;
    await db.entries.delete(e.id);
    backToDiary(date);
  }

  return (
    <>
      <TopBar title={e ? t('quick.editTitle') : t('quick.title', { meal: mealInSentence(meal, meals) })} />
      <main className="page with-action">
        <section className="card form">
          <label>
            <span className="field-label">{t('quick.description')}</span>
            <input className="input" value={name} onChange={(ev) => setName(ev.target.value)} placeholder={t('quick.placeholder')} />
          </label>
          <label>
            <span className="field-label">{t('quick.kcal')}</span>
            <input
              className="input"
              inputMode="decimal"
              value={kcal}
              onChange={(ev) => setKcal(ev.target.value)}
              placeholder={hasMacros && kcalValue != null ? t('quick.fromMacros', { kcal: kcalValue }) : ''}
              autoFocus={!e}
            />
          </label>
          <div className="grid3">
            <label>
              <span className="field-label">{t('field.protein')}</span>
              <input className="input" inputMode="decimal" value={protein} onChange={(ev) => setProtein(ev.target.value)} />
            </label>
            <label>
              <span className="field-label">{t('quick.carbs')}</span>
              <input className="input" inputMode="decimal" value={carbs} onChange={(ev) => setCarbs(ev.target.value)} />
            </label>
            <label>
              <span className="field-label">{t('field.fat')}</span>
              <input className="input" inputMode="decimal" value={fat} onChange={(ev) => setFat(ev.target.value)} />
            </label>
          </div>
          {negative && <p className="notice error">{t('quick.errNegative')}</p>}
          <MealPicker label={t('meal.label')} value={meal} onChange={setMeal} options={mealOptions(meals, meal)} />
        </section>
        {e && (
          <button className="btn danger-text wide" onClick={remove}>
            {t('log.delete')}
          </button>
        )}
      </main>
      <div className="action-bar">
        <button className="btn primary wide" disabled={kcalValue == null || negative} onClick={save}>
          {e ? t('common.save') : t('quick.add', { kcal: kcalValue ?? 0 })}
        </button>
      </div>
    </>
  );
}
