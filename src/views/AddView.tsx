import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { SearchResults } from '../components/SearchResults';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Layout';
import { db, recentFoods, type RecentFood } from '../lib/db';
import { useMatvaretabellen, useMeals } from '../lib/hooks';
import { t } from '../lib/i18n';
import type { LookupResult } from '../lib/lookup';
import { fmt } from '../lib/nutrition';
import { push, replace } from '../lib/router';
import { buildIndex, searchFoods } from '../lib/search';
import { mealLabel, mealOptions, type Entry, type Food, type MealId } from '../lib/types';
import { amountLabel, entryTitle } from './DiaryView';

export function logPath(date: string, meal: MealId, foodId: string, preset?: { n: number; u: string }) {
  const q = preset ? `?${new URLSearchParams({ n: String(preset.n), u: preset.u })}` : '';
  return `/log/${date}/${meal}/${encodeURIComponent(foodId)}${q}`;
}

export function newFoodPath(params: Record<string, string | number | undefined>) {
  const clean = Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][];
  return `/food/new?${new URLSearchParams(clean.map(([k, v]) => [k, String(v)]))}`;
}

// A native <select> is as wide as its longest option, so show the chosen label in a chip
// sized to fit it, with the (invisible) native select laid over the chip to keep the OS picker.
export function MealSelect({ value, onChange }: { value: MealId; onChange: (m: MealId) => void }) {
  const meals = useMeals();
  return (
    <span className="meal-select">
      {mealLabel(value, meals)}
      <Icon name="next" size={16} />
      <select value={value} onChange={(e) => onChange(e.target.value as MealId)} aria-label={t('meal.label')}>
        {mealOptions(meals, value).map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </span>
  );
}

// The amount a recent food is offered with. A line scaled from a recipe (say 66.7 g) is rounded
// to the nearest 5 g or half unit; amounts the user chose are kept as they were.
export function recentAmount(e: Entry): Entry {
  if (!e.group) return e;
  if (e.unitLabel && e.quantity != null && e.quantity > 0) {
    const quantity = Math.max(0.5, Math.round(e.quantity * 2) / 2);
    return { ...e, quantity, grams: quantity * (e.unitGrams ?? e.grams / e.quantity) };
  }
  return { ...e, grams: Math.max(5, Math.round(e.grams / 5) * 5) };
}

const EMPTY_FOODS: Food[] = [];
const EMPTY_RECENT: RecentFood[] = [];

export function AddView({ date, meal, initialQuery }: { date: string; meal: MealId; initialQuery: string }) {
  const { table, error: mvtError } = useMatvaretabellen();
  const myFoods = useLiveQuery(() => db.foods.toArray(), [], EMPTY_FOODS);
  const recent = useLiveQuery(() => recentFoods(), [], EMPTY_RECENT);
  const [q, setQ] = useState(initialQuery);

  const mvtIndex = useMemo(() => (table ? buildIndex(table.foods) : []), [table]);
  const myIndex = useMemo(() => buildIndex(myFoods), [myFoods]);
  const usage = useMemo(() => new Map(recent.map((r) => [r.entry.foodId, r.count])), [recent]);
  const results = useMemo(
    () =>
      q.trim()
        ? searchFoods([...myIndex, ...mvtIndex], q, {
            boost: (f) => (f.source === 'matvaretabellen' ? 0 : 15) + Math.min((usage.get(f.id) ?? 0) * 5, 30),
          })
        : [],
    [q, myIndex, mvtIndex, usage],
  );

  const here = (m: MealId, query: string) => `/add/${date}/${m}${query ? `?${new URLSearchParams({ q: query })}` : ''}`;

  function onQuery(value: string) {
    setQ(value);
    replace(here(meal, value));
  }

  async function pickStoreResult(r: LookupResult) {
    if (r.food) {
      const existing = await db.foods.get(r.food.id);
      if (!existing) await db.foods.put(r.food);
      push(logPath(date, meal, r.food.id));
    } else {
      push(
        newFoodPath({
          date,
          meal,
          ean: r.partial?.ean,
          name: r.partial?.name,
          brand: r.partial?.brand,
          pkg: r.partial?.packageGrams,
          notice: 'nonutrition',
        }),
      );
    }
  }


  return (
    <>
      <TopBar
        title={
          <span className="add-title">
            {t('add.to')} <MealSelect value={meal} onChange={(m) => replace(here(m, q))} />
          </span>
        }
      />
      <main className="page">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder={t('add.search')}
            value={q}
            autoFocus={!initialQuery}
            enterKeyHint="search"
            autoComplete="off"
            onChange={(e) => onQuery(e.target.value)}
            aria-label={t('add.search')}
          />
        </div>

        <div className="quick-actions">
          <button onClick={() => push(`/scan/${date}/${meal}`)}>
            <Icon name="scan" /> {t('add.scan')}
          </button>
          <button onClick={() => push(newFoodPath({ date, meal, name: q.trim() || undefined }))}>
            <Icon name="edit" /> {t('add.create')}
          </button>
          <button onClick={() => push(`/recipes/${date}/${meal}`)}>
            <Icon name="recipe" /> {t('add.recipe')}
          </button>
          <button onClick={() => push(`/quick/${date}/${meal}`)}>
            <Icon name="bolt" /> {t('add.quick')}
          </button>
        </div>

        {mvtError && <p className="notice error">{mvtError}</p>}

        {!q.trim() &&
          (recent.length ? (
            <section>
              <h3 className="section-title">{t('add.recent')}</h3>
              <ul className="list card">
                {recent.slice(0, 30).map(({ entry: logged }) => {
                  const entry = recentAmount(logged);
                  return (
                  <li key={entry.foodId}>
                    <button
                      className="row"
                      onClick={() =>
                        push(
                          logPath(date, meal, entry.foodId, {
                            n: entry.unitLabel && entry.quantity != null ? entry.quantity : entry.grams,
                            u: entry.unitLabel && entry.quantity != null ? entry.unitLabel : 'g',
                          }),
                        )
                      }
                    >
                      <span className="row-main">
                        <span className="row-title">{entryTitle(entry)}</span>
                        <span className="row-sub">
                          {entry.brand ? `${entry.brand} · ` : ''}
                          {amountLabel(entry)}
                        </span>
                      </span>
                      <span className="row-value">
                        {fmt((entry.per100.kcal * entry.grams) / 100)}
                        <small> kcal</small>
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p className="empty">{table ? t('add.emptyCount', { count: fmt(table.foods.length) }) : t('add.empty')}</p>
          ))}

        {q.trim() && (
          <SearchResults
            q={q}
            results={results}
            tableLoaded={!!table}
            onPickFood={(food) => push(logPath(date, meal, food.id))}
            onPickStore={pickStoreResult}
            allowPartial
          />
        )}
      </main>
    </>
  );
}
