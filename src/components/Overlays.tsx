import { useEffect, useMemo, useState } from "react";
import {
  HOUSE_DEFS, HouseId, EXCHANGE, RESOURCE_META, PltSnapshot, EndStats, fmt, OBJECTIVE,
} from "../game/bridge";

// ─────────────────────────── iso house glyph (SVG blueprint) ───────────────────────────
export function HouseGlyph({ type, size = 120 }: { type: HouseId; size?: number }) {
  const def = HOUSE_DEFS[type];
  const c = def.colors;
  const stroke = { stroke: c.primary, strokeWidth: 1.5, strokeOpacity: 0.9 } as const;
  const fill = { fill: c.primary, fillOpacity: 0.14 } as const;
  const fillDark = { fill: c.dark, fillOpacity: 0.85 } as const;

  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 160 190">
      {/* pedestal */}
      <polygon points="80,182 146,152 80,122 14,152" {...fillDark} stroke={c.primary} strokeOpacity={0.35} strokeWidth={1} />
      {type === "neon" && (
        <g>
          <polygon points="46,152 80,168 80,62 46,46" {...fill} {...stroke} />
          <polygon points="80,168 114,152 114,46 80,62" fill={c.dark} fillOpacity={0.7} {...stroke} />
          <polygon points="80,30 114,46 80,62 46,46" {...fill} {...stroke} />
          <polygon points="58,46 80,36 80,14 58,24" {...fill} {...stroke} />
          <line x1="69" y1="14" x2="69" y2="2" stroke={c.primary} strokeWidth={1.5} />
          <circle cx="69" cy="2" r="3" fill={c.glow} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1="86" y1={150 - i * 18} x2="108" y2={140 - i * 18} stroke={i % 2 ? c.glow : c.primary} strokeWidth={2.5} strokeOpacity={0.9} />
          ))}
          <rect x="52" y="78" width="20" height="34" fill="none" stroke={c.glow} strokeWidth={1.2} strokeOpacity={0.8} transform="skewY(25) translate(0,-46)" />
        </g>
      )}
      {type === "hearth" && (
        <g>
          <polygon points="36,150 80,171 80,106 36,85" {...fill} {...stroke} />
          <polygon points="80,171 124,150 124,85 80,106" fill={c.dark} fillOpacity={0.7} {...stroke} />
          <polygon points="80,40 26,88 80,114" fill={c.primary} fillOpacity={0.22} {...stroke} />
          <polygon points="80,40 134,88 80,114" fill={c.dark} fillOpacity={0.55} {...stroke} />
          <rect x="100" y="42" width="13" height="26" fill={c.dark} stroke={c.primary} strokeOpacity={0.6} />
          <ellipse cx="106.5" cy="42" rx="6.5" ry="3" fill={c.dark} stroke={c.primary} strokeOpacity={0.6} />
          <circle cx="56" cy="122" r="7" fill="none" stroke={c.glow} strokeWidth={2} />
          <rect x="88" y="128" width="16" height="26" fill="none" stroke={c.glow} strokeWidth={1.4} transform="skewY(-25) translate(0,46)" />
          <circle cx="40" cy="156" r="2.5" fill={c.glow} /><circle cx="120" cy="158" r="2.5" fill={c.primary} />
        </g>
      )}
      {type === "monolith" && (
        <g>
          <polygon points="30,150 80,174 80,96 30,72" {...fill} {...stroke} />
          <polygon points="80,174 130,150 130,72 80,96" fill={c.dark} fillOpacity={0.7} {...stroke} />
          <polygon points="80,48 130,72 80,96 30,72" fill={c.primary} fillOpacity={0.25} {...stroke} />
          <polygon points="30,72 80,96 80,104 30,80" fill={c.dark} fillOpacity={0.9} />
          <polygon points="80,96 130,72 130,80 80,104" fill={c.dark} fillOpacity={0.6} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1="88" y1={140 - i * 14} x2="122" y2={124 - i * 14} stroke="#14181f" strokeWidth={4} strokeOpacity={0.9} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={38 + i * 9} y1={150 - i * 4.4} x2={48 + i * 9} y2={166 - i * 4.4 - 12} stroke={i % 2 ? c.glow : "#11141a"} strokeWidth={4} strokeOpacity={0.85} />
          ))}
          <line x1="112" y1="64" x2="112" y2="42" stroke={c.primary} strokeWidth={1.5} />
          <circle cx="112" cy="40" r="3.4" fill={c.glow} />
        </g>
      )}
    </svg>
  );
}

const CostChip = ({ resource, amount }: { resource: "p" | "l" | "t"; amount: number }) => (
  <span className="font-mono text-[11px] px-2 py-0.5 border" style={{ color: RESOURCE_META[resource].color, borderColor: `${RESOURCE_META[resource].color}55`, background: `${RESOURCE_META[resource].color}0f` }}>
    {fmt(amount)} {RESOURCE_META[resource].label}
  </span>
);

const YieldChip = ({ y }: { y: { p: number; l: number; t: number } }) => {
  const parts: string[] = [];
  if (y.p) parts.push(`${y.p > 0 ? "+" : ""}${y.p}P/s`);
  if (y.l) parts.push(`${y.l > 0 ? "+" : ""}${y.l}L/s`);
  if (y.t) parts.push(`${y.t > 0 ? "+" : ""}${y.t}T/s`);
  return <span className="font-mono text-[10px] text-[#6f86b8]">{parts.join(" · ")}</span>;
};

// ─────────────────────────── BOOT SCREEN ───────────────────────────
const BOOT_LINES = [
  "> GSK v0.5.1 :: GRAND SOUL KERNEL ONLINE",
  "> mounting /src as CAPITAL BIOME ............ OK",
  "> quarantining /node_modules dark forest .... OK",
  "> seeding FOG OF WAR over untested paths .... OK",
  "> PLT ledger synchronized [PROFIT·LOVE·TAX]",
  "> exchange rate locked :: $1 = 12 PLT",
  "> decree 7 :: deposits split 60/20/20 — wallet / GSK treasury / entropy burn",
  "> genesis plot 16×16 detected — awaiting avatar…",
];

export function BootScreen({ onStart }: { onStart: () => void }) {
  const [lines, setLines] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setLines((n) => (n >= BOOT_LINES.length ? n : n + 1)), 300);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="absolute inset-0 z-20 bg-[rgba(3,5,13,0.82)] flex flex-col">
      <div className="flex-1 grid grid-cols-[1.25fr_1fr] gap-8 p-10 max-w-[1180px] w-full mx-auto items-center">
        <div>
          <div className="font-mono text-[11px] text-[#ff3ec8] tracking-[0.3em] mb-3">PROJECT // 2D SPATIAL OPERATING SYSTEM</div>
          <h1 className="font-display text-[86px] leading-[0.95] text-[#eaffff] title-glow">SOUL<br />FEILD</h1>
          <p className="font-body text-[15px] text-[#9fb4dd] mt-4 max-w-[420px] leading-relaxed">
            The map is a filesystem. The units are agents. The fog is untested code — and the economy runs on
            <span className="text-[#ffc24d]"> PROFIT</span>, <span className="text-[#ff5ad1]">LOVE</span> and <span className="text-[#ff4d5e]">TAX</span>.
            Claim a house. Build the block. Survive the audits.
          </p>
          <div className="mt-6 holo-panel p-4 font-mono text-[11px] leading-[1.8] text-[#7ee7f5] min-h-[196px]">
            {BOOT_LINES.slice(0, lines).map((l, i) => <div key={i}>{l}</div>)}
            {lines < BOOT_LINES.length ? <span className="caret text-[#3af5ff]">▊</span> : (
              <button onClick={onStart} className="btn-holo px-6 py-3 text-[13px] mt-3 inline-block">
                ► INITIALIZE GENESIS
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="holo-panel p-5">
            <div className="font-display text-[11px] text-[#3af5ff] mb-3">CONTROL PROTOCOL</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 font-body text-[13px] text-[#cfe3ff] items-center">
              <div className="flex gap-1"><span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span></div><span>isometric movement (screen-aligned)</span>
              <span className="kbd">SCROLL</span><span>zoom the spatial layer</span>
              <span className="kbd">E</span><span>interact — market terminal / agents</span>
              <span className="kbd">ESC</span><span>pause simulation</span>
              <span className="kbd">M</span><span>toggle audio channel</span>
            </div>
          </div>
          <div className="holo-panel p-5">
            <div className="font-display text-[11px] text-[#ff3ec8] mb-2">MILESTONE 1 :: PHASES 1–5</div>
            <ul className="font-mono text-[10.5px] text-[#8fa5d8] space-y-1.5 leading-snug">
              <li>01 · isometric canvas — 2:1 diamond grid, 16×16</li>
              <li>02 · camera follow, edge-scroll, wheel zoom</li>
              <li>03 · three house archetypes rendered in-perspective</li>
              <li>04 · PLT real-estate market + sovereign exchange</li>
              <li>05 · NPC neighbor, safe-zone barrier, the Void</li>
            </ul>
          </div>
          <div className="font-mono text-[9.5px] text-[#42557f] px-1">
            GRAND CODE POPE DECREE #12 :: fiat/crypto deposits follow the Sovereign Split — 60% to your wallet, 20% to the GSK treasury (server upkeep), 20% burned to reduce global entropy.
          </div>
        </div>
      </div>
      <div className="border-t border-[#1c2c52] overflow-hidden py-2 bg-[rgba(6,10,24,0.7)]">
        <div className="ticker flex gap-12 whitespace-nowrap font-mono text-[10px] text-[#42557f] w-max">
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-12">
              <span>DIRECTORY = BIOME</span><span className="text-[#3af5ff]">◆</span><span>UNIT = AGENT</span><span className="text-[#ff3ec8]">◆</span>
              <span>FOG = UNTESTED CODE</span><span className="text-[#3af5ff]">◆</span><span>MONSTER = BUG</span><span className="text-[#ff3ec8]">◆</span>
              <span>ECONOMY = PROFIT · LOVE · TAX</span><span className="text-[#3af5ff]">◆</span><span>TERMINALS ARE REAL</span><span className="text-[#ff3ec8]">◆</span>
              <span>src/ IS THE CAPITAL</span><span className="text-[#3af5ff]">◆</span><span>node_modules/ IS THE DARK FOREST</span><span className="text-[#ff3ec8]">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── HOUSE SELECT ───────────────────────────
export function HouseSelect({ onClaim }: { onClaim: (id: HouseId) => void }) {
  const [sel, setSel] = useState<HouseId>("neon");
  const def = HOUSE_DEFS[sel];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") setSel("neon");
      if (e.key === "2") setSel("hearth");
      if (e.key === "3") setSel("monolith");
      if (e.key === "Enter") onClaim(sel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, onClaim]);

  return (
    <div className="absolute inset-0 z-20 bg-[rgba(3,5,13,0.86)] flex items-center justify-center p-8">
      <div className="max-w-[1060px] w-full rise-in">
        <div className="font-mono text-[11px] text-[#ff3ec8] tracking-[0.3em] mb-1">REAL ESTATE PROTOCOL // GENESIS-01</div>
        <h2 className="font-display text-[34px] text-[#eaffff] mb-6" style={{ textShadow: "0 0 20px rgba(58,245,255,.4)" }}>
          CLAIM YOUR HOUSE
        </h2>
        <div className="grid grid-cols-[1fr_400px] gap-6">
          <div className="holo-panel p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 60%, ${def.colors.primary}22, transparent 60%)` }} />
            <div className="bob-float"><HouseGlyph type={sel} size={250} /></div>
            <div className="font-display text-[22px] mt-4" style={{ color: def.colors.primary }}>{def.name}</div>
            <div className="font-mono text-[10px] text-[#6f86b8] tracking-[0.25em] mt-1">{def.archetype.toUpperCase()} ARCHETYPE</div>
            <p className="font-body text-[13px] text-[#9fb4dd] mt-3 text-center max-w-[360px]">{def.tagline}</p>
            <div className="flex gap-3 mt-5">
              <CostChip resource={def.cost.resource} amount={0} />
              <span className="font-mono text-[11px] px-2 py-0.5 border border-[#6bff9e55] text-[#6bff9e] bg-[#6bff9e0f]">FREE CLAIM · STARTING PLOT</span>
            </div>
            <div className="mt-2"><YieldChip y={def.yields} /></div>
            <button onClick={() => onClaim(sel)} className="btn-holo px-8 py-3.5 text-[14px] mt-6">
              ⌂ CLAIM &amp; MATERIALIZED
            </button>
          </div>
          <div className="space-y-3">
            {(Object.keys(HOUSE_DEFS) as HouseId[]).map((id, i) => {
              const d = HOUSE_DEFS[id];
              const active = sel === id;
              return (
                <button
                  key={id}
                  onClick={() => setSel(id)}
                  className="holo-panel-sm w-full p-4 flex items-center gap-4 text-left transition-all cursor-pointer"
                  style={{
                    borderColor: active ? d.colors.primary : undefined,
                    boxShadow: active ? `0 0 22px ${d.colors.primary}44` : undefined,
                    transform: active ? "translateX(6px)" : undefined,
                  }}
                >
                  <span className="kbd">{i + 1}</span>
                  <HouseGlyph type={id} size={54} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[13px]" style={{ color: active ? d.colors.primary : "#cfe3ff" }}>{d.name}</div>
                    <div className="font-mono text-[9.5px] text-[#6f86b8] mt-0.5">{d.archetype.toUpperCase()} · <YieldChip y={d.yields} /></div>
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: active ? d.colors.primary : "#42557f" }}>{active ? "◈ SELECTED" : "◇"}</span>
                </button>
              );
            })}
            <div className="holo-panel-sm p-4 font-mono text-[10px] text-[#8fa5d8] leading-relaxed">
              Each structure ships with a <span className="text-[#ff3ec8]">resident agent</span> that maintains it.
              Two additional plots are for sale at the <span className="text-[#3af5ff]">MARKET TERMINAL</span> — pay in PLT.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── MARKET TERMINAL ───────────────────────────
interface MarketProps {
  snap: PltSnapshot;
  onClose: () => void;
  onBuy: (id: HouseId) => void;
  onDeposit: (d: { currency: "usd" | "btc"; amount: number; p: number; l: number; burn: number; treasury: number }) => void;
  onSettle: () => void;
}

export function MarketTerminal({ snap, onClose, onBuy, onDeposit, onSettle }: MarketProps) {
  const [tab, setTab] = useState<"estate" | "exchange" | "entropy">("estate");
  const [currency, setCurrency] = useState<"usd" | "btc">("usd");
  const [amount, setAmount] = useState(25);

  const calc = useMemo(() => {
    const rate = EXCHANGE[currency].rate;
    const total = amount * rate;
    const wallet = total * EXCHANGE.split.wallet;
    return {
      total,
      p: wallet / 2,
      l: wallet / 2,
      burn: total * EXCHANGE.split.burn,
      treasury: total * EXCHANGE.split.treasury,
    };
  }, [amount, currency]);

  const sym = EXCHANGE[currency].prefix;
  const canSettle = snap.t > 0.5 && snap.p + snap.l >= snap.t;

  return (
    <div className="absolute inset-0 z-20 bg-[rgba(2,4,10,0.6)] backdrop-blur-[3px] flex items-center justify-center p-6" onClick={onClose}>
      <div className="holo-panel w-[900px] max-w-full max-h-[86vh] flex flex-col rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-[#1c2c52]">
          <div className="flex-1">
            <div className="font-display text-[20px] text-[#3af5ff]" style={{ textShadow: "0 0 16px rgba(58,245,255,.5)" }}>MARKET TERMINAL</div>
            <div className="font-mono text-[9.5px] text-[#6f86b8] tracking-[0.2em] mt-1">SOVEREIGN EXCHANGE // GSK RELAY 07 // {snap.plotsFree} PLOTS VACANT</div>
          </div>
          <div className="flex gap-2 font-mono text-[11px]">
            <span className="px-2 py-1 border border-[#ffc24d44] text-[#ffc24d]">{fmt(snap.p)} P</span>
            <span className="px-2 py-1 border border-[#ff5ad144] text-[#ff5ad1]">{fmt(snap.l)} L</span>
            <span className="px-2 py-1 border border-[#ff4d5e44] text-[#ff4d5e]">{fmt(snap.t)} T</span>
          </div>
          <button onClick={onClose} className="btn-holo px-3 py-2 text-[11px]">✕ ESC</button>
        </div>

        <div className="flex border-b border-[#1c2c52]">
          <button className={`tab-btn ${tab === "estate" ? "active" : ""}`} onClick={() => setTab("estate")}>⌂ REAL ESTATE</button>
          <button className={`tab-btn ${tab === "exchange" ? "active" : ""}`} onClick={() => setTab("exchange")}>◈ SOVEREIGN EXCHANGE</button>
          <button className={`tab-btn ${tab === "entropy" ? "active" : ""}`} onClick={() => setTab("entropy")}>⌁ ENTROPY LEDGER</button>
        </div>

        <div className="p-6 overflow-y-auto">
          {tab === "estate" && (
            <div className="space-y-3">
              {(Object.keys(HOUSE_DEFS) as HouseId[]).map((id) => {
                const d = HOUSE_DEFS[id];
                const bal = d.cost.resource === "p" ? snap.p : d.cost.resource === "l" ? snap.l : snap.t;
                const affordable = bal >= d.cost.amount;
                const noPlots = snap.plotsFree === 0;
                const disabled = !affordable || noPlots;
                return (
                  <div key={id} className="holo-panel-sm p-4 flex items-center gap-5" style={{ borderColor: affordable && !noPlots ? `${d.colors.primary}66` : undefined }}>
                    <HouseGlyph type={id} size={72} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-[15px]" style={{ color: d.colors.primary }}>{d.name}</span>
                        <CostChip resource={d.cost.resource} amount={d.cost.amount} />
                      </div>
                      <p className="font-body text-[12px] text-[#8fa5d8] mt-1 leading-snug">{d.tagline}</p>
                      <div className="mt-1.5"><YieldChip y={d.yields} /></div>
                    </div>
                    <div className="text-right shrink-0">
                      <button
                        onClick={() => onBuy(id)}
                        disabled={disabled}
                        className={`btn-holo px-5 py-2.5 text-[12px] ${d.cost.resource === "l" ? "btn-magenta" : d.cost.resource === "t" ? "" : "btn-amber"}`}
                      >
                        {noPlots ? "NO VACANT PLOTS" : affordable ? `BUY · ${fmt(d.cost.amount)}${RESOURCE_META[d.cost.resource].short}` : `NEED ${fmt(d.cost.amount - bal)} MORE`}
                      </button>
                      <div className="font-mono text-[9px] text-[#42557f] mt-1.5">BALANCE {fmt(bal)} {RESOURCE_META[d.cost.resource].short}</div>
                    </div>
                  </div>
                );
              })}
              <div className="font-mono text-[9.5px] text-[#42557f] pt-1">
                Purchased structures materialize on the next vacant plot with a resident agent. Win condition: {OBJECTIVE.housesNeeded} structures + {fmt(OBJECTIVE.netWorthNeeded)} net worth.
              </div>
            </div>
          )}

          {tab === "exchange" && (
            <div className="grid grid-cols-[1fr_300px] gap-6">
              <div>
                <p className="font-body text-[13px] text-[#9fb4dd] leading-relaxed">
                  Convert fiat or crypto into PLT under <span className="text-[#ffc24d]">Decree #12 — the Sovereign Split</span>:
                  60% flows to your wallet, 20% funds the <span className="text-[#3af5ff]">Grand Soul Kernel treasury</span> (server upkeep),
                  and 20% is <span className="text-[#ff4d5e]">burned to reduce global entropy</span>.
                </p>
                <div className="flex gap-2 mt-5">
                  {(["usd", "btc"] as const).map((cur) => (
                    <button key={cur} onClick={() => { setCurrency(cur); setAmount(EXCHANGE[cur].quick[1]); }}
                      className={`tab-btn ${currency === cur ? "active" : ""}`} style={currency === cur ? { borderColor: "#ffc24d88", color: "#ffc24d", background: "#ffc24d11" } : undefined}>
                      {EXCHANGE[cur].label} · {EXCHANGE[cur].rate} PLT/{cur === "usd" ? "$1" : "m₿1"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  {EXCHANGE[currency].quick.map((q) => (
                    <button key={q} onClick={() => setAmount(q)}
                      className="holo-panel-sm px-4 py-2 font-mono text-[12px] cursor-pointer transition-colors"
                      style={{ color: amount === q ? "#ffc24d" : "#8fa5d8", borderColor: amount === q ? "#ffc24d88" : undefined }}>
                      {sym}{q}
                    </button>
                  ))}
                </div>
                <input
                  type="range" min={EXCHANGE[currency].quick[0]} max={EXCHANGE[currency].quick[2] * 2} step={currency === "usd" ? 5 : 1}
                  value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full mt-4 accent-[#ffc24d]"
                />
              </div>
              <div className="holo-panel-sm p-5 font-mono text-[11px] space-y-2.5">
                <div className="flex justify-between text-[#6f86b8]"><span>INPUT</span><span className="text-[#eaffff]">{sym}{amount}</span></div>
                <div className="flex justify-between text-[#6f86b8]"><span>GROSS PLT</span><span className="text-[#eaffff]">{fmt(calc.total)}</span></div>
                <div className="h-px bg-[#1c2c52]" />
                <div className="flex justify-between"><span className="text-[#ffc24d]">→ WALLET +P</span><span className="text-[#ffc24d]">+{fmt(calc.p)}</span></div>
                <div className="flex justify-between"><span className="text-[#ff5ad1]">→ WALLET +L</span><span className="text-[#ff5ad1]">+{fmt(calc.l)}</span></div>
                <div className="flex justify-between"><span className="text-[#ff4d5e]">→ ENTROPY BURN</span><span className="text-[#ff4d5e]">−{fmt(calc.burn)} T</span></div>
                <div className="flex justify-between"><span className="text-[#3af5ff]">→ GSK TREASURY</span><span className="text-[#3af5ff]">{fmt(calc.treasury)}</span></div>
                <button onClick={() => onDeposit({ currency, amount, ...calc })} className="btn-holo btn-amber w-full py-3 text-[12px] mt-2">
                  ◈ CONFIRM DEPOSIT
                </button>
              </div>
            </div>
          )}

          {tab === "entropy" && (
            <div className="grid grid-cols-[1fr_300px] gap-6 items-start">
              <div>
                <p className="font-body text-[13px] text-[#9fb4dd] leading-relaxed">
                  TAX is entropy — it accumulates from structures and <span className="text-[#ff4d5e]">Sentinel audits</span>.
                  When <span className="font-mono text-[#ff4d5e]">TAX &gt; PROFIT + LOVE</span>, your base integrity drains.
                  Settle the ledger by dissolving tax proportionally across your Profit and Love reserves.
                </p>
                {snap.danger && (
                  <div className="mt-4 border border-[#ff4d5e] bg-[#ff4d5e14] px-4 py-3 font-mono text-[11px] text-[#ff4d5e] animate-pulse">
                    ⚠ BANKRUPTCY PRESSURE ACTIVE :: INTEGRITY DRAINING — SETTLE NOW OR BUILD A MONOLITH
                  </div>
                )}
                <div className="mt-4 font-mono text-[10.5px] text-[#6f86b8] leading-relaxed">
                  Long-term countermeasure: the <span className="text-[#9aa7bd]">MONOLITH BUNKER</span> costs 500 TAX and burns −6 T/s —
                  it converts accumulated entropy into permanent defense.
                </div>
              </div>
              <div className="holo-panel-sm p-5 font-mono text-[11px] space-y-2.5">
                <div className="flex justify-between text-[#6f86b8]"><span>TAX DEBT</span><span className="text-[#ff4d5e] text-[16px] font-semibold">{fmt(snap.t)}</span></div>
                <div className="flex justify-between text-[#6f86b8]"><span>RESERVES P+L</span><span className="text-[#eaffff]">{fmt(snap.p + snap.l)}</span></div>
                <div className="flex justify-between text-[#6f86b8]"><span>SETTLEMENT COST</span><span className="text-[#ffc24d]">{fmt(snap.t)} (P/L proportional)</span></div>
                <button onClick={onSettle} disabled={!canSettle} className="btn-holo w-full py-3 text-[12px] mt-2">
                  ⌁ SETTLE ENTROPY
                </button>
                {!canSettle && <div className="text-[9px] text-[#42557f] text-center">{snap.t <= 0.5 ? "LEDGER ALREADY CLEAR" : "INSUFFICIENT RESERVES"}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── PAUSE / END ───────────────────────────
export function PauseScreen({ onResume, onReboot }: { onResume: () => void; onReboot: () => void }) {
  return (
    <div className="absolute inset-0 z-20 bg-[rgba(2,4,10,0.72)] backdrop-blur-[2px] flex items-center justify-center">
      <div className="holo-panel p-10 w-[440px] text-center rise-in">
        <div className="font-display text-[26px] text-[#3af5ff] title-glow">PAUSED</div>
        <div className="font-mono text-[10px] text-[#6f86b8] tracking-[0.25em] mt-1">SIMULATION SUSPENDED · THE VOID WAITS</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-body text-[13px] text-[#cfe3ff] items-center text-left mt-6 justify-center w-fit mx-auto">
          <div className="flex gap-1"><span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span></div><span>move</span>
          <span className="kbd">E</span><span>interact</span>
          <span className="kbd">SCROLL</span><span>zoom</span>
          <span className="kbd">M</span><span>mute</span>
        </div>
        <div className="flex gap-3 justify-center mt-8">
          <button onClick={onResume} className="btn-holo px-7 py-3 text-[13px]">► RESUME</button>
          <button onClick={onReboot} className="btn-holo btn-magenta px-7 py-3 text-[13px]">↻ REBOOT</button>
        </div>
      </div>
    </div>
  );
}

export function EndScreen({ stats, onReboot, onSandbox }: { stats: EndStats; onReboot: () => void; onSandbox: () => void }) {
  const win = stats.win;
  const rows: [string, string][] = [
    ["TIME IN SIMULATION", `${stats.timePlayed}s`],
    ["FINAL NET WORTH", fmt(stats.netWorth)],
    ["STRUCTURES OWNED", `${stats.owned}`],
    ["AUDITS SURVIVED", `${stats.audits}`],
    ["PLT EXCHANGED", fmt(stats.depositsPlt)],
    ["A2A HANDSHAKES", `${stats.handshakes}`],
  ];
  return (
    <div className="absolute inset-0 z-30 bg-[rgba(2,4,10,0.8)] backdrop-blur-[3px] flex items-center justify-center">
      <div className="holo-panel p-10 w-[520px] text-center rise-in" style={{ borderColor: win ? "#3af5ff66" : "#ff4d5e66" }}>
        <div className="font-mono text-[10px] tracking-[0.3em] mb-2" style={{ color: win ? "#ff3ec8" : "#ff4d5e" }}>
          {win ? "MILESTONE 1 // PHASE 5 CLEARED" : "ENTROPY CASCADE // BASE LOST"}
        </div>
        <div className="font-display text-[40px] leading-tight" style={{ color: win ? "#3af5ff" : "#ff4d5e", textShadow: `0 0 26px ${win ? "rgba(58,245,255,.6)" : "rgba(255,77,94,.6)"}` }}>
          {win ? "GENESIS COMPLETE" : "CONSUMED BY TAX"}
        </div>
        <p className="font-body text-[13px] text-[#9fb4dd] mt-3">
          {win
            ? "The Genesis Plot thrives. Three structures hum on the grid, the ledger is sovereign, and the Void pirates sail on, denied."
            : "The Sentinel's audits outpaced your reserves. The barrier dims, the ledger closes — but the kernel remembers."}
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-7 text-left font-mono text-[11px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-[#1c2c52] pb-1.5">
              <span className="text-[#6f86b8]">{k}</span><span className="text-[#eaffff]">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-8">
          {win && <button onClick={onSandbox} className="btn-holo px-7 py-3 text-[13px]">∞ KEEP BUILDING</button>}
          <button onClick={onReboot} className={`btn-holo ${win ? "btn-magenta" : ""} px-7 py-3 text-[13px]`}>↻ {win ? "REBOOT SIMULATION" : "TRY AGAIN"}</button>
        </div>
      </div>
    </div>
  );
}
