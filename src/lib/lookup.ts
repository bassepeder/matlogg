import { t } from './i18n';
import type { Food, Nutrients, Portion } from './types';

export interface LookupResult {
  food?: Food;
  partial?: { ean?: string; name?: string; brand?: string; packageGrams?: number; image?: string };
  warnings?: string[];
}

export class LookupError extends Error {
  constructor(
    message: string,
    /** 'busy' means the service refused for now (rate limit, overload); worth backing off. */
    readonly kind: 'unreachable' | 'timeout' | 'http' | 'busy' = 'http',
    readonly status?: number,
  ) {
    super(message);
  }
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

function toGrams(amount: unknown, unit: unknown): number | undefined {
  const n = num(amount);
  if (n == null || n <= 0) return undefined;
  switch (String(unit ?? 'g').toLowerCase()) {
    case 'kg':
    case 'l':
      return n * 1000;
    case 'cl':
      return n * 10;
    case 'dl':
      return n * 100;
    case 'g':
    case 'ml':
      return n;
    default:
      return undefined;
  }
}

function hasNutrition(n: Partial<Nutrients>): n is Nutrients {
  return n.kcal != null && (n.protein != null || n.carbs != null || n.fat != null);
}

function complete(n: Partial<Nutrients>): Nutrients {
  const out: Nutrients = { kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0 };
  for (const k of ['sugar', 'fiber', 'satFat', 'salt'] as const) if (n[k] != null) out[k] = n[k];
  return out;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_nb?: string;
  product_name_no?: string;
  product_name_en?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  image_front_small_url?: string;
}

export function parseOpenFoodFacts(ean: string, p: OffProduct): LookupResult {
  const n = p.nutriments ?? {};
  const per100: Partial<Nutrients> = {
    kcal: num(n['energy-kcal_100g']),
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    fat: num(n['fat_100g']),
    sugar: num(n['sugars_100g']),
    fiber: num(n['fiber_100g']),
    satFat: num(n['saturated-fat_100g']),
    salt: num(n['salt_100g']),
  };
  if (per100.kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj != null) per100.kcal = Math.round(kj / 4.184);
  }
  for (const k of Object.keys(per100) as (keyof Nutrients)[]) if (per100[k] == null) delete per100[k];

  const name = (p.product_name_nb || p.product_name_no || p.product_name || p.product_name_en || '').trim() || undefined;
  const partial = {
    ean,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    packageGrams: toGrams(p.product_quantity, p.product_quantity_unit ?? 'g'),
    image: p.image_front_small_url,
  };
  if (!hasNutrition(per100) || !name) return { partial };

  const serving = num(p.serving_quantity);
  const servingLabel = p.serving_size?.trim();
  const label = servingLabel && !/^[\d.,\s]*(g|ml)$/i.test(servingLabel) ? servingLabel : 'serving';
  const portions: Portion[] | undefined = serving && serving > 0 ? [{ label, grams: serving }] : undefined;

  return {
    partial,
    food: {
      id: `ean:${ean}`,
      source: 'openfoodfacts',
      ean,
      name,
      brand: partial.brand,
      per100: complete(per100),
      portions,
      packageGrams: partial.packageGrams,
      image: partial.image,
      updatedAt: Date.now(),
    },
  };
}

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_nb',
  'product_name_no',
  'product_name_en',
  'brands',
  'nutriments',
  'product_quantity',
  'product_quantity_unit',
  'serving_quantity',
  'serving_size',
  'image_front_small_url',
].join(',');

// Name search in Open Food Facts, limited to products sold in Norway. Results carry full
// nutrition, so no extra request per hit. OFF allows only ~10 searches a minute per user.
export async function searchOpenFoodFacts(query: string, limit = 15): Promise<LookupResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    json: '1',
    page_size: String(limit),
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'norway',
    fields: OFF_FIELDS,
  });
  let data: { products?: OffProduct[] };
  try {
    data = await fetchJson(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
      unreachable: 'lookup.offUnreachable',
      timeout: 'lookup.offTimeout',
      error: 'lookup.offError',
    });
  } catch (e) {
    // Under load OFF answers search with a 503 page that has no CORS header, which the browser
    // reports as a network failure. If we are online, that means "busy", not "check your connection".
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const kind = e instanceof LookupError ? e.kind : 'unreachable';
    if (kind === 'busy' || (kind === 'unreachable' && online)) throw new LookupError(t('lookup.offSearchBusy'), 'busy');
    throw e;
  }
  return (data.products ?? [])
    .filter((p) => p.code)
    .map((p) => parseOpenFoodFacts(p.code!, p))
    .filter((r) => r.food);
}

export async function lookupOpenFoodFacts(ean: string): Promise<LookupResult | null> {
  let json: { status?: number; product?: OffProduct } | null;
  try {
    json = await fetchJson(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${OFF_FIELDS}`,
      { unreachable: 'lookup.offUnreachable', timeout: 'lookup.offTimeout', error: 'lookup.offError' },
    );
  } catch (e) {
    // OFF answers an unknown barcode with 404 (and a JSON body); that is "not found", not a failure.
    if (e instanceof LookupError && e.status === 404) return null;
    throw e;
  }
  if (json?.status === 0 || !json?.product) return null;
  return parseOpenFoodFacts(ean, json.product);
}

// ---- VetDuAt (Tradesolution EPD, via a proxy that injects the vetduat.no Origin) ----

interface VetduatSearchProduct {
  variantIdentityGuid?: string;
}

interface VetduatPackage {
  gtin?: number | string;
  gln?: number | string;
  markedsnavn?: string;
  varemerke?: string;
  firmaNavn?: string;
  mengde?: number;
  mengdetypeenhet?: string;
  harBilde?: boolean;
  deklarasjonListe?: string[];
  isBasispakning?: boolean;
}

interface VetduatProduct {
  fellesProduktnavn?: string;
  pakninger?: VetduatPackage[];
}

const VETDUAT_NUTRIENTS: { re: RegExp; key: keyof Nutrients }[] = [
  { re: /^energi kcal/i, key: 'kcal' },
  { re: /^protein/i, key: 'protein' },
  { re: /^karbohydrater/i, key: 'carbs' },
  { re: /^fett \(totalt\)/i, key: 'fat' },
  { re: /^sukkerarter/i, key: 'sugar' },
  { re: /^kostfiber/i, key: 'fiber' },
  { re: /^mettede fettsyrer/i, key: 'satFat' },
  { re: /^salt/i, key: 'salt' },
];

// Lines look like "Energi kcal pr 100=233.0000" or "Protein pr 100=11.0000".
export function parseVetduatDeklarasjon(list: string[] | undefined): Partial<Nutrients> {
  const out: Partial<Nutrients> = {};
  let kj: number | undefined;
  for (const line of list ?? []) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const label = line.slice(0, eq).trim();
    const value = num(line.slice(eq + 1));
    if (value == null) continue;
    if (/^energi kj/i.test(label)) kj = value;
    const match = VETDUAT_NUTRIENTS.find((n) => n.re.test(label));
    if (match) out[match.key] = value;
  }
  if (out.kcal == null && kj != null) out.kcal = Math.round(kj / 4.184);
  return out;
}

const VETDUAT_UNITS: Record<string, string> = {
  gram: 'g',
  kilogram: 'kg',
  liter: 'l',
  desiliter: 'dl',
  centiliter: 'cl',
  milliliter: 'ml',
};

function vetduatGrams(amount: unknown, unit: unknown): number | undefined {
  const u = VETDUAT_UNITS[String(unit ?? '').toLowerCase()] ?? String(unit ?? 'g');
  return toGrams(amount, u);
}

// GTINs can come back as numbers, which drops leading zeros, so compare without them.
const sameGtin = (a: unknown, b: string) => a != null && String(a).replace(/^0+/, '') === b.replace(/^0+/, '');

// With `scanned`, reads the package with that barcode (a multipack and its single item are different
// packages of one product) and keeps the scanned code, so the next scan finds it on the device.
export function parseVetduatProduct(product: VetduatProduct, proxyBase: string, scanned?: string): LookupResult {
  const packages = product.pakninger ?? [];
  const pkg = scanned
    ? packages.find((p) => sameGtin(p.gtin, scanned))
    : (packages.find((p) => p.isBasispakning) ?? packages[0]);
  const ean = scanned ?? (pkg?.gtin != null ? String(pkg.gtin) : '');
  const gln = pkg?.gln != null ? String(pkg.gln) : '';
  const nutrition = parseVetduatDeklarasjon(pkg?.deklarasjonListe);
  const name = (pkg?.markedsnavn || product.fellesProduktnavn || '').trim() || undefined;
  const brand = pkg?.varemerke?.trim() || pkg?.firmaNavn?.trim() || undefined;
  const gtin = pkg?.gtin != null ? String(pkg.gtin) : '';
  const image = pkg?.harBilde && gtin && gln ? `${proxyBase}/api/images/medium/${gtin}/${gln}` : undefined;
  const partial = {
    ean: ean || undefined,
    name,
    brand,
    packageGrams: vetduatGrams(pkg?.mengde, pkg?.mengdetypeenhet),
    image,
  };
  if (!hasNutrition(nutrition) || !name || !ean) return { partial };
  return {
    partial,
    food: {
      id: `ean:${ean}`,
      source: 'vetduat',
      ean,
      name,
      brand,
      per100: complete(nutrition),
      packageGrams: partial.packageGrams,
      image,
      updatedAt: Date.now(),
    },
  };
}

function normalizeProxy(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

// The app's own VetDuAt proxy (proxy/), used unless Settings names another. The worker only answers
// the origin in its ALLOW_ORIGINS, so it is only offered there: local dev and forks deployed
// elsewhere start without a proxy and set up their own, as before.
const BUILT_IN_PROXY = { url: 'https://vetduat-proxy.bassepeder.workers.dev', origin: 'https://bassepeder.github.io' };

export function defaultVetduatProxyUrl(origin: string | undefined = globalThis.location?.origin): string {
  return origin === BUILT_IN_PROXY.origin ? BUILT_IN_PROXY.url : '';
}

/** The proxy to use: the one set in Settings, else the built-in one; '' means VetDuAt is off. */
export function vetduatProxyUrl(settings: { vetduatProxyUrl?: string }, origin?: string): string {
  return settings.vetduatProxyUrl?.trim() || defaultVetduatProxyUrl(origin);
}

export const SEARCH_TIMEOUT_MS = 10_000;

type FetchMessages = {
  unreachable: 'lookup.vetduatUnreachable' | 'lookup.offUnreachable';
  timeout: 'lookup.vetduatTimeout' | 'lookup.offTimeout';
  error: 'lookup.vetduatError' | 'lookup.offError';
};

// Fetches and parses JSON. The whole request, body included, gives up after SEARCH_TIMEOUT_MS so a
// hung server shows an error instead of an endless spinner.
async function fetchJson<T>(url: string, messages: FetchMessages, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
  const failed = () =>
    ctrl.signal.aborted ? new LookupError(t(messages.timeout), 'timeout') : new LookupError(t(messages.unreachable), 'unreachable');
  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch {
      throw failed();
    }
    if (!res.ok)
      throw new LookupError(t(messages.error, { status: res.status }), res.status === 429 || res.status === 503 ? 'busy' : 'http', res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw failed();
    }
  } finally {
    clearTimeout(timer);
  }
}

const VETDUAT_MESSAGES: FetchMessages = {
  unreachable: 'lookup.vetduatUnreachable',
  timeout: 'lookup.vetduatTimeout',
  error: 'lookup.vetduatError',
};

function vetduatJson<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(`${base}${path}`, VETDUAT_MESSAGES, init);
}

export async function lookupVetduat(ean: string, proxy: string): Promise<LookupResult | null> {
  const base = normalizeProxy(proxy);
  if (!base) return null;
  const search = await vetduatJson<{ products?: VetduatSearchProduct[] }>(base, '/api/products/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: ean, top: 3, skip: 0, count: true }),
  });
  // The search is a text search, so a hit is not necessarily this barcode: use the first product
  // that actually has a package with it, and treat none as not found rather than log the wrong thing.
  for (const hit of (search?.products ?? []).filter((p) => p.variantIdentityGuid)) {
    const product = await vetduatJson<VetduatProduct>(base, `/api/products/${encodeURIComponent(hit.variantIdentityGuid!)}`);
    if (product.pakninger?.some((p) => sameGtin(p.gtin, ean))) return parseVetduatProduct(product, base, ean);
  }
  return null;
}

// Text search: VetDuAt results carry no nutrition, so fetch each hit's product detail.
export async function searchVetduat(query: string, proxy: string, limit = 8): Promise<LookupResult[]> {
  const base = normalizeProxy(proxy);
  if (!base) return [];
  const data = await vetduatJson<{ products?: VetduatSearchProduct[] }>(base, '/api/products/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: query, top: limit, skip: 0, count: true }),
  });
  const products = (data?.products ?? []).filter((p) => p.variantIdentityGuid);
  const details = await Promise.all(
    products.map(async (p) => {
      try {
        const product = await vetduatJson<VetduatProduct>(base, `/api/products/${encodeURIComponent(p.variantIdentityGuid!)}`);
        return parseVetduatProduct(product, base);
      } catch {
        return null;
      }
    }),
  );
  return details.filter((r): r is LookupResult => !!r && !!r.food);
}

export async function lookupBarcode(ean: string, vetduatProxy?: string): Promise<LookupResult> {
  const errors: string[] = [];
  let partial: LookupResult['partial'];

  // VetDuAt (EPD) is the industry's own master data, so prefer it when a proxy is set up.
  if (vetduatProxy) {
    try {
      const r = await lookupVetduat(ean, vetduatProxy);
      if (r?.food) return { ...r, warnings: errors };
      partial = r?.partial;
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  try {
    const r = await lookupOpenFoodFacts(ean);
    if (r?.food) {
      if (partial?.name) r.food.name = partial.name;
      if (partial?.brand) r.food.brand = partial.brand;
      r.food.packageGrams ??= partial?.packageGrams;
      return { ...r, warnings: errors };
    }
    partial = { ...r?.partial, ...stripEmpty(partial) };
  } catch (e) {
    errors.push((e as Error).message);
    if (!partial) throw new LookupError(errors.join(' '));
  }

  return { partial, warnings: errors };
}

function stripEmpty<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '')) as Partial<T>;
}
