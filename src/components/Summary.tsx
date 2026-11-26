import { useState } from 'react';
import { t } from '../lib/i18n';
import { fmt, fmtKcal } from '../lib/nutrition';
import type { Goals, Nutrients } from '../lib/types';

type Mode = 'left' | 'eaten';
const MODE_KEY = 'matlogg.summaryMode';

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'eaten' ? 'eaten' : 'left';
  } catch {
    return 'left';
  }
}

function Bar({ value, goal, kind }: { value: number; goal: number; kind: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const over = goal > 0 && value > goal * 1.02;
  return (
    <div className={`bar ${kind}${over ? ' over' : ''}`} role="presentation">
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Summary({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
    }
  };

  const left = goals.kcal - totals.kcal;
  const macros = [
    { key: 'protein', label: t('macro.protein'), value: totals.protein, goal: goals.protein },
    { key: 'carbs', label: t('macro.carbs'), value: totals.carbs, goal: goals.carbs },
    { key: 'fat', label: t('macro.fat'), value: totals.fat, goal: goals.fat },
  ];

  const macroText = (value: number, goal: number) => {
    if (mode === 'eaten') return `${fmt(value)} / ${fmt(goal)} g`;
    const rest = goal - value;
    return rest >= 0 ? t('summary.gLeft', { g: fmt(rest) }) : t('summary.gOver', { g: fmt(-rest) });
  };

  return (
    <section className="card summary" aria-label={t('summary.aria')}>
      <div className="summary-kcal">
        <div>
          {mode === 'left' ? (
            <>
              <div className={`big-number${left < 0 ? ' over' : ''}`}>{fmtKcal(Math.abs(left))}</div>
              <div className="muted">{left < 0 ? t('summary.over') : t('summary.left')}</div>
            </>
          ) : (
            <>
              <div className={`big-number${left < 0 ? ' over' : ''}`}>{fmtKcal(totals.kcal)}</div>
              <div className="muted">{t('summary.eatenBig')}</div>
            </>
          )}
        </div>
        <div className="summary-side">
          <div className="mini-toggle" role="radiogroup" aria-label={t('summary.modeAria')}>
            {(['eaten', 'left'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {t(m === 'eaten' ? 'summary.modeEaten' : 'summary.modeLeft')}
              </button>
            ))}
          </div>
          <div className="muted">
            {mode === 'left' ? (
              <>
                <strong>{fmtKcal(totals.kcal)}</strong> {t('summary.eaten')}
              </>
            ) : (
              <>
                <strong>{fmtKcal(Math.max(0, left))}</strong> {t('summary.leftShort')}
              </>
            )}
            {' · '}
            <strong>{fmtKcal(goals.kcal)}</strong> {t('summary.goal')}
          </div>
        </div>
      </div>
      <Bar value={totals.kcal} goal={goals.kcal} kind="kcal" />
      <div className="macros">
        {macros.map((m) => (
          <div key={m.key} className="macro">
            <div className="macro-head">
              <span>{m.label}</span>
              <span className="muted">{macroText(m.value, m.goal)}</span>
            </div>
            <Bar value={m.value} goal={m.goal} kind={m.key} />
          </div>
        ))}
      </div>
    </section>
  );
}
