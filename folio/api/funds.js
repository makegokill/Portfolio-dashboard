// Vercel Serverless Function — Thai mutual fund daily prices (NAV) from the Thai SEC Open Data API (V2)
// GET /api/funds?codes=SCBRM3,SCBRMNDQ(A) → latest NAV per fund code
// GET /api/funds?codes=SCBRM3&debug=1     → also returns the raw SEC lookups (no keys), for troubleshooting
//
// Needs free SEC developer keys (secopendata.sec.or.th → Subscriptions). Each SEC product has its own key,
// stored in Vercel as environment variables:
//   SEC_GENERAL_INFO_KEY — "fund general info" product (finds a fund's project ID from its code)
//   SEC_DAILY_INFO_KEY   — "Fund Daily Info" product (daily NAV)
// (SEC_API_KEY is still accepted as a fallback for either.) NAVs are published once per trading day,
// so answers are cached at Vercel's CDN for an hour.

const BASE = "https://api.sec.or.th";
const VALID_CODE = /^[A-Z0-9][A-Z0-9&()\-./ ]{0,39}$/;
const MAX_CODES = 30;
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
const NAV_WINDOW_DAYS = 14;

// code → { projId, className, resolved }, kept while this function instance stays warm
const lookupCache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").trim().toUpperCase();

function parseCodes(q) {
  if (!q) return [];
  const list = String(Array.isArray(q) ? q.join(",") : q)
    .split(",")
    .map(norm)
    .filter((s) => VALID_CODE.test(s));
  return [...new Set(list)].slice(0, MAX_CODES);
}

// "SCBRMNDQ(A)" → { base: "SCBRMNDQ", cls: "A" };  "SCBLTT-SSF" → { base: "SCBLTT-SSF", cls: null }
function splitClass(code) {
  const m = code.match(/^(.*?)\(([^)]+)\)$/);
  return m ? { base: m[1].trim(), cls: m[2].trim() } : { base: code, cls: null };
}

async function secGet(path, params, key, keyName) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${BASE}${path}?${qs}`, {
      headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
    });
    if (r.status === 204) return { items: [] };
    if (r.status === 421 || r.status === 429 || r.status >= 500) {
      const wait = Math.min(5000, (+r.headers.get("retry-after") || 1) * 1000);
      await sleep(wait);
      continue;
    }
    if (r.status === 401) throw new Error(`SEC rejected the key (401) — check ${keyName} in Vercel`);
    if (r.status === 403) throw new Error(`${keyName} isn't allowed to use ${path} (403) — check it's the key for the right SEC product`);
    if (!r.ok) throw new Error(`SEC returned ${r.status} for ${path}`);
    return r.json();
  }
  throw new Error(`SEC kept rate-limiting ${path}`);
}

// Find the fund project (and share class, if any) for a code like "SCBRM3" or "SCBAUTO(SSF)"
async function lookup(code, key, debug) {
  const hit = lookupCache.get(code);
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.value;

  const { base, cls } = splitClass(code);
  const tries = [...new Set([code, base])];
  let items = [];
  for (const q of tries) {
    const d = await secGet("/v2/fund/general-info/profiles", { project_info: q, page_size: 100 }, key, "SEC_GENERAL_INFO_KEY");
    items = items.concat(d.items || []);
    await sleep(70);
  }
  if (debug) debug.profiles[code] = items.slice(0, 15).map((p) => ({
    proj_id: p.proj_id, proj_abbr_name: p.proj_abbr_name, fund_class_name: p.fund_class_name, fund_status: p.fund_status,
  }));

  const active = (p) => !p.fund_status || norm(p.fund_status) === "RG";
  const pick =
    // the class itself is listed under the full code, e.g. proj_abbr_name or fund_class_name = "SCBAUTO(SSF)"
    items.find((p) => active(p) && (norm(p.proj_abbr_name) === code || norm(p.fund_class_name) === code)) ||
    // the project is listed under the base code, with the class named separately
    items.find((p) => active(p) && norm(p.proj_abbr_name) === base && (!cls || norm(p.fund_class_name) === cls || norm(p.fund_class_name).endsWith(`(${cls})`))) ||
    // plain fund code without classes
    (!cls && items.find((p) => active(p) && norm(p.proj_abbr_name) === base)) ||
    null;

  const value = pick
    ? { projId: pick.proj_id, className: pick.fund_class_name || null, resolved: pick.fund_class_name && cls ? `${pick.proj_abbr_name} ${pick.fund_class_name}` : pick.proj_abbr_name }
    : null;
  lookupCache.set(code, { at: Date.now(), value });
  return value;
}

async function latestNav(info, key, debug, code) {
  const end = new Date();
  const start = new Date(end.getTime() - NAV_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const params = { proj_id: info.projId, start_nav_date: fmt(start), end_nav_date: fmt(end), page_size: 100 };
  if (info.className) params.fund_class_name = info.className;
  const d = await secGet("/v2/fund/daily-info/nav", params, key, "SEC_DAILY_INFO_KEY");
  let rows = d.items || [];
  if (info.className) rows = rows.filter((r) => !r.fund_class_name || norm(r.fund_class_name) === norm(info.className));
  if (debug) debug.nav[code] = rows.slice(0, 3);
  const priced = rows
    .map((r) => ({ r, nav: Number(r.last_val) }))
    .filter((x) => x.nav > 0)
    .sort((a, b) => String(b.r.nav_date).localeCompare(String(a.r.nav_date)));
  if (!priced.length) return null;
  const top = priced[0];
  return { nav: top.nav, date: top.r.nav_date || null, currency: "THB", resolved: info.resolved };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const codes = parseCodes(req.query && req.query.codes);
  const debug = req.query && req.query.debug ? { profiles: {}, nav: {}, errors: {} } : null;
  const generalKey = process.env.SEC_GENERAL_INFO_KEY || process.env.SEC_API_KEY;
  const dailyKey = process.env.SEC_DAILY_INFO_KEY || process.env.SEC_API_KEY;

  if (!generalKey || !dailyKey) {
    const need = [!generalKey && "SEC_GENERAL_INFO_KEY", !dailyKey && "SEC_DAILY_INFO_KEY"].filter(Boolean).join(" and ");
    res.status(200).json({ ok: false, error: `Fund prices aren't set up yet: add ${need} in Vercel`, funds: {}, missing: codes });
    return;
  }
  if (!codes.length) {
    res.status(200).json({ ok: false, error: "No fund codes given", funds: {}, missing: [] });
    return;
  }

  const funds = {};
  const missing = [];
  let lastError = null;
  // One at a time — the SEC asks for at least 60 ms between requests
  for (const code of codes) {
    try {
      const info = await lookup(code, generalKey, debug);
      if (!info) { missing.push(code); continue; }
      await sleep(70);
      const nav = await latestNav(info, dailyKey, debug, code);
      if (nav) funds[code] = nav; else missing.push(code);
    } catch (e) {
      missing.push(code);
      lastError = e.message;
      if (debug) debug.errors[code] = e.message;
      if (/401|403/.test(e.message)) break; // the key itself is the problem; no point trying the rest
    }
    await sleep(70);
  }

  const ok = Object.keys(funds).length > 0;
  if (ok && !debug) res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json({ ok, funds, missing, error: ok ? undefined : lastError || "No prices found", fetchedAt: new Date().toISOString(), ...(debug ? { debug } : {}) });
}
