import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { todayISO } from './dates';
import { DEFAULT_SETTINGS, getSettings } from './db';
import { loadMatvaretabellen, type MvtTable } from './matvaretabellen';
import { DEFAULT_MEALS, type Meal, type Settings } from './types';

let lastSettings: Settings | undefined;

export function useSettingsState(): Settings | undefined {
  const s = useLiveQuery(getSettings, []);
  if (s) lastSettings = s;
  return s ?? lastSettings;
}

export function useSettings(): Settings {
  return useSettingsState() ?? DEFAULT_SETTINGS;
}

export function mealsOf(settings: Settings): Meal[] {
  return settings.meals?.length ? settings.meals : DEFAULT_MEALS;
}

export function useMeals(): Meal[] {
  return mealsOf(useSettings());
}

// Today's date that rolls over at midnight, also when the app comes back after sitting in the background.
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday(todayISO());
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

export function useMatvaretabellen(): { table?: MvtTable; error?: string } {
  const [state, setState] = useState<{ table?: MvtTable; error?: string }>({});
  useEffect(() => {
    let alive = true;
    loadMatvaretabellen().then(
      (table) => alive && setState({ table }),
      (e: Error) => alive && setState({ error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
