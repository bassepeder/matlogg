import { useState } from 'react';
import { useSettings } from '../lib/hooks';
import { t } from '../lib/i18n';
import { vetduatProxyUrl, type LookupResult } from '../lib/lookup';
import { useStoreSearch, withoutSaved, type RemoteSource, type SourceView } from '../lib/storeSearch';
import type { Food } from '../lib/types';
import { FoodRow, Thumb } from './FoodRow';

type GroupId = 'mine' | 'mvt' | RemoteSource;
type Filter = 'all' | GroupId;

// In "All", each group shows its best few hits with a link to see the rest under that filter.
const PREVIEW = 5;

interface Group {
  id: GroupId;
  title: string;
  chip: string;
  status: 'loading' | 'done' | 'error' | 'off';
  error?: string;
  soft?: boolean;
  count: number;
}

interface Props {
  q: string;
  /** Local hits (your foods and Matvaretabellen), already ranked. */
  results: Food[];
  tableLoaded: boolean;
  onPickFood: (food: Food) => void;
  onPickStore: (result: LookupResult) => void;
  /** Whether products without nutrition can be picked (to fill in from the label). */
  allowPartial: boolean;
}

function remoteStatus(view: SourceView): Pick<Group, 'status' | 'error' | 'soft'> {
  if (view.status === 'error') return { status: 'error', error: view.error, soft: view.soft };
  if (view.status === 'loading') return { status: 'loading' };
  if (view.status === 'done') return { status: 'done' };
  return { status: 'off' };
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="list card skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="row">
          <span className="sk sk-thumb" />
          <span className="row-main">
            <span className="sk sk-line" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <span className="sk sk-line short" />
          </span>
          <span className="sk sk-value" />
        </li>
      ))}
    </ul>
  );
}

export function SearchResults({ q, results, tableLoaded, onPickFood, onPickStore, allowPartial }: Props) {
  const settings = useSettings();
  const hasProxy = !!vetduatProxyUrl(settings);
  const [filter, setFilter] = useState<Filter>('all');
  const wants = (id: GroupId) => filter === 'all' || filter === id;
  const store = useStoreSearch(q, settings, { vetduat: wants('vetduat'), off: wants('off') });

  const mine = results.filter((f) => f.source !== 'matvaretabellen');
  const mvt = results.filter((f) => f.source === 'matvaretabellen');
  const vetduat = withoutSaved(store.vetduat.status === 'done' ? store.vetduat.results : [], results);
  const vetduatFoods = vetduat.flatMap((r) => (r.food ? [r.food] : []));
  const off = withoutSaved(store.off.status === 'done' ? store.off.results : [], [...results, ...vetduatFoods]);

  const groups: Group[] = [
    { id: 'mine', title: t('search.mine'), chip: t('search.mineShort'), status: 'done', count: mine.length },
    { id: 'mvt', title: 'Matvaretabellen', chip: 'Matvaretabellen', status: tableLoaded ? 'done' : 'loading', count: mvt.length },
    ...(hasProxy
      ? [{ id: 'vetduat' as const, title: t('search.vetduat'), chip: 'VetDuAt', ...remoteStatus(store.vetduat), count: vetduat.length }]
      : []),
    { id: 'off', title: 'Open Food Facts', chip: 'Open Food Facts', ...remoteStatus(store.off), count: off.length },
  ];

  const shown = filter === 'all' ? groups : groups.filter((g) => g.id === filter);
  const anyBusy = shown.some((g) => g.status === 'loading' || g.status === 'error');
  const nothing = filter === 'all' && !anyBusy && groups.every((g) => g.count === 0);

  function items(id: GroupId, limit: number) {
    if (id === 'mine' || id === 'mvt') {
      const foods = id === 'mine' ? mine : mvt;
      const thumbs = foods.some((f) => f.image);
      return foods.slice(0, limit).map((f) => <FoodRow key={f.id} food={f} thumb={thumbs} onClick={() => onPickFood(f)} />);
    }
    return (id === 'vetduat' ? vetduat : off).slice(0, limit).map((r, i) =>
      r.food ? (
        <FoodRow key={r.food.id} food={r.food} thumb onClick={() => onPickStore(r)} />
      ) : (
        <li key={r.partial?.ean ?? i}>
          {allowPartial ? (
            <button className="row" onClick={() => onPickStore(r)}>
              <Thumb src={r.partial?.image} />
              <span className="row-main">
                <span className="row-title">{r.partial?.name}</span>
                <span className="row-sub">{[r.partial?.brand, t('add.noNutrition')].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ) : (
            <div className="row disabled">
              <Thumb src={r.partial?.image} />
              <span className="row-main">
                <span className="row-title">{r.partial?.name}</span>
                <span className="row-sub">{t('add.noNutrition')}</span>
              </span>
            </div>
          )}
        </li>
      ),
    );
  }

  return (
    <section className="search-results">
      <div className="source-filter" role="radiogroup" aria-label={t('search.filterAria')}>
        {[{ id: 'all' as const, chip: t('search.all') }, ...groups].map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={filter === c.id}
            className={`chip${filter === c.id ? ' on' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.chip}
            {'status' in c && c.status === 'loading' && <span className="chip-dot" aria-hidden="true" />}
            {'status' in c && c.status === 'done' && c.count > 0 && <span className="chip-count">{c.count}</span>}
          </button>
        ))}
      </div>

      {shown.map((g) => {
        if (g.status === 'off') return null;
        if (g.status === 'done' && g.count === 0 && filter === 'all') return null;
        const limit = filter === 'all' ? PREVIEW : Infinity;
        return (
          <div key={g.id} className="result-group">
            <div className="group-head">
              <h3 className="section-title">{g.title}</h3>
              {g.status === 'done' && g.count > 0 && <span className="group-count">{g.count}</span>}
            </div>
            {g.status === 'loading' && (
              <>
                <p className="sr-only" role="status">
                  {t('search.searchingIn', { source: g.title })}
                </p>
                <SkeletonRows rows={g.id === 'mvt' ? 4 : 3} />
              </>
            )}
            {g.status === 'error' && (
              <div className={`notice group-error${g.soft ? '' : ' error'}`}>
                <span>{g.error}</span>
                <button className="link" onClick={() => store.retry(g.id as RemoteSource)}>
                  {t('search.retry')}
                </button>
              </div>
            )}
            {g.status === 'done' && g.count === 0 && <p className="empty">{t('search.noMatches')}</p>}
            {g.status === 'done' && g.count > 0 && (
              <ul className={`list card${g.id === 'vetduat' || g.id === 'off' ? ' rise-in' : ''}`}>
                {items(g.id, limit)}
                {g.count > limit && (
                  <li>
                    <button className="show-all" onClick={() => setFilter(g.id)}>
                      {t('search.showAll', { count: g.count })}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}

      {nothing && <p className="empty">{t('search.noMatchesAnywhere')}</p>}
      {filter === 'all' && !hasProxy && <p className="hint">{t('add.keyHint')}</p>}
    </section>
  );
}
