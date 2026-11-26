import { useMemo, useState } from 'react';
import { NutrientGrid, TopBar } from '../components/Layout';
import { t } from '../lib/i18n';
import { replace } from '../lib/router';
import { decodeFood, saveSharedFood } from '../lib/share';
import type { Food } from '../lib/types';
import { per100Values } from './LogView';

export function ImportView({ data }: { data: string }) {
  const food = useMemo(() => decodeFood(data), [data]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!food) return;
    setSaving(true);
    const saved = await saveSharedFood(food);
    replace(`/food/${encodeURIComponent(saved.id)}`);
  }

  return (
    <>
      <TopBar title={t('import.title')} onBack={() => replace('/')} />
      <main className="page with-action">
        {food ? (
          <>
            <p className="notice">{t('import.intro')}</p>
            <section className="food-head">
              <div>
                <h1>{food.name}</h1>
                {food.brand && <p className="muted">{food.brand}</p>}
              </div>
            </section>
            <section className="card">
              <h3 className="section-title inline">{t('log.per100')}</h3>
              <NutrientGrid values={per100Values({ ...food, id: '' } as Food)} />
            </section>
          </>
        ) : (
          <p className="notice error">{t('import.invalid')}</p>
        )}
      </main>
      {food && (
        <div className="action-bar">
          <button className="btn primary wide" disabled={saving} onClick={save}>
            {t('import.save')}
          </button>
        </div>
      )}
    </>
  );
}
