import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dayDiff } from '../lib/body';
import { addDays, fromISODate, toISODate } from '../lib/dates';
import { locale } from '../lib/i18n';

export type Range = '1m' | '3m' | '6m' | '1y' | 'all';
export const RANGES: Range[] = ['1m', '3m', '6m', '1y', 'all'];

// First day the chart shows. "All" still spans at least a month, so a few days of data don't
// get stretched edge to edge.
export function rangeStart(range: Range, today: string, first?: string): string {
  if (range === 'all') {
    const month = addDays(today, -29);
    return first && first < month ? first : month;
  }
  const d = fromISODate(today);
  d.setMonth(d.getMonth() - { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[range]);
  return toISODate(d);
}

export interface ChartPoint {
  date: string;
  value: number;
}

const HEIGHT = 190; // must match .chart-wrap
const M = { top: 14, right: 10, bottom: 24, left: 36 };

function niceStep(raw: number): number {
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

function xTicks(from: string, to: string): { date: string; label: string; anchor: 'start' | 'middle' | 'end' }[] {
  const span = dayDiff(from, to);
  if (span <= 45) {
    const f = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' });
    return [0, 1, 2, 3].map((i) => {
      const date = addDays(from, Math.round((span * i) / 3));
      return { date, label: f.format(fromISODate(date)), anchor: i === 0 ? 'start' : i === 3 ? 'end' : 'middle' };
    });
  }
  const f = new Intl.DateTimeFormat(locale(), span > 330 ? { month: 'short', year: '2-digit' } : { month: 'short' });
  const months: string[] = [];
  const d = fromISODate(from);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  for (; toISODate(d) <= to; d.setMonth(d.getMonth() + 1)) months.push(toISODate(d));
  const every = Math.ceil(months.length / 5);
  return months.filter((_, i) => i % every === 0).map((date) => ({ date, label: f.format(fromISODate(date)), anchor: 'middle' }));
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// Values over time: dots for what was measured, and for weight a smoothed trend line through
// them. Touch, hover or arrow keys pick a day; the parent shows its numbers above the chart.
export function BodyChart({
  points,
  trend,
  goal,
  goalLabel,
  from,
  to,
  label,
  active,
  onActive,
}: {
  points: ChartPoint[];
  trend?: ChartPoint[];
  goal?: number;
  goalLabel?: string;
  from: string;
  to: string;
  label: string;
  active: number | null;
  onActive: (i: number | null) => void;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const gradient = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const span = Math.max(1, dayDiff(from, to));
  const x = (date: string) => M.left + (dayDiff(from, date) / span) * plotW;

  const values = [...points.map((p) => p.value), ...(trend ?? []).map((p) => p.value)];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  // Show the goal when it is near the data; one far away would flatten the line.
  const showGoal = goal != null && values.length > 0 && goal >= lo - Math.max(hi - lo, 2) && goal <= hi + Math.max(hi - lo, 2);
  if (showGoal) {
    lo = Math.min(lo, goal);
    hi = Math.max(hi, goal);
  }
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.5;
    hi = mid + 0.5;
  }
  const step = niceStep((hi - lo) / 3);
  const y0 = Math.floor(lo / step) * step;
  const y1 = Math.max(Math.ceil(hi / step) * step, y0 + step);
  const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * plotH;
  const tickFmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: step < 1 ? 1 : 0 });
  const yTicks: number[] = [];
  for (let v = y0; v <= y1 + step / 1000; v += step) yTicks.push(v);

  const line = trend ?? points;
  const path = line.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const bottom = M.top + plotH;
  const area = line.length > 1 ? `${path}L${x(line[line.length - 1].date).toFixed(1)},${bottom}L${x(line[0].date).toFixed(1)},${bottom}Z` : '';
  const dotR = points.length > 90 ? 2 : 3.2;
  const solid = !trend; // without a trend line, the dots are the data

  function pick(e: PointerEvent<SVGSVGElement>) {
    if (!points.length) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    if (best !== active) onActive(best);
  }

  function onKey(e: KeyboardEvent) {
    if (!points.length) return;
    const last = points.length - 1;
    if (e.key === 'ArrowLeft') onActive(Math.max(0, (active ?? last + 1) - 1));
    else if (e.key === 'ArrowRight') onActive(Math.min(last, (active ?? -1) + 1));
    else if (e.key === 'Escape') onActive(null);
    else return;
    e.preventDefault();
  }

  const a = active != null ? points[active] : null;
  const aTrend = a && trend ? trend.find((p) => p.date === a.date) : undefined;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={() => onActive(null)}
          onPointerCancel={() => onActive(null)}
          onKeyDown={onKey}
          onBlur={() => onActive(null)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--primary)', stopOpacity: 0.22 }} />
              <stop offset="1" style={{ stopColor: 'var(--primary)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {yTicks.map((v) => (
            <g key={v}>
              <line className="chart-grid" x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
              <text className="chart-tick" x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
                {tickFmt.format(v)}
              </text>
            </g>
          ))}
          {xTicks(from, to).map((tk) => (
            <text key={tk.date} className="chart-tick" x={x(tk.date)} y={HEIGHT - 6} textAnchor={tk.anchor}>
              {tk.label}
            </text>
          ))}

          {showGoal && (
            <g>
              <line className="chart-goal" x1={M.left} x2={width - M.right} y1={y(goal)} y2={y(goal)} />
              {goalLabel && (
                <text className="chart-goal-label" x={width - M.right} y={y(goal) - 5} textAnchor="end">
                  {goalLabel}
                </text>
              )}
            </g>
          )}

          {area && <path d={area} fill={`url(#${gradient})`} />}
          {line.length > 1 && <path className="chart-line" d={path} />}
          {points.map((p) => (
            <circle key={p.date} className={`chart-dot${solid ? ' solid' : ''}`} cx={x(p.date)} cy={y(p.value)} r={dotR} />
          ))}

          {a && (
            <g aria-hidden="true">
              <line className="chart-cursor" x1={x(a.date)} x2={x(a.date)} y1={M.top - 4} y2={bottom} />
              {aTrend && <circle className="chart-active trend" cx={x(a.date)} cy={y(aTrend.value)} r={4} />}
              <circle className="chart-active" cx={x(a.date)} cy={y(a.value)} r={5.5} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
