import { afterEach, describe, expect, it } from 'vitest';
import { dayLabel, monthGrid } from './dates';
import { detectLang, getLang, portionLabel, setLangSetting, t } from './i18n';
import { carbsFromRest, fmt, resolveGoals } from './nutrition';
import { DEFAULT_MEALS, mealInSentence } from './types';

afterEach(() => setLangSetting('en'));

describe('detectLang', () => {
  it('picks Norwegian for any Norwegian variant listed before English', () => {
    expect(detectLang(['nb-NO', 'en-US'])).toBe('nb');
    expect(detectLang(['nn'])).toBe('nb');
    expect(detectLang(['no'])).toBe('nb');
    expect(detectLang(['en-GB', 'nb-NO'])).toBe('en');
  });
  it('falls back to English', () => {
    expect(detectLang(['sv-SE', 'de'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});

describe('t', () => {
  it('translates and fills in placeholders', () => {
    setLangSetting('en');
    expect(t('log.addButton', { kcal: 369, meal: 'Breakfast' })).toBe('Add 369 kcal to Breakfast');
    setLangSetting('nb');
    expect(getLang()).toBe('nb');
    expect(t('log.addButton', { kcal: 369, meal: mealInSentence('breakfast', DEFAULT_MEALS) })).toBe('Legg til 369 kcal i frokost');
  });

  it('formats numbers and dates for the language', () => {
    setLangSetting('nb');
    expect(fmt(2.5)).toBe('2,5');
    expect(dayLabel('2026-11-25', '2026-11-26')).toBe('I går');
    setLangSetting('en');
    expect(fmt(2.5)).toBe('2.5');
  });
});

describe('portionLabel', () => {
  it('shows Matvaretabellen portions in the app language', () => {
    setLangSetting('nb');
    expect(portionLabel('stk')).toBe('stk');
    expect(portionLabel('package')).toBe('pakke');
    setLangSetting('en');
    expect(portionLabel('stk')).toBe('pcs');
    expect(portionLabel('desiliter')).toBe('decilitre');
  });
  it('keeps labels you typed yourself', () => {
    expect(portionLabel('bolle')).toBe('bolle');
  });
});

describe('carbs as rest of calories', () => {
  it('gives carbs the calories left after protein and fat', () => {
    // 2800 − 180×4 − 80×9 = 1360 kcal → 340 g
    expect(carbsFromRest({ kcal: 2800, protein: 180, fat: 80 })).toBe(340);
    expect(resolveGoals({ kcal: 2800, protein: 180, fat: 80, carbs: 100, carbsAuto: true }).carbs).toBe(340);
  });
  it('leaves fixed carbs alone and never goes below zero', () => {
    expect(resolveGoals({ kcal: 2800, protein: 180, fat: 80, carbs: 100 }).carbs).toBe(100);
    expect(carbsFromRest({ kcal: 1000, protein: 200, fat: 50 })).toBe(0);
  });
});

describe('monthGrid', () => {
  it('starts weeks on Monday and fills whole weeks', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid.length % 7).toBe(0);
    expect(grid[0].iso).toBe('2026-10-26'); // the Monday before
    expect(grid[6]).toEqual({ iso: '2026-11-01', inMonth: true });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
  });
});
