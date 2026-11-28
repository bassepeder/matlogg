import { addDays, fromISODate, todayISO } from './dates';
import { locale, t } from './i18n';

// Body weight and measurements. One record per day, keyed by date, so logging the same day
// again edits that day instead of adding a duplicate.
export const METRICS = ['weight', 'fat', 'waist', 'hips', 'chest', 'neck', 'arm', 'thigh'] as const;
export type BodyMetric = (typeof METRICS)[number];
export type Measure = Exclude<BodyMetric, 'weight'>;
export const MEASURES = METRICS.filter((m): m is Measure => m !== 'weight');

export type BodyEntry = { date: string; note?: string; updatedAt: number } & Partial<Record<BodyMetric, number>>;

export const METRIC_UNIT: Record<BodyMetric, 'kg' | '%' | 'cm'> = {
  weight: 'kg',
  fat: '%',
  waist: 'cm',
  hips: 'cm',
  chest: 'cm',
  neck: 'cm',
  arm: 'cm',
  thigh: 'cm',
};

// Anything outside these is a typo (a missing decimal point, kg typed as cm), not a body.
const METRIC_RANGE: Record<BodyMetric, [number, number]> = {
  weight: [20, 400],
  fat: [2, 75],
  waist: [30, 250],
  hips: [30, 250],
  chest: [30, 250],
  neck: [15, 80],
  arm: [10, 90],
  thigh: [20, 140],
};

export function inRange(metric: BodyMetric, value: number): boolean {
  const [min, max] = METRIC_RANGE[metric];
  return value >= min && value <= max;
}

export function metricLabel(m: BodyMetric): string {
  return t(`body.metric.${m}`);
}

export function hasValue(e: BodyEntry, m: BodyMetric): boolean {
  return typeof e[m] === 'number' && Number.isFinite(e[m]);
}

export function dayDiff(from: string, to: string): number {
  return Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);
}

const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// ---------- Trend ----------

/** Share of each day's weight that goes into the trend: about the last two weeks count. */
export const TREND_ALPHA = 0.1;

export interface TrendPoint {
  date: string;
  trend: number;
  /** The scale weight, on days with a weigh-in. */
  weight?: number;
}

// An exponentially smoothed moving average, one point per day from the first weigh-in to the
// last. Days without a weigh-in are filled in on a straight line between their neighbours, so
// weighing every day or twice a week gives the same trend. It starts from the average of the
// first week rather than the first weigh-in, so one odd first reading doesn't skew the first
// weeks (and with them the calorie estimate).
export function weightTrend(entries: BodyEntry[]): TrendPoint[] {
  const weighed = entries.filter((e) => hasValue(e, 'weight')).sort(byDate) as (BodyEntry & { weight: number })[];
  if (!weighed.length) return [];
  const firstWeek = weighed.filter((e) => dayDiff(weighed[0].date, e.date) < 7);
  let trend = firstWeek.reduce((s, e) => s + e.weight, 0) / firstWeek.length;
  const out: TrendPoint[] = [{ date: weighed[0].date, trend, weight: weighed[0].weight }];
  for (let i = 1; i < weighed.length; i++) {
    const prev = weighed[i - 1];
    const cur = weighed[i];
    const gap = dayDiff(prev.date, cur.date);
    for (let d = 1; d < gap; d++) {
      trend += TREND_ALPHA * (prev.weight + ((cur.weight - prev.weight) * d) / gap - trend);
      out.push({ date: addDays(prev.date, d), trend });
    }
    trend += TREND_ALPHA * (cur.weight - trend);
    out.push({ date: cur.date, trend, weight: cur.weight });
  }
  return out;
}

/** The trend on `date`, or at the last weigh-in before it. */
export function trendAt(series: TrendPoint[], date: string): number | undefined {
  if (!series.length || date < series[0].date) return undefined;
  const i = dayDiff(series[0].date, date);
  return series[Math.min(i, series.length - 1)].trend;
}

/** Change in kg per week over the last two weeks of the trend; null until it spans a week. */
export function weeklyRate(series: TrendPoint[]): number | null {
  if (series.length < 8) return null;
  const n = Math.min(14, series.length - 1);
  return ((series[series.length - 1].trend - series[series.length - 1 - n].trend) / n) * 7;
}

// ---------- Goal ----------

export interface GoalProgress {
  start: number;
  goal: number;
  /** 0 at the start weight, 1 at the goal. */
  fraction: number;
  /** kg still to go; 0 once reached. */
  left: number;
  reached: boolean;
  /** When the goal is reached at the current weekly rate, if that is within two years. */
  eta?: string;
}

export function goalProgress(current: number, goal: number, start: number, rate: number | null, today = todayISO()): GoalProgress {
  const dir = Math.sign(goal - start) || Math.sign(goal - current) || 1;
  const toGo = (goal - current) * dir;
  const reached = toGo <= 0.05;
  const fraction = reached ? 1 : goal === start ? 0 : Math.min(1, Math.max(0, (current - start) / (goal - start)));
  let eta: string | undefined;
  const pace = rate == null ? 0 : rate * dir;
  if (!reached && pace >= 0.05) {
    const days = Math.round((toGo / pace) * 7);
    if (days <= 730) eta = addDays(today, days);
  }
  return { start, goal, fraction, left: reached ? 0 : toGo, reached, eta };
}

// ---------- Maintenance calories ----------

/** Energy in a kilo of body weight change, the usual rule of thumb for fat tissue. */
export const KCAL_PER_KG = 7700;

export interface Maintenance {
  kcal: number;
  /** Average kcal per day on days with food logged. */
  intake: number;
  /** Trend change in kg per week over the window. */
  weekly: number;
  days: number;
  logged: number;
}

// What you burn, worked out from what you ate and what the scale did: eating 500 kcal a day
// over maintenance shows up as about 0.45 kg a week on the trend. Uses up to the last four
// finished weeks, and only once there are enough weigh-ins and logged days to mean something.
export function estimateMaintenance(series: TrendPoint[], kcalByDay: Map<string, number>, today = todayISO(), window = 28): Maintenance | null {
  if (!series.length) return null;
  const yesterday = addDays(today, -1);
  const last = series[series.length - 1].date;
  const end = last < yesterday ? last : yesterday;
  const first = addDays(end, -(window - 1));
  const start = first > series[0].date ? first : series[0].date;
  const days = dayDiff(start, end) + 1;
  if (days < 14) return null;

  const weighIns = series.filter((p) => p.weight != null && p.date >= start && p.date <= end).length;
  if (weighIns < 4) return null;

  let total = 0;
  let logged = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const kcal = kcalByDay.get(d) ?? 0;
    if (kcal > 0) {
      total += kcal;
      logged++;
    }
  }
  if (logged < Math.max(10, days * 0.6)) return null;

  const daily = (trendAt(series, end)! - trendAt(series, start)!) / (days - 1);
  const intake = total / logged;
  const kcal = intake - daily * KCAL_PER_KG;
  if (kcal < 800 || kcal > 6000) return null;
  return { kcal: Math.round(kcal / 10) * 10, intake, weekly: daily * 7, days, logged };
}

/** kg per week that eating `kcal` a day would give, against the maintenance estimate. */
export function weeklyChangeAt(kcal: number, maintenance: number): number {
  return ((kcal - maintenance) * 7) / KCAL_PER_KG;
}

// ---------- Derived ----------

export function bmi(weight: number, heightCm: number): number {
  return weight / (heightCm / 100) ** 2;
}

/** The latest value of each metric, and the first, for "since" changes. */
export function latestValues(entries: BodyEntry[]): Map<BodyMetric, { first: BodyEntry; last: BodyEntry; count: number }> {
  const out = new Map<BodyMetric, { first: BodyEntry; last: BodyEntry; count: number }>();
  for (const e of [...entries].sort(byDate)) {
    for (const m of METRICS) {
      if (!hasValue(e, m)) continue;
      const seen = out.get(m);
      if (seen) {
        seen.last = e;
        seen.count++;
      } else out.set(m, { first: e, last: e, count: 1 });
    }
  }
  return out;
}

/** The latest entry before `date` that has `metric`. */
export function previousValue(entries: BodyEntry[], date: string, metric: BodyMetric): BodyEntry | undefined {
  let best: BodyEntry | undefined;
  for (const e of entries) if (e.date < date && hasValue(e, metric) && (!best || e.date > best.date)) best = e;
  return best;
}

// Two devices' records for the same day: the one changed last wins.
export function mergeBody(local: BodyEntry[], incoming: BodyEntry[]): { put: BodyEntry[]; skipped: number } {
  const have = new Map(local.map((e) => [e.date, e]));
  const put: BodyEntry[] = [];
  for (const e of incoming) {
    const mine = have.get(e.date);
    if (!mine || (e.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
      put.push(e);
      have.set(e.date, e);
    }
  }
  return { put, skipped: incoming.length - put.length };
}

// ---------- Formatting ----------

const formatters = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number, signed = false): Intl.NumberFormat {
  const key = `${locale()}:${min}:${max}:${signed}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(), { minimumFractionDigits: min, maximumFractionDigits: max, signDisplay: signed ? 'exceptZero' : 'auto' });
    formatters.set(key, f);
  }
  return f;
}

/** Weight always with one decimal (82.0 kg), so a column of weights lines up; cm and % only when needed. */
export function fmtMetric(metric: BodyMetric, value: number): string {
  return metric === 'weight' ? nf(1, 1).format(value) : nf(0, 1).format(value);
}

export function fmtDelta(metric: BodyMetric, value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return metric === 'weight' ? nf(1, 1, true).format(rounded) : nf(0, 1, true).format(rounded);
}

export function withUnit(metric: BodyMetric, text: string): string {
  return METRIC_UNIT[metric] === '%' ? `${text} %` : `${text} ${METRIC_UNIT[metric]}`;
}

/** "26 Nov", with the year when it isn't this year. */
export function shortDate(iso: string, today = todayISO()): string {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale(), sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(
    fromISODate(iso),
  );
}

/** "today", "yesterday", "3 days ago", then the date. */
export function relativeDay(iso: string, today = todayISO()): string {
  const n = dayDiff(iso, today);
  if (n <= 0) return t('body.today');
  if (n === 1) return t('body.yesterday');
  if (n < 7) return t('body.daysAgo', { n });
  return shortDate(iso, today);
}
