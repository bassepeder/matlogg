import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { IngredientPicker } from '../components/IngredientPicker';
import { TopBar } from '../components/Layout';
import { db, newId } from '../lib/db';
import { portionLabel, t } from '../lib/i18n';
import { fmt, fmtKcal, parseNum, scale, toInput } from '../lib/nutrition';
import { buildRecipeFood, rawWeight, recipeTotals, recipeWeight } from '../lib/recipe';
import { back, replace } from '../lib/router';
import { shareFood } from '../lib/share';
import type { Ingredient, Nutrients } from '../lib/types';
import { logPath } from './AddView';

function MacroRow({ n }: { n: Nutrients }) {
  return (
    <div className="totals">
      <div>
        <strong>{fmtKcal(n.kcal)}</strong>
        <span>{t('macro.kcalShort')}</span>
      </div>
      <div className="protein">
        <strong>{fmt(n.protein)}</strong>
        <span>{t('macro.proteinShort')}</span>
      </div>
      <div className="carbs">
        <strong>{fmt(n.carbs)}</strong>
        <span>{t('macro.carbsShort')}</span>
      </div>
      <div className="fat">
        <strong>{fmt(n.fat)}</strong>
        <span>{t('macro.fatShort')}</span>
      </div>
    </div>
  );
}

type Picker = { mode: 'add' } | { mode: 'edit'; index: number } | null;

export function RecipeEditView({ id, query }: { id?: string; query: URLSearchParams }) {
  const loaded = useLiveQuery(async () => ({ food: id ? await db.foods.get(id) : undefined }), [id]);
  const existing = loaded?.food;

  const [ready, setReady] = useState(!id);
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [cooked, setCooked] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (ready || !existing) return;
    setName(existing.name);
    setServings(String(existing.servings ?? 1));
    setCooked(toInput(existing.cookedGrams));
    setIngredients(existing.ingredients ?? []);
    setReady(true);
  }, [ready, existing]);

  if (id && loaded && !existing) {
    return (
      <>
        <TopBar title={t('recipe.edit')} />
        <main className="page">
          <p className="empty">{t('food.gone')}</p>
        </main>
      </>
    );
  }
  if (!ready) return <TopBar title={t('recipe.edit')} />;

  const servingCount = Math.max(1, Math.round(parseNum(servings) ?? 1));
  const cookedGrams = parseNum(cooked);
  const weight = recipeWeight(ingredients, cookedGrams);
  const total = recipeTotals(ingredients);
  const date = query.get('date');
  const meal = query.get('meal') ?? undefined;

  function build() {
    return buildRecipeFood({
      id: existing?.id ?? `recipe:${newId()}`,
      name: name.trim(),
      ingredients,
      servings: servingCount,
      cookedGrams,
    });
  }

  async function save() {
    if (!name.trim()) return setError(t('food.errName'));
    if (!ingredients.length) return setError(t('recipe.errIngredients'));
    const food = build();
    await db.foods.put(food);
    if (!existing && date && meal) replace(logPath(date, meal, food.id));
    else back('/foods');
  }

  async function remove() {
    if (!existing || !confirm(t('food.confirmDelete', { name: existing.name }))) return;
    await db.foods.delete(existing.id);
    back('/foods');
  }

  async function share() {
    if (!existing) return;
    const copied = await shareFood(existing);
    if (copied) setInfo(t('share.copied'));
  }

  return (
    <>
      <TopBar
        title={existing ? t('recipe.edit') : t('recipe.new')}
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

        <section className="card form">
          <label>
            <span className="field-label">{t('food.name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('recipe.namePlaceholder')}
              autoFocus={!existing}
            />
          </label>
          <div className="grid2">
            <label>
              <span className="field-label">{t('recipe.servings')}</span>
              <input className="input" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} />
            </label>
            <label>
              <span className="field-label">{t('recipe.cookedGrams')}</span>
              <input
                className="input"
                inputMode="decimal"
                value={cooked}
                onChange={(e) => setCooked(e.target.value)}
                placeholder={ingredients.length ? fmt(rawWeight(ingredients)) : ''}
              />
            </label>
          </div>
          {ingredients.length > 0 && <p className="hint">{t('recipe.cookedHint', { grams: fmt(rawWeight(ingredients)) })}</p>}
        </section>

        <h3 className="section-title">{t('recipe.ingredients')}</h3>
        <section className="card meal">
          {ingredients.length ? (
            <ul className="list">
              {ingredients.map((ing, i) => (
                <li key={`${ing.foodId}-${i}`}>
                  <button className="row" onClick={() => setPicker({ mode: 'edit', index: i })}>
                    <span className="row-main">
                      <span className="row-title">{ing.name}</span>
                      <span className="row-sub">
                        {ing.unitLabel && ing.quantity != null
                          ? `${fmt(ing.quantity)} ${portionLabel(ing.unitLabel)} · ${fmt(ing.grams)} g`
                          : `${fmt(ing.grams)} g`}
                      </span>
                    </span>
                    <span className="row-value">{fmtKcal(scale(ing.per100, ing.grams).kcal)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint ingredient-empty">{t('recipe.noIngredients')}</p>
          )}
          <button className="add-link" onClick={() => setPicker({ mode: 'add' })}>
            <Icon name="plus" size={18} /> {t('recipe.addIngredient')}
          </button>
        </section>

        {ingredients.length > 0 && weight > 0 && (
          <>
            {servingCount > 1 && (
              <>
                <h3 className="section-title">{t('recipe.perServing', { grams: fmt(weight / servingCount) })}</h3>
                <section className="card">
                  <MacroRow n={scale(total, 100 / servingCount)} />
                </section>
              </>
            )}
            <h3 className="section-title">{t('recipe.whole', { grams: fmt(weight) })}</h3>
            <section className="card">
              <MacroRow n={total} />
            </section>
          </>
        )}

        {error && <p className="notice error">{error}</p>}
        {existing && (
          <button className="btn danger-text wide" onClick={remove}>
            {t('recipe.delete')}
          </button>
        )}
      </main>

      <div className="action-bar">
        <button className="btn primary wide" onClick={save}>
          {existing ? t('common.save') : date ? t('food.saveContinue') : t('recipe.save')}
        </button>
      </div>

      {picker && (
        <IngredientPicker
          excludeId={existing?.id}
          editing={picker.mode === 'edit' ? ingredients[picker.index] : undefined}
          onClose={() => setPicker(null)}
          onRemove={
            picker.mode === 'edit'
              ? () => {
                  setIngredients(ingredients.filter((_, i) => i !== picker.index));
                  setPicker(null);
                }
              : undefined
          }
          onDone={(ing) => {
            setIngredients(
              picker.mode === 'edit' ? ingredients.map((x, i) => (i === picker.index ? ing : x)) : [...ingredients, ing],
            );
            setPicker(null);
            setError('');
          }}
        />
      )}
    </>
  );
}
