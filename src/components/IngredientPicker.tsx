import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { findByBarcode } from '../lib/barcode';
import { db, recentFoods, type RecentFood } from '../lib/db';
import { useMatvaretabellen, useSettings } from '../lib/hooks';
import { portionLabel, t } from '../lib/i18n';
import { getFood } from '../lib/matvaretabellen';
import { fmt, fmtKcal, parseNum, scale, toInput } from '../lib/nutrition';
import { buildIndex, searchFoods } from '../lib/search';
import { SearchResults } from './SearchResults';
import type { Food, Ingredient } from '../lib/types';
import { defaultQuantity, isNutrientUnit, unitsFor } from '../lib/units';
import { BarcodeScanner } from './BarcodeScanner';
import { Icon } from './Icon';

const EMPTY_FOODS: Food[] = [];
const EMPTY_RECENT: RecentFood[] = [];

export function IngredientPicker({
  excludeId,
  editing,
  onDone,
  onRemove,
  onClose,
}: {
  excludeId?: string;
  editing?: Ingredient;
  onDone: (ingredient: Ingredient) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [food, setFood] = useState<Food | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const snapshot: Food = { id: editing.foodId, source: 'custom', name: editing.name, brand: editing.brand, per100: editing.per100 };
    getFood(editing.foodId).then(
      (f) => setFood(f ?? snapshot),
      () => setFood(snapshot),
    );
  }, [editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fullscreen-sheet" role="dialog" aria-label={editing ? t('ingredient.edit') : t('ingredient.add')}>
      <header className="topbar">
        <button
          className="icon-btn"
          aria-label={(food || scanning) && !editing ? t('common.back') : t('common.close')}
          onClick={food && !editing ? () => setFood(null) : scanning ? () => setScanning(false) : onClose}
        >
          <Icon name={(food || scanning) && !editing ? 'back' : 'close'} />
        </button>
        <div className="topbar-title">
          {editing ? t('ingredient.edit') : scanning && !food ? t('ingredient.scanTitle') : t('ingredient.add')}
        </div>
        <div />
      </header>
      {food ? (
        <AmountStep food={food} editing={editing} onDone={onDone} onRemove={onRemove} />
      ) : editing ? null : scanning ? (
        <ScanStep onFound={setFood} />
      ) : (
        <SearchStep excludeId={excludeId} onPick={setFood} onScan={() => setScanning(true)} />
      )}
    </div>
  );
}

function SearchStep({ excludeId, onPick, onScan }: { excludeId?: string; onPick: (f: Food) => void; onScan: () => void }) {
  const { table } = useMatvaretabellen();
  const myFoods = useLiveQuery(() => db.foods.toArray(), [], EMPTY_FOODS);
  const recent = useLiveQuery(() => recentFoods(), [], EMPTY_RECENT);
  const [q, setQ] = useState('');

  const mine = useMemo(() => myFoods.filter((f) => f.id !== excludeId), [myFoods, excludeId]);
  const index = useMemo(() => [...buildIndex(mine), ...(table ? buildIndex(table.foods) : [])], [mine, table]);
  const usage = useMemo(() => new Map(recent.map((r) => [r.entry.foodId, r.count])), [recent]);
  const results = useMemo(
    () =>
      q.trim()
        ? searchFoods(index, q, {
            boost: (f) => (f.source === 'matvaretabellen' ? 0 : 15) + Math.min((usage.get(f.id) ?? 0) * 5, 30),
          })
        : [],
    [q, index, usage],
  );

  const pickById = async (id: string) => {
    const f = await getFood(id);
    if (f) onPick(f);
  };

  async function pickStoreResult(food: Food) {
    const existing = await db.foods.get(food.id);
    if (!existing) await db.foods.put(food);
    onPick(existing ?? food);
  }


  return (
    <main className="page sheet-page">
      <div className="search-box">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder={t('add.search')}
          aria-label={t('add.search')}
          value={q}
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <button className="btn secondary wide" onClick={onScan}>
        <Icon name="scan" /> {t('scan.title')}
      </button>
      {q.trim() ? (
        <SearchResults
          q={q}
          results={results}
          tableLoaded={!!table}
          onPickFood={onPick}
          onPickStore={(r) => r.food && pickStoreResult(r.food)}
          allowPartial={false}
        />
      ) : (
        recent.length > 0 && (
          <section>
            <h3 className="section-title">{t('add.recent')}</h3>
            <ul className="list card">
              {recent
                .filter((r) => r.entry.foodId !== excludeId)
                .slice(0, 20)
                .map(({ entry }) => (
                  <li key={entry.foodId}>
                    <button className="row" onClick={() => pickById(entry.foodId)}>
                      <span className="row-main">
                        <span className="row-title">{entry.name}</span>
                        {entry.brand && <span className="row-sub">{entry.brand}</span>}
                      </span>
                      <span className="row-value">
                        {fmtKcal(entry.per100.kcal)}
                        <small> {t('unit.kcalPer100')}</small>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )
      )}
    </main>
  );
}

function ScanStep({ onFound }: { onFound: (f: Food) => void }) {
  const settings = useSettings();
  const [scanning, setScanning] = useState(true);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [manual, setManual] = useState('');

  async function handle(raw: string) {
    const code = raw.replace(/\D/g, '');
    if (code.length < 8) return;
    setScanning(false);
    setMessage({ text: t('scan.looking', { code }) });
    try {
      const result = await findByBarcode(code, settings.vetduatProxyUrl);
      if (result.food) return onFound(result.food);
      setMessage({ text: t('ingredient.notFound', { code }), error: true });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    handle(manual);
  }

  return (
    <main className="page sheet-page">
      <BarcodeScanner active={scanning} onDetect={handle} />
      {message && (
        <div className={`notice${message.error ? ' error' : ''}`}>
          <p>{message.text}</p>
          {message.error && (
            <button
              className="btn secondary"
              onClick={() => {
                setMessage(null);
                setScanning(true);
              }}
            >
              {t('scan.another')}
            </button>
          )}
        </div>
      )}
      <form className="manual-code" onSubmit={submit}>
        <label className="field-label" htmlFor="ing-ean">
          {t('scan.typeLabel')}
        </label>
        <div className="amount-row">
          <input
            id="ing-ean"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('scan.placeholder')}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={manual.replace(/\D/g, '').length < 8}>
            {t('scan.lookup')}
          </button>
        </div>
      </form>
      {!settings.vetduatProxyUrl && <p className="hint">{t('scan.offOnly')}</p>}
    </main>
  );
}

function AmountStep({
  food,
  editing,
  onDone,
  onRemove,
}: {
  food: Food;
  editing?: Ingredient;
  onDone: (ingredient: Ingredient) => void;
  onRemove?: () => void;
}) {
  const units = unitsFor(food);
  const startIdx = editing?.unitLabel ? units.findIndex((u) => u.label === editing.unitLabel) : 0;
  const [unitIdx, setUnitIdx] = useState(Math.max(0, startIdx));
  const [qty, setQty] = useState(
    editing ? toInput(startIdx > 0 && editing.quantity != null ? editing.quantity : editing.grams) : '100',
  );

  const unit = units[unitIdx] ?? units[0];
  const quantity = parseNum(qty);
  const grams = quantity != null && quantity > 0 ? quantity * unit.grams : 0;
  const amount = scale(food.per100, grams);

  function done() {
    if (grams <= 0) return;
    const isGrams = unit.label === 'g';
    onDone({
      foodId: food.id,
      name: food.name,
      brand: food.brand,
      grams,
      quantity: isGrams ? undefined : quantity,
      unitLabel: isGrams ? undefined : unit.label,
      unitGrams: isGrams ? undefined : unit.grams,
      per100: food.per100,
    });
  }

  return (
    <>
      <main className="page sheet-page with-action">
        <section className="food-head">
          <div>
            <h1>{food.name}</h1>
            {food.brand && <p className="muted">{food.brand}</p>}
          </div>
        </section>
        <section className="card">
          <label className="field-label" htmlFor="ing-qty">
            {t('log.amount')}
          </label>
          <div className="amount-row">
            <input
              id="ing-qty"
              className="input"
              inputMode="decimal"
              value={qty}
              autoFocus
              onChange={(e) => setQty(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => e.key === 'Enter' && done()}
              aria-label={t('log.quantity')}
            />
            <select
              className="input"
              value={unitIdx}
              aria-label={t('log.unit')}
              onChange={(e) => {
                const i = Number(e.target.value);
                setUnitIdx(i);
                setQty(defaultQuantity(units[i].label, grams, food));
              }}
            >
              {units.map((u, i) => (
                <option key={u.label} value={i}>
                  {u.label === 'g' ? t('unit.grams') : isNutrientUnit(u.label) ? portionLabel(u.label) : `${portionLabel(u.label)} (${fmt(u.grams)} g)`}
                </option>
              ))}
            </select>
          </div>
          {unit.label !== 'g' && <p className="hint">= {fmt(grams)} g</p>}
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
        {onRemove && (
          <button className="btn danger-text wide" onClick={onRemove}>
            {t('ingredient.remove')}
          </button>
        )}
      </main>
      <div className="action-bar">
        <button className="btn primary wide" disabled={grams <= 0} onClick={done}>
          {editing ? t('common.save') : t('ingredient.addButton', { grams: fmt(grams) })}
        </button>
      </div>
    </>
  );
}
