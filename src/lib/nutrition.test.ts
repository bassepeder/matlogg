import { describe, expect, it } from 'vitest';
import { addDays, dayLabel, mealForTime, toISODate } from './dates';
import { kcalFromMacros, parseNum, scale, sum } from './nutrition';

describe('scale', () => {
  it('scales per-100 g values to an amount', () => {
    const egg = { kcal: 148, protein: 12.9, carbs: 0.3, fat: 10.5, salt: 0.3 };
    const two = scale(egg, 112);
    expect(two.kcal).toBeCloseTo(165.76);
    expect(two.protein).toBeCloseTo(14.448);
    expect(two.salt).toBeCloseTo(0.336);
    expect(two.fiber).toBeUndefined();
  });
});

describe('sum', () => {
  it('adds required values and only the optional values that exist', () => {
    const total = sum([
      { kcal: 100, protein: 10, carbs: 5, fat: 2, sugar: 1 },
      { kcal: 50, protein: 1, carbs: 10, fat: 0 },
    ]);
    expect(total).toEqual({ kcal: 150, protein: 11, carbs: 15, fat: 2, sugar: 1 });
  });
});

describe('parseNum', () => {
  it('accepts Norwegian decimal commas', () => {
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum(' 1 000 ')).toBe(1000);
    expect(parseNum('0.5')).toBe(0.5);
  });
  it('returns undefined for empty or invalid input', () => {
    expect(parseNum('')).toBeUndefined();
    expect(parseNum('abc')).toBeUndefined();
    expect(parseNum(null)).toBeUndefined();
  });
});

describe('kcalFromMacros', () => {
  it('uses 4/4/9 kcal per gram plus 2 for fiber', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5, fiber: 3 })).toBe(40 + 80 + 45 + 6);
  });
});

describe('dates', () => {
  it('uses the local calendar date', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('labels nearby days', () => {
    expect(dayLabel('2026-11-26', '2026-11-26')).toBe('Today');
    expect(dayLabel('2026-11-25', '2026-11-26')).toBe('Yesterday');
  });
  it('guesses the meal from the time of day', () => {
    expect(mealForTime(new Date(2026, 0, 1, 7, 0))).toBe('breakfast');
    expect(mealForTime(new Date(2026, 0, 1, 12, 0))).toBe('lunch');
    expect(mealForTime(new Date(2026, 0, 1, 17, 30))).toBe('dinner');
    expect(mealForTime(new Date(2026, 0, 1, 21, 0))).toBe('snacks');
  });
});
