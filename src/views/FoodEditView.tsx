import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ChangeEvent } from 'react';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Layout';
import { db, newId } from '../lib/db';
import { t, type MessageKey } from '../lib/i18n';
import { kcalFromMacros, parseNum, toInput } from '../lib/nutrition';
import { back, replace } from '../lib/router';
import { shareFood } from '../lib/share';
import type { Food, Nutrients } from '../lib/types';
import { logPath } from './AddView';

const FIELDS: { key: keyof Nutrients; label: MessageKey; indent?: boolean }[] = [
  { key: 'kcal', label: 'field.kcal' },
  { key: 'protein', label: 'field.protein' },
  { key: 'carbs', label: 'field.carbs' },
  { key: 'sugar', label: 'field.sugar', indent: true },
  { key: 'fat', label: 'field.fat' },
  { key: 'satFat', label: 'field.satFat', indent: true },
  { key: 'fiber', label: 'field.fiber' },
  { key: 'salt', label: 'field.salt' },
];

type Form = Record<keyof Nutrients | 'name' | 'brand' | 'ean' | 'servingLabel' | 'servingGrams' | 'packageGrams', string>;

const EMPTY_FORM: Form = {
  name: '',
  brand: '',
  ean: '',
  kcal: '',
  protein: '',
  carbs: '',
  sugar: '',
  fat: '',
  satFat: '',
  fiber: '',
  salt: '',
  servingLabel: '',
  servingGrams: '',
  packageGrams: '',
};

function formFromFood(f: Food): Form {
  const n = f.per100;
  const serving = f.portions?.[0];
  return {
    name: f.name,
    brand: f.brand ?? '',
    ean: f.ean ?? '',
    kcal: toInput(n.kcal),
    protein: toInput(n.protein),
    carbs: toInput(n.carbs),
    sugar: toInput(n.sugar),
    fat: toInput(n.fat),
    satFat: toInput(n.satFat),
    fiber: toInput(n.fiber),
    salt: toInput(n.salt),
    servingLabel: serving?.label ?? '',
    servingGrams: toInput(serving?.grams),
    packageGrams: toInput(f.packageGrams),
  };
}

export function FoodEditView({ id, query }: { id?: string; query: URLSearchParams }) {
  const loaded = useLiveQuery(async () => ({ food: id ? await db.foods.get(id) : undefined }), [id]);
  const existing = loaded?.food;
  const [form, setForm] = useState<Form | null>(id ? null : { ...EMPTY_FORM, ean: query.get('ean') ?? '', name: query.get('name') ?? '', brand: query.get('brand') ?? '', packageGrams: query.get('pkg') ?? '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (id && existing && !form) setForm(formFromFood(existing));
  }, [id, existing, form]);

  if (id && loaded && !existing) {
    return (
      <>
        <TopBar title={t('food.title')} />
        <main className="page">
          <p className="empty">{t('food.gone')}</p>
        </main>
      </>
    );
  }
  if (!form) return <TopBar title={t('food.edit')} />;

  const set = (key: keyof Form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const macros = { protein: parseNum(form.protein), carbs: parseNum(form.carbs), fat: parseNum(form.fat), fiber: parseNum(form.fiber) };
  const estimate = Math.round(kcalFromMacros(macros));
  const notice = query.get('notice');
  const date = query.get('date');
  const meal = query.get('meal') ?? undefined;

  async function save() {
    const f = form!;
    const name = f.name.trim();
    const kcal = parseNum(f.kcal) ?? (estimate > 0 ? estimate : undefined);
    if (!name) return setError(t('food.errName'));
    if (kcal == null) return setError(t('food.errKcal'));
    const ean = f.ean.replace(/\D/g, '') || undefined;

    const per100: Nutrients = {
      kcal,
      protein: parseNum(f.protein) ?? 0,
      carbs: parseNum(f.carbs) ?? 0,
      fat: parseNum(f.fat) ?? 0,
    };
    for (const k of ['sugar', 'fiber', 'satFat', 'salt'] as const) {
      const v = parseNum(f[k]);
      if (v != null) per100[k] = v;
    }

    const servingGrams = parseNum(f.servingGrams);
    const serving = servingGrams && servingGrams > 0 ? [{ label: f.servingLabel.trim() || 'serving', grams: servingGrams }] : [];
    const otherPortions = existing?.portions?.slice(1) ?? [];
    const packageGrams = parseNum(f.packageGrams);

    let foodId = existing?.id;
    if (!foodId) {
      foodId = ean ? `ean:${ean}` : `custom:${newId()}`;
      if (ean && (await db.foods.get(foodId))) foodId = `custom:${newId()}`;
    }

    const food: Food = {
      ...existing,
      id: foodId,
      source: existing?.source ?? 'custom',
      name,
      brand: f.brand.trim() || undefined,
      ean,
      per100,
      portions: [...serving, ...otherPortions].length ? [...serving, ...otherPortions] : undefined,
      packageGrams: packageGrams && packageGrams > 0 ? packageGrams : undefined,
      updatedAt: Date.now(),
    };
    await db.foods.put(food);

    if (!existing && date && meal) replace(logPath(date, meal, food.id));
    else back('/foods');
  }

  async function share() {
    if (existing && (await shareFood(existing))) setInfo(t('share.copied'));
  }

  async function remove() {
    if (!existing || !confirm(t('food.confirmDelete', { name: existing.name }))) return;
    await db.foods.delete(existing.id);
    back('/foods');
  }

  return (
    <>
      <TopBar
        title={existing ? t('food.edit') : t('food.new')}
        right={
          existing && (
            <button className="icon-btn" aria-label={t('share.button')} onClick={share}>
              <Icon name="share" />
            </button>
          )
        }
      />
      <main className="page with-action">
        {info && <p className="notice">{info}</p>}
        {notice === 'notfound' && (
          <p className="notice">{t('food.notFound', { ean: form.ean })}</p>
        )}
        {notice === 'nonutrition' && (
          <p className="notice">{t('food.noNutrition')}</p>
        )}

        <section className="card form">
          <label>
            <span className="field-label">{t('food.name')}</span>
            <input className="input" value={form.name} onChange={set('name')} autoFocus={!form.name} />
          </label>
          <div className="grid2">
            <label>
              <span className="field-label">{t('food.brand')}</span>
              <input className="input" value={form.brand} onChange={set('brand')} />
            </label>
            <label>
              <span className="field-label">{t('food.barcode')}</span>
              <input className="input" inputMode="numeric" value={form.ean} onChange={set('ean')} />
            </label>
          </div>
        </section>

        <h3 className="section-title">{t('food.per100')}</h3>
        <section className="card form nutrients-form">
          {FIELDS.map((field) => (
            <label key={field.key} className={`inline-field${field.indent ? ' indent' : ''}`}>
              <span>{t(field.label)}</span>
              <input
                className="input"
                inputMode="decimal"
                value={form[field.key]}
                onChange={set(field.key)}
                placeholder={field.key === 'kcal' && estimate > 0 ? String(estimate) : ''}
              />
            </label>
          ))}
          {estimate > 0 && (
            <p className="hint">
              {t('food.estimate', { kcal: estimate })}
              {!form.kcal && ` ${t('food.estimateUsed')}`}
            </p>
          )}
        </section>

        <h3 className="section-title">{t('food.sizes')}</h3>
        <section className="card form">
          <div className="grid2">
            <label>
              <span className="field-label">{t('food.servingName')}</span>
              <input className="input" value={form.servingLabel} onChange={set('servingLabel')} placeholder={t('food.servingPlaceholder')} />
            </label>
            <label>
              <span className="field-label">{t('food.servingGrams')}</span>
              <input className="input" inputMode="decimal" value={form.servingGrams} onChange={set('servingGrams')} />
            </label>
          </div>
          <label>
            <span className="field-label">{t('food.packageGrams')}</span>
            <input className="input" inputMode="decimal" value={form.packageGrams} onChange={set('packageGrams')} />
          </label>
        </section>

        {error && <p className="notice error">{error}</p>}
        {existing && (
          <button className="btn danger-text wide" onClick={remove}>
            {t('food.delete')}
          </button>
        )}
      </main>
      <div className="action-bar">
        <button className="btn primary wide" onClick={save}>
          {existing ? t('common.save') : date ? t('food.saveContinue') : t('food.save')}
        </button>
      </div>
    </>
  );
}
