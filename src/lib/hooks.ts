import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
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
