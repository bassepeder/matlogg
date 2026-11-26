# VetDuAt proxy

Matlogg searches and scans Norwegian grocery products in **VetDuAt**
(Tradesolution's EPD register, ~98 000 products). EPD is the grocery industry's own
master data, so it's the most complete and accurate source for Norwegian products.
Barcode scans fall back to Open Food Facts when VetDuAt has no match.

The VetDuAt API (`vetduatbffapi.tradesolution.no`) only answers requests whose
`Origin` is `https://vetduat.no`, and its CORS policy only allows that origin. A
browser app on any other domain is therefore refused. This tiny proxy sits in
between: it forwards `/api/*` calls with the right `Origin` and returns them with
open CORS so the app can read them.

## Deploy (Cloudflare Workers, free tier)

```bash
npm i -g wrangler
cd proxy
wrangler login
wrangler deploy
```

With `wrangler.toml`:

```toml
name = "vetduat-proxy"
main = "vetduat-worker.js"
compatibility_date = "2024-11-01"
```

Wrangler prints a URL like `https://vetduat-proxy.<you>.workers.dev`.

## Use

Open Matlogg → **Settings → VetDuAt**, paste that URL, **Save**, then **Test**.
Product search and barcode scans now use VetDuAt.

To lock the proxy to your own app, set `ALLOW_ORIGINS` in `vetduat-worker.js`.
