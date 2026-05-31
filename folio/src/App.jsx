import React, { useState, useEffect, useMemo, useRef } from "react";

/* ════════════════════════════════════════════════════════════
   FOLIO — Portfolio Dashboard
   Design: Folio (Claude Design)  ·  Engine: live prices + storage
════════════════════════════════════════════════════════════ */

const ORDER = ["BTC", "Crypto", "Trading", "Gold", "ETF", "Stocks"];
const GROUPS_META = {
  BTC:     { label: "Bitcoin", color: "#F7931A" },
  Crypto:  { label: "Crypto",  color: "#7C5CFF" },
  Trading: { label: "Trading", color: "#E5484D" },
  Gold:    { label: "Gold",    color: "#E8B923" },
  ETF:     { label: "ETF",     color: "#4A7FD4" },
  Stocks:  { label: "Stocks",  color: "#1FB6C9" },
};
const groupColor = (g) => GROUPS_META[g]?.color || "#6B7280";

const COINS = {
  bitcoin:    { label: "BTC",       fallback: 73500 },
  ethereum:   { label: "ETH",       fallback: 2333 },
  dogecoin:   { label: "DOGE",      fallback: 0.0995 },
  "pax-gold": { label: "Gold (oz)", fallback: 4740 },
};
const FALLBACK_PRICES = Object.fromEntries(Object.entries(COINS).map(([k, v]) => [k, v.fallback]));

const uid = () => "h" + Math.random().toString(36).slice(2, 9);
const SEED_HOLDINGS = [
  { id: "btc",  name: "BTC",  group: "BTC",    type: "live", coin: "bitcoin",  qty: 0.9745498,      costUSD: 0, sold: false },
  { id: "doge", name: "DOGE", group: "Crypto", type: "live", coin: "dogecoin", qty: 13922.44171832, costUSD: 5200, sold: false },
  { id: "defi", name: "DeFi LP", group: "Crypto", type: "manual", ccy: "USD", cost: 0, value: 41254.13, sold: false },
  { id: "gold", name: "Gold (3.6 oz)", group: "Gold", type: "live", coin: "pax-gold", qty: 3.6, costUSD: 11533.36, sold: false, note: "PAXG spot proxy · $3,203.71/oz cost" },
  { id: "cpaxt", name: "CPAXT", group: "Stocks", type: "manual", ccy: "THB", cost: 326250.00, value: 112358.40, sold: false },
  { id: "jck",   name: "JCK",   group: "Stocks", type: "manual", ccy: "THB", cost: 326681.73, value: 43485.00,  sold: false },
  { id: "kex",   name: "KEX",   group: "Stocks", type: "manual", ccy: "THB", cost: 478800.00, value: 5000.00,   sold: false, note: "Suspended · last ฿0.50" },
  { id: "scgp",  name: "SCGP",  group: "Stocks", type: "manual", ccy: "THB", cost: 63005.67,  value: 33040.00,  sold: false },
  { id: "true",  name: "TRUE",  group: "Stocks", type: "manual", ccy: "THB", cost: 33125.55,  value: 82827.60,  sold: false },
  { id: "etf1", name: "SCBAUTO(SSF)",  group: "ETF", type: "manual", ccy: "THB", cost: 68500,  value: 97922.99,  sold: false, note: "7,090.32 u × 13.8108" },
  { id: "etf2", name: "SCBLTT-SSF",   group: "ETF", type: "manual", ccy: "THB", cost: 28500,  value: 26474.64,  sold: false, note: "1,811.52 u × 14.6146" },
  { id: "etf3", name: "SCBRM3",       group: "ETF", type: "manual", ccy: "THB", cost: 13040,  value: 14151.87,  sold: false, note: "523.43 u × 27.0368" },
  { id: "etf4", name: "SCBRMNDQ",     group: "ETF", type: "manual", ccy: "THB", cost: 43000,  value: 52253.08,  sold: false, note: "2,987 u × 17.4935" },
  { id: "etf5", name: "SCBRMS&P500",  group: "ETF", type: "manual", ccy: "THB", cost: 115000, value: 129073.57, sold: false, note: "5,669.9 u × 22.7647" },
  { id: "tr1", name: "Isolated margin", group: "Trading", type: "manual", ccy: "USD", cost: 0, value: 24350, sold: false },
  { id: "tr2", name: "Cross margin",    group: "Trading", type: "manual", ccy: "USD", cost: 0, value: 3378,  sold: false },
];
const STORAGE_KEY = "folio-dashboard-v3";

function usdValue(h, prices, rate) {
  if (h.type === "live") return (+h.qty || 0) * (prices[h.coin] ?? FALLBACK_PRICES[h.coin] ?? 0);
  if (h.ccy === "USD") return +h.value || 0;
  return (+h.value || 0) / (rate || 1);
}
function usdCost(h, rate) {
  if (h.type === "live") return +h.costUSD || 0;
  if (h.ccy === "USD") return +h.cost || 0;
  return (+h.cost || 0) / (rate || 1);
}
const hasCost = (h, rate) => usdCost(h, rate) > 0;

const fu = (v) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const sg = (v) => (v >= 0 ? "+" : "-");
const pc = (v) => (v >= 0 ? "var(--pos)" : "var(--neg)");
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)].join(",");

function polar(cx, cy, r, deg) { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function arcPath(cx, cy, oR, iR, s, e) {
  const g = 2.2, a = s + g / 2, b = e - g / 2;
  if (b - a < 0.5) return "";
  const [x1, y1] = polar(cx, cy, oR, a), [x2, y2] = polar(cx, cy, oR, b);
  const [x3, y3] = polar(cx, cy, iR, b), [x4, y4] = polar(cx, cy, iR, a);
  const la = b - a > 180 ? 1 : 0, f = (n) => n.toFixed(3);
  return `M${f(x1)},${f(y1)} A${oR},${oR} 0 ${la} 1 ${f(x2)},${f(y2)} L${f(x3)},${f(y3)} A${iR},${iR} 0 ${la} 0 ${f(x4)},${f(y4)} Z`;
}

function useCountUp(target, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null, raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(e * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []);
  return m;
}

export default function App() {
  const [holdings, setHoldings] = useState(SEED_HOLDINGS);
  const [rate, setRate] = useState(33);
  const [prices, setPrices] = useState(FALLBACK_PRICES);
  const [changes, setChanges] = useState({});
  const [priceMode, setPriceMode] = useState("loading");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [tab, setTab] = useState("allocation");
  const [hov, setHov] = useState(null);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loaded, setLoaded] = useState(false);
  const fxLocked = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          const res = await window.storage.get(STORAGE_KEY);
          if (res && res.value) {
            const d = JSON.parse(res.value);
            if (Array.isArray(d.holdings)) setHoldings(d.holdings);
            if (typeof d.rate === "number") { setRate(d.rate); fxLocked.current = true; }
          }
        }
      } catch (e) { /* keep seed */ }
      finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage)
          await window.storage.set(STORAGE_KEY, JSON.stringify({ holdings, rate }));
      } catch (e) { /* session only */ }
    })();
  }, [holdings, rate, loaded]);

  const fetchPrices = async () => {
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
    if (!fxLocked.current) {
      try {
        const fr = await fetch("https://open.er-api.com/v6/latest/USD");
        if (fr.ok) { const fd = await fr.json(); if (fd?.rates?.THB) { setRate(+fd.rates.THB.toFixed(2)); fxLocked.current = true; } }
      } catch (e) { /* keep */ }
    }
  };
  useEffect(() => { fetchPrices(); const t = setInterval(fetchPrices, 90000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  const fthb = (v) => "฿" + Math.round(Math.abs(v) * rate).toLocaleString("en-US");

  const groups = useMemo(() => ORDER.map((g) => {
    const items = holdings.filter((h) => h.group === g);
    const val = items.filter((h) => !h.sold).reduce((s, h) => s + usdValue(h, prices, rate), 0);
    const costItems = items.filter((h) => hasCost(h, rate));
    // Only show group-level cost/PL if ALL active items have a cost basis
    // Otherwise it would mix costed + uncosted items and show a misleading return %
    const activeItems = items.filter((h) => !h.sold);
    const allCosted = activeItems.length > 0 && activeItems.every((h) => hasCost(h, rate));
    const cost = allCosted ? costItems.reduce((s, h) => s + usdCost(h, rate), 0) : null;
    const itemRows = items.map((h) => ({
      name: h.name, id: h.id,
      val: usdValue(h, prices, rate),
      cost: hasCost(h, rate) ? usdCost(h, rate) : null,
      live: h.type === "live",
      chg: h.type === "live" ? changes[h.coin] : undefined,
      note: h.sold ? "Sold" : h.note,
    }));
    return { g, label: GROUPS_META[g].label, color: GROUPS_META[g].color, val, cost, items: itemRows };
  }).filter((r) => r.items.length > 0), [holdings, prices, rate, changes]);

  const totalVal = groups.reduce((s, r) => s + r.val, 0);
  const basisCost = holdings.filter((h) => hasCost(h, rate)).reduce((s, h) => s + usdCost(h, rate), 0);
  const basisPL = holdings.filter((h) => hasCost(h, rate)).reduce((s, h) => s + (usdValue(h, prices, rate) - usdCost(h, rate)), 0);
  const basisPLpct = basisCost > 0 ? (basisPL / basisCost) * 100 : 0;
  const GRAND = { value: totalVal, cost: basisCost, pl: basisPL, plPct: basisPLpct };

  const alloc = useMemo(() => groups.filter((r) => r.val > 0)
    .map((r) => ({ g: r.g, label: r.label, value: r.val, color: r.color, share: totalVal > 0 ? (r.val / totalVal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value), [groups, totalVal]);

  const tickers = useMemo(() => ([
    { sym: "BTC",  price: fu(prices.bitcoin),                      chg: changes.bitcoin,     color: "#F7931A" },
    { sym: "ETH",  price: fu(prices.ethereum),                     chg: changes.ethereum,    color: "#7C5CFF" },
    { sym: "DOGE", price: "$" + (prices.dogecoin ?? 0).toFixed(3), chg: changes.dogecoin,    color: "#C2A633" },
    { sym: "GOLD", price: fu(prices["pax-gold"]) + "/oz",          chg: changes["pax-gold"], color: "#E8B923" },
  ]), [prices, changes]);

  const count = useCountUp(GRAND.value, 1400);

  const update = (id, patch) => setHoldings((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const remove = (id) => setHoldings((hs) => hs.filter((h) => h.id !== id));
  const addHolding = () => setHoldings((hs) => [...hs, { id: uid(), name: "New asset", group: "Crypto", type: "manual", ccy: "USD", cost: 0, value: 0, sold: false }]);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const selectAll = (e) => e.target.select();
  const resetData = () => { if (typeof window !== "undefined" && window.confirm("Reset all holdings to the latest data set? This replaces what's saved on this device.")) setHoldings(SEED_HOLDINGS); };

  const TABS = [
    { k: "allocation", label: "Allocation",   Icon: PieIcon },
    { k: "pnl",        label: "Profit & Loss", Icon: TableIcon },
    { k: "edit",       label: "Edit Holdings", Icon: GearIcon },
  ];

  return (
    <div className="folio-root">
      <style>{CSS}</style>
      <div className="folio-glow" />

      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <div className="logo-mark" style={{ background:"linear-gradient(140deg,rgba(34,201,128,.2),rgba(43,214,123,.08))", border:"1px solid rgba(34,201,128,.35)", boxShadow:"0 0 18px rgba(34,201,128,.2),inset 0 1px 0 rgba(255,255,255,.08)" }}><svg width="13" height="13" viewBox="0 0 20 20"><polygon points="10,1 19,10 10,19 1,10" fill="#22C980" /></svg></div>
            <span className="logo-word" style={{ color:"#22C980" }}>FOLIO</span>
          </div>
          <div className="nav-right">
            <button className="nav-pill" onClick={fetchPrices} title="Refresh prices"
              style={{ cursor: "pointer", background: "none", color: "var(--live)" }}>
              {priceMode === "live" && <span className="live-dot" />}
              <span style={{ fontSize: 12 }}>{priceMode === "live" ? "Live prices" : priceMode === "offline" ? "Offline" : "Loading…"}</span>
            </button>
            <div className="nav-sep" />
            <div className="fx-wrap">
              <span className="fx-label">USD/THB</span>
              <input className="fx-input" type="number" value={rate} onFocus={selectAll} onChange={(e) => { fxLocked.current = true; setRate(num(e.target.value)); }} />
            </div>
          </div>
        </div>
      </nav>

      <div className="ticker">
        <div className="ticker-inner">
          {tickers.map((t, i) => (
            <React.Fragment key={t.sym}>
              {i > 0 && <div className="tick-sep" />}
              <div className="tick-item">
                <span className="tick-sym" style={{ color: t.color }}>{t.sym}</span>
                <span className="tick-price">{t.price}</span>
                {typeof t.chg === "number" && <span className="tick-chg" style={{ color: t.chg >= 0 ? "var(--pos)" : "var(--neg)" }}>{t.chg >= 0 ? "+" : ""}{t.chg.toFixed(1)}%</span>}
              </div>
            </React.Fragment>
          ))}
          <div className="tick-ts">{priceMode === "live" && <span className="live-dot" />}{updatedAt ? updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—"}</div>
        </div>
      </div>

      <div className="page pg-fade">
        <div className="hero">
          <div className="hero-card">
            <div className="hero-left">
              <div className="hero-eyebrow" style={{ color:"var(--live)" }}>Portfolio value</div>
              <div className="hero-number" style={{ fontSize: 44 }}>${count.toLocaleString("en-US")}</div>
              <div className="hero-thb">{fthb(GRAND.value)}</div>
            </div>
            <div className="hero-divider" />
            <div className="hero-right">
              <div className="hero-stat">
                <div className="stat-lbl">Cost basis</div>
                <div className="stat-val">{fu(GRAND.cost)}</div>
                <div className="stat-thb">{fthb(GRAND.cost)}</div>
              </div>
              <div className="hero-stat">
                <div className="stat-lbl">Unrealised P&amp;L</div>
                <div className="stat-val" style={{ color: pc(GRAND.pl) }}>{sg(GRAND.pl)}{fu(GRAND.pl)}</div>
                <div className="stat-thb" style={{ color: pc(GRAND.pl) }}>{sg(GRAND.plPct)}{Math.abs(GRAND.plPct).toFixed(1)}% return</div>
              </div>
            </div>
          </div>
        </div>

        <div className="tabs-row">
          {TABS.map((tb) => (
            <button key={tb.k} className={`tab-btn${tab === tb.k ? " active" : ""}`} onClick={() => setTab(tb.k)}><tb.Icon /> {tb.label}</button>
          ))}
        </div>

        <div key={tab} className="panel-fade">
          {tab === "allocation" && (
            <div className="alloc-grid">
              <div className="card donut-card">
                <Donut alloc={alloc} grand={GRAND} hov={hov} onHov={setHov} fthb={fthb} selected={selected} onSelect={(g) => setSelected(selected === g ? null : g)} />
              </div>
              {selected
                ? <DrillDown group={groups.find((gr) => gr.g === selected)} onBack={() => setSelected(null)} />
                : <AllocBars alloc={alloc} grand={GRAND} hov={hov} onHov={setHov} />}
            </div>
          )}
          {tab === "pnl" && <PnLTable groups={groups} grand={GRAND} hov={hov} onHov={setHov} />}
          {tab === "edit" && (
            <EditHoldings holdings={holdings} expanded={expanded} setExpanded={setExpanded}
              update={update} remove={remove} addHolding={addHolding} resetData={resetData}
              num={num} selectAll={selectAll} prices={prices} rate={rate} fthb={fthb} />
          )}
        </div>

        <div className="footer">USD · ฿THB at {rate} · crypto &amp; gold live via CoinGecko · stocks &amp; ETF at last NAV · {updatedAt ? `updated ${updatedAt.toLocaleTimeString()}` : "loading"}</div>
      </div>
    </div>
  );
}

function CategoryCards({ alloc, groups, hov, onHov, fthb }) {
  const mounted = useMounted();
  return (
    <div className="cat-section">
      <div className="cat-cards">
        {alloc.map((d, i) => {
          const grp = groups.find((g) => g.g === d.g);
          const gpl = grp && grp.cost != null ? grp.val - grp.cost : null;
          const isH = hov === d.g, isO = hov && !isH;
          return (
            <div key={d.g} className="card-in" style={{ animationDelay: `${i * 55}ms` }}>
              <div className="cat-card" style={{
                background: isH ? `rgba(${hexRgb(d.color)},.1)` : "var(--bg-card)",
                borderColor: isH ? `rgba(${hexRgb(d.color)},.4)` : "var(--border)",
                borderTopColor: isH ? d.color + "80" : "var(--border-hi)",
                boxShadow: isH ? `0 0 28px rgba(${hexRgb(d.color)},.18),inset 0 1px 0 rgba(255,255,255,.07)` : "inset 0 1px 0 rgba(255,255,255,.04)",
                opacity: isO ? 0.3 : 1,
              }} onMouseEnter={() => onHov(d.g)} onMouseLeave={() => onHov(null)}>
                <div className="cat-eyebrow-row" style={{ color: d.color }}>
                  <span className="cat-dot" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />{d.label}
                </div>
                <div className="cat-val">{fu(d.value)}</div>
                <div className="cat-thb">{fthb(d.value)}</div>
                <div className="cat-bar-track">
                  <div className="cat-bar-fill" style={{ width: mounted ? d.share + "%" : 0, background: d.color, boxShadow: `0 0 8px ${d.color}80`, transition: "width .6s var(--ease)", transitionDelay: `${i * 60}ms` }} />
                </div>
                <div className="cat-footer">
                  <span className="cat-pct" style={{ color: d.color }}>{d.share.toFixed(1)}%</span>
                  {gpl != null && <span className="cat-pl" style={{ color: gpl >= 0 ? "var(--pos)" : "var(--neg)" }}>{gpl >= 0 ? "+" : "-"}{fu(Math.abs(gpl))}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Donut({ alloc, grand, hov, onHov, fthb, selected, onSelect }) {
  const CX = 120, CY = 120, OR = 103, IR = 68;
  let cum = 0;
  const segs = alloc.map((d) => { const st = cum * 3.6; cum += d.share; return { ...d, st, en: cum * 3.6 }; });
  const activeG = hov || selected;
  const active = activeG ? alloc.find((a) => a.g === activeG) : null;
  const cLabel = active ? active.label : "Total value";
  const cVal = active ? fu(active.value) : fu(grand.value);
  const cSub = active ? active.share.toFixed(1) + "%" : fthb(grand.value);
  const cClr = active ? active.color : "var(--fg1)";
  return (
    <svg width="290" height="290" viewBox="0 0 240 240" style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
      <defs>
        {segs.map((s) => (
          <filter key={s.g} id={`gl-${s.g}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        ))}
      </defs>
      {segs.map((s) => {
        const isH = s.g === hov || s.g === selected;
        const isO = activeG && !isH;
        return (
          <path key={s.g} d={arcPath(CX, CY, isH ? OR + 7 : OR, IR, s.st, s.en)} fill={s.color} opacity={isO ? 0.15 : 1}
            filter={isH ? `url(#gl-${s.g})` : "none"} style={{ cursor: "pointer", transition: "opacity .2s ease" }}
            onMouseEnter={() => onHov(s.g)} onMouseLeave={() => onHov(null)} onClick={() => onSelect(s.g)} />
        );
      })}
      <text x={CX} y={CY - 14} textAnchor="middle" fill="var(--fg3)" fontSize="10" fontFamily="'Sora',sans-serif" fontWeight="500">{cLabel}</text>
      <text x={CX} y={CY + 9} textAnchor="middle" fill={cClr} fontSize="17" fontWeight="600" fontFamily="'JetBrains Mono',monospace" style={{ fontFeatureSettings: '"tnum"' }}>{cVal}</text>
      <text x={CX} y={CY + 27} textAnchor="middle" fill="var(--fg3)" fontSize="11.5" fontFamily="'JetBrains Mono',monospace">{cSub}</text>
    </svg>
  );
}

function AllocBars({ alloc, grand, hov, onHov }) {
  const mounted = useMounted();
  return (
    <div className="bars-card card">
      <div className="bars-hdr"><span className="bars-title">Category breakdown</span><span className="bars-total">{fu(grand.value)}</span></div>
      {alloc.map((d, i) => {
        const isH = d.g === hov, isO = hov && !isH;
        return (
          <div key={d.g} className="bar-item" style={{ opacity: isO ? 0.28 : 1 }} onMouseEnter={() => onHov(d.g)} onMouseLeave={() => onHov(null)}>
            <div className="bar-meta">
              <span className="bar-name"><span className="bar-pip" style={{ background: d.color, boxShadow: isH ? `0 0 9px ${d.color}` : "none" }} />{d.label}</span>
              <span className="bar-nums"><span className="bar-pct">{d.share.toFixed(1)}%</span><span className="bar-usd">${Math.round(d.value).toLocaleString("en-US")}</span></span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: mounted ? d.share + "%" : 0, background: `linear-gradient(90deg, ${d.color}99, ${d.color})`, boxShadow: isH ? `0 0 12px ${d.color}90` : `0 0 6px ${d.color}45`, opacity: isH ? 1 : 0.72, transitionDelay: mounted ? "0ms" : `${i * 70}ms` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniDonut({ group }) {
  const CX = 80, CY = 80, OR = 66, IR = 46;
  const total = group.val || 1;
  const live = group.items.filter((it) => it.val > 0);
  let cum = 0;
  const segs = live.map((item) => { const share = (item.val / total) * 100; const st = cum * 3.6; cum += share; return { ...item, share, st, en: cum * 3.6 }; });
  const opacities = [1, 0.62, 0.42, 0.28, 0.2];
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ display: "block", flexShrink: 0 }}>
      <defs><filter id="gl-mini" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {segs.map((s, i) => (
        <path key={s.name} d={arcPath(CX, CY, OR, IR, s.st, s.en)} fill={group.color} opacity={opacities[i] !== undefined ? opacities[i] : 0.18} filter="url(#gl-mini)" />
      ))}
      <text x={CX} y={CY - 4} textAnchor="middle" fill="var(--fg1)" fontSize="20" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{live.length}</text>
      <text x={CX} y={CY + 13} textAnchor="middle" fill="var(--fg3)" fontSize="10" fontFamily="'Sora',sans-serif">{live.length === 1 ? "asset" : "assets"}</text>
    </svg>
  );
}

function DrillDown({ group, onBack }) {
  const mounted = useMounted();
  if (!group) return null;
  const total = group.val || 1;
  const items = group.items.filter((it) => it.val > 0).map((item) => ({ ...item, share: (item.val / total) * 100 }));
  return (
    <div className="bars-card card" style={{ animation: "plfade .22s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <button className="drill-back" onClick={onBack}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>Categories
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--fg1)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: group.color, boxShadow: `0 0 8px ${group.color}`, display: "inline-block", flexShrink: 0 }} />Inside {group.label}
        </span>
      </div>
      <div className="drill-grid">
        <MiniDonut group={group} />
        <div>
          {items.map((item, i) => (
            <div key={item.name} style={{ marginBottom: i < items.length - 1 ? 16 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--fg1)", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: group.color, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, display: "flex", gap: 10, flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ color: "var(--fg1)", fontWeight: 600 }}>{item.share.toFixed(1)}%</span>
                  <span style={{ color: "var(--fg3)" }}>${Math.round(item.val).toLocaleString("en-US")}</span>
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: mounted ? item.share + "%" : 0, background: `linear-gradient(90deg, ${group.color}99, ${group.color})`, boxShadow: `0 0 6px ${group.color}45`, opacity: 0.8, transitionDelay: `${i * 60}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20, fontSize: 11, color: "var(--fg4)", fontFamily: "'JetBrains Mono',monospace" }}>Weight of each holding within {group.label}.</div>
    </div>
  );
}

function PnLTable({ groups, grand, hov, onHov }) {
  const [open, setOpen] = useState({});
  const toggle = (g) => setOpen((s) => ({ ...s, [g]: !s[g] }));
  const costed = groups.filter((g) => g.cost);
  const maxAbsPct = costed.length ? Math.max(...costed.map((g) => Math.abs((g.val - g.cost) / g.cost * 100))) : 1;
  return (
    <div className="card pnl-card">
        <table className="pnl-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Asset</th>
              <th className="pnl-col-cost">Cost basis</th>
              <th>Current value</th>
              <th>P&amp;L</th>
              <th className="pnl-col-return">Return</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((grp) => {
              const isO2 = open[grp.g];
              const gpl = grp.cost != null ? grp.val - grp.cost : null;
              const gpp = grp.cost ? gpl / grp.cost * 100 : null;
              const isHov = hov === grp.g, isOther = hov && !isHov;
              return (
                <React.Fragment key={grp.g}>
                  <tr className="g-row" onClick={() => toggle(grp.g)} onMouseEnter={() => onHov(grp.g)} onMouseLeave={() => onHov(null)} style={{ opacity: isOther ? 0.35 : 1 }}>
                    <td style={{ borderLeft: `3px solid ${isHov ? grp.color : "transparent"}`, paddingLeft: isHov ? 15 : 18, transition: "border-color .15s,padding .15s" }}>
                      <span className="g-name">
                        <svg className={`chev${isO2 ? " open" : ""}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        <span className="g-dot" style={{ background: grp.color, boxShadow: isHov ? `0 0 7px ${grp.color}` : "none" }} />{grp.label}
                        <span className="h-ct">· {grp.items.length} {grp.items.length > 1 ? "holdings" : "holding"}</span>
                      </span>
                    </td>
                    <td className="pnl-col-cost">{grp.cost != null ? fu(grp.cost) : "—"}</td>
                    <td>{fu(grp.val)}</td>
                    <td style={{ color: gpl != null ? pc(gpl) : "var(--fg4)" }}>{gpl != null ? sg(gpl) + fu(gpl) : "—"}</td>
                    <td className="pnl-col-return">
                      {gpp != null ? (
                        <div className="ret-bar-wrap">
                          <span style={{ color: pc(gpp), minWidth: 52, textAlign: "right" }}>{sg(gpp)}{Math.abs(gpp).toFixed(1)}%</span>
                          <div className="ret-bar-track"><div className="ret-bar-fill" style={{ width: `${Math.min(Math.abs(gpp) / maxAbsPct * 100, 100)}%`, background: gpp >= 0 ? "var(--pos)" : "var(--neg)", opacity: 0.7 }} /></div>
                        </div>
                      ) : <span className="dim">—</span>}
                    </td>
                  </tr>
                  {isO2 && grp.items.map((item) => {
                    const pl = item.cost != null ? item.val - item.cost : null;
                    const pp = item.cost ? pl / item.cost * 100 : null;
                    return (
                      <tr key={item.name} className="item-row" style={{ opacity: isOther ? 0.35 : 1 }}>
                        <td>
                          {item.name}
                          {item.live && <span className="live-badge">LIVE</span>}
                          {typeof item.chg === "number" && <span className="chg-chip" style={{ color: item.chg >= 0 ? "var(--pos)" : "var(--neg)" }}>{item.chg >= 0 ? "+" : ""}{item.chg.toFixed(1)}%</span>}
                          {item.note && <span className="note-chip">{item.note}</span>}
                        </td>
                        <td className="pnl-col-cost">{item.cost != null ? fu(item.cost) : "—"}</td>
                        <td>{fu(item.val)}</td>
                        <td style={{ color: pl != null ? pc(pl) : "var(--fg4)" }}>{pl != null ? sg(pl) + fu(pl) : "—"}</td>
                        <td className="pnl-col-return" style={{ color: pp != null ? pc(pp) : "var(--fg4)" }}>{pp != null ? `${sg(pp)}${Math.abs(pp).toFixed(1)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
            <tr className="total-row">
              <td style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>Total</td>
              <td className="bold pnl-col-cost">{fu(grand.cost)}</td>
              <td className="bold">{fu(grand.value)}</td>
              <td className="bold" style={{ color: pc(grand.pl) }}>{sg(grand.pl) + fu(grand.pl)}</td>
              <td className="bold pnl-col-return" style={{ color: pc(grand.plPct) }}>{sg(grand.plPct) + Math.abs(grand.plPct).toFixed(1) + "%"}</td>
            </tr>
          </tbody>
        </table>
    </div>
  );
}

function EditHoldings({ holdings, expanded, setExpanded, update, remove, addHolding, resetData, num, selectAll, prices, rate, fthb }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="edit-hdr">
        <div>
          <div className="edit-title">Holdings</div>
          <div className="edit-sub">Click a category to expand and edit</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={resetData}><RefreshIcon /> Reset data</button>
          <button className="btn-accent" onClick={addHolding}><PlusIcon /> Add asset</button>
        </div>
      </div>

      {ORDER.map((g) => {
        const items = holdings.filter((h) => h.group === g);
        if (!items.length) return null;
        const isOpen = !!expanded[g];
        const gv = items.filter((h) => !h.sold).reduce((s, h) => s + usdValue(h, prices, rate), 0);
        const col = groupColor(g);
        return (
          <div key={g} style={{ marginBottom: 8 }}>
            <div className="acc-head" onClick={() => setExpanded((e) => ({ ...e, [g]: !e[g] }))}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: col, boxShadow: `0 0 8px ${col}80`, flexShrink: 0 }} />
              <svg className={`chev${isOpen ? " open" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'Sora',sans-serif" }}>{GROUPS_META[g].label}</span>
              <span style={{ fontSize: 11, color: "var(--fg4)", fontWeight: 400 }}>· {items.length} {items.length > 1 ? "assets" : "asset"}</span>
              <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--fg2)" }}>{fu(gv)}</span>
            </div>

            {isOpen && (
              <div style={{ paddingTop: 8 }}>
                {items.map((h) => (
                  <div key={h.id} className="ecard">
                    <div className="erow">
                      <div style={{ flex: "2 1 140px" }}>
                        <span className="elbl">Name</span>
                        <input className="ein" style={{ fontFamily: "'Sora',sans-serif" }} value={h.name} onChange={(e) => update(h.id, { name: e.target.value })} />
                      </div>
                      <div style={{ flex: "1 1 90px" }}>
                        <span className="elbl">Category</span>
                        <select className="ein" value={h.group} onChange={(e) => update(h.id, { group: e.target.value })}>
                          {ORDER.map((x) => <option key={x} value={x}>{GROUPS_META[x].label}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: "1 1 90px" }}>
                        <span className="elbl">Price source</span>
                        <select className="ein" value={h.type} onChange={(e) => {
                          const type = e.target.value;
                          if (type === "live") update(h.id, { type, coin: h.coin || "bitcoin", qty: h.qty || 0, costUSD: h.costUSD || 0 });
                          else update(h.id, { type, ccy: h.ccy || "USD", cost: h.cost || 0, value: h.value || 0 });
                        }}>
                          <option value="live">Live price</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>
                      <label className="esold"><input type="checkbox" checked={!!h.sold} onChange={(e) => update(h.id, { sold: e.target.checked })} /> Sold</label>
                      <button className="edel" onClick={() => remove(h.id)} title="Delete"><TrashIcon /></button>
                    </div>

                    {h.type === "live" ? (
                      <div className="erow">
                        <div style={{ flex: "1 1 100px" }}>
                          <span className="elbl">Coin</span>
                          <select className="ein" value={h.coin} onChange={(e) => update(h.id, { coin: e.target.value })}>
                            {Object.entries(COINS).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: "1 1 100px" }}>
                          <span className="elbl">Quantity held</span>
                          <input className="ein" type="number" step="any" value={h.qty} onFocus={selectAll} onChange={(e) => update(h.id, { qty: num(e.target.value) })} />
                        </div>
                        <div style={{ flex: "1 1 100px" }}>
                          <span className="elbl">Cost basis (USD)</span>
                          <input className="ein" type="number" step="any" value={h.costUSD} onFocus={selectAll} onChange={(e) => update(h.id, { costUSD: num(e.target.value) })} />
                        </div>
                      </div>
                    ) : (
                      <div className="erow">
                        <div style={{ flex: "0 1 75px" }}>
                          <span className="elbl">Currency</span>
                          <select className="ein" value={h.ccy} onChange={(e) => update(h.id, { ccy: e.target.value })}>
                            <option value="USD">USD</option><option value="THB">THB</option>
                          </select>
                        </div>
                        <div style={{ flex: "1 1 100px" }}>
                          <span className="elbl">Cost ({h.ccy})</span>
                          <input className="ein" type="number" step="any" value={h.cost} onFocus={selectAll} onChange={(e) => update(h.id, { cost: num(e.target.value) })} />
                        </div>
                        <div style={{ flex: "1 1 100px" }}>
                          <span className="elbl">Current value ({h.ccy})</span>
                          <input className="ein" type="number" step="any" value={h.value} onFocus={selectAll} onChange={(e) => update(h.id, { value: num(e.target.value) })} />
                        </div>
                      </div>
                    )}
                    {h.note && <div className="enote">{h.note}</div>}
                    <div className="eval">
                      → {fu(usdValue(h, prices, rate))} <span style={{ color: "var(--fg4)" }}>({fthb(usdValue(h, prices, rate))})</span>
                      {h.type === "live" && <span style={{ color: "var(--accent)", marginLeft: 8 }}>@ {fu(prices[h.coin] ?? FALLBACK_PRICES[h.coin])}/unit</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PieIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>;
const TableIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" /></svg>;
const GearIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const RefreshIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
.folio-root *, .folio-root *::before, .folio-root *::after { box-sizing:border-box; margin:0; padding:0; }
.folio-root {
  --bg:#06080F; --bg-card:rgba(255,255,255,0.032); --bg-inset:rgba(255,255,255,0.018);
  --bg-raised:rgba(255,255,255,0.052); --bg-row:rgba(255,255,255,0.022);
  --border:rgba(255,255,255,0.08); --border-hi:rgba(255,255,255,0.16); --border-foc:rgba(247,147,26,0.55);
  --fg1:#EDEEF2; --fg2:#8A8F9C; --fg3:#4D5467; --fg4:#252933;
  --pos:#2BD67B; --neg:#FF5C5C; --live:#22C980; --accent:#F7931A;
  --ease:cubic-bezier(.4,0,.2,1); --t:.18s ease;
  background:var(--bg); color:var(--fg1); font-family:'Sora',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  width:100%; min-height:100vh;
  position:relative; overflow-x:hidden;
  display:block;
}
.folio-root::after { content:''; position:fixed; inset:0; background-image:radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px); background-size:28px 28px; pointer-events:none; z-index:0; }
.folio-glow { position:fixed; inset:0; pointer-events:none; z-index:0; background:
  radial-gradient(ellipse 1500px 560px at 50% -70px, rgba(247,147,26,.13) 0%, rgba(124,92,255,.07) 46%, transparent 68%),
  radial-gradient(ellipse 900px 700px at -8% 88%, rgba(124,92,255,.08) 0%, transparent 60%),
  radial-gradient(ellipse 700px 500px at 50% 110%, rgba(31,182,201,.04) 0%, transparent 55%),
  radial-gradient(ellipse 500px 400px at 96% 72%, rgba(229,72,77,.04) 0%, transparent 52%); }

.nav { position:sticky; top:0; z-index:100; backdrop-filter:blur(24px) saturate(150%); -webkit-backdrop-filter:blur(24px); background:rgba(6,8,15,.82); border-bottom:1px solid var(--border); }
.nav::after { content:''; position:absolute; bottom:-1px; left:50%; transform:translateX(-50%); width:70%; height:1px; background:linear-gradient(90deg,transparent,rgba(247,147,26,.28),rgba(124,92,255,.18),transparent); pointer-events:none; }
.nav-inner { max-width:1240px; margin:0 auto; padding:0 44px; height:60px; display:flex; align-items:center; justify-content:space-between; }
.nav-logo { display:flex; align-items:center; gap:11px; }
.logo-mark { width:28px; height:28px; border-radius:7px; background:linear-gradient(140deg,rgba(247,147,26,.2),rgba(229,72,77,.08)); border:1px solid rgba(247,147,26,.28); display:flex; align-items:center; justify-content:center; box-shadow:0 0 18px rgba(247,147,26,.18),inset 0 1px 0 rgba(255,255,255,.08); }
.logo-word { font-size:12px; font-weight:700; letter-spacing:.22em; color:var(--fg1); }
.nav-right { display:flex; align-items:center; gap:10px; }
.nav-pill { display:flex; align-items:center; gap:7px; padding:5px 13px; border:1px solid var(--border); border-radius:99px; font-size:11.5px; }
.live-dot { width:6px; height:6px; border-radius:50%; background:var(--live); box-shadow:0 0 0 2px rgba(34,201,128,.16); animation:pls 2.2s ease-in-out infinite; flex-shrink:0; }
@keyframes pls { 0%,100%{box-shadow:0 0 0 2px rgba(34,201,128,.16)} 50%{box-shadow:0 0 0 5px rgba(34,201,128,.05)} }
.nav-sep { width:1px; height:20px; background:var(--border); }
.fx-wrap { display:flex; align-items:center; gap:7px; }
.fx-label { font-size:11px; color:var(--fg3); }
.fx-input { background:var(--bg-inset); border:1px solid var(--border); color:var(--fg1); border-radius:7px; padding:5px 9px; width:70px; outline:none; font-family:'JetBrains Mono',monospace; font-size:12px; transition:border-color var(--t); }
.fx-input:focus { border-color:var(--border-foc); }

.ticker { border-bottom:1px solid var(--border); background:rgba(255,255,255,.012); position:relative; z-index:1; }
.ticker-inner { max-width:1240px; margin:0 auto; padding:0 44px; height:38px; display:flex; align-items:center; gap:28px; overflow-x:auto; scrollbar-width:none; }
.ticker-inner::-webkit-scrollbar { display:none; }
.tick-item { display:flex; align-items:center; gap:8px; white-space:nowrap; flex-shrink:0; }
.tick-sym { font-size:9.5px; font-weight:700; letter-spacing:.12em; }
.tick-price { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--fg1); font-weight:500; }
.tick-chg { font-family:'JetBrains Mono',monospace; font-size:10.5px; }
.tick-sep { width:1px; height:16px; background:var(--border); flex-shrink:0; }
.tick-ts { margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--fg3); white-space:nowrap; display:flex; align-items:center; gap:6px; flex-shrink:0; }

.page { max-width:1240px; margin:0 auto; padding:52px 44px 110px; position:relative; z-index:1; }
.hero { margin-bottom:32px; }
.hero-eyebrow { font-size:11px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); margin-bottom:10px; display:flex; align-items:center; gap:10px; }
.hero-eyebrow::after { content:''; width:32px; height:1px; background:linear-gradient(90deg,rgba(34,201,128,.55),transparent); }
.hero-card { display:flex; align-items:stretch; border-radius:16px; overflow:hidden; border:1px solid var(--border); border-top-color:var(--border-hi); background:rgba(255,255,255,.032); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); box-shadow:0 1px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06); }
.hero-left { flex:1; padding:28px 36px; display:flex; flex-direction:column; justify-content:center; }
.hero-divider { width:1px; background:var(--border); flex-shrink:0; }
.hero-right { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:rgba(255,255,255,.04); }
.hero-stat { background:var(--bg-card); padding:28px 32px; min-width:0; display:flex; flex-direction:column; justify-content:center; transition:background var(--t); }
.hero-stat:hover { background:var(--bg-raised); }
.hero-number { font-family:'JetBrains Mono',monospace; font-size:74px; font-weight:700; color:var(--fg1); letter-spacing:-.04em; line-height:1; font-feature-settings:"tnum"; text-shadow:0 0 80px rgba(247,147,26,.14); }
.hero-thb { font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--fg3); margin-top:6px; }
.stat-lbl { font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:var(--fg1); margin-bottom:7px; }
.stat-val { font-family:'JetBrains Mono',monospace; font-size:20px; font-weight:600; font-feature-settings:"tnum"; line-height:1.1; }
.stat-thb { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--fg3); margin-top:4px; }

.cat-section { margin-bottom:36px; }
.cat-cards { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; }
.cat-card { padding:16px 14px; border-radius:12px; border:1px solid var(--border); border-top-color:var(--border-hi); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); cursor:default; transition:all .22s ease; }
.cat-eyebrow-row { font-size:9px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; margin-bottom:11px; display:flex; align-items:center; gap:5px; }
.cat-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
.cat-val { font-family:'JetBrains Mono',monospace; font-size:16px; font-weight:700; color:var(--fg1); letter-spacing:-.02em; font-feature-settings:"tnum"; margin-bottom:3px; }
.cat-thb { font-family:'JetBrains Mono',monospace; font-size:9.5px; color:var(--fg3); margin-bottom:11px; }
.cat-bar-track { height:3px; background:rgba(255,255,255,.06); border-radius:99px; position:relative; margin-bottom:9px; }
.cat-bar-fill { position:absolute; top:0; left:0; height:100%; border-radius:99px; }
.cat-footer { display:flex; justify-content:space-between; align-items:center; }
.cat-pct { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; }
.cat-pl { font-family:'JetBrains Mono',monospace; font-size:10px; }

.tabs-row { display:flex; border-bottom:1px solid var(--border); margin-bottom:28px; }
.tab-btn { background:none; border:none; cursor:pointer; font-family:'Sora',sans-serif; font-size:13px; font-weight:500; color:var(--fg3); padding:11px 22px 13px; border-bottom:2px solid transparent; margin-bottom:-1px; display:flex; align-items:center; gap:7px; transition:color var(--t),border-color var(--t); white-space:nowrap; }
.tab-btn:hover { color:var(--fg2); }
.tab-btn.active { color:var(--fg1); border-bottom-color:var(--accent); }

.card { background:var(--bg-card); border:1px solid var(--border); border-top-color:var(--border-hi); border-radius:13px; backdrop-filter:blur(18px) saturate(140%); -webkit-backdrop-filter:blur(18px) saturate(140%); box-shadow:0 1px 40px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06); }
.alloc-grid { display:grid; grid-template-columns:340px 1fr; gap:14px; align-items:start; }
.donut-card { padding:30px 24px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.bars-card { padding:26px 30px; min-width:0; }
.bars-hdr { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:24px; }
.bars-title { font-size:17px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--fg1); }
.bars-total { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--fg3); }
.bar-item { margin-bottom:20px; cursor:default; transition:opacity .18s ease; }
.bar-item:last-child { margin-bottom:0; }
.bar-meta { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:9px; }
.bar-name { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:600; color:var(--fg1); }
.bar-pip { width:7px; height:7px; border-radius:2px; flex-shrink:0; transition:box-shadow .2s ease; }
.bar-nums { font-family:'JetBrains Mono',monospace; font-size:14px; display:flex; gap:11px; }
.bar-pct { color:var(--fg1); font-weight:600; }
.bar-usd { color:var(--fg3); }
.bar-track { height:7px; background:rgba(255,255,255,.05); border-radius:99px; position:relative; overflow:visible; }
.bar-fill { position:absolute; top:0; left:0; height:100%; border-radius:99px; transition:width .55s var(--ease),box-shadow .2s ease; }
.drill-grid { display:grid; grid-template-columns:160px 1fr; gap:28px; align-items:center; }
.drill-back { display:flex; align-items:center; gap:5px; background:none; border:1px solid var(--border); border-radius:7px; color:var(--fg3); font-size:12px; padding:4px 11px; cursor:pointer; font-family:'Sora',sans-serif; transition:color .15s,border-color .15s; }
.drill-back:hover { color:var(--fg1); border-color:var(--border-hi); }

.pnl-card { overflow:hidden; border-radius:13px; }
.pnl-table { width:100%; border-collapse:collapse; table-layout:fixed; }
.pnl-table thead tr { border-bottom:1px solid var(--border); }
.pnl-table th { padding:12px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--fg4); text-align:right; background:var(--bg-inset); white-space:nowrap; overflow:hidden; }
.pnl-table th:first-child { text-align:left; width:38%; }
.pnl-table td { padding:11px 14px; font-family:'JetBrains Mono',monospace; font-size:14px; font-feature-settings:"tnum"; white-space:nowrap; text-align:right; color:var(--fg1); overflow:hidden; text-overflow:ellipsis; }
.pnl-table td:first-child { text-align:left; font-family:'Sora',sans-serif; }
.g-row { cursor:pointer; user-select:none; background:rgba(255,255,255,.02); transition:background var(--t),opacity var(--t); border-top:1px solid rgba(255,255,255,.045); }
.g-row:hover { background:rgba(255,255,255,.04); }
.g-row td { padding:13px 18px; }
.item-row { border-top:1px solid rgba(255,255,255,.025); transition:opacity var(--t); }
.item-row td { padding:9px 18px 9px 44px; }
.item-row td:first-child { font-family:'Sora',sans-serif; font-size:15px; }
.total-row { background:var(--bg-inset); border-top:1px solid var(--border-hi); }
.total-row td { padding:14px 18px; font-weight:700; font-size:15px; }
td.muted{color:var(--fg3)} td.dim{color:var(--fg4)} td.pos{color:var(--pos)} td.neg{color:var(--neg)} td.bold{font-weight:700}
.live-badge { display:inline-block; font-size:9px; font-weight:700; color:var(--accent); border:1px solid rgba(247,147,26,.25); background:rgba(247,147,26,.07); border-radius:4px; padding:1.5px 5px; margin-left:8px; font-family:'JetBrains Mono',monospace; letter-spacing:.07em; vertical-align:middle; }
.chg-chip { font-family:'JetBrains Mono',monospace; font-size:11px; margin-left:7px; vertical-align:middle; }
.note-chip { font-size:11px; color:var(--fg4); margin-left:8px; }
.chev { transition:transform .15s ease; color:var(--fg4); flex-shrink:0; }
.chev.open { transform:rotate(90deg); color:var(--fg2); }
.g-name { display:inline-flex; align-items:center; gap:10px; font-family:'Sora',sans-serif; font-size:15px; font-weight:600; }
.g-dot { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
.h-ct { font-size:11px; color:var(--fg2); font-weight:400; }
.ret-bar-wrap { display:flex; align-items:center; gap:8px; justify-content:flex-end; }
.ret-bar-track { width:48px; height:4px; background:rgba(255,255,255,.06); border-radius:99px; position:relative; flex-shrink:0; }
.ret-bar-fill { position:absolute; top:0; left:0; height:100%; border-radius:99px; }
.pnl-note { padding:11px 18px; font-size:10.5px; color:var(--fg4); font-family:'JetBrains Mono',monospace; background:var(--bg-inset); border-top:1px solid rgba(255,255,255,.03); }

.edit-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px; }
.edit-title { font-size:11px; letter-spacing:.18em; color:var(--fg2); text-transform:uppercase; margin-bottom:3px; }
.edit-sub { font-size:13px; color:var(--fg3); }
.btn-ghost { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,.04); color:var(--fg2); border:1px solid var(--border); border-radius:9px; padding:8px 12px; font-weight:500; cursor:pointer; font-size:12px; font-family:'Sora',sans-serif; transition:all var(--t); }
.btn-ghost:hover { color:var(--fg1); border-color:var(--border-hi); }
.btn-accent { display:flex; align-items:center; gap:6px; background:var(--accent); color:#000; border:none; border-radius:9px; padding:8px 14px; font-weight:600; cursor:pointer; font-size:13px; font-family:'Sora',sans-serif; }
.acc-head { display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; border-radius:11px; border:1px solid var(--border); background:var(--bg-inset); transition:background var(--t); user-select:none; }
.acc-head:hover { background:var(--bg-raised); }
.ecard { border:1px solid var(--border); border-radius:11px; padding:12px; margin-bottom:8px; margin-top:8px; background:var(--bg-inset); }
.erow { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px; }
.erow:last-child { margin-bottom:0; }
.elbl { font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--fg3); margin-bottom:5px; display:block; }
.ein { background:rgba(0,0,0,.32); border:1px solid var(--border); color:var(--fg1); border-radius:8px; padding:8px 10px; outline:none; width:100%; font-family:'JetBrains Mono',monospace; font-size:13px; transition:border-color var(--t); }
.ein:focus { border-color:var(--border-foc); }
.esold { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--fg2); padding-bottom:8px; white-space:nowrap; font-family:'Sora',sans-serif; }
.esold input { width:15px; height:15px; accent-color:var(--accent); }
.edel { background:none; border:none; color:var(--fg3); cursor:pointer; padding:0 0 8px; transition:color var(--t); }
.edel:hover { color:var(--neg); }
.enote { font-size:10.5px; color:var(--fg4); margin-top:7px; line-height:1.5; }
.eval { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--fg3); margin-top:7px; }

.footer { margin-top:60px; text-align:center; font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--fg4); letter-spacing:.04em; }
.pg-fade { animation:pfade .55s ease both; }
@keyframes pfade { from{opacity:0} to{opacity:1} }
.panel-fade { animation:plfade .22s ease both; }
@keyframes plfade { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
.card-in { animation:cin .4s var(--ease) both; }
@keyframes cin { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }

@media(max-width:1100px){ .cat-cards{grid-template-columns:repeat(3,1fr)} }
@media(max-width:860px){
  .page{padding:28px 16px 80px} .nav-inner,.ticker-inner{padding:0 16px} .hero{margin-bottom:20px}
  .alloc-grid{grid-template-columns:1fr} .hero-card{flex-direction:column} .hero-left{padding:20px 20px 14px}
  .hero-divider{width:auto;height:1px} .hero-right{grid-template-columns:1fr 1fr} .hero-stat{padding:16px 20px}
  .cat-cards{grid-template-columns:repeat(2,1fr)} .hero-number{font-size:36px} .drill-grid{grid-template-columns:1fr;gap:18px;justify-items:center}
  .stat-val{font-size:16px} .stat-lbl{font-size:10px}
}
@media(max-width:640px){
  .pnl-col-cost,.pnl-col-return{display:none}
  .pnl-table td,.pnl-table th{padding:9px 8px;font-size:12px}
  .g-row td{padding:9px 8px} .item-row td{padding-left:20px}
  .g-name{font-size:13px} .h-ct{display:none}
  .hero-right{grid-template-columns:1fr} .hero-stat{padding:12px 20px;border-top:1px solid var(--border)}
  .stat-val{font-size:15px} .hero-number{font-size:32px}
}
@media(max-width:420px){
  .hero-stat{padding:10px 16px} .hero-number{font-size:28px}
  .stat-val{font-size:14px} .stat-thb{font-size:10px}
}
`;
