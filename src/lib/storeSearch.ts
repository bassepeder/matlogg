import { useEffect, useRef, useState } from 'react';
import { LookupError, searchOpenFoodFacts, searchVetduat, type LookupResult } from './lookup';
import { t } from './i18n';
import type { Food, Settings } from './types';

const MIN_CHARS = 3;
// OFF only allows ~10 searches a minute, so wait for a longer pause in typing before asking it.
const DELAY: Record<'vetduat' | 'off', number> = { vetduat: 500, off: 1000 };
// After OFF refuses (rate limit or overload), leave it alone for a minute unless the user retries.
const OFF_BACKOFF_MS = 60_000;
let offBackoffUntil = 0;

export type RemoteSource = 'vetduat' | 'off';
const SOURCES: RemoteSource[] = ['vetduat', 'off'];

// Successful results per source and query; in-flight requests are shared so switching the source
// filter, or re-rendering, never fires the same request twice.
const cache = new Map<string, LookupResult[]>();
const inflight = new Map<string, Promise<LookupResult[]>>();

function fetchSource(source: RemoteSource, query: string, proxy: string | undefined): Promise<LookupResult[]> {
  const key = `${source}:${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  if (source === 'off' && Date.now() < offBackoffUntil) return Promise.reject(new LookupError(t('lookup.offSearchBusy'), 'busy'));
  let p = inflight.get(key);
  if (!p) {
    p = source === 'vetduat' ? searchVetduat(query, proxy ?? '') : searchOpenFoodFacts(query);
    if (source === 'off')
      p.catch((e) => {
        if (e instanceof LookupError && e.kind === 'busy') offBackoffUntil = Date.now() + OFF_BACKOFF_MS;
      });
    inflight.set(key, p);
    p.then((r) => cache.set(key, r))
      .catch(() => {})
      .finally(() => inflight.delete(key));
  }
  return p;
}

export type SourceView =
  | { status: 'disabled' }
  | { status: 'idle' | 'loading'; results: [] }
  | { status: 'done'; results: LookupResult[] }
  | { status: 'error'; results: []; error: string; soft: boolean };

type Entry = { query: string } & (
  | { status: 'loading' }
  | { status: 'done'; results: LookupResult[] }
  | { status: 'error'; error: string; soft: boolean }
);

export function useStoreSearch(q: string, settings: Settings, wanted: Record<RemoteSource, boolean>) {
  const query = q.trim();
  const proxy = settings.vetduatProxyUrl;
  const active: Record<RemoteSource, boolean> = { vetduat: wanted.vetduat && !!proxy, off: wanted.off };
  const canSearch = query.length >= MIN_CHARS;
  const [state, setState] = useState<Partial<Record<RemoteSource, Entry>>>({});
  const latest = useRef(query);

  useEffect(() => {
    latest.current = query;
  }, [query]);

  function run(source: RemoteSource, target: string) {
    const set = (entry: Entry) => {
      if (latest.current === target) setState((s) => ({ ...s, [source]: entry }));
    };
    if (!cache.has(`${source}:${target.toLowerCase()}`)) set({ query: target, status: 'loading' });
    fetchSource(source, target, proxy).then(
      (results) => set({ query: target, status: 'done', results }),
      (e: Error) => set({ query: target, status: 'error', error: e.message, soft: e instanceof LookupError && e.kind === 'busy' }),
    );
  }

  useEffect(() => {
    if (!canSearch) return;
    const ids = SOURCES.filter((s) => active[s]).map((s) => setTimeout(() => run(s, query), DELAY[s]));
    return () => ids.forEach(clearTimeout);
  }, [canSearch, query, proxy, active.vetduat, active.off]);

  const view = (source: RemoteSource): SourceView => {
    if (!active[source]) return { status: 'disabled' };
    if (!canSearch) return { status: 'idle', results: [] };
    const e = state[source];
    if (!e || e.query !== query || e.status === 'loading') return { status: 'loading', results: [] };
    return e.status === 'done' ? { status: 'done', results: e.results } : { status: 'error', results: [], error: e.error, soft: e.soft };
  };

  return {
    canSearch,
    vetduat: view('vetduat'),
    off: view('off'),
    retry: (source: RemoteSource) => {
      if (source === 'off') offBackoffUntil = 0;
      run(source, query);
    },
  };
}

// Store hits that are already saved on the device show up in the local list, so drop them here.
export function withoutSaved(results: LookupResult[], saved: Food[]): LookupResult[] {
  const ids = new Set(saved.map((f) => f.id));
  const eans = new Set(saved.map((f) => f.ean).filter(Boolean));
  return results.filter((r) => {
    const ean = r.food?.ean ?? r.partial?.ean;
    return !(r.food && ids.has(r.food.id)) && !(ean && eans.has(ean));
  });
}
