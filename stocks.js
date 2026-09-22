// Vercel Serverless Function — Thai Stock Prices via Yahoo Finance
// GET /api/stocks → returns latest THB prices for SET stocks
//
// NOTE: Yahoo's old /v7/finance/quote endpoint started returning 401
// Unauthorized (requires cookie+crumb auth) as of Jan 2026. This uses
// /v8/finance/chart/{symbol} instead — the same endpoint Yahoo's own
// website uses, which still works without authentication.

const SYMBOLS = ["CPAXT.BK", "JCK.BK", "KEX.BK", "SCGP.BK", "TRUE.BK", "DELTA.BK"];

async function fetchOne(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
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

  try {
    const results = await Promise.allSettled(SYMBOLS.map(fetchOne));

    const prices = {};
    let anyOk = false;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const sym = SYMBOLS[i].replace(".BK", ""); // "CPAXT.BK" → "CPAXT"
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
