import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Layout';
import { db } from '../lib/db';
import { t } from '../lib/i18n';
import { fmtKcal } from '../lib/nutrition';
import { push } from '../lib/router';
import { mealInSentence, type Food, type MealId } from '../lib/types';
import { useMeals } from '../lib/hooks';
import { logPath } from './AddView';

// Saved recipes to log from, newest first. Creating one lives under "My foods"; the link here is a shortcut.
export function RecipesView({ date, meal }: { date: string; meal: MealId }) {
  const meals = useMeals();
  const recipes = useLiveQuery(() => db.foods.filter((f) => f.source === 'recipe').toArray(), []);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('nb');
    return (recipes ?? [])
      .filter((r) => !needle || r.name.toLocaleLowerCase('nb').includes(needle))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [recipes, q]);
  const newRecipe = () => push(`/recipe/new?${new URLSearchParams({ date, meal })}`);

  return (
    <>
      <TopBar title={t('recipes.title', { meal: mealInSentence(meal, meals) })} />
      <main className="page" style={recipes ? undefined : { visibility: 'hidden' }}>
        {recipes?.length ? (
          <>
            {recipes.length > 6 && (
              <div className="search-box">
                <Icon name="search" size={18} />
                <input type="search" placeholder={t('foods.filter')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('foods.filter')} />
              </div>
            )}
            {shown.length ? (
              <ul className="list card">
                {shown.map((r) => (
                  <RecipeRow key={r.id} recipe={r} onClick={() => push(logPath(date, meal, r.id))} />
                ))}
              </ul>
            ) : (
              <p className="empty">{t('foods.noMatches')}</p>
            )}
            <button className="add-link" onClick={newRecipe}>
              <Icon name="plus" size={18} /> {t('recipe.new')}
            </button>
          </>
        ) : (
          <>
            <p className="empty">{t('recipes.empty')}</p>
            <button className="btn primary wide" onClick={newRecipe}>
              <Icon name="recipe" /> {t('recipe.new')}
            </button>
          </>
        )}
      </main>
    </>
  );
}

function RecipeRow({ recipe, onClick }: { recipe: Food; onClick: () => void }) {
  const serving = recipe.portions?.[0];
  const perServing = serving?.label === 'serving';
  const grams = serving?.grams ?? 100;
  const ingredients = (recipe.ingredients ?? []).map((i) => i.name).join(', ');
  return (
    <li>
      <button className="row" onClick={onClick}>
        <span className="row-main">
          <span className="row-title">{recipe.name}</span>
          {ingredients && <span className="row-sub">{ingredients}</span>}
        </span>
        <span className="row-value">
          {fmtKcal((recipe.per100.kcal * grams) / 100)}
          <small> {perServing ? t('unit.kcalPerServing') : t('unit.kcalPerRecipe')}</small>
        </span>
      </button>
    </li>
  );
}
