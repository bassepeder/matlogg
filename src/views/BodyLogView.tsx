import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Layout';
import {
  fmtDelta,
  fmtMetric,
  hasValue,
  inRange,
  MEASURES,
  metricLabel,
  METRIC_UNIT,
  METRICS,
  previousValue,
  relativeDay,
  withUnit,
  type BodyEntry,
  type BodyMetric,
} from '../lib/body';
import { isISODate } from '../lib/dates';
import { db } from '../lib/db';
import { useToday } from '../lib/hooks';
import { t } from '../lib/i18n';
import { parseNum, toInput } from '../lib/nutrition';
import { backTo } from '../lib/router';

type Form = Record<BodyMetric, string> & { note: string };

const EMPTY: Form = { ...(Object.fromEntries(METRICS.map((m) => [m, ''])) as Record<BodyMetric, string>), note: '' };
const OPEN_KEY = 'matlogg.bodyMeasuresOpen';

function fromEntry(e: BodyEntry): Form {
  const f = { ...EMPTY, note: e.note ?? '' };
  for (const m of METRICS) if (hasValue(e, m)) f[m] = toInput(e[m]);
  return f;
}

function rememberedOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

const backToBody = () => backTo((p) => p === '/body', '/body');

// Logs a day's weight, and optionally measurements and a note. The form always shows the chosen
// day: picking another date loads what is logged there, unless you have already typed something.
export function BodyLogView({ date: initial }: { date?: string }) {
  const today = useToday();
  const [date, setDate] = useState(initial ?? today);
  const entries = useLiveQuery(() => db.body.toArray(), []);
  const [form, setForm] = useState<Form>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [open, setOpen] = useState(rememberedOpen);
  const weightRef = useRef<HTMLInputElement>(null);
  // Opened from far down the history list: start at the top, where the date is.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!entries || synced === date) return;
    // A new weigh-in starts in the weight field. Not before now: the page is hidden while
    // loading, and a hidden field can't take focus.
    if (synced == null && !initial) weightRef.current?.focus();
    setSynced(date);
    if (dirty) return;
    const e = entries.find((x) => x.date === date);
    setForm(e ? fromEntry(e) : EMPTY);
    setLoadedDate(e ? date : null);
    if (e && MEASURES.some((m) => hasValue(e, m))) setOpen(true);
  }, [entries, date, synced, dirty, initial]);

  const existing = entries?.find((e) => e.date === date);
  const editing = loadedDate === date && !!existing;
  const values = Object.fromEntries(METRICS.map((m) => [m, parseNum(form[m])])) as Record<BodyMetric, number | undefined>;
  const wrong = METRICS.find((m) => values[m] != null && !inRange(m, values[m]!));
  const canSave = METRICS.some((m) => values[m] != null) && !wrong;
  const prev = entries ? previousValue(entries, date, 'weight') : undefined;
  const weight = values.weight;

  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  function step(delta: number) {
    const base = weight ?? prev?.weight;
    if (base == null) return;
    set('weight', toInput(Math.round((base + delta) * 10) / 10));
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!canSave) return;
    // Typed over another day's record without loading it: keep what it had that wasn't retyped.
    const base: Partial<BodyEntry> = existing && !editing ? existing : {};
    const record: BodyEntry = { ...base, date, updatedAt: Date.now() };
    for (const m of METRICS) {
      const v = values[m];
      if (v != null) record[m] = Math.round(v * 100) / 100;
    }
    const note = form.note.trim();
    if (note) record.note = note;
    await db.body.put(record);
    backToBody();
  }

  async function remove() {
    if (!editing) return;
    await db.body.delete(date);
    backToBody();
  }

  const filled = MEASURES.filter((m) => values[m] != null);
  const summary = filled.length ? filled.map((m) => `${metricLabel(m)} ${withUnit(m, fmtMetric(m, values[m]!))}`).join(' · ') : t('body.measuresSummary');

  return (
    <>
      <TopBar title={editing ? t('body.editTitle') : t('body.logTitle')} onBack={backToBody} />
      <main className="page with-action" style={entries ? undefined : { visibility: 'hidden' }}>
        <form id="body-form" className="form" onSubmit={save}>
          <section className="card form">
            <label className="inline-field">
              <span>{t('body.date')}</span>
              <input
                className="input date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => isISODate(e.target.value) && setDate(e.target.value)}
              />
            </label>

            <div className="weight-input">
              <button type="button" className="step" aria-label={t('body.minus')} onClick={() => step(-0.1)} disabled={weight == null && !prev}>
                <Icon name="minus" />
              </button>
              <label className="weight-field">
                <span className="sr-only">{t('body.weightKg')}</span>
                <input
                  className="input"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  value={form.weight}
                  onChange={(e) => set('weight', e.target.value)}
                  placeholder={prev ? fmtMetric('weight', prev.weight!) : fmtMetric('weight', 0)}
                  ref={weightRef}
                />
                <span aria-hidden="true">kg</span>
              </label>
              <button type="button" className="step" aria-label={t('body.plus')} onClick={() => step(0.1)} disabled={weight == null && !prev}>
                <Icon name="plus" />
              </button>
            </div>
            {prev && (
              <p className="hint weight-meta">
                {t('body.previous', { value: fmtMetric('weight', prev.weight!), date: relativeDay(prev.date, today) })}
                {weight != null && inRange('weight', weight) && <span className="body-delta">{withUnit('weight', fmtDelta('weight', weight - prev.weight!))}</span>}
              </p>
            )}
            {existing && !editing && <p className="notice">{t('body.existing')}</p>}
          </section>

          <details
            className="card measures"
            open={open}
            onToggle={(e) => {
              const next = e.currentTarget.open;
              setOpen(next);
              try {
                localStorage.setItem(OPEN_KEY, next ? '1' : '0');
              } catch {
              }
            }}
          >
            <summary>
              <span>
                <strong>{t('body.measuresOptional')}</strong>
                <small className="muted">{summary}</small>
              </span>
              <Icon name="next" size={18} />
            </summary>
            <div className="grid2 measure-grid">
              {MEASURES.map((m) => {
                const last = entries ? previousValue(entries, date, m) : undefined;
                return (
                  <label key={m}>
                    <span className="field-label">
                      {metricLabel(m)} ({METRIC_UNIT[m]})
                    </span>
                    <input
                      className="input"
                      inputMode="decimal"
                      autoComplete="off"
                      value={form[m]}
                      onChange={(e) => set(m, e.target.value)}
                      placeholder={last ? fmtMetric(m, last[m]!) : ''}
                    />
                  </label>
                );
              })}
            </div>
          </details>

          <section className="card form">
            <label>
              <span className="field-label">{t('body.note')}</span>
              <input className="input" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('body.notePlaceholder')} />
            </label>
          </section>

          {wrong && <p className="notice error">{t('body.errRange', { metric: metricLabel(wrong) })}</p>}

          {editing && (
            <button type="button" className="btn danger-text wide" onClick={remove}>
              {t('body.deleteEntry')}
            </button>
          )}
          <button type="submit" hidden />
        </form>
      </main>
      <div className="action-bar">
        <button className="btn primary wide" type="submit" form="body-form" disabled={!canSave}>
          {weight != null && !wrong ? t('body.saveWeight', { value: fmtMetric('weight', weight) }) : t('common.save')}
        </button>
      </div>
    </>
  );
}
