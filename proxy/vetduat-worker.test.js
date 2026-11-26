import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './vetduat-worker.js';

const call = (path, init) => worker.fetch(new Request(`https://proxy.test${path}`, init));

describe('vetduat proxy worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards API calls with the vetduat.no origin and open CORS', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('/api/products/search', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://vetduatbffapi.tradesolution.no/api/products/search');
    expect(init.headers.get('Origin')).toBe('https://vetduat.no');
    expect(init.cf).toBeUndefined();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toBeNull();
  });

  it('marks product images as cacheable for a week, at the edge and in the browser', async () => {
    const fetchMock = vi.fn(async () => new Response('img', { headers: { 'Content-Type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('/api/images/medium/7038010068157/7080000083435');
    expect(fetchMock.mock.calls[0][1].cf).toEqual({ cacheEverything: true, cacheTtl: 604800 });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=604800, immutable');
  });

  it('does not mark failed image responses as cacheable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    const res = await call('/api/images/medium/1/2');
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBeNull();
  });
});
