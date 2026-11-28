import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BodyChart, rangeStart, RANGES, type Range } from '../components/BodyChart';
import { Icon } from '../components/Icon';
import { BottomNav, MealPicker } from '../components/Layout';
import { SwipeRow } from '../components/SwipeRow';
import {
  bmi,
  estimateMaintenance,
  fmtDelta,
  fmtMetric,
  goalProgress,
  hasValue,
  inRange,
  latestValues,
  MEASURES,
  metricLabel,
  METRIC_UNIT,
  METRICS,
  relativeDay,
  shortDate,
  weeklyChangeAt,
  weeklyRate,
  weightTrend,
  withUnit,
  type BodyEntry,
  type BodyMetric,
  type TrendPoint,
} from '../lib/body';
import { addDays, dayLabel, fromISODate } from '../lib/dates';
import { db, DEFAULT_SETTINGS, saveSettings } from '../lib/db';
import { useSettingsState, useToday } from '../lib/hooks';
import { locale, t } from '../lib/i18n';
import { entryNutrients, fmt, fmtKcal, parseNum, resolveGoals, toInput } from '../lib/nutrition';
import { push } from '../lib/router';
import type { BodySettings } from '../lib/types';

const HISTORY_SHOWN = 10;

// Small per-device preferences: which chart the user last looked at.
function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
  }
  return fallback;
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
}

function longDate(iso: string, today: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (iso.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric';
  return new Intl.DateTimeFormat(locale(), opts).format(fromISODate(iso));
}

function historyLabel(iso: string, today: string): string {
  if (iso.slice(0, 4) === today.slice(0, 4)) return capitalize(dayLabel(iso, today));
  return capitalize(new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(fromISODate(iso)));
}

const kg = (v: number) => withUnit('weight', fmtMetric('weight', v));

export function BodyView() {
  const today = useToday();
  const settings = useSettingsState();
  const entries = useLiveQuery(() => db.body.orderBy('date').toArray(), []);
  const foodFrom = addDays(today, -35);
  const food = useLiveQuery(() => db.entries.where('date').between(foodFrom, today, true, true).toArray(), [foodFrom]);
  const kcalByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of food ?? []) map.set(e.date, (map.get(e.date) ?? 0) + entryNutrients(e).kcal);
    return map;
  }, [food]);
  const series = useMemo(() => weightTrend(entries ?? []), [entries]);
  const body = settings?.body ?? {};
  const goals = resolveGoals((settings ?? DEFAULT_SETTINGS).goals);

  const [goalOpen, setGoalOpen] = useState(false);
  const [metric, setMetricState] = useState<BodyMetric>(() => stored('matlogg.bodyMetric', METRICS, 'weight'));
  const [range, setRangeState] = useState<Range>(() => stored('matlogg.bodyRange', RANGES, '3m'));
  const chartRef = useRef<HTMLElement>(null);
  const setMetric = (m: BodyMetric) => {
    setMetricState(m);
    store('matlogg.bodyMetric', m);
  };
  const setRange = (r: Range) => {
    setRangeState(r);
    store('matlogg.bodyRange', r);
  };

  const [undo, setUndo] = useState<BodyEntry | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(timer);
  }, [undo]);

  async function remove(e: BodyEntry) {
    await db.body.delete(e.date);
    setUndo(e);
  }

  async function restore() {
    if (!undo) return;
    await db.body.put(undo);
    setUndo(null);
  }

  const list = entries ?? [];
  const loaded = entries !== undefined && settings !== undefined && food !== undefined;
  const available = METRICS.filter((m) => list.some((e) => hasValue(e, m)));
  const shownMetric = available.includes(metric) ? metric : (available[0] ?? 'weight');

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">{t('body.title')}</div>
        <div className="topbar-right">
          <button className="icon-btn" aria-label={t('body.goalButton')} onClick={() => setGoalOpen(true)}>
            <Icon name="flag" />
          </button>
        </div>
      </header>

      <main className="page with-nav" style={loaded ? undefined : { visibility: 'hidden' }}>
        {list.length === 0 ? (
          <EmptyCard />
        ) : (
          <>
            {series.length > 0 ? <TrendCard series={series} body={body} today={today} onGoal={() => setGoalOpen(true)} /> : <EmptyCard compact />}
            <section className="card body-chart" ref={chartRef}>
              <ChartPanel
                key={`${shownMetric}-${range}`}
                entries={list}
                series={series}
                metric={shownMetric}
                range={range}
                today={today}
                goal={shownMetric === 'weight' ? body.goalWeight : undefined}
              />
              {available.length > 1 && (
                <div className="source-filter" role="radiogroup" aria-label={t('body.metricAria')}>
                  {available.map((m) => (
                    <button key={m} role="radio" aria-checked={m === shownMetric} className={`chip${m === shownMetric ? ' on' : ''}`} onClick={() => setMetric(m)}>
                      {metricLabel(m)}
                    </button>
                  ))}
                </div>
              )}
              <MealPicker label={t('body.rangeAria')} value={range} onChange={setRange} options={RANGES.map((r) => ({ id: r, label: t(`body.range.${r}`) }))} />
            </section>
            <MaintenanceCard series={series} kcalByDay={kcalByDay} today={today} goalKcal={goals.kcal} />
            <MeasuresCard
              entries={list}
              series={series}
              height={body.height}
              today={today}
              onPick={(m) => {
                setMetric(m);
                chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
            <History entries={list} today={today} onDelete={remove} />
          </>
        )}
      </main>

      {undo && (
        <div className="snackbar" role="status">
          <span>{t('body.deleted', { date: shortDate(undo.date, today) })}</span>
          <button onClick={restore}>{t('diary.undo')}</button>
        </div>
      )}

      <button className="fab" aria-label={t('body.log')} onClick={() => push('/body/log')}>
        <Icon name="plus" size={28} />
      </button>
      <BottomNav active="body" />

      {goalOpen && <GoalSheet body={body} trend={series[series.length - 1]?.trend} onClose={() => setGoalOpen(false)} />}
    </>
  );
}

function EmptyCard({ compact }: { compact?: boolean }) {
  return (
    <section className={`card body-empty${compact ? ' compact' : ''}`}>
      {!compact && (
        <div className="body-empty-art" aria-hidden="true">
          <Icon name="body" size={34} />
        </div>
      )}
      <h2>{t('body.emptyTitle')}</h2>
      <p>{t('body.emptyText')}</p>
      {!compact && <p className="hint">{t('body.emptyTip')}</p>}
      <button className="btn primary" onClick={() => push('/body/log')}>
        <Icon name="plus" size={18} /> {t('body.logFirst')}
      </button>
    </section>
  );
}

function TrendCard({ series, body, today, onGoal }: { series: TrendPoint[]; body: BodySettings; today: string; onGoal: () => void }) {
  const last = series[series.length - 1];
  const rate = weeklyRate(series);
  const goal = body.goalWeight;
  const start = body.goalStart ?? series[0].trend;
  const progress = goal != null ? goalProgress(last.trend, goal, start, rate, today) : null;
  const dir = goal != null ? Math.sign(goal - start) || Math.sign(goal - last.trend) : 0;
  const towardGoal = rate != null && dir !== 0 && rate * dir > 0.02;

  return (
    <section className="card body-trend" aria-label={t('body.trendAria')}>
      <div className="summary-kcal">
        <div>
          <div className="big-number">
            {fmtMetric('weight', last.trend)}
            <span className="unit"> kg</span>
          </div>
          <div className="muted">{t('body.trend')}</div>
        </div>
        <div className="summary-side muted">
          <div>
            <strong>{kg(last.weight!)}</strong> {t('body.lastWeighIn', { when: relativeDay(last.date, today) })}
          </div>
          {rate != null && (
            <div>
              {Math.abs(rate) < 0.05 ? (
                <strong>{t('body.steady')}</strong>
              ) : (
                <>
                  <strong className={towardGoal ? 'toward-goal' : undefined}>{kg(rate).replace(fmtMetric('weight', rate), fmtDelta('weight', rate))}</strong>{' '}
                  {t('body.perWeek')}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {progress ? (
        <div className="goal-progress">
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}>
            <div style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <div className="goal-ends muted">
            <span>{t('body.start', { value: kg(progress.start) })}</span>
            <span>{t('body.goal', { value: kg(progress.goal) })}</span>
          </div>
          <p className="goal-line">
            {progress.reached ? (
              <strong className="toward-goal">✓ {t('body.goalReached')}</strong>
            ) : (
              <>
                <strong>{t('body.toGo', { value: kg(progress.left) })}</strong>
                {progress.eta ? (
                  <span className="muted"> · {t('body.eta', { date: longDate(progress.eta, today) })}</span>
                ) : rate != null ? (
                  <span className="muted"> · {t('body.noEta')}</span>
                ) : null}
              </>
            )}
          </p>
        </div>
      ) : (
        <button className="add-link inset" onClick={onGoal}>
          <Icon name="flag" size={18} /> {t('body.setGoal')}
        </button>
      )}
      {rate == null && <p className="hint">{t('body.rateSoon')}</p>}
    </section>
  );
}

function ChartPanel({
  entries,
  series,
  metric,
  range,
  today,
  goal,
}: {
  entries: BodyEntry[];
  series: TrendPoint[];
  metric: BodyMetric;
  range: Range;
  today: string;
  goal?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const withMetric = entries.filter((e) => hasValue(e, metric));
  const from = rangeStart(range, today, withMetric[0]?.date);
  const points = withMetric.filter((e) => e.date >= from).map((e) => ({ date: e.date, value: e[metric]! }));
  const trend = metric === 'weight' ? series.filter((p) => p.date >= from).map((p) => ({ date: p.date, value: p.trend })) : undefined;
  const unit = METRIC_UNIT[metric];

  // What the numbers above the chart say: the picked day, or else where things stand and how
  // they changed over the period.
  const line = trend ?? points;
  let big: number | undefined;
  let sub = '';
  if (active != null && points[active]) {
    const p = points[active];
    big = p.value;
    const tr = trend?.find((x) => x.date === p.date);
    sub = [capitalize(dayLabel(p.date, today)), tr ? t('body.trendValue', { value: withUnit(metric, fmtMetric(metric, tr.value)) }) : ''].filter(Boolean).join(' · ');
  } else if (line.length) {
    big = line[line.length - 1].value;
    sub =
      line.length > 1
        ? t('body.since', { delta: withUnit(metric, fmtDelta(metric, big - line[0].value)), date: shortDate(line[0].date, today) })
        : relativeDay(line[0].date, today);
  }

  return (
    <>
      <div className="chart-readout" aria-live="polite">
        <span className="chart-metric">{metricLabel(metric)}</span>
        {big != null ? (
          <strong>
            {fmtMetric(metric, big)} <small>{unit}</small>
          </strong>
        ) : (
          <strong>–</strong>
        )}
        <span className="muted">{sub || ' '}</span>
      </div>
      {points.length ? (
        <BodyChart
          points={points}
          trend={trend}
          goal={goal}
          goalLabel={goal != null ? t('body.goalLine', { value: fmtMetric('weight', goal) }) : undefined}
          from={from}
          to={today}
          label={t('body.chartAria', { metric: metricLabel(metric).toLocaleLowerCase(locale()), from: shortDate(from, today), to: shortDate(today, today) })}
          active={active}
          onActive={setActive}
        />
      ) : (
        <p className="chart-empty">{t('body.noneInRange')}</p>
      )}
    </>
  );
}

function MaintenanceCard({ series, kcalByDay, today, goalKcal }: { series: TrendPoint[]; kcalByDay: Map<string, number>; today: string; goalKcal: number }) {
  const m = estimateMaintenance(series, kcalByDay, today);
  let goalLine = '';
  if (m) {
    const change = weeklyChangeAt(goalKcal, m.kcal);
    const vars = { goal: fmtKcal(goalKcal), kg: fmtMetric('weight', Math.abs(change)) };
    goalLine = Math.abs(change) < 0.05 ? t('body.maintHold', vars) : change < 0 ? t('body.maintLose', vars) : t('body.maintGain', vars);
  }
  return (
    <section className="card body-maint">
      <h3 className="section-title inline">{t('body.maintTitle')}</h3>
      {m ? (
        <>
          <div className="maint-number">
            <span className="big-number">≈ {fmtKcal(m.kcal)}</span>
            <span className="muted">{t('body.maintValue')}</span>
          </div>
          <p className="maint-goal">{goalLine}</p>
          <p className="hint">
            {t('body.maintHint', { days: m.days, intake: fmtKcal(m.intake), logged: m.logged, change: fmtDelta('weight', m.weekly) })}
          </p>
        </>
      ) : (
        <p className="hint">{t('body.maintEmpty')}</p>
      )}
    </section>
  );
}

function MeasuresCard({
  entries,
  series,
  height,
  today,
  onPick,
}: {
  entries: BodyEntry[];
  series: TrendPoint[];
  height?: number;
  today: string;
  onPick: (m: BodyMetric) => void;
}) {
  const latest = latestValues(entries);
  const rows = MEASURES.filter((m) => latest.has(m));
  const weight = series[series.length - 1]?.trend;
  const waist = latest.get('waist')?.last.waist;
  const ratio = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const oneDecimal = new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const derived = [
    height && weight ? { key: 'bmi', title: t('body.bmi'), sub: t('body.bmiSub', { cm: fmt(height) }), value: oneDecimal.format(bmi(weight, height)) } : null,
    height && waist ? { key: 'whtr', title: t('body.whtr'), sub: t('body.whtrSub'), value: ratio.format(waist / height) } : null,
  ].filter((d) => d != null);
  if (!rows.length && !derived.length) return null;

  return (
    <>
      <h3 className="section-title">{t('body.measures')}</h3>
      <ul className="list card">
        {rows.map((m) => {
          const { first, last, count } = latest.get(m)!;
          return (
            <li key={m}>
              <button className="row" onClick={() => onPick(m)}>
                <span className="row-main">
                  <span className="row-title">{metricLabel(m)}</span>
                  <span className="row-sub">
                    {count > 1
                      ? t('body.since', { delta: withUnit(m, fmtDelta(m, last[m]! - first[m]!)), date: shortDate(first.date, today) })
                      : t('body.measuredOn', { date: shortDate(last.date, today) })}
                  </span>
                </span>
                <span className="row-value">
                  {fmtMetric(m, last[m]!)}
                  <small> {METRIC_UNIT[m]}</small>
                </span>
              </button>
            </li>
          );
        })}
        {derived.map((d) => (
          <li key={d.key}>
            <div className="row">
              <span className="row-main">
                <span className="row-title">{d.title}</span>
                <span className="row-sub">{d.sub}</span>
              </span>
              <span className="row-value">{d.value}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function History({ entries, today, onDelete }: { entries: BodyEntry[]; today: string; onDelete: (e: BodyEntry) => void }) {
  const [all, setAll] = useState(false);
  // Change since the weigh-in before, worked out oldest first in one pass.
  const deltas = useMemo(() => {
    const map = new Map<string, number>();
    let prev: number | undefined;
    for (const e of entries) {
      if (!hasValue(e, 'weight')) continue;
      if (prev != null) map.set(e.date, e.weight! - prev);
      prev = e.weight;
    }
    return map;
  }, [entries]);
  const newest = [...entries].reverse();
  const shown = all ? newest : newest.slice(0, HISTORY_SHOWN);

  return (
    <>
      <h3 className="section-title">{t('body.history')}</h3>
      <ul className="list card">
        {shown.map((e) => {
          const measures = MEASURES.filter((m) => hasValue(e, m)).map((m) => `${metricLabel(m)} ${withUnit(m, fmtMetric(m, e[m]!))}`);
          const sub = [measures.join(' · '), e.note].filter(Boolean).join(' – ');
          const delta = deltas.get(e.date);
          return (
            <SwipeRow key={e.date} deleteLabel={t('diary.delete')} onDelete={() => onDelete(e)}>
              <button className="row" onClick={() => push(`/body/log/${e.date}`)}>
                <span className="row-main">
                  <span className="row-title">{historyLabel(e.date, today)}</span>
                  {sub && <span className="row-sub">{sub}</span>}
                </span>
                <span className="row-value">
                  {hasValue(e, 'weight') ? (
                    <>
                      {fmtMetric('weight', e.weight!)}
                      <small> kg</small>
                      {delta != null && <span className="body-delta">{fmtDelta('weight', delta)}</span>}
                    </>
                  ) : (
                    <small>{t('body.onlyMeasures')}</small>
                  )}
                </span>
              </button>
            </SwipeRow>
          );
        })}
      </ul>
      {!all && newest.length > HISTORY_SHOWN && (
        <button className="add-link" onClick={() => setAll(true)}>
          {t('body.showAll', { n: newest.length })}
        </button>
      )}
    </>
  );
}

function GoalSheet({ body, trend, onClose }: { body: BodySettings; trend?: number; onClose: () => void }) {
  const [goal, setGoal] = useState(toInput(body.goalWeight));
  const [height, setHeight] = useState(toInput(body.height));
  const g = parseNum(goal);
  const h = parseNum(height);
  const bad = g != null && !inRange('weight', g) ? metricLabel('weight') : h != null && (h < 100 || h > 250) ? t('body.height') : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (bad) return;
    const changed = g !== body.goalWeight;
    await saveSettings({
      body: {
        ...body,
        goalWeight: g,
        // The bar starts where you are when you set (or change) the goal.
        goalStart: g == null ? undefined : changed || body.goalStart == null ? trend : body.goalStart,
        height: h,
      },
    });
    onClose();
  }

  async function removeGoal() {
    await saveSettings({ body: { ...body, goalWeight: undefined, goalStart: undefined } });
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form body-sheet" role="dialog" aria-label={t('body.goalTitle')} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 className="sheet-title">{t('body.goalTitle')}</h2>
        <label>
          <span className="field-label">{t('body.goalWeight')}</span>
          <input className="input" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={trend ? toInput(Math.round(trend)) : ''} autoFocus />
        </label>
        <p className="hint">{t('body.goalHint')}</p>
        <label>
          <span className="field-label">{t('body.height')}</span>
          <input className="input" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <p className="hint">{t('body.heightHint')}</p>
        {bad && <p className="notice error">{t('body.errRange', { metric: bad })}</p>}
        <div className="button-row">
          <button type="submit" className="btn primary" disabled={!!bad}>
            {t('common.save')}
          </button>
          <button type="button" className="btn secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {body.goalWeight != null && (
            <button type="button" className="btn danger-text" onClick={removeGoal}>
              {t('body.removeGoal')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
