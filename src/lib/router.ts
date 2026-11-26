import { useMemo, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let stack: string[] = [];
let index = 0;

function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/';
}

function emit() {
  for (const l of listeners) l();
}

export function initRouter() {
  const i = (history.state as { i?: number } | null)?.i;
  index = typeof i === 'number' ? i : 0;
  if (typeof i !== 'number') history.replaceState({ i: 0 }, '');
  stack[index] = currentPath();
  window.addEventListener('popstate', (e) => {
    const s = (e.state as { i?: number } | null)?.i;
    index = typeof s === 'number' ? s : 0;
    stack[index] = currentPath();
    emit();
  });
}

export function push(path: string) {
  index++;
  stack = stack.slice(0, index);
  stack[index] = path;
  history.pushState({ i: index }, '', `#${path}`);
  emit();
}

export function replace(path: string) {
  stack[index] = path;
  history.replaceState({ i: index }, '', `#${path}`);
  emit();
}

export function back(fallback = '/') {
  if (index > 0) history.back();
  else replace(fallback);
}

export function backTo(match: (path: string) => boolean, fallback: string) {
  for (let j = index - 1; j >= 0; j--) {
    if (stack[j] != null && match(stack[j])) {
      history.go(j - index);
      return;
    }
  }
  replace(fallback);
}

export const isDiaryPath = (p: string) => p === '/' || p.startsWith('/day/');

export function backToDiary(date: string) {
  backTo(isDiaryPath, `/day/${date}`);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute() {
  const path = useSyncExternalStore(subscribe, currentPath);
  return useMemo(() => {
    const [pathname, search = ''] = path.split('?');
    const parts = pathname
      .split('/')
      .filter(Boolean)
      .map((p) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      });
    return { path, parts, query: new URLSearchParams(search) };
  }, [path]);
}
