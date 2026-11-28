import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lookupBarcode,
  lookupOpenFoodFacts,
  lookupVetduat,
  parseOpenFoodFacts,
  parseVetduatDeklarasjon,
  parseVetduatProduct,
  searchOpenFoodFacts,
  searchVetduat,
  defaultVetduatProxyUrl,
  vetduatProxyUrl,
} from './lookup';

const APP_ORIGIN = 'https://bassepeder.github.io';

describe('vetduatProxyUrl', () => {
  it('offers the built-in proxy only on the origin the worker allows', () => {
    expect(defaultVetduatProxyUrl('http://localhost:5173')).toBe('');
    expect(defaultVetduatProxyUrl('https://someone.github.io')).toBe('');
    expect(defaultVetduatProxyUrl(undefined)).toBe('');
    expect(defaultVetduatProxyUrl(APP_ORIGIN)).toBe('https://vetduat-proxy.bassepeder.workers.dev');
    expect(vetduatProxyUrl({}, APP_ORIGIN)).toBe('https://vetduat-proxy.bassepeder.workers.dev');
    expect(vetduatProxyUrl({ vetduatProxyUrl: '' }, APP_ORIGIN)).toBe('https://vetduat-proxy.bassepeder.workers.dev');
  });

  it('prefers a proxy set in Settings, and treats a blank one as unset', () => {
    expect(vetduatProxyUrl({ vetduatProxyUrl: ' https://mine.workers.dev ' }, APP_ORIGIN)).toBe('https://mine.workers.dev');
    expect(vetduatProxyUrl({ vetduatProxyUrl: 'https://mine.workers.dev' }, 'http://localhost:5173')).toBe('https://mine.workers.dev');
    expect(vetduatProxyUrl({ vetduatProxyUrl: '  ' }, 'http://localhost:5173')).toBe('');
  });
});

// Shape copied from a real Open Food Facts response.
const offProduct = {
  code: '7037610239097',
  product_name: 'Brownies',
  brands: 'Orkla foods norge',
  product_quantity: '450',
  product_quantity_unit: 'g',
  serving_quantity: '45',
  serving_size: '1 stk (45 g)',
  nutriments: {
    'energy-kcal_100g': 390,
    proteins_100g: 4.8,
    carbohydrates_100g: 64,
    fat_100g: 12,
    sugars_100g: 48,
    'saturated-fat_100g': 1.4,
    salt_100g: 0.47,
  },
};

// Shape captured from the live VetDuAt API (POST /api/products/search -> GET /api/products/{guid}).
const vetduatProduct = {
  epDnr: 2465334,
  fellesProduktnavn: 'Grandiosa Pepperoni 500g',
  pakninger: [
    {
      gtin: 7039010019828,
      gln: 7080000083435,
      markedsnavn: 'Grandiosa Pepperoni 500g',
      varemerke: '',
      firmaNavn: 'ORKLA FOODS NORGE AS',
      mengde: 500,
      mengdetypeenhet: 'gram',
      harBilde: true,
      isBasispakning: true,
      deklarasjonListe: [
        'Energi kj pr 100=975.0000',
        'Energi kcal pr 100=233.0000',
        'Fett (totalt) pr 100=8.3000',
        'Mettede fettsyrer pr 100=4.5000',
        'Karbohydrater pr 100=28.0000',
        'Sukkerarter pr 100=3.1000',
        'Protein pr 100=11.0000',
        'Salt pr 100=1.0000',
      ],
    },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('parseOpenFoodFacts', () => {
  it('maps per-100 g nutriments, serving and package size', () => {
    const { food } = parseOpenFoodFacts('7037610239097', offProduct);
    expect(food).toMatchObject({
      id: 'ean:7037610239097',
      source: 'openfoodfacts',
      name: 'Brownies',
      brand: 'Orkla foods norge',
      packageGrams: 450,
      portions: [{ label: '1 stk (45 g)', grams: 45 }],
      per100: { kcal: 390, protein: 4.8, carbs: 64, fat: 12, sugar: 48, satFat: 1.4, salt: 0.47 },
    });
    expect(food?.per100.fiber).toBeUndefined();
  });

  it('prefers the Norwegian product name', () => {
    const { food } = parseOpenFoodFacts('1', { ...offProduct, product_name_nb: 'Brownies med sjokolade' });
    expect(food?.name).toBe('Brownies med sjokolade');
  });
});

describe('parseVetduatDeklarasjon', () => {
  it('maps the declaration lines to nutrients', () => {
    const n = parseVetduatDeklarasjon(vetduatProduct.pakninger[0].deklarasjonListe);
    expect(n).toMatchObject({ kcal: 233, protein: 11, carbs: 28, fat: 8.3, sugar: 3.1, satFat: 4.5, salt: 1 });
  });

  it('derives kcal from kJ when the kcal line is missing', () => {
    const n = parseVetduatDeklarasjon(['Energi kj pr 100=975.0000', 'Protein pr 100=11.0000']);
    expect(n.kcal).toBe(233);
  });
});

describe('parseVetduatProduct', () => {
  it('reads the base package and builds a proxied image URL', () => {
    const { food } = parseVetduatProduct(vetduatProduct, 'https://proxy.test');
    expect(food).toMatchObject({
      id: 'ean:7039010019828',
      source: 'vetduat',
      name: 'Grandiosa Pepperoni 500g',
      brand: 'ORKLA FOODS NORGE AS',
      packageGrams: 500,
      image: 'https://proxy.test/api/images/medium/7039010019828/7080000083435',
      per100: { kcal: 233, protein: 11, carbs: 28, fat: 8.3, sugar: 3.1, satFat: 4.5, salt: 1 },
    });
  });

  it('returns only partial data when nutrition is missing', () => {
    const noNutrition = { ...vetduatProduct, pakninger: [{ ...vetduatProduct.pakninger[0], deklarasjonListe: [] }] };
    const r = parseVetduatProduct(noNutrition, 'https://proxy.test');
    expect(r.food).toBeUndefined();
    expect(r.partial).toMatchObject({ ean: '7039010019828', name: 'Grandiosa Pepperoni 500g' });
  });
});

describe('lookupVetduat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches, then fetches the product, through the proxy', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/api/products/search')
        ? json({ products: [{ variantIdentityGuid: 'guid-1' }] })
        : json(vetduatProduct),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await lookupVetduat('7039010019828', 'https://proxy.test/');
    expect(r?.food?.source).toBe('vetduat');
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.test/api/products/search');
    expect(fetchMock.mock.calls[1][0]).toBe('https://proxy.test/api/products/guid-1');
  });

  it('returns null when the search has no hit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ products: [] })));
    expect(await lookupVetduat('000', 'https://proxy.test')).toBeNull();
  });
});

describe('searchVetduat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches by name and fetches nutrition for each hit', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/api/products/search')
        ? json({ products: [{ variantIdentityGuid: 'a' }, { variantIdentityGuid: 'b' }] })
        : json(vetduatProduct),
    );
    vi.stubGlobal('fetch', fetchMock);
    const results = await searchVetduat('yt proteinmelk', 'https://proxy.test');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.food?.source === 'vetduat')).toBe(true);
  });

  it('returns an empty list with no proxy', async () => {
    expect(await searchVetduat('x', '')).toEqual([]);
  });

  it('gives up with a clear error when the proxy does not answer within 10 s', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
        ),
      );
      const result = expect(searchVetduat('yt proteinmelk', 'https://proxy.test')).rejects.toThrow(/took too long/);
      await vi.advanceTimersByTimeAsync(9_999);
      await vi.advanceTimersByTimeAsync(1);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('searchOpenFoodFacts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches products sold in Norway and keeps only hits with nutrition', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      json({ products: [{ ...offProduct, code: '7035620021275', product_name: 'Blåbær', brands: 'First Price' }, { code: '1', product_name: 'No data' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const results = await searchOpenFoodFacts('blåbær first price');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/cgi/search.pl');
    expect(url.searchParams.get('search_terms')).toBe('blåbær first price');
    expect(url.searchParams.get('tag_0')).toBe('norway');
    expect(results.map((r) => [r.food?.source, r.food?.name, r.food?.brand])).toEqual([['openfoodfacts', 'Blåbær', 'First Price']]);
  });

  it('reports rate limiting as "busy", not as a broken connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 429)));
    await expect(searchOpenFoodFacts('melk')).rejects.toMatchObject({ kind: 'busy', message: expect.stringMatching(/unavailable right now/) });
  });

  it('treats a blocked response while online (OFF\'s 503 page has no CORS header) as busy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(searchOpenFoodFacts('melk')).rejects.toMatchObject({ kind: 'busy' });
  });
});

describe('lookupBarcode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses VetDuAt first when a proxy is set', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/products/search')) return json({ products: [{ variantIdentityGuid: 'guid-1' }] });
      if (url.includes('/api/products/')) return json(vetduatProduct);
      return json({ status: 1, product: offProduct });
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await lookupBarcode('7039010019828', 'https://proxy.test');
    expect(r.food?.source).toBe('vetduat');
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('openfoodfacts'))).toBe(false);
  });

  it('falls back to Open Food Facts when VetDuAt has no hit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/api/products/search') ? json({ products: [] }) : json({ status: 1, product: offProduct }),
      ),
    );
    const r = await lookupBarcode('7037610239097', 'https://proxy.test');
    expect(r.food?.source).toBe('openfoodfacts');
  });

  it('keeps the VetDuAt name when Open Food Facts has the nutrition', async () => {
    const noNutrition = { ...vetduatProduct, pakninger: [{ ...vetduatProduct.pakninger[0], deklarasjonListe: [] }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/products/search')) return json({ products: [{ variantIdentityGuid: 'guid-1' }] });
        if (url.includes('/api/products/')) return json(noNutrition);
        return json({ status: 1, product: offProduct });
      }),
    );
    const r = await lookupBarcode('7039010019828', 'https://proxy.test');
    expect(r.food?.source).toBe('openfoodfacts');
    expect(r.food?.name).toBe('Grandiosa Pepperoni 500g');
  });

  it('reports a failing proxy as a warning when Open Food Facts answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.includes('proxy.test') ? json({}, 502) : json({ status: 1, product: offProduct }))),
    );
    const r = await lookupBarcode('7037610239097', 'https://proxy.test');
    expect(r.food?.source).toBe('openfoodfacts');
    expect(r.warnings?.[0]).toMatch(/VetDuAt proxy error/);
  });

  it('only asks Open Food Facts without a proxy and returns empty partial when nothing is found', async () => {
    const fetchMock = vi.fn(async () => json({ status: 0 }, 404));
    vi.stubGlobal('fetch', fetchMock);
    const r = await lookupBarcode('123456789012');
    expect(r.food).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when every source fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(lookupBarcode('7037610239097', 'https://proxy.test')).rejects.toThrow(/Could not reach/);
  });
});

describe('barcode lookup matches the scanned code', () => {
  afterEach(() => vi.unstubAllGlobals());
  const multipack = {
    ...vetduatProduct,
    pakninger: [
      { ...vetduatProduct.pakninger[0] },
      { ...vetduatProduct.pakninger[0], gtin: 7039010019835, isBasispakning: false, markedsnavn: 'Grandiosa Pepperoni 3-pk' },
    ],
  };
  const vetduat = (products: Record<string, unknown>) =>
    vi.fn(async (url: string) =>
      url.includes('/search') ? json({ products: Object.keys(products).map((g) => ({ variantIdentityGuid: g })) }) : json(products[url.split('/').pop()!]),
    );

  it('reads the package with the scanned barcode and saves it under that code', async () => {
    vi.stubGlobal('fetch', vetduat({ g1: multipack }));
    const r = await lookupVetduat('7039010019835', 'https://proxy.test');
    expect(r?.food).toMatchObject({ id: 'ean:7039010019835', ean: '7039010019835', name: 'Grandiosa Pepperoni 3-pk' });
  });

  it('skips search hits that do not have the scanned barcode', async () => {
    vi.stubGlobal('fetch', vetduat({ other: { ...vetduatProduct, pakninger: [{ ...vetduatProduct.pakninger[0], gtin: 123 }] }, g1: vetduatProduct }));
    expect((await lookupVetduat('7039010019828', 'https://proxy.test'))?.food?.ean).toBe('7039010019828');
  });

  it('finds nothing rather than a different product', async () => {
    vi.stubGlobal('fetch', vetduat({ other: { ...vetduatProduct, pakninger: [{ ...vetduatProduct.pakninger[0], gtin: 123 }] } }));
    expect(await lookupVetduat('7039010019828', 'https://proxy.test')).toBeNull();
  });

  it('matches codes with a leading zero the service drops', async () => {
    vi.stubGlobal('fetch', vetduat({ g1: { ...vetduatProduct, pakninger: [{ ...vetduatProduct.pakninger[0], gtin: 7039010019828 }] } }));
    expect((await lookupVetduat('07039010019828', 'https://proxy.test'))?.food?.id).toBe('ean:07039010019828');
  });
});

describe('Open Food Facts barcode lookup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('treats an unknown barcode (404) as not found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: 0 }, 404)));
    expect(await lookupOpenFoodFacts('123')).toBeNull();
  });

  it('gives up with a timeout error instead of waiting forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))),
    );
    const p = lookupOpenFoodFacts('123');
    const check = expect(p).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(10_000);
    await check;
  });
});
