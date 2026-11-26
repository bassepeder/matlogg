import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://www.matvaretabellen.no/api';
const OUT_DIR = new URL('../public/data/', import.meta.url);

async function get(path) {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const round1 = (n) => (n == null ? undefined : Math.round(n * 10) / 10);

function nutrient(food, id) {
  return food.constituents?.find((c) => c.nutrientId === id)?.quantity;
}

const [nb, en] = await Promise.all([get('nb/foods.json'), get('en/foods.json')]);
const enById = new Map(en.foods.map((f) => [f.foodId, f]));

const foods = [];
const skipped = [];
const portionNamesEn = {};

for (const f of nb.foods) {
  const e = enById.get(f.foodId);
  const kcal = f.calories?.quantity ?? (f.energy?.quantity != null ? f.energy.quantity / 4.184 : undefined);
  if (kcal == null) {
    skipped.push(f.foodName);
    continue;
  }

  const sodiumMg = nutrient(f, 'Na');
  const portions = (f.portions ?? [])
    .filter((p) => p.unit === 'g' && p.quantity > 0)
    .map((p) => {
      const enName = e?.portions?.find((x) => x.id === p.id)?.portionName;
      if (enName && enName !== p.portionName) portionNamesEn[p.portionName] = enName;
      return [p.portionName, round1(p.quantity)];
    });

  const row = {
    id: f.foodId,
    n: f.foodName.trim(),
    en: e?.foodName?.trim(),
    g: f.foodGroupId,
    k: Math.round(kcal),
    p: round1(nutrient(f, 'Protein')) ?? 0,
    c: round1(nutrient(f, 'Karbo')) ?? 0,
    f: round1(nutrient(f, 'Fett')) ?? 0,
    fi: round1(nutrient(f, 'Fiber')),
    su: round1(nutrient(f, 'Mono+Di')),
    sf: round1(nutrient(f, 'Mettet')),
    sa: round1(nutrient(f, 'NaCl') ?? (sodiumMg != null ? (sodiumMg * 2.5) / 1000 : undefined)),
    po: portions.length ? portions : undefined,
    kw: f.searchKeywords?.length ? f.searchKeywords.join(' ') : undefined,
  };
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  foods.push(row);
}

foods.sort((a, b) => a.n.localeCompare(b.n, 'nb'));

await mkdir(OUT_DIR, { recursive: true });
const out = new URL('matvaretabellen.json', OUT_DIR);
const body = JSON.stringify({
  source: 'Matvaretabellen, Mattilsynet (www.matvaretabellen.no)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  foods,
});
await writeFile(out, body);

const namesOut = new URL('../src/lib/portion-names.en.json', import.meta.url);
const sortedNames = Object.fromEntries(Object.entries(portionNamesEn).sort(([a], [b]) => a.localeCompare(b, 'nb')));
await writeFile(namesOut, JSON.stringify(sortedNames, null, 2) + '\n');

console.log(`Wrote ${foods.length} foods (${(body.length / 1024).toFixed(0)} KB) to ${out.pathname}`);
if (skipped.length) console.log(`Skipped ${skipped.length} without energy data: ${skipped.join(', ')}`);
