import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { FoodRow } from '../components/FoodRow';
import { Icon } from '../components/Icon';
import { BottomNav } from '../components/Layout';
import { db } from '../lib/db';
import { t } from '../lib/i18n';
import { push } from '../lib/router';
import { buildIndex, searchFoods } from '../lib/search';
import type { Food } from '../lib/types';

const EMPTY: Food[] = [];

export function MyFoodsView() {
  const foods = useLiveQuery(() => db.foods.toArray(), [], EMPTY);
  const [q, setQ] = useState('');
  const index = useMemo(() => buildIndex(foods), [foods]);
  const shown = useMemo(
    () => (q.trim() ? searchFoods(index, q, { limit: 500 }) : [...foods].sort((a, b) => a.name.localeCompare(b.name, 'nb'))),
    [q, index, foods],
  );
  // Show product images, but skip the empty gutter when none of the listed foods has one.
  const withImages = shown.some((f) => f.image);

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">{t('foods.title')}</div>
      </header>
      <main className="page with-nav">
        <p className="hint">{t('foods.hint')}</p>
        <div className="quick-actions two">
          <button onClick={() => push('/food/new')}>
            <Icon name="edit" /> {t('foods.new')}
          </button>
          <button onClick={() => push('/recipe/new')}>
            <Icon name="recipe" /> {t('recipe.new')}
          </button>
        </div>
        {foods.length > 0 && (
          <div className="search-box">
            <Icon name="search" size={18} />
            <input type="search" placeholder={t('foods.filter')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('foods.filter')} />
          </div>
        )}
        {shown.length ? (
          <ul className="list card">
            {shown.map((f) => (
              <FoodRow key={f.id} food={f} thumb={withImages} onClick={() => push(`/food/${encodeURIComponent(f.id)}`)} />
            ))}
          </ul>
        ) : (
          <p className="empty">{foods.length ? t('foods.noMatches') : t('foods.empty')}</p>
        )}
      </main>
      <BottomNav active="foods" />
    </>
  );
}
