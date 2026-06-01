// Vercel Serverless Function — Thai Stock Prices via Yahoo Finance
// GET /api/stocks → returns latest THB prices for SET stocks

const SYMBOLS = ["CPAXT.BK", "JCK.BK", "KEX.BK", "SCGP.BK", "TRUE.BK"];

export default async function handler(req, res) {
  // CORS — allow your Vercel app to call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const ids = SYMBOLS.join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ids}&fields=regularMarketPrice,regularMarketTime,marketState`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);

    const data = await response.json();
    const quotes = data?.quoteResponse?.result ?? [];

    const prices = {};
    quotes.forEach((q) => {
      const sym = q.symbol.replace(".BK", ""); // "CPAXT.BK" → "CPAXT"
      prices[sym] = {
        price: q.regularMarketPrice ?? null,
        time: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
        state: q.marketState ?? "UNKNOWN", // "REGULAR", "CLOSED", "PRE", "POST"
      };
    });

    res.status(200).json({ ok: true, prices, fetchedAt: new Date().toISOString() });
  } catch (err) {
    // Return error but don't crash — app falls back to manual values
    res.status(200).json({ ok: false, error: err.message, prices: {} });
  }
}
