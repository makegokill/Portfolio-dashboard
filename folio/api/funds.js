// Vercel Serverless Function — Thai mutual fund daily prices (NAV) via Finnomena
// GET /api/funds?codes=SCBRM3,SCBRMNDQ(A) → latest NAV for each fund code
//
// NAVs are published once per trading day, after the market closes, so the
// answer is cached at Vercel's CDN for an hour. Finnomena's API is public but
// unofficial; if it changes, the app keeps showing the last NAV it saved.

const BASE = "https://www.finnomena.com/fn3/api/fund/v2/public/funds";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "application/json" };
const VALID_CODE = /^[A-Z0-9][A-Z0-9&()\-./ ]{0,39}$/;
const MAX_CODES = 30;
const LIST_TTL_MS = 24 * 60 * 60 * 1000;

// short_code → fund_id, kept while this function instance stays warm (the full list is ~3 MB)
let codeMap = null;
let codeMapAt = 0;

async function getCodeMap() {
  if (codeMap && Date.now() - codeMapAt < LIST_TTL_MS) return codeMap;
  const r = await fetch(BASE, { headers: HEADERS });
  if (!r.ok) throw new Error(`Finnomena fund list returned ${r.status}`);
  const d = await r.json();
  const map = new Map();
  for (const f of d?.data || []) {
    if (f && f.short_code && f.fund_id) map.set(String(f.short_code).toUpperCase(), f.fund_id);
  }
  if (!map.size) throw new Error("Finnomena fund list was empty");
  codeMap = map;
  codeMapAt = Date.now();
  return map;
}

function parseCodes(q) {
  if (!q) return [];
  const list = String(Array.isArray(q) ? q.join(",") : q)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => VALID_CODE.test(s));
  return [...new Set(list)].slice(0, MAX_CODES);
}

// Finnomena lists some share classes with a suffix, e.g. SCBRMNDQ is "SCBRMNDQ(A)"
function resolve(map, code) {
  if (map.has(code)) return code;
  for (const suffix of ["(A)", "-A"]) if (map.has(code + suffix)) return code + suffix;
  return null;
}

async function fetchLatest(fundId) {
  const r = await fetch(`${BASE}/${encodeURIComponent(fundId)}/latest`, { headers: HEADERS });
  if (!r.ok) throw new Error(`Finnomena returned ${r.status} for ${fundId}`);
  const d = (await r.json())?.data;
  if (!d || typeof d.value !== "number") throw new Error(`No NAV for ${fundId}`);
  return { nav: d.value, date: d.date || null, currency: d.currency || "THB", dChange: typeof d.d_change === "number" ? d.d_change : null };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const codes = parseCodes(req.query && req.query.codes);
  if (!codes.length) {
    res.status(200).json({ ok: false, error: "No fund codes given", funds: {} });
    return;
  }

  try {
    const map = await getCodeMap();
    const funds = {};
    const missing = [];
    const jobs = codes.map(async (code) => {
      const resolved = resolve(map, code);
      if (!resolved) { missing.push(code); return; }
      try {
        funds[code] = { ...(await fetchLatest(map.get(resolved))), resolved };
      } catch (e) {
        missing.push(code);
      }
    });
    await Promise.all(jobs);

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ ok: Object.keys(funds).length > 0, funds, missing, fetchedAt: new Date().toISOString() });
  } catch (err) {
    // Don't crash — the app falls back to the last NAV it saved
    res.status(200).json({ ok: false, error: err.message, funds: {}, missing: codes });
  }
}
