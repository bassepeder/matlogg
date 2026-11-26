import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { fromISODate, monthGrid, monthTitle, todayISO, weekdayNames } from '../lib/dates';
import { db } from '../lib/db';
import { t } from '../lib/i18n';
import { entryNutrients } from '../lib/nutrition';
import { Icon } from './Icon';

export function Calendar({
  date,
  kcalGoal,
  onPick,
  onClose,
}: {
  date: string;
  kcalGoal: number;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const start = fromISODate(date);
  const [view, setView] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);
  const first = cells[0].iso;
  const last = cells[cells.length - 1].iso;
  const today = todayISO();

  const kcalByDay = useLiveQuery(async () => {
    const entries = await db.entries.where('date').between(first, last, true, true).toArray();
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + entryNutrients(e).kcal);
    return map;
  }, [first, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shift = (delta: number) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet calendar" role="dialog" aria-label={t('cal.open')} onClick={(e) => e.stopPropagation()}>
        <div className="calendar-head">
          <button className="icon-btn" aria-label={t('cal.prevMonth')} onClick={() => shift(-1)}>
            <Icon name="prev" />
          </button>
          <strong>{monthTitle(view.year, view.month)}</strong>
          <button className="icon-btn" aria-label={t('cal.nextMonth')} onClick={() => shift(1)}>
            <Icon name="next" />
          </button>
        </div>

        <div className="calendar-grid" role="grid">
          {weekdayNames().map((w, i) => (
            <div key={i} className="calendar-weekday" aria-hidden="true">
              {w}
            </div>
          ))}
          {cells.map(({ iso, inMonth }) => {
            const kcal = kcalByDay?.get(iso);
            const status = kcal == null || kcal <= 0 ? '' : kcal > kcalGoal * 1.02 ? 'over' : 'within';
            const cls = ['calendar-day', inMonth ? '' : 'outside', iso === date ? 'selected' : '', iso === today ? 'today' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <button key={iso} className={cls} onClick={() => onPick(iso)} aria-current={iso === date ? 'date' : undefined}>
                <span>{fromISODate(iso).getDate()}</span>
                <i className={`dot ${status}`} aria-label={status ? t(status === 'over' ? 'cal.over' : 'cal.within') : undefined} />
              </button>
            );
          })}
        </div>

        <div className="calendar-foot">
          <span className="legend">
            <i className="dot within" /> {t('cal.within')}
            <i className="dot over" /> {t('cal.over')}
          </span>
          <button className="btn secondary" onClick={() => onPick(today)}>
            {t('day.today')}
          </button>
        </div>
      </div>
    </div>
  );
}
