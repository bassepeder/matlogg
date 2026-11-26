import type { Food } from './types';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-̉̋-ͯ]/g, '')
    .normalize('NFC');
}

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

export interface IndexedFood {
  food: Food;
  name: string;
  nameWords: string[];
  other: string;
  otherWords: string[];
}

export function buildIndex(foods: Food[]): IndexedFood[] {
  return foods.map((food) => {
    const name = normalize(food.name);
    const other = normalize([food.brand, food.altName, food.keywords, food.ean].filter(Boolean).join(' '));
    return {
      food,
      name,
      nameWords: name.split(WORD_SPLIT).filter(Boolean),
      other,
      otherWords: other.split(WORD_SPLIT).filter(Boolean),
    };
  });
}

function scoreToken(item: IndexedFood, token: string): number {
  if (item.nameWords.some((w) => w.startsWith(token))) return 20;
  if (item.name.includes(token)) return 10;
  if (item.otherWords.some((w) => w.startsWith(token))) return 6;
  return 0;
}

export interface SearchOptions {
  limit?: number;
  boost?: (food: Food) => number;
}

export function searchFoods(index: IndexedFood[], query: string, opts: SearchOptions = {}): Food[] {
  const q = normalize(query).trim();
  const tokens = q.split(WORD_SPLIT).filter(Boolean);
  if (!tokens.length) return [];

  const scored: { food: Food; score: number }[] = [];
  for (const item of index) {
    let score = 0;
    let matchedAll = true;
    for (const t of tokens) {
      const s = scoreToken(item, t);
      if (!s) {
        matchedAll = false;
        break;
      }
      score += s;
    }
    if (!matchedAll) continue;

    if (item.name.startsWith(q)) score += 40;
    else if (item.nameWords[0] === tokens[0]) score += 25;
    score -= item.name.length * 0.15;
    score += opts.boost?.(item.food) ?? 0;
    scored.push({ food: item.food, score });
  }

  scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, 'nb'));
  return scored.slice(0, opts.limit ?? 60).map((s) => s.food);
}
