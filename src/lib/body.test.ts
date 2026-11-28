import { afterEach, describe, expect, it } from 'vitest';
import {
  bmi,
  estimateMaintenance,
  fmtDelta,
  fmtMetric,
  goalProgress,
  latestValues,
  previousValue,
  relativeDay,
  trendAt,
  weeklyChangeAt,
  weeklyRate,
  weightTrend,
  type BodyEntry,
} from './body';
import { addDays } from './dates';
import { setLangSetting } from './i18n';

afterEach(() => setLangSetting('en'));

const day = (n: number) => addDays('2026-09-01', n);
const w = (n: number, weight: number, extra: Partial<BodyEntry> = {}): BodyEntry => ({ date: day(n), weight, updatedAt: n, ...extra });
// A steady loss of `perDay` kg, weighed every `every` days.
const ramp = (days: number, perDay: number, every = 1) =>
  Array.from({ length: Math.ceil(days / every) }, (_, i) => w(i * every, 90 - perDay * i * every));

describe('weightTrend', () => {
  it('smooths each weigh-in into the trend and fills the days between on a straight line', () => {
    const s = weightTrend([w(10, 82), w(0, 80)]);
    expect(s.map((p) => p.date)).toEqual(Array.from({ length: 11 }, (_, i) => day(i)));
    expect(s[0]).toEqual({ date: day(0), trend: 80, weight: 80 });
    expect(s[1].weight).toBeUndefined();
    expect(s[1].trend).toBeCloseTo(80.02); // the filled-in 80.2 kg, at 10 %
    expect(s[10].weight).toBe(82);
  });

  it('starts from the first week on average, so one odd first weigh-in does not skew it', () => {
    const s = weightTrend([w(0, 81), w(1, 79), w(2, 80), w(9, 85)]);
    expect(s[0]).toEqual({ date: day(0), trend: 80, weight: 81 });
  });

  it('ignores days with only measurements', () => {
    expect(weightTrend([{ date: day(0), waist: 90, updatedAt: 0 }])).toEqual([]);
  });

  it('gives about the same trend whether you weigh daily or twice a week', () => {
    const daily = weightTrend(ramp(60, 0.1));
    const sparse = weightTrend(ramp(60, 0.1, 3));
    const end = sparse[sparse.length - 1].date;
    expect(trendAt(sparse, end)).toBeCloseTo(trendAt(daily, end)!, 1);
  });

  it('holds the last trend after the last weigh-in, and has none before the first', () => {
    const s = weightTrend([w(0, 80), w(1, 81)]);
    expect(trendAt(s, day(30))).toBeCloseTo(80.55); // from 80.5, 10 % of the way to 81
    expect(trendAt(s, day(-1))).toBeUndefined();
  });
});

describe('weeklyRate', () => {
  it('follows a steady loss once the trend has settled', () => {
    expect(weeklyRate(weightTrend(ramp(60, 0.1)))).toBeCloseTo(-0.7, 1);
  });

  it('waits for a week of data', () => {
    expect(weeklyRate(weightTrend(ramp(7, 0.1)))).toBeNull();
    expect(weeklyRate(weightTrend(ramp(8, 0.1)))).not.toBeNull();
  });
});

describe('goalProgress', () => {
  it('measures the way from start to goal and projects when it is reached', () => {
    const p = goalProgress(84, 80, 86, -0.5, '2026-11-28');
    expect(p.fraction).toBeCloseTo(1 / 3);
    expect(p.left).toBeCloseTo(4);
    expect(p.reached).toBe(false);
    expect(p.eta).toBe('2027-01-23'); // 4 kg at 0.5 kg a week = 8 weeks
  });

  it('works for gaining weight too', () => {
    const p = goalProgress(62, 65, 60, 0.25, '2026-11-28');
    expect(p.fraction).toBeCloseTo(0.4);
    expect(p.eta).toBe(addDays('2026-11-28', 84));
  });

  it('has no date when heading the other way or barely moving', () => {
    expect(goalProgress(84, 80, 86, 0.3).eta).toBeUndefined();
    expect(goalProgress(84, 80, 86, -0.01).eta).toBeUndefined();
    expect(goalProgress(84, 80, 86, null).eta).toBeUndefined();
  });

  it('is reached at or past the goal', () => {
    expect(goalProgress(79.9, 80, 86, -0.5)).toMatchObject({ reached: true, fraction: 1, left: 0 });
  });
});

describe('estimateMaintenance', () => {
  const today = addDays(day(59), 1);
  const intake = (kcal: number, days = 60, skip = (_: number) => false) =>
    new Map(Array.from({ length: days }, (_, i) => [day(i), skip(i) ? 0 : kcal] as [string, number]));

  it('adds the energy of the trend change to what was eaten', () => {
    // 2000 kcal a day while losing 0.1 kg a day: burning about 2000 + 770.
    const m = estimateMaintenance(weightTrend(ramp(60, 0.1)), intake(2000), today)!;
    expect(m.kcal).toBeGreaterThan(2730);
    expect(m.kcal).toBeLessThan(2790);
    expect(m.days).toBe(28);
    expect(m.logged).toBe(28);
    expect(m.weekly).toBeCloseTo(-0.7, 1);
  });

  it('equals intake when the weight holds steady', () => {
    const steady = Array.from({ length: 30 }, (_, i) => w(i, 80 + (i % 2 ? 0.4 : -0.4)));
    const m = estimateMaintenance(weightTrend(steady), intake(2400, 30), addDays(day(29), 1))!;
    expect(Math.abs(m.kcal - 2400)).toBeLessThan(60);
  });

  it('averages only the days with food logged', () => {
    const m = estimateMaintenance(weightTrend(ramp(60, 0)), intake(2200, 60, (i) => i % 4 === 0), today)!;
    expect(m.kcal).toBe(2200);
    expect(m.logged).toBe(21);
  });

  it('waits for two weeks, a few weigh-ins and most days logged', () => {
    expect(estimateMaintenance(weightTrend(ramp(10, 0.1)), intake(2000), addDays(day(9), 1))).toBeNull();
    expect(estimateMaintenance(weightTrend([w(0, 80), w(20, 79), w(40, 78)]), intake(2000), today)).toBeNull();
    expect(estimateMaintenance(weightTrend(ramp(60, 0.1)), intake(2000, 60, (i) => i % 2 === 0), today)).toBeNull();
  });

  it('leaves out today, which is not over yet', () => {
    const food = intake(2000);
    food.set(day(59), 300);
    const m = estimateMaintenance(weightTrend(ramp(60, 0)), food, day(59))!;
    expect(m.kcal).toBe(2000);
  });
});

describe('helpers', () => {
  it('turns a calorie goal into a weekly change against maintenance', () => {
    expect(weeklyChangeAt(2000, 2550)).toBeCloseTo(-0.5);
  });

  it('computes BMI from kg and cm', () => {
    expect(bmi(81, 180)).toBeCloseTo(25);
  });

  it('finds the first and latest value of each metric, and the one before a date', () => {
    const list = [w(0, 80, { waist: 92 }), w(5, 79), w(9, 78.5, { waist: 90 })];
    const latest = latestValues(list);
    expect(latest.get('waist')).toMatchObject({ first: { date: day(0) }, last: { date: day(9) }, count: 2 });
    expect(latest.get('weight')?.count).toBe(3);
    expect(latest.has('hips')).toBe(false);
    expect(previousValue(list, day(9), 'waist')?.date).toBe(day(0));
    expect(previousValue(list, day(0), 'weight')).toBeUndefined();
  });

  it('formats weights with one decimal and changes with a sign', () => {
    expect(fmtMetric('weight', 82)).toBe('82.0');
    expect(fmtMetric('waist', 88)).toBe('88');
    expect(fmtDelta('weight', 0.25)).toBe('+0.3');
    expect(fmtDelta('weight', 0.01)).toBe('0.0');
    setLangSetting('nb');
    expect(fmtMetric('weight', 82.45)).toBe('82,5');
  });

  it('says how long ago a day was', () => {
    expect(relativeDay('2026-11-28', '2026-11-28')).toBe('today');
    expect(relativeDay('2026-11-27', '2026-11-28')).toBe('yesterday');
    expect(relativeDay('2026-11-25', '2026-11-28')).toBe('3 days ago');
    expect(relativeDay('2026-11-18', '2026-11-28')).toBe('18 Nov');
    expect(relativeDay('2025-11-18', '2026-11-28')).toBe('18 Nov 2025');
  });
});
