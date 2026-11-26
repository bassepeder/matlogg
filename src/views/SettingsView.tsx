import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { BottomNav, MealPicker } from '../components/Layout';
import { downloadBlob, exportBackup, importBackup, parseBackup } from '../lib/backup';
import { countMealEntries, deleteAllData, removeMeal, saveMeals, saveSettings } from '../lib/db';
import { mealsOf, useMatvaretabellen, useSettings } from '../lib/hooks';
import { detectLang, getLangSetting, setLangSetting, t, type LangSetting } from '../lib/i18n';
import { lookupVetduat } from '../lib/lookup';
import { carbsFromRest, fmt, kcalFromMacros, parseNum, toInput } from '../lib/nutrition';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { builtInMealLabel, isBuiltInMeal, mealLabel, type Goals, type Meal, type MealId } from '../lib/types';

const LANG_NAMES = { nb: 'Norsk', en: 'English' } as const;

const TEST_EAN = '7039010019828';

type GoalForm = { kcal: string; protein: string; carbs: string; fat: string; carbsAuto: boolean };

type Card = 'goals' | 'meals' | 'vetduat' | 'data';
type Message = { card: Card; text: string; error?: boolean };

// Feedback is shown inside the card the action came from, not at the top of the page.
function Notice({ message, card }: { message: Message | null; card: Card }) {
  if (message?.card !== card) return null;
  return (
    <p className={`notice${message.error ? ' error' : ''}`} role="status">
      {message.text}
    </p>
  );
}

function GoalsCard({ goals, onSaved, notice }: { goals: Goals; onSaved: () => void; notice: ReactNode }) {
  const [form, setForm] = useState<GoalForm | null>(null);
  const f: GoalForm = form ?? {
    kcal: toInput(goals.kcal),
    protein: toInput(goals.protein),
    carbs: toInput(goals.carbs),
    fat: toInput(goals.fat),
    carbsAuto: !!goals.carbsAuto,
  };
  const set = (patch: Partial<GoalForm>) => setForm({ ...f, ...patch });

  const kcal = parseNum(f.kcal) ?? goals.kcal;
  const protein = parseNum(f.protein) ?? 0;
  const fat = parseNum(f.fat) ?? 0;
  const restCarbs = carbsFromRest({ kcal, protein, fat });
  const proteinKcal = Math.round(protein * 4);
  const fatKcal = Math.round(fat * 9);
  const macroKcal = Math.round(kcalFromMacros({ protein, carbs: parseNum(f.carbs), fat }));

  async function save() {
    await saveSettings({
      goals: {
        kcal,
        protein: parseNum(f.protein) ?? goals.protein,
        fat: parseNum(f.fat) ?? goals.fat,
        carbs: f.carbsAuto ? restCarbs : (parseNum(f.carbs) ?? goals.carbs),
        carbsAuto: f.carbsAuto,
      },
    });
    setForm(null);
    onSaved();
  }

  const field = (key: 'kcal' | 'protein' | 'carbs' | 'fat', label: string, disabled = false) => (
    <label className="inline-field">
      <span>{label}</span>
      <input
        className="input"
        inputMode="decimal"
        disabled={disabled}
        value={disabled ? String(restCarbs) : f[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <section className="card form">
      {field('kcal', t('settings.goalKcal'))}
      {field('protein', t('settings.goalProtein'))}
      {field('fat', t('settings.goalFat'))}
      <div>
        <span className="field-label">{t('settings.carbsMode')}</span>
        <MealPicker
          label={t('settings.carbsMode')}
          value={f.carbsAuto ? 'rest' : 'fixed'}
          onChange={(v) => set({ carbsAuto: v === 'rest' })}
          options={[
            { id: 'rest', label: t('settings.carbsRest') },
            { id: 'fixed', label: t('settings.carbsFixed') },
          ]}
        />
      </div>
      {field('carbs', t('settings.goalCarbs'), f.carbsAuto)}
      <p className="hint">
        {f.carbsAuto
          ? kcal - proteinKcal - fatKcal < 0
            ? t('settings.carbsRestNegative', { kcal: fmt(proteinKcal + fatKcal) })
            : t('settings.carbsRestHint', {
                kcal: fmt(kcal),
                proteinKcal: fmt(proteinKcal),
                fatKcal: fmt(fatKcal),
                carbsKcal: fmt(kcal - proteinKcal - fatKcal),
                carbs: fmt(restCarbs),
              })
          : t('settings.macroSum', { kcal: fmt(macroKcal) })}
      </p>
      <button className="btn primary" disabled={!form} onClick={save}>
        {t('settings.saveGoals')}
      </button>
      {notice}
    </section>
  );
}

function MealsCard({ meals, onMessage, notice }: { meals: Meal[]; onMessage: (text: string) => void; notice: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<MealId, string>>({});
  const [newName, setNewName] = useState('');
  const [removing, setRemoving] = useState<{ id: MealId; count: number; moveTo: MealId } | null>(null);
  const label = (id: MealId) => mealLabel(id, meals);

  async function rename(m: Meal) {
    const draft = drafts[m.id];
    if (draft == null) return;
    setDrafts(({ [m.id]: _, ...rest }) => rest);
    const name = draft.trim();
    // Clearing a built-in meal, or typing its default label, returns it to the translated default.
    const next = isBuiltInMeal(m.id) && (!name || name === builtInMealLabel(m.id)) ? undefined : name || m.name;
    if (next === m.name) return;
    await saveMeals(meals.map((x) => (x.id === m.id ? (next ? { id: x.id, name: next } : { id: x.id }) : x)));
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= meals.length) return;
    const next = [...meals];
    [next[i], next[j]] = [next[j], next[i]];
    await saveMeals(next);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await saveMeals([...meals, { id: `custom-${Date.now().toString(36)}`, name }]);
    setNewName('');
  }

  async function startRemove(m: Meal) {
    const count = await countMealEntries(m.id);
    if (!count) {
      await removeMeal(m.id);
      onMessage(t('settings.mealRemoved', { meal: label(m.id) }));
      return;
    }
    setRemoving({ id: m.id, count, moveTo: meals.find((x) => x.id !== m.id)!.id });
  }

  async function confirmRemove() {
    if (!removing) return;
    const { id, count, moveTo } = removing;
    const meal = label(id);
    const target = label(moveTo);
    await removeMeal(id, moveTo);
    setRemoving(null);
    onMessage(t('settings.mealRemovedMoved', { meal, count, target }));
  }

  return (
    <section className="card form">
      <p className="hint">{t('settings.mealsHint')}</p>
      <ul className="meal-list">
        {meals.map((m, i) => (
          <li key={m.id}>
            <div className="meal-row">
              <input
                className="input"
                value={drafts[m.id] ?? label(m.id)}
                placeholder={isBuiltInMeal(m.id) ? builtInMealLabel(m.id) : undefined}
                onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                onBlur={() => rename(m)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label={t('settings.mealNameAria', { meal: label(m.id) })}
              />
              <button className="icon-btn up" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('settings.mealUp', { meal: label(m.id) })}>
                <Icon name="next" size={18} />
              </button>
              <button
                className="icon-btn down"
                disabled={i === meals.length - 1}
                onClick={() => move(i, 1)}
                aria-label={t('settings.mealDown', { meal: label(m.id) })}
              >
                <Icon name="next" size={18} />
              </button>
              <button
                className="icon-btn danger-text"
                disabled={meals.length === 1 || removing?.id === m.id}
                onClick={() => startRemove(m)}
                aria-label={t('settings.mealRemove', { meal: label(m.id) })}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {removing?.id === m.id && (
              <div className="meal-remove">
                <label htmlFor={`move-${m.id}`}>{t('settings.mealMoveEntries', { meal: label(m.id), count: removing.count })}</label>
                <select
                  id={`move-${m.id}`}
                  className="input"
                  value={removing.moveTo}
                  onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })}
                >
                  {meals
                    .filter((x) => x.id !== m.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {label(x.id)}
                      </option>
                    ))}
                </select>
                <div className="button-row">
                  <button className="btn secondary" onClick={() => setRemoving(null)}>
                    {t('common.cancel')}
                  </button>
                  <button className="btn primary" onClick={confirmRemove}>
                    {t('settings.mealMoveAndRemove')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form className="meal-add" onSubmit={add}>
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('settings.mealNewPlaceholder')}
          aria-label={t('settings.mealNewPlaceholder')}
        />
        <button className="btn secondary" type="submit" disabled={!newName.trim()}>
          {t('settings.mealAdd')}
        </button>
      </form>
      {notice}
    </section>
  );
}

export function SettingsView() {
  const settings = useSettings();
  const { table } = useMatvaretabellen();
  const [proxy, setProxy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const proxyUrl = proxy ?? settings.vetduatProxyUrl ?? '';

  async function saveProxy() {
    await saveSettings({ vetduatProxyUrl: proxyUrl.trim() || undefined });
    setProxy(null);
    setMessage({ card: 'vetduat', text: proxyUrl.trim() ? t('settings.vetduatSaved') : t('settings.vetduatRemoved') });
  }

  async function testProxy() {
    const url = proxyUrl.trim();
    if (!url) return;
    setMessage({ card: 'vetduat', text: t('settings.testing') });
    try {
      const r = await lookupVetduat(TEST_EAN, url);
      setMessage({
        card: 'vetduat',
        text: r?.partial?.name ? t('settings.vetduatWorksFound', { name: r.partial.name }) : t('settings.vetduatWorks'),
      });
    } catch (e) {
      setMessage({ card: 'vetduat', text: (e as Error).message, error: true });
    }
  }

  async function doExport() {
    const { filename, blob } = await exportBackup();
    downloadBlob(filename, blob);
  }

  async function doImport(file: File) {
    try {
      const backup = parseBackup(await file.text());
      const ok = confirm(
        t('settings.importConfirm', {
          entries: backup.entries.length,
          foods: backup.foods.length,
          date: backup.exportedAt?.slice(0, 10) ?? '?',
        }),
      );
      if (!ok) return;
      await importBackup(backup);
      setMessage({ card: 'data', text: t('settings.imported') });
    } catch (e) {
      setMessage({ card: 'data', text: (e as Error).message, error: true });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteAll() {
    if (!confirm(t('settings.deleteAllConfirm'))) return;
    await deleteAllData();
    location.reload();
  }

  async function askPersist() {
    const ok = await navigator.storage?.persist?.();
    setPersisted(!!ok);
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">{t('settings.title')}</div>
      </header>
      <main className="page with-nav">

        <section className="card settings-row">
          <label htmlFor="lang">{t('settings.language')}</label>
          <div className="select-wrap">
            <select id="lang" value={getLangSetting()} onChange={(e) => setLangSetting(e.target.value as LangSetting)}>
              <option value="auto">
                {t('settings.langAuto')} ({LANG_NAMES[detectLang()]})
              </option>
              <option value="nb">{LANG_NAMES.nb}</option>
              <option value="en">{LANG_NAMES.en}</option>
            </select>
            <Icon name="next" size={18} />
          </div>
        </section>

        <section className="card settings-row">
          <label>{t('settings.theme')}</label>
          <MealPicker
            label={t('settings.theme')}
            value={theme}
            onChange={(v) => {
              setTheme(v);
              setThemeState(v);
            }}
            options={[
              { id: 'auto', label: t('settings.themeAuto') },
              { id: 'light', label: t('settings.themeLight') },
              { id: 'dark', label: t('settings.themeDark') },
            ]}
          />
        </section>

        <h3 className="section-title">{t('settings.goals')}</h3>
        <GoalsCard
          goals={settings.goals}
          onSaved={() => setMessage({ card: 'goals', text: t('settings.goalsSaved') })}
          notice={<Notice message={message} card="goals" />}
        />

        <h3 className="section-title">{t('settings.meals')}</h3>
        <MealsCard
          meals={mealsOf(settings)}
          onMessage={(text) => setMessage({ card: 'meals', text })}
          notice={<Notice message={message} card="meals" />}
        />

        <h3 className="section-title">{t('settings.vetduatTitle')}</h3>
        <section className="card form">
          <p className="hint">{t('settings.vetduatHint')}</p>
          <input
            className="input"
            value={proxyUrl}
            onChange={(e) => {
              setProxy(e.target.value);
              if (message?.card === 'vetduat') setMessage(null);
            }}
            placeholder="https://your-proxy.workers.dev"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            aria-label={t('settings.vetduatUrlAria')}
          />
          <div className="button-row">
            <button className="btn primary" disabled={proxy == null} onClick={saveProxy}>
              {t('settings.save')}
            </button>
            <button className="btn secondary" disabled={!proxyUrl.trim()} onClick={testProxy}>
              {t('settings.test')}
            </button>
          </div>
          <Notice message={message} card="vetduat" />
        </section>

        <h3 className="section-title">{t('settings.data')}</h3>
        <section className="card form">
          <p className="hint">{t('settings.dataHint')}</p>
          <div className="button-row">
            <button className="btn secondary" onClick={doExport}>
              {t('settings.export')}
            </button>
            <button className="btn secondary" onClick={() => fileRef.current?.click()}>
              {t('settings.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </div>
          <button className="btn secondary danger-text" onClick={deleteAll}>
            {t('settings.deleteAll')}
          </button>
          <Notice message={message} card="data" />
          {persisted === false && (
            <p className="hint">
              {t('settings.mayClear')}{' '}
              <button className="link" onClick={askPersist}>
                {t('settings.askKeep')}
              </button>
            </p>
          )}
          {persisted && <p className="hint">{t('settings.kept')}</p>}
        </section>

        <h3 className="section-title">{t('settings.about')}</h3>
        <section className="card about">
          <p>
            {t('settings.aboutMvt1')}
            <a href="https://www.matvaretabellen.no" target="_blank" rel="noreferrer">
              Matvaretabellen
            </a>
            {t('settings.aboutMvt2')}
            {table?.fetchedAt ? t('settings.downloaded', { date: table.fetchedAt }) : ''}.
          </p>
          <p>
            {t('settings.aboutProducts1')}
            <a href="https://vetduat.no" target="_blank" rel="noreferrer">
              VetDuAt
            </a>
            {t('settings.and')}
            <a href="https://openfoodfacts.org" target="_blank" rel="noreferrer">
              Open Food Facts
            </a>
            {t('settings.aboutProducts2')}
          </p>
          <p className="muted">Matlogg {__APP_VERSION__}</p>
        </section>
      </main>
      <BottomNav active="settings" />
    </>
  );
}
