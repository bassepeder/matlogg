import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../components/Icon';
import { BottomNav } from '../components/Layout';
import { Bar } from '../components/Summary';
import { addDays, dayLabel, fromISODate, weekdayNames } from '../lib/dates';
import { db, DEFAULT_SETTINGS } from '../lib/db';
import { useSettingsState, useToday } from '../lib/hooks';
import { locale, t } from '../lib/i18n';
import { fmt, fmtKcal, resolveGoals } from '../lib/nutrition';
import { push, replace } from '../lib/router';
import { isoWeek, weekDays, weekStart, weekStats, type DayStats } from '../lib/week';

// A day counts as over the goal at the same 2% margin the diary and calendar use.
const isOver = (kcal: number, goal: number) => goal > 0 && kcal > goal * 1.02;

// Heights of the bar area and the day labels under it; must match .week-bar-area and .week-day.
const PLOT_H = 150;
const LABEL_H = 34;

export function WeekView({ date }: { date: string }) {
  const today = useToday();
  const settings = useSettingsState();
  const goals = resolveGoals((settings ?? DEFAULT_SETTINGS).goals);
  const start = weekStart(date);
  const days = weekDays(start);
  const entries = useLiveQuery(() => db.entries.where('date').between(days[0], days[6], true, true).toArray(), [start]);
  const stats = weekStats(entries ?? [], start, today);
  const isCurrent = start === weekStart(today);

  const range = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).formatRange(fromISODate(days[0]), fromISODate(days[6]));
  const go = (weeks: number) => {
    const next = addDays(start, weeks * 7);
    replace(next === weekStart(today) ? '/week' : `/week/${next}`);
  };

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label={t('week.prev')} onClick={() => go(-1)}>
          <Icon name="prev" />
        </button>
        <div className="topbar-title week-title">
          {isCurrent ? t('week.this') : t('week.number', { n: isoWeek(start) })}
          <small>{range}</small>
        </div>
        <button className="icon-btn" aria-label={t('week.next')} onClick={() => go(1)} disabled={isCurrent}>
          <Icon name="next" />
        </button>
      </header>

      <main className="page with-nav" style={entries && settings ? undefined : { visibility: 'hidden' }}>
        <AverageCard stats={stats} goals={goals} past={!stats.days.some((d) => d.open)} />
        <WeekChart days={stats.days} goal={goals.kcal} />
        <DayList days={stats.days} goal={goals.kcal} />
      </main>
      <BottomNav active="week" />
    </>
  );
}

function AverageCard({ stats, goals, past }: { stats: ReturnType<typeof weekStats>; goals: ReturnType<typeof resolveGoals>; past: boolean }) {
  const avg = stats.average;
  if (!avg) {
    return (
      <section className="card week-average">
        <p className="empty">{past ? t('week.emptyWeek') : t('week.noAverage')}</p>
      </section>
    );
  }
  const diff = Math.round(avg.kcal - goals.kcal);
  const macros = [
    { key: 'protein', label: t('macro.protein'), value: avg.protein, goal: goals.protein },
    { key: 'carbs', label: t('macro.carbs'), value: avg.carbs, goal: goals.carbs },
    { key: 'fat', label: t('macro.fat'), value: avg.fat, goal: goals.fat },
  ];
  return (
    <section className="card summary week-average" aria-label={t('week.averageAria')}>
      <div className="summary-kcal">
        <div>
          <div className={`big-number${isOver(avg.kcal, goals.kcal) ? ' over' : ''}`}>{fmtKcal(avg.kcal)}</div>
          <div className="muted">{t('week.kcalPerDay')}</div>
        </div>
        <div className="summary-side muted">
          <div>
            <strong>{fmtKcal(Math.abs(diff))}</strong> {diff > 0 ? t('week.overGoal') : t('week.underGoal')}
          </div>
          <div>
            <strong>{fmtKcal(goals.kcal)}</strong> {t('summary.goal')}
          </div>
        </div>
      </div>
      <Bar value={avg.kcal} goal={goals.kcal} kind="kcal" />
      <div className="macros">
        {macros.map((m) => (
          <div key={m.key} className="macro">
            <div className="macro-head">
              <span>{m.label}</span>
              <span className="muted">
                {fmt(m.value)} / {fmt(m.goal)} g
              </span>
            </div>
            <Bar value={m.value} goal={m.goal} kind={m.key} />
          </div>
        ))}
      </div>
      <p className="hint">{t('week.averageHint', { n: stats.counted })}</p>
    </section>
  );
}

// Calories per day against the goal line. One series, so no legend: the title names it, and the
// list below is the table view with exact numbers.
function WeekChart({ days, goal }: { days: DayStats[]; goal: number }) {
  const max = Math.max(goal * 1.25, ...days.map((d) => d.totals.kcal), 1);
  const names = weekdayNames();
  return (
    <section className="card week-chart">
      <h3 className="section-title inline">{t('week.chartTitle')}</h3>
      <div className="week-plot" role="list">
        <div className="week-goal" style={{ bottom: `calc(${LABEL_H}px + ${(goal / max) * PLOT_H}px)` }} aria-hidden="true">
          <span>{t('week.goalLine', { kcal: fmtKcal(goal) })}</span>
        </div>
        {days.map((d, i) => {
          const kcal = d.totals.kcal;
          const over = isOver(kcal, goal);
          const label = `${dayLabel(d.iso)}: ${d.logged ? `${fmtKcal(kcal)} kcal${over ? `, ${t('cal.over').toLocaleLowerCase(locale())}` : ''}` : t('week.nothing')}`;
          return (
            <button
              key={d.iso}
              role="listitem"
              className={`week-col${d.open ? ' open' : ''}`}
              onClick={() => push(`/day/${d.iso}`)}
              aria-label={label}
            >
              <span className="week-bar-area">
                {d.logged && <span className={`week-bar${over ? ' over' : ''}`} style={{ height: `${(kcal / max) * 100}%` }} />}
                <span className="week-tip" aria-hidden="true">
                  {d.logged ? `${fmtKcal(kcal)} kcal` : '–'}
                </span>
              </span>
              <span className="week-day" aria-hidden="true">
                {names[i]}
                <small>{fromISODate(d.iso).getDate()}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DayList({ days, goal }: { days: DayStats[]; goal: number }) {
  return (
    <ul className="list card">
      {days.map((d) => {
        const n = d.totals;
        const over = d.logged && isOver(n.kcal, goal);
        return (
          <li key={d.iso}>
            <button className="row" onClick={() => push(`/day/${d.iso}`)}>
              <span className="row-main">
                <span className="row-title">{capitalize(dayLabel(d.iso))}</span>
                <span className="row-sub">
                  {d.logged
                    ? `${fmt(n.protein)} g ${t('macro.proteinShort')} · ${fmt(n.carbs)} g ${t('macro.carbsShort')} · ${fmt(n.fat)} g ${t('macro.fatShort')}`
                    : t('week.nothing')}
                </span>
              </span>
              {d.logged && (
                <span className="row-value">
                  {fmtKcal(n.kcal)}
                  <small> kcal</small>
                  {over && <span className="week-over-tag">{t('cal.over')}</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
}
