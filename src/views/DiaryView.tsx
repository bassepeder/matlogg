import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Calendar } from '../components/Calendar';
import { Icon } from '../components/Icon';
import { BottomNav } from '../components/Layout';
import { Summary } from '../components/Summary';
import { SwipeRow } from '../components/SwipeRow';
import { addDays, dayLabel, mealForTime, todayISO } from '../lib/dates';
import { copyEntries, DEFAULT_SETTINGS, db, notYetCopied } from '../lib/db';
import { mealsOf, useSettingsState, useToday } from '../lib/hooks';
import { portionLabel, t } from '../lib/i18n';
import { entryNutrients, fmt, fmtKcal, resolveGoals, sum } from '../lib/nutrition';
import { push, replace } from '../lib/router';
import { mealLabel, sourceLabel, type Entry, type MealId } from '../lib/types';

export function entryTitle(e: Entry): string {
  return e.name || sourceLabel('quick');
}

export function amountLabel(e: Entry): string {
  if (e.source === 'quick') return e.name ? sourceLabel('quick') : '';
  if (e.unitLabel && e.quantity != null) return `${fmt(e.quantity)} ${portionLabel(e.unitLabel)} · ${fmt(e.grams)} g`;
  return `${fmt(e.grams)} g`;
}

// Splits a meal's entries into single lines and recipe groups, in the order they were logged.
export function groupEntries(list: Entry[]): (Entry | Entry[])[] {
  const out: (Entry | Entry[])[] = [];
  const groups = new Map<string, Entry[]>();
  for (const e of list) {
    if (!e.group) {
      out.push(e);
      continue;
    }
    const g = groups.get(e.group);
    if (g) g.push(e);
    else {
      const fresh = [e];
      groups.set(e.group, fresh);
      out.push(fresh);
    }
  }
  return out;
}

export function DiaryView({ date }: { date: string }) {
  const settings = useSettingsState();
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]);
  const loaded = settings !== undefined && entries !== undefined;
  const goals = resolveGoals((settings ?? DEFAULT_SETTINGS).goals);
  const meals = mealsOf(settings ?? DEFAULT_SETTINGS);
  // Entries under a meal that is no longer in the list still get a section, so nothing goes missing.
  const orphanMeals = [...new Set((entries ?? []).map((e) => e.meal))].filter((id) => !meals.some((m) => m.id === id));
  const sections: MealId[] = [...meals.map((m) => m.id), ...orphanMeals];
  const totals = sum((entries ?? []).map(entryNutrients));
  const isToday = date === useToday();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const yesterday = useLiveQuery(() => db.entries.where('date').equals(addDays(date, -1)).sortBy('createdAt'), [date]);

  const [undo, setUndo] = useState<{ entries: Entry[]; name: string } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(timer);
  }, [undo]);

  async function remove(list: Entry[], name: string) {
    const ids = list.map((e) => e.id).filter((id): id is number => id != null);
    if (!ids.length) return;
    await db.entries.bulkDelete(ids);
    setUndo({ entries: list, name });
  }

  async function restore() {
    if (!undo) return;
    await db.entries.bulkPut(undo.entries);
    setUndo(null);
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label={t('day.prev')} onClick={() => replace(`/day/${addDays(date, -1)}`)}>
          <Icon name="prev" />
        </button>
        <button className="topbar-title date-title" onClick={() => setCalendarOpen(true)} aria-haspopup="dialog" aria-label={`${dayLabel(date)}, ${t('cal.open')}`}>
          {dayLabel(date)}
          <Icon name="calendar" size={16} />
        </button>
        <button className="icon-btn" aria-label={t('day.next')} onClick={() => replace(`/day/${addDays(date, 1)}`)}>
          <Icon name="next" />
        </button>
      </header>

      {calendarOpen && (
        <Calendar
          date={date}
          kcalGoal={goals.kcal}
          onClose={() => setCalendarOpen(false)}
          onPick={(iso) => {
            setCalendarOpen(false);
            replace(iso === todayISO() ? '/' : `/day/${iso}`);
          }}
        />
      )}

      <main className="page with-nav" style={loaded ? undefined : { visibility: 'hidden' }}>
        <Summary totals={totals} goals={goals} />

        {sections.map((meal) => {
          const list = (entries ?? []).filter((e) => e.meal === meal);
          const mealTotals = sum(list.map(entryNutrients));
          // Yesterday's entries for this meal that are not already logged today, so a partly filled meal can still be topped up.
          const sameAsYesterday = notYetCopied((yesterday ?? []).filter((e) => e.meal === meal), list);
          return (
            <section key={meal} className="card meal">
              <div className="meal-head">
                <h2>{mealLabel(meal, meals)}</h2>
                <span className="muted">{list.length ? `${fmtKcal(mealTotals.kcal)} kcal` : ''}</span>
              </div>
              {list.length > 0 && (
                <div className="meal-macros">
                  {(['protein', 'carbs', 'fat'] as const).map((k) => (
                    <span key={k} className={k}>
                      {fmt(mealTotals[k])} g {t(`macro.${k}Short`)}
                    </span>
                  ))}
                </div>
              )}
              {list.length > 0 && (
                <ul className="list">
                  {groupEntries(list).map((item) => {
                    if (!Array.isArray(item)) return <EntryRow key={item.id} e={item} onDelete={() => remove([item], entryTitle(item))} />;
                    const name = item[0].recipeName ?? '';
                    return (
                      <li key={item[0].group} className="recipe-group">
                        <ul className="list">
                          <SwipeRow deleteLabel={t('diary.deleteRecipe', { name })} onDelete={() => remove(item, name)}>
                            <button
                              className="row group-head"
                              onClick={() => push(`/group/${date}/${encodeURIComponent(item[0].group!)}`)}
                              aria-label={t('group.open', { name })}
                            >
                              <span className="row-main">
                                <span className="row-sub">{t('diary.fromRecipe', { name })}</span>
                              </span>
                              <span className="row-sub">
                                {fmtKcal(sum(item.map(entryNutrients)).kcal)} kcal <Icon name="next" size={14} />
                              </span>
                            </button>
                          </SwipeRow>
                          {item.map((e) => (
                            <EntryRow key={e.id} e={e} inGroup onDelete={() => remove([e], entryTitle(e))} />
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button className="add-link" onClick={() => push(`/add/${date}/${meal}`)}>
                <Icon name="plus" size={18} /> {t('diary.addFood')}
              </button>
              {sameAsYesterday.length > 0 && (
                <button className="add-link secondary" onClick={() => copyEntries(sameAsYesterday, date)}>
                  <Icon name="copy" size={18} />{' '}
                  {t('diary.copyYesterday', {
                    count: sameAsYesterday.length,
                    kcal: fmtKcal(sum(sameAsYesterday.map(entryNutrients)).kcal),
                  })}
                </button>
              )}
            </section>
          );
        })}
      </main>

      {undo && (
        <div className="snackbar" role="status">
          <span>{t('diary.deleted', { name: undo.name })}</span>
          <button onClick={restore}>{t('diary.undo')}</button>
        </div>
      )}

      <button
        className="fab"
        aria-label={t('diary.addFood')}
        onClick={() => push(`/add/${date}/${isToday ? mealForTime(new Date(), meals) : meals[meals.length - 1].id}`)}
      >
        <Icon name="plus" size={28} />
      </button>
      <BottomNav active="diary" />
    </>
  );
}

function EntryRow({ e, inGroup, onDelete }: { e: Entry; inGroup?: boolean; onDelete: () => void }) {
  const sub = [e.brand, amountLabel(e)].filter(Boolean).join(' · ');
  return (
    <SwipeRow deleteLabel={t('diary.delete')} onDelete={onDelete}>
      <button className={inGroup ? 'row in-group' : 'row'} onClick={() => push(`/entry/${e.id}`)}>
        <span className="row-main">
          <span className="row-title">{entryTitle(e)}</span>
          {sub && <span className="row-sub">{sub}</span>}
        </span>
        <span className="row-value">{fmtKcal(entryNutrients(e).kcal)}</span>
      </button>
    </SwipeRow>
  );
}
