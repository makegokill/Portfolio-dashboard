import React, { useState, useEffect, useMemo, useRef } from "react";

/* ════════════════════════════════════════════════════════════
   FOLIO — Portfolio dashboard, made for iPhone first
   Light "passbook" design · live prices · saved on this device
════════════════════════════════════════════════════════════ */

const ORDER = ["BTC", "Crypto", "Trading", "Gold", "ETF", "Stocks"];
const GROUPS_META = {
  BTC:     { label: "Bitcoin", color: "#F7931A" },
  Crypto:  { label: "Crypto",  color: "#7E5DB5" },
  Trading: { label: "Trading", color: "#7A7267" },
  Gold:    { label: "Gold",    color: "#A68A2C" },
  ETF:     { label: "ETF",     color: "#2D63A8" },
  Stocks:  { label: "Stock",   color: "#2A7F78" },
};
const groupColor = (g) => GROUPS_META[g]?.color || "#6B7280";

const COINS = {
  bitcoin:    { label: "BTC",       unit: "BTC",  fallback: 73500 },
  ethereum:   { label: "ETH",       unit: "ETH",  fallback: 2333 },
  dogecoin:   { label: "DOGE",      unit: "DOGE", fallback: 0.0995 },
  "pax-gold": { label: "Gold (oz)", unit: "oz",   fallback: 4740 },
};
const FALLBACK_PRICES = Object.fromEntries(Object.entries(COINS).map(([k, v]) => [k, v.fallback]));

const uid = () => "h" + Math.random().toString(36).slice(2, 9);
const SEED_HOLDINGS = [
  { id: "btc",  name: "BTC",  group: "BTC",    type: "live", coin: "bitcoin",  qty: 1.01437001,     costUSD: 67920, sold: false },
  { id: "doge", name: "DOGE", group: "Crypto", type: "live", coin: "dogecoin", qty: 13922.44171832, costUSD: 5200, sold: false },
  { id: "defi", name: "DeFi LP", group: "Crypto", type: "manual", ccy: "USD", cost: 0, value: 41254.13, sold: false },
  { id: "gold", name: "Gold (4.1 oz)", group: "Gold", type: "live", coin: "pax-gold", qty: 4.1, costUSD: 13743, sold: false },
  { id: "cpaxt", name: "CPAXT", group: "Stocks", type: "set", ticker: "CPAXT", qty: 7392,   costTHB: 326250.00,  sold: false },
  { id: "jck",   name: "JCK",   group: "Stocks", type: "set", ticker: "JCK",   qty: 334500, costTHB: 326681.73,  sold: false },
  { id: "kex",   name: "KEX",   group: "Stocks", type: "set", ticker: "KEX",   qty: 10000,  costTHB: 478800.00,  sold: false, note: "Suspended · last ฿0.50" },
  { id: "scgp",  name: "SCGP",  group: "Stocks", type: "set", ticker: "SCGP",  qty: 1400,   costTHB: 63005.67,   sold: false },
  { id: "true",  name: "TRUE",  group: "Stocks", type: "set", ticker: "TRUE",  qty: 6002,   costTHB: 33125.55,   sold: false },
  { id: "delta", name: "DELTA", group: "Stocks", type: "set", ticker: "DELTA", qty: 400,    costTHB: 95000.00,   sold: false },
  { id: "etf1", name: "SCBAUTO(SSF)",  group: "ETF", type: "manual", ccy: "THB", cost: 68500,  value: 78000,  sold: false },
  { id: "etf2", name: "SCBLTT-SSF",   group: "ETF", type: "manual", ccy: "THB", cost: 28500,  value: 25500,  sold: false },
  { id: "etf3", name: "SCBRM3",       group: "ETF", type: "manual", ccy: "THB", cost: 13040,  value: 15100,  sold: false },
  { id: "etf4", name: "SCBRMNDQ",     group: "ETF", type: "manual", ccy: "THB", cost: 73000,  value: 80000,  sold: false },
  { id: "etf5", name: "SCBRMS&P500",  group: "ETF", type: "manual", ccy: "THB", cost: 115000, value: 129000, sold: false },
  { id: "etf6", name: "SCBAUTO(A)",   group: "ETF", type: "manual", ccy: "USD", cost: 800,    value: 800,    sold: false },
  { id: "tr1", name: "Isolated margin", group: "Trading", type: "manual", ccy: "USD", cost: 0, value: 24500, sold: false },
  { id: "tr2", name: "Cross margin",    group: "Trading", type: "manual", ccy: "USD", cost: 0, value: 3700,  sold: false },
];
const STORAGE_KEY = "folio-dashboard-v7";
// Last known live prices, so the app opens with real numbers (not the built-in fallbacks)
const PRICE_CACHE_KEY = "folio-prices-v1";
const SEED_SET_PRICES = { CPAXT: 15.20, JCK: 0.13, KEX: null, SCGP: 23.60, TRUE: 13.80, DELTA: 237.50 };
const STALE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function readPriceCache() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(PRICE_CACHE_KEY) : null;
    const c = raw ? JSON.parse(raw) : null;
    return c && typeof c === "object" ? c : {};
  } catch (e) { return {}; }
}

function ago(ts) {
  const days = Math.floor((Date.now() - ts) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}
const isStaleManual = (h) => h.type === "manual" && !h.sold && (!h.valueUpdatedAt || Date.now() - h.valueUpdatedAt > STALE_DAYS * DAY_MS);

const fundKeyOf = (h) => String(h.fundCode || "").trim().toUpperCase();

// Price of one fund unit in USD (fund NAVs are in THB, converted at the current USD/THB rate)
function fundUnitUSD(f, rate) {
  if (!f || typeof f.nav !== "number") return null;
  return f.currency === "USD" ? f.nav : f.nav / (rate || 1);
}

function usdValue(h, prices, rate, setP, fundP) {
  if (h.type === "live") return (+h.qty || 0) * (prices[h.coin] ?? FALLBACK_PRICES[h.coin] ?? 0);
  if (h.type === "set") {
    const p = setP?.[h.ticker];
    if (p) return (+h.qty || 0) * p / (rate || 1);
    return (+h.fallbackTHB || 0) / (rate || 1); // use fallback if no price
  }
  if (h.type === "fund") {
    const unit = fundUnitUSD(fundP?.[fundKeyOf(h)], rate);
    if (unit != null && +h.qty > 0) return (+h.qty || 0) * unit;
    // No daily price yet (or no units entered): keep showing the last manual value instead of $0
    if (+h.value > 0) return h.ccy === "USD" ? +h.value : +h.value / (rate || 1);
    return 0;
  }
  if (h.ccy === "USD") return +h.value || 0;
  return (+h.value || 0) / (rate || 1);
}
function usdCost(h, rate) {
  if (h.type === "live") return +h.costUSD || 0;
  if (h.type === "set" || h.type === "fund") return (+h.costTHB || 0) / (rate || 1);
  if (h.ccy === "USD") return +h.cost || 0;
  return (+h.cost || 0) / (rate || 1);
}
const hasCost = (h, rate) => usdCost(h, rate) > 0;
// Which field holds a holding's cost, and in which currency you type it
const costField = (h) => (h.type === "live" ? "costUSD" : h.type === "set" || h.type === "fund" ? "costTHB" : "cost");
const costCcy = (h) => (h.type === "live" ? "USD" : h.type === "set" || h.type === "fund" ? "THB" : h.ccy === "THB" ? "THB" : "USD");

const MINUS = "−";
const coinPrice = (v) => (v == null ? "…" : v < 10 ? "$" + v.toFixed(3) : "$" + Math.round(v).toLocaleString("en-US"));
const fu = (v) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const thb = (v) => "฿" + Math.round(Math.abs(v)).toLocaleString("en-US");
const signed = (v) => (v >= 0 ? "+" : MINUS) + fu(v);
const pctTxt = (p) => (p >= 0 ? "+" : MINUS) + Math.abs(p).toFixed(1) + "%";
const tone = (v) => (v >= 0 ? "var(--gain)" : "var(--loss)");
const round2 = (n) => Math.round(n * 100) / 100;
const num = (x, digits) => (+x || 0).toLocaleString("en-US", { maximumFractionDigits: digits });

// One line under a holding's name: how much you hold and where its price comes from
function holdingSub(h) {
  if (h.sold) return "Sold, not counted";
  let s;
  if (h.type === "live") s = `${num(h.qty, 8)} ${COINS[h.coin]?.unit || ""}, live price`;
  else if (h.type === "set") s = `${num(h.qty, 0)} shares, SET`;
  else if (h.type === "fund") s = `${num(h.qty, 4)} units, daily price${h.unitsEstimated ? " (estimated)" : ""}`;
  else s = "You type the value";
  if (h.note) s += `, ${h.note}`;
  return s;
}

const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Counts up from 0 on first load, then glides from the current number to the new one
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(prefersReducedMotion() ? target : 0);
  const cur = useRef(prefersReducedMotion() ? target : 0);
  const first = useRef(true);
  useEffect(() => {
    if (prefersReducedMotion()) { cur.current = target; setVal(target); return; }
    const from = cur.current;
    const dur = first.current ? duration : 650;
    first.current = false;
    if (from === target) return;
    let start = null, raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * e);
      cur.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [target]);
  return val;
}

export default function App() {
  const [cache] = useState(readPriceCache);
  const [holdings, setHoldings] = useState(SEED_HOLDINGS);
  const [rate, setRate] = useState(typeof cache.rate === "number" ? cache.rate : 33);
  // true = you typed the USD/THB rate yourself, so it's kept; false = refreshed automatically
  const [rateManual, setRateManual] = useState(false);
  const [prices, setPrices] = useState(() => ({ ...FALLBACK_PRICES, ...(cache.prices || {}) }));
  const [changes, setChanges] = useState(() => cache.changes || {});
  const [priceMode, setPriceMode] = useState("loading");
  const [updatedAt, setUpdatedAt] = useState(() => (cache.at ? new Date(cache.at) : null));
  const [tab, setTab] = useState("overview");
  const [openCat, setOpenCat] = useState(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // { h, isNew } — the holding open in the sheet
  const [loaded, setLoaded] = useState(false);
  const [undo, setUndo] = useState(null); // { kind: "delete", h, idx } or { kind: "reset", ... }
  // Your own names for the categories (e.g. "ETF" → "Mutual funds"); empty = the built-in name
  const [groupLabels, setGroupLabels] = useState({});
  // The highest total Folio has seen on this device: { usd, at }
  const [peak, setPeak] = useState(null);
  const labelOf = (g) => String(groupLabels[g] || "").trim() || GROUPS_META[g]?.label || g;
  const renameGroup = (g, name) => setGroupLabels((l) => {
    const next = { ...l };
    const clean = String(name || "").trim().slice(0, 24);
    if (!clean || clean === GROUPS_META[g]?.label) delete next[g]; else next[g] = clean;
    return next;
  });
  const undoTimer = useRef(null);

  // SET stock prices — keyed by ticker (THB), seeded with last known prices
  const [setP, setSetP] = useState(() => ({ ...SEED_SET_PRICES, ...(cache.setP || {}) }));
  const [stocksUpdatedAt, setStocksUpdatedAt] = useState(() => (cache.setAt ? new Date(cache.setAt) : null));
  const [setMode, setSetMode] = useState("idle");
  const [setMissing, setSetMissing] = useState([]); // tickers Yahoo had no price for

  // Fund NAVs (THB, published once per trading day) — keyed by fund code
  const [fundP, setFundP] = useState(() => cache.fundP || {});
  const [fundsUpdatedAt, setFundsUpdatedAt] = useState(() => (cache.fundAt ? new Date(cache.fundAt) : null));
  const [fundMode, setFundMode] = useState("idle");
  const [fundMissing, setFundMissing] = useState([]);
  const [fundError, setFundError] = useState(null);
  const lastFundFetch = useRef(cache.fundAt || 0);

  // Refs so timers and app-resume handlers always see the latest values
  const holdingsRef = useRef(holdings); holdingsRef.current = holdings;
  const rateManualRef = useRef(rateManual); rateManualRef.current = rateManual;
  const lastCryptoFetch = useRef(0);
  const lastSetFetch = useRef(0);
  const lastFxFetch = useRef(0);

  const isBangkokTradingHours = () => {
    const bkk = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const day = bkk.getDay(); // 0=Sun 6=Sat
    const h = bkk.getHours();
    return day >= 1 && day <= 5 && h >= 9 && h < 18;
  };

  const setTickersOf = (hs) => [...new Set(hs.filter((h) => h.type === "set" && h.ticker).map((h) => String(h.ticker).trim().toUpperCase()).filter(Boolean))].sort();

  // force = fetch even outside SET trading hours (used on load and when tickers change)
  const fetchSetPrices = async (force = false) => {
    if (!force && !isBangkokTradingHours()) return;
    if (!force && Date.now() - lastSetFetch.current < 60 * 1000) return;
    const tickers = setTickersOf(holdingsRef.current);
    if (!tickers.length) return;
    lastSetFetch.current = Date.now();
    try {
      const r = await fetch(`/api/stocks?symbols=${encodeURIComponent(tickers.join(","))}`);
      if (!r.ok) throw new Error("api error");
      const d = await r.json();
      if (d.ok && d.prices) {
        setSetP((prev) => {
          const next = { ...prev };
          Object.entries(d.prices).forEach(([sym, v]) => { if (v.price !== null) next[sym] = v.price; });
          return next;
        });
        setSetMissing(tickers.filter((t) => !d.prices[t] || d.prices[t].price === null));
        setSetMode("live"); setStocksUpdatedAt(new Date());
      } else throw new Error(d.error || "no data");
    } catch (e) { setSetMode("offline"); }
  };

  // Fetch SET prices once your saved holdings are loaded, and again shortly after a ticker is added or changed
  const setTickerKey = setTickersOf(holdings).join(",");
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => fetchSetPrices(true), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [loaded, setTickerKey]);

  // During SET trading hours, refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(() => fetchSetPrices(), 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let raw = null;
        // Real browser localStorage (works on Vercel/iPhone)
        if (typeof window !== "undefined" && window.localStorage) {
          raw = window.localStorage.getItem(STORAGE_KEY);
        }
        // Fallback: Claude artifact storage API
        if (!raw && typeof window !== "undefined" && window.storage) {
          const res = await window.storage.get(STORAGE_KEY);
          if (res && res.value) raw = res.value;
        }
        if (raw) {
          const d = JSON.parse(raw);
          if (Array.isArray(d.holdings)) setHoldings(d.holdings);
          if (d.groupLabels && typeof d.groupLabels === "object") setGroupLabels(d.groupLabels);
          if (d.peak && typeof d.peak.usd === "number") setPeak(d.peak);
          // Only keep a saved rate if you typed it yourself; otherwise it refreshes from the live feed
          if (d.rateManual === true && typeof d.rate === "number" && d.rate > 0) { setRate(d.rate); setRateManual(true); }
        }
      } catch (e) { /* keep seed */ }
      finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const payload = JSON.stringify({ holdings, rate, rateManual, groupLabels, peak });
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, payload);
        }
        if (typeof window !== "undefined" && window.storage) {
          await window.storage.set(STORAGE_KEY, payload);
        }
      } catch (e) { /* session only */ }
    })();
  }, [holdings, rate, rateManual, groupLabels, peak, loaded]);

  // Remember the latest prices so the next visit opens with them
  useEffect(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({
        prices, changes, setP, fundP, rate: rateManual ? undefined : rate,
        at: updatedAt ? updatedAt.getTime() : null,
        setAt: stocksUpdatedAt ? stocksUpdatedAt.getTime() : null,
        fundAt: fundsUpdatedAt ? fundsUpdatedAt.getTime() : null,
      }));
    } catch (e) { /* ignore */ }
  }, [prices, changes, setP, fundP, rate, rateManual, updatedAt, stocksUpdatedAt, fundsUpdatedAt]);

  // ── Fund NAVs: one price per trading day, so check at most every 3 hours ──
  const fundCodesOf = (hs) => [...new Set(hs.filter((h) => h.type === "fund").map(fundKeyOf).filter(Boolean))].sort();
  const fetchFundPrices = async (force = false) => {
    if (!force && Date.now() - lastFundFetch.current < 3 * 60 * 60 * 1000) return;
    const codes = fundCodesOf(holdingsRef.current);
    if (!codes.length) return;
    lastFundFetch.current = Date.now();
    try {
      const r = await fetch(`/api/funds?codes=${encodeURIComponent(codes.join(","))}`);
      if (!r.ok) throw new Error("api error");
      const d = await r.json();
      if (d.ok && d.funds) {
        setFundP((prev) => ({ ...prev, ...d.funds }));
        setFundMissing(codes.filter((c) => !d.funds[c]));
        setFundMode("live"); setFundsUpdatedAt(new Date()); setFundError(null);
      } else throw new Error(d.error || "no data");
    } catch (e) {
      setFundMode("offline");
      setFundError(e && e.message && e.message !== "api error" ? e.message : "Couldn't reach the fund price service");
      lastFundFetch.current = Date.now() - 2.5 * 60 * 60 * 1000; // try again in ~30 min, not 3 h
    }
  };
  const fundKey = fundCodesOf(holdings).join(",");
  const fundKeyRef = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    // First load: use the saved NAVs if they're recent; a new or changed fund code fetches right away
    const changed = fundKeyRef.current !== null && fundKeyRef.current !== fundKey;
    const missingNav = fundKey.split(",").some((c) => c && !fundP[c]);
    fundKeyRef.current = fundKey;
    const t = setTimeout(() => fetchFundPrices(changed || missingNav), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [loaded, fundKey]);
  useEffect(() => {
    const t = setInterval(() => fetchFundPrices(), 30 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, []);

  // When a holding is switched to a fund, estimate its units from its last value once the NAV arrives
  useEffect(() => {
    const pending = holdings.filter((h) => h.type === "fund" && h.estimateFromTHB > 0 && !(+h.qty > 0) && fundP[fundKeyOf(h)]);
    if (!pending.length) return;
    setHoldings((hs) => hs.map((h) => {
      const f = h.type === "fund" && h.estimateFromTHB > 0 && !(+h.qty > 0) ? fundP[fundKeyOf(h)] : null;
      if (!f || !(f.nav > 0)) return h;
      const unitTHB = f.currency === "USD" ? f.nav * (rate || 1) : f.nav;
      const { estimateFromTHB, ...rest } = h;
      return { ...rest, qty: +(estimateFromTHB / unitTHB).toFixed(4), unitsEstimated: true };
    }));
    // eslint-disable-next-line
  }, [fundP, holdings]);

  const fetchFx = async (force = false) => {
    if (rateManualRef.current) return;
    if (!force && Date.now() - lastFxFetch.current < 60 * 60 * 1000) return; // at most hourly
    lastFxFetch.current = Date.now();
    try {
      const fr = await fetch("https://open.er-api.com/v6/latest/USD");
      if (fr.ok) {
        const fd = await fr.json();
        if (fd?.rates?.THB && !rateManualRef.current) setRate(+fd.rates.THB.toFixed(2));
      }
    } catch (e) { /* keep last rate */ }
  };

  const fetchPrices = async () => {
    lastCryptoFetch.current = Date.now();
    setPriceMode((m) => (m === "live" ? "live" : "loading"));
    try {
      const ids = Object.keys(COINS).join(",");
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
      if (!r.ok) throw new Error("http " + r.status);
      const d = await r.json();
      const np = { ...FALLBACK_PRICES }, nc = {};
      Object.keys(COINS).forEach((id) => {
        if (d[id] && typeof d[id].usd === "number") {
          np[id] = d[id].usd;
          if (typeof d[id].usd_24h_change === "number") nc[id] = d[id].usd_24h_change;
        }
      });
      setPrices(np); setChanges(nc); setPriceMode("live"); setUpdatedAt(new Date());
    } catch (e) { setPriceMode("offline"); }
    fetchFx();
  };
  useEffect(() => { fetchPrices(); const t = setInterval(fetchPrices, 90000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);
  const refreshAll = () => { fetchPrices(); fetchSetPrices(true); fetchFundPrices(true); };

  // iPhone pauses the page in the background — refresh as soon as you come back to it
  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCryptoFetch.current > 20 * 1000) fetchPrices();
      fetchSetPrices();
      fetchFundPrices();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => { document.removeEventListener("visibilitychange", onResume); window.removeEventListener("pageshow", onResume); };
    // eslint-disable-next-line
  }, []);

  // Fetch a fresh USD/THB rate once storage has loaded, and again when you switch the rate back to automatic
  useEffect(() => { if (loaded && !rateManual) fetchFx(true); /* eslint-disable-next-line */ }, [loaded, rateManual]);

  // ── Totals ──
  const groups = useMemo(() => ORDER.map((g) => {
    const all = holdings.filter((h) => h.group === g);
    const items = all.filter((h) => !h.sold).map((h) => {
      const val = usdValue(h, prices, rate, setP, fundP);
      const cost = hasCost(h, rate) ? usdCost(h, rate) : null;
      return { h, id: h.id, name: h.name, val, cost, pl: cost != null ? val - cost : null };
    }).sort((a, b) => b.val - a.val);
    const val = items.reduce((s, i) => s + i.val, 0);
    const costed = items.filter((i) => i.cost != null);
    const cost = costed.reduce((s, i) => s + i.cost, 0);
    const costedVal = costed.reduce((s, i) => s + i.val, 0);
    return { g, label: labelOf(g), color: groupColor(g), all, items, val,
      cost: costed.length ? cost : null, worth: costedVal, pl: costed.length ? costedVal - cost : null };
    // eslint-disable-next-line
  }).filter((r) => r.all.length > 0), [holdings, prices, rate, setP, fundP, groupLabels]);

  const totalVal = groups.reduce((s, r) => s + r.val, 0);
  const basisCost = groups.reduce((s, r) => s + (r.cost || 0), 0);
  const basisPL = groups.reduce((s, r) => s + (r.pl || 0), 0);
  const GRAND = { value: totalVal, cost: basisCost, pl: basisPL, plPct: basisCost > 0 ? (basisPL / basisCost) * 100 : 0 };

  const alloc = useMemo(() => groups.filter((r) => r.val > 0)
    .map((r) => ({ ...r, share: totalVal > 0 ? (r.val / totalVal) * 100 : 0 }))
    .sort((a, b) => b.val - a.val), [groups, totalVal]);

  // Remember the highest total, but only from live prices (not the built-in fallbacks)
  const roundedTotal = Math.round(GRAND.value);
  useEffect(() => {
    if (!loaded || priceMode !== "live" || !(roundedTotal > 0)) return;
    setPeak((p) => (!p || roundedTotal > p.usd ? { usd: roundedTotal, at: Date.now() } : p));
  }, [loaded, priceMode, roundedTotal]);
  const resetPeak = () => setPeak(roundedTotal > 0 ? { usd: roundedTotal, at: Date.now() } : null);

  const count = useCountUp(Math.round(GRAND.value));

  const update = (id, patch) => setHoldings((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const startUndo = (u, ms) => {
    setUndo(u);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), ms);
  };
  const remove = (id) => {
    const idx = holdings.findIndex((h) => h.id === id);
    if (idx < 0) return;
    startUndo({ kind: "delete", h: holdings[idx], idx }, 6000);
    setHoldings((hs) => hs.filter((h) => h.id !== id));
  };
  const undoLast = () => {
    if (!undo) return;
    if (undo.kind === "reset") {
      setHoldings(undo.holdings);
      setGroupLabels(undo.groupLabels || {});
      setPeak(undo.peak || null);
    } else {
      setHoldings((hs) => { const next = [...hs]; next.splice(Math.min(undo.idx, next.length), 0, undo.h); return next; });
    }
    clearTimeout(undoTimer.current);
    setUndo(null);
  };
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  const resetData = () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Erase all your holdings on this iPhone and go back to the starter list?\n\nSave a backup first if you want to keep them. You'll have 10 seconds to undo.")) return;
    startUndo({ kind: "reset", holdings, groupLabels, peak }, 10000);
    setHoldings(SEED_HOLDINGS);
    setGroupLabels({});
    setPeak(null);
  };

  const openHolding = (h) => setSheet({ h, isNew: false });
  const addHolding = (group) => setSheet({
    h: { id: uid(), name: "", group, type: "manual", ccy: "USD", cost: 0, value: 0, valueUpdatedAt: Date.now() },
    isNew: true,
  });
  const saveSheet = (d) => {
    const clean = { ...d, name: String(d.name || "").trim() || "New asset" };
    setHoldings((hs) => (sheet && sheet.isNew ? [...hs, clean] : hs.map((h) => (h.id === clean.id ? clean : h))));
    setSheet(null);
  };

  // ── Backup: save holdings to a .json file / restore one ──
  const exportBackup = () => {
    try {
      const payload = JSON.stringify({ app: "folio", version: 7, exportedAt: new Date().toISOString(), rate, rateManual, groupLabels, peak, holdings }, null, 2);
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const filename = `folio-backup-${stamp}.json`;

      // Phones (e.g. iPhone Safari) open a downloaded .json as text instead of saving it.
      // On touch devices that can share files, open the share sheet so "Save to Files" is one tap.
      const isTouch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      if (isTouch && typeof File === "function" && navigator.canShare) {
        const file = new File([payload], filename, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "Folio backup" }).catch((err) => {
            if (err && err.name !== "AbortError") window.alert("Couldn't share the backup file: " + err.message);
          });
          return;
        }
      }

      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      window.alert("Couldn't create the backup file: " + err.message);
    }
  };
  const importBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => window.alert("Couldn't read that file.");
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        if (!d || !Array.isArray(d.holdings) || d.holdings.length === 0) throw new Error("This isn't a Folio backup (no holdings found).");
        const ok = d.holdings.every((h) => h && typeof h === "object" && h.id && h.name && h.group);
        if (!ok) throw new Error("Some holdings in this file are malformed.");
        const when = d.exportedAt ? new Date(d.exportedAt).toLocaleString() : "unknown date";
        if (!window.confirm(`Restore the backup from ${when} (${d.holdings.length} holdings)? This replaces what's saved on this iPhone.`)) return;
        setHoldings(d.holdings);
        setGroupLabels(d.groupLabels && typeof d.groupLabels === "object" ? d.groupLabels : {});
        setPeak(d.peak && typeof d.peak.usd === "number" ? d.peak : null);
        if (d.rateManual === true && typeof d.rate === "number" && d.rate > 0) { setRate(d.rate); setRateManual(true); }
        else setRateManual(false);
        window.alert("Backup restored.");
      } catch (err) {
        window.alert("Restore failed: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const goTab = (k) => { setTab(k); setRateOpen(false); try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } };
  const lastPriceTime = updatedAt ? updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

  const TABS = [
    { k: "overview", label: "Overview", Icon: OverviewIcon },
    { k: "holdings", label: "Holdings", Icon: ListIcon },
    { k: "gains",    label: "Gains",    Icon: GainsIcon },
  ];

  return (
    <div className="folio">
      <style>{CSS}</style>

      <main className="screen">
        {tab === "overview" && (
          <Overview
            grand={GRAND} count={count} rate={rate} rateManual={rateManual} rateOpen={rateOpen} setRateOpen={setRateOpen}
            setRate={(v) => { if (v > 0) { setRateManual(true); setRate(v); } }} liveRate={() => setRateManual(false)}
            alloc={alloc} openCat={openCat} setOpenCat={setOpenCat} peak={peak} resetPeak={resetPeak}
            priceMode={priceMode} lastPriceTime={lastPriceTime} refresh={refreshAll} openHolding={openHolding}
            prices={prices} changes={changes} />
        )}
        {tab === "gains" && <Gains groups={groups} grand={GRAND} openHolding={openHolding} />}
        {tab === "holdings" && (
          <Holdings holdings={holdings} groups={groups} labelOf={labelOf} renameGroup={renameGroup} rate={rate}
            update={update} openHolding={openHolding} addHolding={addHolding}
            exportBackup={exportBackup} importBackup={importBackup} resetData={resetData} />
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.k} type="button" className={`tab${tab === t.k ? " on" : ""}`} aria-current={tab === t.k ? "page" : undefined} onClick={() => goTab(t.k)}>
            <t.Icon />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {sheet && (
        <HoldingSheet key={sheet.h.id} start={sheet.h} isNew={sheet.isNew} labelOf={labelOf} rate={rate}
          prices={prices} setP={setP} fundP={fundP} setMode={setMode} setMissing={setMissing}
          fundMode={fundMode} fundMissing={fundMissing} fundError={fundError}
          onSave={saveSheet} onClose={() => setSheet(null)}
          onDelete={(id) => { setSheet(null); remove(id); }} />
      )}

      {undo && (
        <div className="toast" role="status">
          {undo.kind === "reset"
            ? <span>All holdings reset to the starter list</span>
            : <span>Deleted <b>{undo.h.name}</b></span>}
          <button type="button" className="toast-btn" onClick={undoLast}>Undo</button>
        </div>
      )}
    </div>
  );
}

// Number field for phones: decimal keypad, thousands separators when not editing,
// and it keeps what you type (e.g. "0." or an empty field) instead of fighting you.
// onCommit(before, after) runs when you leave the field after changing it.
function NumInput({ value, onChange, onCommit, className, style, id, ariaLabel }) {
  const [draft, setDraft] = useState(null);
  const startRef = useRef(null);
  const parseDraft = (s) => { const n = parseFloat(String(s).replace(/,/g, "")); return isNaN(n) ? 0 : n; };
  // If the value is changed from elsewhere (e.g. tapping "Use live rate"), show the new value
  useEffect(() => { if (draft !== null && parseDraft(draft) !== (Number(value) || 0)) setDraft(null); /* eslint-disable-next-line */ }, [value]);
  const shown = draft !== null ? draft : (Number(value) || 0).toLocaleString("en-US", { maximumFractionDigits: 8 });
  return (
    <input id={id} aria-label={ariaLabel} className={className} style={style} type="text" inputMode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false}
      value={shown}
      onFocus={(e) => { const el = e.target; startRef.current = Number(value) || 0; setDraft(value ? String(value) : ""); setTimeout(() => { try { el.select(); } catch (err) { /* ignore */ } }, 0); }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.,-]/g, "");
        setDraft(raw);
        onChange(parseDraft(raw));
      }}
      onBlur={() => {
        const after = draft !== null ? parseDraft(draft) : Number(value) || 0;
        setDraft(null);
        if (onCommit && startRef.current !== null && after !== startRef.current) onCommit(startRef.current, after);
        startRef.current = null;
      }} />
  );
}

const COIN_MARK = { bitcoin: { g: "BTC" }, "pax-gold": { g: "Gold" }, ethereum: { color: "#627EEA" }, dogecoin: { color: "#C2A633" } };

// Category marker: the Bitcoin and gold coins, or a small colour square
function CatMark({ g, color }) {
  if (g === "BTC") return (
    <svg className="mark" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#F7931A" />
      <g transform="rotate(14 12 12)" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 6.5v11" /><path d="M9.5 6.5H13a2.6 2.6 0 0 1 0 5.2H9.5" /><path d="M9.5 11.7h4.1a2.9 2.9 0 0 1 0 5.8H9.5" />
        <path d="M11 4.8v1.7M13.2 4.8v1.7M11 17.5v1.7M13.2 17.5v1.7" />
      </g>
    </svg>
  );
  if (g === "Gold") return (
    <svg className="mark" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#D4A72C" />
      <g fill="#FFFFFF"><path d="M4.6 17.6l1.2-3.6h5l1.2 3.6z" /><path d="M12 17.6l1.2-3.6h5l1.2 3.6z" /><path d="M8.3 12.9l1.2-3.6h5l1.2 3.6z" /></g>
    </svg>
  );
  return <span className="mark" aria-hidden="true"><span className="swatch" style={{ background: color }} /></span>;
}

const Chevron = ({ open, down }) => (
  <svg className="chev" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? (down ? "rotate(180deg)" : "rotate(90deg)") : "none" }}>
    {down ? <path d="M4 6l4 4 4-4" /> : <path d="M6 3l5 5-5 5" />}
  </svg>
);

function polar(cx, cy, r, deg) { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function arcPath(cx, cy, oR, iR, s, e) {
  const g = 1.6, a = s + g / 2, b = e - g / 2;
  if (b - a < 0.4) return "";
  const [x1, y1] = polar(cx, cy, oR, a), [x2, y2] = polar(cx, cy, oR, b);
  const [x3, y3] = polar(cx, cy, iR, b), [x4, y4] = polar(cx, cy, iR, a);
  const la = b - a > 180 ? 1 : 0, f = (n) => n.toFixed(3);
  return `M${f(x1)},${f(y1)} A${oR},${oR} 0 ${la} 1 ${f(x2)},${f(y2)} L${f(x3)},${f(y3)} A${iR},${iR} 0 ${la} 0 ${f(x4)},${f(y4)} Z`;
}

// Tap a slice: it stands out, the others fade, the middle shows that category,
// and its row below opens with the holdings inside. Tap it again (or the middle) to go back.
function Donut({ alloc, selected, onSelect }) {
  if (!alloc.length) return null;
  const C = 120, OR = 106, IR = 72;
  let cum = 0;
  const segs = alloc.map((a) => { const st = cum * 3.6; cum += a.share; return { ...a, st, en: cum * 3.6 }; });
  const active = selected ? alloc.find((a) => a.g === selected) : null;
  const shown = active || alloc[0];
  const label = "Allocation: " + alloc.map((a) => `${a.label} ${a.share.toFixed(1)}%`).join(", ");
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 240 240" role="img" aria-label={label}>
        {segs.map((s) => {
          const on = !!active && s.g === active.g;
          return (
            <path key={s.g} className="seg" fill={s.color} opacity={active && !on ? 0.25 : 1}
              d={arcPath(C, C, on ? OR + 8 : OR, on ? IR - 3 : IR, s.st, s.en)}
              onClick={() => onSelect(on ? null : s.g)} />
          );
        })}
        <circle cx={C} cy={C} r={IR - 4} fill="transparent" onClick={() => { if (active) onSelect(null); }} />
      </svg>
      <div className="donut-hole" aria-hidden="true">
        <span className="muted small">{active ? fu(active.val) : "Biggest"}</span>
        <span className="donut-name">{shown.label}</span>
        <span className="muted">{shown.share.toFixed(1)}%</span>
      </div>
      <p className="muted small center">{active ? "Tap the middle to see everything" : "Tap a slice to see what's in it"}</p>
    </div>
  );
}

const dayMonth = (t) => {
  const d = new Date(t);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) });
};

function Overview({ grand, count, rate, rateManual, rateOpen, setRateOpen, setRate, liveRate, alloc, openCat, setOpenCat, peak, resetPeak, priceMode, lastPriceTime, refresh, openHolding, prices, changes }) {
  const [peakOpen, setPeakOpen] = useState(false);
  // The stamp: the highest total Folio has seen on this iPhone
  const peakToday = !!peak && new Date(peak.at).toDateString() === new Date().toDateString();
  const atPeak = !!peak && grand.value >= peak.usd * 0.999;
  const stampTitle = peak && atPeak && peakToday ? "New high" : "Peak";
  const stampAmt = peak ? fu(peak.usd) : "…";
  const stampSub = !peak ? "checking prices" : peakToday ? "today" : dayMonth(peak.at);
  const below = peak ? Math.max(0, peak.usd - grand.value) : 0;
  const pick = (g) => {
    setOpenCat(g);
    if (g) setTimeout(() => {
      const el = document.getElementById(`cat-${g}`);
      if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
    }, 60);
  };
  return (
    <>
      <header className="topbar">
        <div className="wordmark">Folio</div>
        <button type="button" className="chip" aria-expanded={rateOpen} onClick={() => setRateOpen(!rateOpen)}
          aria-label={`Exchange rate, ${rate} baht per dollar${rateManual ? ", set by you" : ""}. Tap to change`}>
          ฿{rate} = $1{rateManual ? " (yours)" : ""}
        </button>
      </header>
      {rateOpen && (
        <div className="rate-panel">
          <label htmlFor="rate-in" className="rate-lbl">Baht per dollar</label>
          <NumInput id="rate-in" className="field-in rate-in" value={rate} onChange={setRate} />
          {rateManual
            ? <button type="button" className="btn-line" onClick={liveRate}>Use live rate</button>
            : <span className="muted small">Live rate, checked every hour</span>}
        </div>
      )}

      <section className="hero">
        <div className="muted">Everything you own</div>
        <div className="total">${count.toLocaleString("en-US")}</div>
        <div className="muted big">{thb(grand.value * rate)}</div>
        <button type="button" className="stamp" aria-expanded={peakOpen} onClick={() => setPeakOpen(!peakOpen)}
          aria-label={`${stampTitle}: ${stampAmt}, ${stampSub}. Tap for details`}>
          <span className="stamp-t">{stampTitle}</span>
          <span className="stamp-n">{stampAmt}</span>
          <span className="stamp-s">{stampSub}</span>
        </button>
      </section>
      {peakOpen && peak && (
        <div className="peak-panel">
          <p>{atPeak
            ? "You're at your highest total so far."
            : `Your highest total was ${fu(peak.usd)} on ${dayMonth(peak.at)}. You're ${fu(below)} (${(below / peak.usd * 100).toFixed(1)}%) below it.`}</p>
          <p className="muted small">Folio remembers the highest total it has seen on this iPhone. If a typo pushed it too high, start over from today's total.</p>
          <button type="button" className="btn-line" onClick={() => { resetPeak(); setPeakOpen(false); }}>Start over from today</button>
        </div>
      )}

      <div className="pair">
        <div>
          <div className="muted small">You put in</div>
          <div className="pair-n">{fu(grand.cost)}</div>
        </div>
        <div>
          <div className="muted small">Since you bought</div>
          <div className="pair-n" style={{ color: tone(grand.pl) }}>{signed(grand.pl)} <span className="pair-p">({pctTxt(grand.plPct)})</span></div>
        </div>
      </div>

      <div className="market" role="group" aria-label="Live prices, with the change over 24 hours">
        {Object.entries(COINS).map(([id, c]) => {
          const chg = changes[id];
          const m = COIN_MARK[id] || {};
          return (
            <div key={id} className="mkt">
              <div className="mkt-sym"><CatMark g={m.g} color={m.color} /><span>{id === "pax-gold" ? "Gold" : c.label}</span></div>
              <div className="mkt-p">{coinPrice(prices[id])}{id === "pax-gold" && <span className="mkt-u">/oz</span>}</div>
              <div className="mkt-c" style={{ color: typeof chg === "number" ? tone(chg) : undefined }}>{typeof chg === "number" ? pctTxt(chg) : "–"}</div>
            </div>
          );
        })}
      </div>

      <div className="sec-head">
        <h2>Where your money is</h2>
        <span className="muted small">{alloc.length} {alloc.length === 1 ? "category" : "categories"}</span>
      </div>
      <Donut alloc={alloc} selected={openCat} onSelect={pick} />

      <div className="list">
        {alloc.map((c) => {
          const open = openCat === c.g;
          return (
            <div key={c.g} id={`cat-${c.g}`} className="row-wrap">
              <button type="button" className="row" aria-expanded={open} onClick={() => setOpenCat(open ? null : c.g)}>
                <CatMark g={c.g} color={c.color} />
                <span className="row-main">
                  <span className="row-name">{c.label}</span>
                  <span className="row-sub">{c.share.toFixed(1)}% of your money</span>
                </span>
                <span className="row-end">
                  <span className="row-val">{fu(c.val)}</span>
                  {c.pl != null
                    ? <span className="row-sub" style={{ color: tone(c.pl) }}>{signed(c.pl)} ({pctTxt(c.cost > 0 ? c.pl / c.cost * 100 : 0)})</span>
                    : <span className="row-sub">No cost recorded</span>}
                </span>
                <Chevron open={open} />
              </button>
              {open && (
                <div className="sub-list">
                  {c.items.map((it) => (
                    <button key={it.id} type="button" className="sub-row" onClick={() => openHolding(it.h)}>
                      <span className="row-main">
                        <span className="sub-name">{it.name}</span>
                        <span className="row-sub">{holdingSub(it.h)}</span>
                      </span>
                      <span className="row-end">
                        <span className="sub-name">{fu(it.val)}</span>
                        {it.pl != null
                          ? <span className="row-sub" style={{ color: tone(it.pl) }}>{signed(it.pl)} ({pctTxt(it.cost > 0 ? it.pl / it.cost * 100 : 0)})</span>
                          : <span className="row-sub">No cost recorded</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="updated">
        <span className="muted small">
          {priceMode === "offline" ? "Offline, showing saved prices" : lastPriceTime ? `Prices updated ${lastPriceTime}` : "Getting prices…"}
        </span>
        <button type="button" className="btn-text" onClick={refresh}><RefreshIcon /> Refresh</button>
      </div>
    </>
  );
}

function Gains({ groups, grand, openHolding }) {
  const [sort, setSort] = useState("cat");
  const costedGroups = groups.map((g) => ({ ...g, rows: g.items.filter((i) => i.cost != null) })).filter((g) => g.rows.length);
  const flat = costedGroups.flatMap((g) => g.rows.map((r) => ({ ...r, g: g.g, color: g.color }))).sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl));
  const noCost = groups.flatMap((g) => g.items.filter((i) => i.cost == null));
  const Row = ({ r, mark }) => (
    <button type="button" className="g-row" onClick={() => openHolding(r.h)}>
      {mark && <span className="mark" aria-hidden="true"><span className="swatch small" style={{ background: r.color }} /></span>}
      <span className="row-main">
        <span className="row-name">{r.name}</span>
        <span className="row-sub">Worth {fu(r.val)}, cost {fu(r.cost)}{r.h.note ? `, ${r.h.note}` : ""}</span>
      </span>
      <span className="row-end">
        <span className="row-val" style={{ color: tone(r.pl) }}>{signed(r.pl)}</span>
        <span className="row-sub" style={{ color: tone(r.pl) }}>{pctTxt(r.cost > 0 ? r.pl / r.cost * 100 : 0)}</span>
      </span>
    </button>
  );
  return (
    <>
      <header className="page-head">
        <h1>Gains and losses</h1>
        <div className="gl-total" style={{ color: tone(grand.pl) }}>
          <span className="gl-n">{signed(grand.pl)}</span>
          <span className="gl-p">{pctTxt(grand.plPct)}</span>
        </div>
        <div className="muted">since you bought, on {fu(grand.cost)} put in</div>
      </header>

      <div className="seg" role="group" aria-label="Sort">
        <button type="button" className={sort === "cat" ? "on" : ""} aria-pressed={sort === "cat"} onClick={() => setSort("cat")}>By category</button>
        <button type="button" className={sort === "size" ? "on" : ""} aria-pressed={sort === "size"} onClick={() => setSort("size")}>Biggest moves</button>
      </div>

      {sort === "cat" && (
        <div className="list">
          {costedGroups.map((g) => (
            <section key={g.g} className="g-group">
              <div className="g-head">
                <CatMark g={g.g} color={g.color} />
                <span className="row-main">
                  <span className="g-name">{g.label}</span>
                  <span className="row-sub">Worth {fu(g.worth)}, cost {fu(g.cost)}</span>
                </span>
                <span className="row-end">
                  <span className="g-pl" style={{ color: tone(g.pl) }}>{signed(g.pl)}</span>
                  <span className="row-sub" style={{ color: tone(g.pl), fontWeight: 500 }}>{pctTxt(g.cost > 0 ? g.pl / g.cost * 100 : 0)}</span>
                </span>
              </div>
              {g.rows.map((r) => <Row key={r.id} r={r} />)}
            </section>
          ))}
        </div>
      )}
      {sort === "size" && (
        <div className="list" style={{ paddingTop: 8 }}>
          {flat.map((r) => <Row key={r.id} r={r} mark />)}
        </div>
      )}

      {noCost.length > 0 && (
        <section className="block">
          <h2 className="h-small">Not counted yet</h2>
          <p className="muted small">These have no cost recorded, so they are left out of your gain.</p>
          <div className="list">
            {noCost.map((r) => (
              <div key={r.id} className="nc-row">
                <span className="row-main">
                  <span className="row-name">{r.name}</span>
                  <span className="row-sub">Worth {fu(r.val)}</span>
                </span>
                <button type="button" className="chip strong" onClick={() => openHolding(r.h)}>Add cost</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Holdings({ holdings, groups, labelOf, renameGroup, rate, update, openHolding, addHolding, exportBackup, importBackup, resetData }) {
  const [open, setOpen] = useState(null);
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const fileRef = useRef(null);
  const manual = holdings.filter((h) => h.type === "manual" && !h.sold);
  const staleCount = manual.filter(isStaleManual).length;
  const finishRename = () => { if (renaming) renameGroup(renaming, nameDraft); setRenaming(null); };
  return (
    <>
      <header className="page-head row-between">
        <h1>Holdings</h1>
        <button type="button" className="btn-ink" aria-expanded={picking} onClick={() => setPicking((p) => !p)}><PlusIcon /> Add</button>
      </header>
      {picking && (
        <div className="picker" role="group" aria-label="Add to which category?">
          <div className="muted small">Add to which category?</div>
          <div className="picker-grid">
            {ORDER.map((g) => (
              <button key={g} type="button" className="picker-btn" onClick={() => { setPicking(false); addHolding(g); }}>
                <CatMark g={g} color={groupColor(g)} /> {labelOf(g)}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="block">
        <h2>All holdings</h2>
        <p className="muted">Tap a holding to change units or cost. Tap the pencil to rename a category.</p>
        <div className="list">
          {groups.map((g) => {
            const isOpen = open === g.g;
            return (
              <div key={g.g} className="row-wrap">
                <div className="cat-line">
                  {renaming === g.g ? (
                    <div className="rename">
                      <CatMark g={g.g} color={g.color} />
                      <input className="field-in rename-in" autoFocus value={nameDraft} maxLength={24} aria-label={`New name for ${g.label}`}
                        onChange={(e) => setNameDraft(e.target.value)} onBlur={finishRename}
                        onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setRenaming(null); }} />
                    </div>
                  ) : (
                    <button type="button" className="row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.g)}>
                      <CatMark g={g.g} color={g.color} />
                      <span className="row-main">
                        <span className="row-name strong">{g.label}</span>
                        <span className="row-sub">{g.all.length} {g.all.length === 1 ? "holding" : "holdings"}</span>
                      </span>
                      <span className="row-val">{fu(g.val)}</span>
                      <Chevron open={isOpen} down />
                    </button>
                  )}
                  <button type="button" className="icon-btn" aria-label={`Rename ${g.label}`} onClick={() => { setRenaming(g.g); setNameDraft(g.label); }}><PencilIcon /></button>
                </div>
                {isOpen && (
                  <div className="sub-list">
                    {g.all.map((h) => (
                      <button key={h.id} type="button" className="sub-row" onClick={() => openHolding(h)}>
                        <span className="row-main">
                          <span className="sub-name">{h.name}</span>
                          <span className={`row-sub${isStaleManual(h) ? " warn" : ""}`}>{holdingSub(h)}</span>
                        </span>
                        <span className="sub-name">{h.sold ? "" : fu((g.items.find((i) => i.id === h.id) || {}).val || 0)}</span>
                        <Chevron />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {manual.length > 0 && (
        <section className="block">
          <h2>Update your numbers</h2>
          <p className="muted">These have no live price. Type what each is worth today.</p>
          {staleCount > 0 && <p className="warn small">{staleCount} {staleCount === 1 ? "value hasn't" : "values haven't"} been updated in over {STALE_DAYS} days.</p>}
          <div className="list">
            {manual.map((h) => (
              <div key={h.id} className="mv-row">
                <label htmlFor={`mv-${h.id}`} className="row-main">
                  <span className="row-name">{h.name}</span>
                  <span className={`row-sub${isStaleManual(h) ? " warn" : ""}`}>{labelOf(h.group)}, {h.valueUpdatedAt ? `updated ${ago(h.valueUpdatedAt)}` : "date unknown"}</span>
                </label>
                <span className="money-box">
                  <span className="muted" aria-hidden="true">{h.ccy === "THB" ? "฿" : "$"}</span>
                  <NumInput id={`mv-${h.id}`} className="money-in" value={h.value} onChange={(v) => update(h.id, { value: v, valueUpdatedAt: Date.now() })} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <h2>Backup</h2>
        <p className="muted">Your holdings are saved on this iPhone only. Save a backup to Files before changing phones.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
          onChange={(e) => { importBackup(e.target.files && e.target.files[0]); e.target.value = ""; }} />
        <div className="two">
          <button type="button" className="btn-box" onClick={exportBackup}><UploadIcon /> Save backup</button>
          <button type="button" className="btn-box" onClick={() => fileRef.current && fileRef.current.click()}><DownloadIcon /> Restore</button>
        </div>
      </section>

      <section className="block danger">
        <button type="button" className="btn-text loss" onClick={resetData}>Reset all data</button>
        <p className="muted small">Replaces everything with the starter list. You can undo for 10 seconds.</p>
      </section>
    </>
  );
}

// The sheet that slides up when you open a holding. Edits apply when you tap Done.
function HoldingSheet({ start, isNew, labelOf, rate, prices, setP, fundP, setMode, setMissing, fundMode, fundMissing, fundError, onSave, onClose, onDelete }) {
  const [d, setD] = useState(start);
  const up = (patch) => setD((x) => ({ ...x, ...patch }));
  const ccy = costCcy(d);
  const cf = costField(d);
  const val = usdValue(d, prices, rate, setP, fundP);
  const cost = hasCost(d, rate) ? usdCost(d, rate) : null;
  const pl = cost != null ? val - cost : null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line
  }, []);

  const switchType = (type) => {
    if (type === "live") up({ type, coin: d.coin || "bitcoin", qty: d.qty || 0, costUSD: d.costUSD || 0 });
    else if (type === "set") up({ type, ticker: d.ticker || "", qty: d.qty || 0, costTHB: d.costTHB || 0 });
    else if (type === "fund") {
      // Carry over what we know from a typed-in value: code from the name, cost in baht,
      // and the last value (used to estimate units once the fund price arrives)
      const toTHB = (v) => (d.ccy === "USD" ? (+v || 0) * (rate || 1) : +v || 0);
      const fromManual = d.type === "manual";
      up({
        type,
        fundCode: d.fundCode || String(d.name || "").trim().toUpperCase(),
        qty: d.type === "fund" ? d.qty : 0,
        costTHB: d.costTHB || (fromManual ? round2(toTHB(d.cost)) : 0),
        estimateFromTHB: fromManual && +d.value > 0 ? toTHB(d.value) : undefined,
      });
    } else up({ type, ccy: d.ccy || "USD", cost: d.cost || 0, value: d.value || 0, valueUpdatedAt: Date.now() });
  };

  // One or two lines on where the price comes from
  const priceInfo = (() => {
    if (d.type === "live") return { text: `${fu(prices[d.coin] ?? FALLBACK_PRICES[d.coin] ?? 0)} per ${COINS[d.coin]?.unit || "unit"}, live price` };
    if (d.type === "set") {
      const t = String(d.ticker || "").toUpperCase();
      if (setP[t]) return { text: `฿${setP[t]} a share on the SET` };
      if (t && setMode === "live" && setMissing.includes(t)) return { text: `No SET price found for "${t}". Check the ticker.`, warn: true };
      return { text: t ? "Getting the SET price…" : "Type the SET ticker below." };
    }
    if (d.type === "fund") {
      const key = fundKeyOf(d);
      const f = fundP[key];
      if (f && typeof f.nav === "number") {
        const day = f.date ? new Date(f.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" }) : null;
        return { text: `฿${f.nav} a unit`, sub: day ? `Fund price for ${day}, the latest from the Thai SEC` : null };
      }
      if (key && fundMode === "live" && fundMissing.includes(key)) return { text: `No fund found for "${key}". Check the code.`, warn: true };
      if (fundMode === "offline" && fundError) return { text: fundError, warn: true };
      return { text: key ? "Getting the fund price…" : "Type the fund code below." };
    }
    return { text: d.valueUpdatedAt ? `Value you type in, updated ${ago(d.valueUpdatedAt)}` : "Value you type in" };
  })();

  const title = String(d.name || "").trim() || (isNew ? "New holding" : "Holding");
  const field = (id, label, input) => (
    <div className="f-row"><label htmlFor={id} className="f-lbl">{label}</label>{input}</div>
  );
  const moneyField = (id, label, key, onCommit) => field(id, label,
    <span className="f-money">
      <span className="muted" aria-hidden="true">{ccy === "THB" ? "฿" : "$"}</span>
      <NumInput id={id} className="f-in" value={d[key] || 0} onChange={(v) => up({ [key]: v, ...(key === "value" ? { valueUpdatedAt: Date.now() } : {}) })} onCommit={onCommit} />
    </span>);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${title} details`} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-bar">
          <button type="button" className="bar-btn" onClick={onClose}>Cancel</button>
          <div className="sheet-title">{title}</div>
          <button type="button" className="bar-btn strong" onClick={() => onSave(d)}>{isNew ? "Add" : "Done"}</button>
        </div>

        <div className="readout">
          <div className="ro-n">{fu(val)}</div>
          <div className="muted">{thb(val * rate)}{d.type !== "manual" && !priceInfo.warn ? `, at ${priceInfo.text}` : ""}</div>
          {pl != null && <div className="ro-pl" style={{ color: tone(pl) }}>{signed(pl)} ({pctTxt(cost > 0 ? pl / cost * 100 : 0)}) since you bought</div>}
          {(d.type === "manual" || priceInfo.warn) && <div className={`small ${priceInfo.warn ? "warn" : "muted"}`}>{priceInfo.text}</div>}
          {priceInfo.sub && <div className="muted small">{priceInfo.sub}</div>}
          {d.type === "fund" && d.unitsEstimated && <div className="warn small">Units are estimated from your last value. Enter the exact number from your SCB app.</div>}
        </div>

        <div className="sheet-body">
          <div className="card">
            {field("f-name", "Name", <input id="f-name" className="f-in" value={d.name} placeholder="e.g. SCBRM3" onChange={(e) => up({ name: e.target.value })} />)}
            {field("f-cat", "Category",
              <select id="f-cat" className="f-in" value={d.group} onChange={(e) => up({ group: e.target.value })}>
                {ORDER.map((x) => <option key={x} value={x}>{labelOf(x)}</option>)}
              </select>)}
            {field("f-type", "Price from",
              <select id="f-type" className="f-in" value={d.type} onChange={(e) => switchType(e.target.value)}>
                <option value="live">Crypto or gold, live</option>
                <option value="set">Thai stock (SET)</option>
                <option value="fund">Thai fund, daily price</option>
                <option value="manual">I type the value</option>
              </select>)}
          </div>

          <div>
            <div className="card">
              {d.type === "live" && (<>
                {field("f-coin", "Coin",
                  <select id="f-coin" className="f-in" value={d.coin} onChange={(e) => up({ coin: e.target.value })}>
                    {Object.entries(COINS).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
                  </select>)}
                {field("f-qty", "Amount held", <NumInput id="f-qty" className="f-in" value={d.qty} onChange={(v) => up({ qty: v })} />)}
                {moneyField("f-cost", "Cost", "costUSD")}
              </>)}
              {d.type === "set" && (<>
                {field("f-tk", "SET ticker", <input id="f-tk" className="f-in caps" value={d.ticker || ""} placeholder="e.g. DELTA" onChange={(e) => up({ ticker: e.target.value.toUpperCase() })} />)}
                {field("f-qty", "Shares held", <NumInput id="f-qty" className="f-in" value={d.qty} onChange={(v) => up({ qty: v })} />)}
                {moneyField("f-cost", "Cost", "costTHB")}
              </>)}
              {d.type === "fund" && (<>
                {field("f-code", "Fund code", <input id="f-code" className="f-in caps" value={d.fundCode || ""} placeholder="e.g. SCBRM3" onChange={(e) => up({ fundCode: e.target.value.toUpperCase() })} />)}
                {field("f-qty", "Units held", <NumInput id="f-qty" className="f-in" value={d.qty} onChange={(v) => up({ qty: v, unitsEstimated: false, estimateFromTHB: undefined })} />)}
                {moneyField("f-cost", "Cost", "costTHB")}
              </>)}
              {d.type === "manual" && (<>
                {field("f-ccy", "Currency",
                  <select id="f-ccy" className="f-in" value={d.ccy || "USD"} onChange={(e) => up({ ccy: e.target.value })}>
                    <option value="USD">US dollar</option><option value="THB">Thai baht</option>
                  </select>)}
                {moneyField("f-val", "Value now", "value")}
                {moneyField("f-cost", "Cost", "cost")}
              </>)}
            </div>

            <p className="muted small hint">{ccy === "THB" ? "Cost is what you paid in total, in baht." : "Cost is what you paid in total, in dollars."}</p>
          </div>

          <div>
            <button type="button" className="btn-box full loss" onClick={() => (isNew ? onClose() : onDelete(d.id))}>{isNew ? "Discard" : "Delete holding"}</button>
            {!isNew && <p className="muted small center hint">You can undo for 6 seconds after deleting.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const svgP = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
const OverviewIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.8" {...svgP}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M8 15h4" /></svg>;
const GainsIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.8" {...svgP}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>;
const ListIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.8" {...svgP}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3.5 6h.01" /><path d="M3.5 12h.01" /><path d="M3.5 18h.01" /></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="2" {...svgP}><path d="M8 3v10" /><path d="M3 8h10" /></svg>;
const PencilIcon = () => <svg width="17" height="17" viewBox="0 0 16 16" strokeWidth="1.5" {...svgP}><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" /></svg>;
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.6" {...svgP}><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" /></svg>;
const UploadIcon = () => <svg width="18" height="18" viewBox="0 0 20 20" strokeWidth="1.6" {...svgP}><path d="M10 13V3" /><path d="M6 7l4-4 4 4" /><path d="M4 11v5h12v-5" /></svg>;
const DownloadIcon = () => <svg width="18" height="18" viewBox="0 0 20 20" strokeWidth="1.6" {...svgP}><path d="M10 3v10" /><path d="M6 9l4 4 4-4" /><path d="M4 11v5h12v-5" /></svg>;

const CSS = `
.folio, .folio *, .folio *::before, .folio *::after { box-sizing:border-box; }
.folio {
  --paper:#EDF1EC; --bar:#F6F8F4; --ink:#17201B; --ink2:#4A554E; --chev:#7B867F;
  --line:#D3DBD2; --line2:#DEE5DD; --field:#FFFFFF; --field-line:#B9C4B8; --chip-line:#C9D2C8; --seg:#DDE4DB;
  --gain:#1B7349; --loss:#B8382A; --warn:#8A5A00; --focus:#2D63A8;
  background:var(--paper); color:var(--ink);
  font-family:'IBM Plex Sans Thai Looped', system-ui, -apple-system, sans-serif;
  font-variant-numeric:tabular-nums; -webkit-font-smoothing:antialiased;
  min-height:100vh; min-height:100dvh;
}
.folio button, .folio input, .folio select { font:inherit; color:inherit; }
.folio button { cursor:pointer; -webkit-tap-highlight-color:transparent; }
.folio :focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.folio h1, .folio h2, .folio p { margin:0; }

.screen { max-width:560px; margin:0 auto; padding:calc(env(safe-area-inset-top) + 12px) 20px calc(env(safe-area-inset-bottom) + 96px); }
.muted { color:var(--ink2); font-size:14px; }
.small { font-size:13px; }
.big { font-size:16px; }
.warn { color:var(--warn); }
.loss { color:var(--loss) !important; }
.strong { font-weight:600; }
.center { text-align:center; }

.topbar { display:flex; align-items:center; justify-content:space-between; min-height:44px; }
.wordmark { font-size:20px; font-weight:700; letter-spacing:-.2px; }
.chip { min-height:44px; padding:0 14px; border:1px solid var(--chip-line); border-radius:22px; background:transparent; font-size:14px; font-weight:500; color:var(--ink2); white-space:nowrap; }
.chip.strong { color:var(--ink); font-weight:600; }
.rate-panel { margin-top:10px; padding:12px 14px; background:var(--field); border-radius:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.rate-lbl { font-size:15px; }
.rate-in { width:96px; }

.hero { position:relative; padding:20px 0 22px; }
.total { font-size:46px; font-weight:600; letter-spacing:-1px; line-height:1.1; margin-top:6px; }
.stamp { background:transparent; color:var(--ink); font:inherit; position:absolute; right:2px; top:22px; transform:rotate(-6deg); border:2px solid var(--ink); outline:1px solid var(--ink); outline-offset:-6px; opacity:.8; border-radius:10px; padding:9px 14px; display:flex; flex-direction:column; align-items:center; max-width:150px; text-align:center; }
.stamp-t { font-size:11px; font-weight:600; }
.stamp-n { font-size:22px; font-weight:700; line-height:1.15; }
.stamp-s { font-size:11px; font-weight:500; }

.pair { border-top:1px solid var(--line); border-bottom:1px solid var(--line); display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); }
.pair > div { padding:14px 0; min-width:0; }
.pair > div + div { padding-left:16px; border-left:1px solid var(--line); }
.pair-n { font-size:18px; font-weight:600; margin-top:2px; }
.market { border-bottom:1px solid var(--line); display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); }
.mkt { padding:12px 0 12px 10px; min-width:0; display:flex; flex-direction:column; gap:3px; }
.mkt:first-child { padding-left:0; }
.mkt + .mkt { border-left:1px solid var(--line); }
.mkt-sym { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--ink2); }
.mkt-sym .mark { width:18px; height:18px; }
.mkt-p { font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mkt-u { font-size:12px; font-weight:500; color:var(--ink2); }
.mkt-c { font-size:13px; font-weight:500; color:var(--ink2); }
.pair-p { font-size:14px; font-weight:500; }

.sec-head { padding:28px 0 6px; display:flex; align-items:baseline; justify-content:space-between; }
.sec-head h2, .block h2 { font-size:18px; font-weight:600; }
.h-small { font-size:16px !important; }

.donut-wrap { position:relative; width:240px; margin:8px auto 10px; }
.donut { display:block; width:240px; height:240px; overflow:visible; }
.donut .seg { cursor:pointer; transition:opacity .2s ease; }
.donut-hole { position:absolute; left:50%; top:120px; transform:translate(-50%,-50%); width:132px; pointer-events:none; display:flex; flex-direction:column; align-items:center; text-align:center; }
.donut-wrap > p { margin-top:2px; }
.peak-panel { margin-bottom:16px; padding:14px; background:var(--field); border-radius:12px; display:flex; flex-direction:column; gap:6px; align-items:flex-start; }
.peak-panel p { font-size:15px; }
.peak-panel .muted.small { font-size:13px; }
.donut-name { font-size:24px; font-weight:600; line-height:1.2; max-width:130px; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.list { display:flex; flex-direction:column; }
.row-wrap { border-bottom:1px solid var(--line); }
.row { width:100%; display:flex; align-items:center; gap:12px; min-height:62px; padding:8px 0; border:0; background:transparent; text-align:left; }
.mark { width:24px; height:24px; flex:none; display:flex; align-items:center; justify-content:center; }
.swatch { width:12px; height:12px; border-radius:3px; }
.swatch.small { width:10px; height:10px; }
.row-main { flex:1 1 auto; display:flex; flex-direction:column; min-width:0; }
.row-name { font-size:16px; font-weight:500; overflow-wrap:anywhere; }
.row-sub { font-size:13px; color:var(--ink2); }
.row-end { display:flex; flex-direction:column; align-items:flex-end; text-align:right; flex:none; }
.row-val { font-size:16px; font-weight:500; }
.chev { flex:none; color:var(--chev); }
.sub-list { padding:0 0 10px 36px; display:flex; flex-direction:column; }
.sub-row { width:100%; display:flex; align-items:center; gap:12px; min-height:54px; padding:6px 0; border:0; border-top:1px solid var(--line2); background:transparent; text-align:left; }
.sub-name { font-size:15px; font-weight:500; }
.updated { padding-top:14px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn-text { min-height:44px; padding:0 4px 0 12px; border:0; background:transparent; font-size:14px; font-weight:600; display:inline-flex; align-items:center; gap:6px; }

.page-head { padding:4px 0 0; }
.page-head h1 { font-size:30px; font-weight:700; letter-spacing:-.4px; line-height:1.2; }
.row-between { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.gl-total { margin-top:14px; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.gl-n { font-size:28px; font-weight:600; letter-spacing:-.4px; }
.gl-p { font-size:16px; font-weight:500; }
.seg { margin:20px 0 6px; padding:3px; border-radius:12px; background:var(--seg); display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:3px; }
.seg button { min-height:40px; border:0; border-radius:9px; background:transparent; font-size:14px; font-weight:500; color:var(--ink2); }
.seg button.on { background:var(--field); color:var(--ink); font-weight:600; box-shadow:0 1px 2px rgba(23,32,27,.12); }
.g-group { padding-top:22px; }
.g-head { display:flex; align-items:center; gap:10px; padding-bottom:8px; border-bottom:2px solid var(--ink); }
.g-name { font-size:18px; font-weight:600; }
.g-pl { font-size:17px; font-weight:600; }
.g-row { width:100%; display:flex; align-items:center; gap:12px; min-height:58px; padding:6px 0; border:0; border-bottom:1px solid var(--line); background:transparent; text-align:left; }
.nc-row { display:flex; align-items:center; gap:12px; min-height:58px; border-bottom:1px solid var(--line); }

.block { padding-top:30px; }
.block > p { margin-top:2px; }
.block .list { margin-top:8px; }
.mv-row { display:flex; align-items:center; gap:12px; min-height:64px; border-bottom:1px solid var(--line); }
.money-box { display:flex; align-items:center; gap:4px; width:148px; height:46px; flex:none; padding:0 12px; border:1px solid var(--field-line); border-radius:10px; background:var(--field); }
.money-in { width:100%; min-width:0; border:0; outline:none; background:transparent; font-size:17px; font-weight:500; text-align:right; padding:0; }
.cat-line { display:flex; align-items:center; gap:4px; }
.icon-btn { width:44px; height:44px; flex:none; border:0; border-radius:22px; background:transparent; display:flex; align-items:center; justify-content:center; color:var(--ink2); }
.rename { flex:1 1 auto; display:flex; align-items:center; gap:12px; min-height:62px; }
.field-in { height:44px; padding:0 12px; border:1px solid var(--field-line); border-radius:10px; background:var(--field); font-size:16px; outline:none; }
.rename-in { flex:1 1 auto; min-width:0; }
.picker { margin-top:14px; padding:14px; background:var(--field); border-radius:12px; }
.picker-grid { margin-top:8px; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; }
.picker-btn { min-height:48px; display:flex; align-items:center; gap:10px; padding:0 12px; border:1px solid var(--line); border-radius:10px; background:transparent; font-size:15px; font-weight:500; text-align:left; }
.two { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; margin-top:12px; }
.btn-box, .btn-ink, .btn-line { min-height:48px; border-radius:12px; font-size:15px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:0 14px; }
.btn-box { border:1px solid var(--field-line); background:var(--field); }
.btn-ink { border:0; background:var(--ink); color:var(--bar) !important; }
.btn-line { min-height:44px; border:1px solid var(--chip-line); background:transparent; font-size:14px; }
.page-head .btn-ink { min-height:44px; border-radius:22px; padding:0 16px 0 12px; }
.full { width:100%; }
.danger { padding-top:40px; }

.tabbar { position:fixed; left:0; right:0; bottom:0; z-index:20; background:var(--bar); border-top:1px solid var(--line); display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); padding:4px 12px max(6px, calc(env(safe-area-inset-bottom) - 16px)); }
.tab { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:44px; border:0; background:transparent; font-size:12px; font-weight:500; color:#5E6962; }
.tab.on { color:var(--ink); font-weight:600; }

.toast { position:fixed; left:50%; bottom:calc(env(safe-area-inset-bottom) + 60px); transform:translateX(-50%); z-index:40; background:var(--ink); color:var(--bar); border-radius:12px; padding:6px 6px 6px 16px; display:flex; align-items:center; gap:12px; font-size:14px; box-shadow:0 6px 20px rgba(23,32,27,.25); max-width:calc(100% - 32px); }
.toast-btn { min-height:40px; padding:0 14px; border:0; border-radius:9px; background:rgba(255,255,255,.14); color:var(--bar) !important; font-weight:600; }

.scrim { position:fixed; inset:0; z-index:30; background:rgba(23,32,27,.45); }
.sheet { position:absolute; left:0; right:0; bottom:0; top:calc(env(safe-area-inset-top) + 40px); max-width:560px; margin:0 auto; background:var(--paper); border-radius:14px 14px 0 0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-bottom:calc(env(safe-area-inset-bottom) + 24px); animation:sheet-up .24s cubic-bezier(.2,.8,.2,1); }
@keyframes sheet-up { from { transform:translateY(40px); opacity:.6; } to { transform:none; opacity:1; } }
.grabber { width:36px; height:5px; border-radius:3px; background:var(--field-line); margin:6px auto 0; }
.sheet-bar { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:2px 8px 0; position:sticky; top:0; background:var(--paper); z-index:1; }
.bar-btn { min-height:44px; padding:0 12px; border:0; background:transparent; font-size:16px; color:var(--ink2); justify-self:start; }
.bar-btn.strong { color:var(--ink); font-weight:700; justify-self:end; }
.sheet-title { font-size:17px; font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; }
.readout { padding:16px 20px 18px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:2px; }
.ro-n { font-size:36px; font-weight:600; letter-spacing:-.6px; line-height:1.15; }
.ro-pl { font-size:15px; font-weight:500; margin-top:6px; }
.sheet-body { padding:18px 16px 0; display:flex; flex-direction:column; gap:18px; }
.card { background:var(--field); border-radius:12px; display:flex; flex-direction:column; }
.f-row { display:flex; align-items:center; gap:12px; min-height:52px; padding:0 16px; border-bottom:1px solid #E3E8E2; }
.card > .f-row:last-child { border-bottom:0; }
.f-lbl { font-size:16px; flex:none; width:110px; }
.f-in { flex:1 1 auto; min-width:0; width:100%; border:0; outline:none; background:transparent; font-size:16px; text-align:right; padding:0; -webkit-appearance:none; appearance:none; }
select.f-in { text-align-last:right; color:var(--ink2); }
.f-in.caps { text-transform:uppercase; }
.f-money { flex:1 1 auto; display:flex; justify-content:flex-end; align-items:center; gap:2px; min-width:0; }
.f-money .f-in { flex:0 1 150px; width:150px; }
.hint { padding:6px 4px 0; }
.pad { padding:10px 16px 14px; }

@media (prefers-reduced-motion: reduce) { .sheet { animation:none; } }
`;
