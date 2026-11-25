// Vercel Serverless Function — Thai Stock Prices via Yahoo Finance
// GET /api/stocks?symbols=CPAXT,JCK,DELTA → latest THB prices for those SET stocks
// (without ?symbols it falls back to the original default list)
//
// NOTE: Yahoo's old /v7/finance/quote endpoint started returning 401
// Unauthorized (requires cookie+crumb auth) as of Jan 2026. This uses
// /v8/finance/chart/{symbol} instead — the same endpoint Yahoo's own
// website uses, which still works without authentication.

const DEFAULT_TICKERS = ["CPAXT", "JCK", "KEX", "SCGP", "TRUE", "DELTA"];
const VALID_TICKER = /^[A-Z0-9][A-Z0-9&.\-]{0,14}$/;
const MAX_TICKERS = 40;

function parseTickers(q) {
  if (!q) return DEFAULT_TICKERS;
  const list = String(Array.isArray(q) ? q.join(",") : q)
    .split(",")
    .map((s) => s.trim().toUpperCase().replace(/\.BK$/, ""))
    .filter((s) => VALID_TICKER.test(s));
  const unique = [...new Set(list)].slice(0, MAX_TICKERS);
  return unique.length ? unique : DEFAULT_TICKERS;
}

async function fetchOne(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });
  if (!response.ok) throw new Error(`Yahoo returned ${response.status} for ${symbol}`);
  const data = await response.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No data for ${symbol}`);
  return {
    symbol,
    price: meta.regularMarketPrice ?? null,
    time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    state: meta.marketState ?? "UNKNOWN", // "REGULAR", "CLOSED", "PRE", "POST"
  };
}

export default async function handler(req, res) {
  // CORS — allow your Vercel app to call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  // Let Vercel's CDN reuse an answer for 60s so many refreshes don't hammer Yahoo
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  try {
    const tickers = parseTickers(req.query && req.query.symbols);
    const results = await Promise.allSettled(tickers.map((t) => fetchOne(`${t}.BK`)));

    const prices = {};
    let anyOk = false;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const sym = tickers[i];
        prices[sym] = { price: r.value.price, time: r.value.time, state: r.value.state };
        anyOk = true;
      }
    });

    if (!anyOk) throw new Error("All symbol fetches failed");

    res.status(200).json({ ok: true, prices, fetchedAt: new Date().toISOString() });
  } catch (err) {
    // Return error but don't crash — app falls back to manual/last-known values
    res.status(200).json({ ok: false, error: err.message, prices: {} });
  }
}
