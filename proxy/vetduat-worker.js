// Cloudflare Worker: proxy for the VetDuAt (Tradesolution EPD) API.
//
// The upstream API at vetduatbffapi.tradesolution.no only answers requests whose
// Origin is https://vetduat.no, and its CORS headers only allow that origin — so a
// browser app on any other domain is refused. This worker forwards /api/* requests
// with the right Origin and returns them with permissive CORS so the PWA can read
// them. Deploy it, then paste its URL into Matlogg → Settings → VetDuAt.
//
//   npm i -g wrangler
//   wrangler deploy        # from this folder (see wrangler.toml below)
//
// wrangler.toml:
//   name = "vetduat-proxy"
//   main = "vetduat-worker.js"
//   compatibility_date = "2024-11-01"

const UPSTREAM = 'https://vetduatbffapi.tradesolution.no';
const SITE = 'https://vetduat.no';

// Product images rarely change: let browsers and Cloudflare's edge keep them for a week.
const IMAGE_TTL = 7 * 24 * 60 * 60;

// Optional: lock the proxy to your own app's origin(s). Empty array = allow any.
const ALLOW_ORIGINS = [];

function corsHeaders(origin) {
  const allow = ALLOW_ORIGINS.length === 0 ? '*' : ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const upstream = UPSTREAM + url.pathname + url.search;
    const isImage = url.pathname.startsWith('/api/images/');
    const headers = new Headers();
    headers.set('Origin', SITE);
    headers.set('Referer', SITE + '/');
    headers.set('Accept', request.headers.get('Accept') ?? 'application/json');
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    };

    let res;
    try {
      // `cf` is Cloudflare's edge-cache control; other runtimes ignore it.
      res = await fetch(upstream, isImage ? { ...init, cf: { cacheEverything: true, cacheTtl: IMAGE_TTL } } : init);
    } catch {
      return new Response('Upstream unreachable', { status: 502, headers: cors });
    }

    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) out.set(k, v);
    out.delete('Access-Control-Allow-Credentials');
    if (isImage && res.ok) out.set('Cache-Control', `public, max-age=${IMAGE_TTL}, immutable`);
    return new Response(res.body, { status: res.status, headers: out });
  },
};
