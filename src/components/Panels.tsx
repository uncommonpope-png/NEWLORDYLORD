import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { bridge } from "../game/bridge";
import type { PltSnapshot, RegionId, FactionId } from "../game/bridge";
import {
  REGION_DEFS, FACTION_DEFS, FACTION_TIERS, SPECIES, speciesById,
  TOWER_TIERS, TOWER_FLOORS, TOWER_TIER_COLORS, towerFloorPower,
  HOME_MAX_LEVEL, homeUpgradeCost, homeGardenPlots, SEEDS,
  fmt,
} from "../game/bridge";

export type PanelId = "dashboard" | "creatures" | "factions" | "tower" | "home" | null;

// ── creature glyph (SVG by shape) ────────────────────────────────────
export function CreatureGlyph({ shape, color, size = 40 }: { shape: string; color: string; size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32">
      {shape === "blob" && <circle cx="16" cy="18" r="11" fill={color} opacity="0.9" />}
      {shape === "quad" && <><ellipse cx="15" cy="19" rx="12" ry="8" fill={color} opacity="0.9" /><circle cx="24" cy="11" r="6" fill={color} /><polygon points="21,6 23,1 25,6" fill={color} /><polygon points="25,6 27,1 28,7" fill={color} /></>}
      {shape === "wing" && <><ellipse cx="16" cy="18" rx="7" ry="10" fill={color} opacity="0.9" /><polygon points="10,14 1,6 9,22" fill={color} opacity="0.7" /><polygon points="22,14 31,6 23,22" fill={color} opacity="0.7" /></>}
      {shape === "snake" && <path d="M4 20 q4 -8 8 0 q4 8 8 0 q3 -6 7 -4" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />}
      {shape === "rock" && <polygon points="16,3 28,11 26,26 6,26 4,11" fill={color} opacity="0.9" />}
      {shape === "wisp" && <><circle cx="16" cy="12" r="9" fill={color} opacity="0.85" /><polygon points="11,18 16,30 16,19" fill={color} opacity="0.5" /><polygon points="16,19 18,28 21,18" fill={color} opacity="0.5" /></>}
      <circle cx="12" cy="15" r="1.8" fill="#0a0f1e" />
      <circle cx="20" cy="15" r="1.8" fill="#0a0f1e" />
    </svg>
  );
}

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="holo-panel-sm px-3 py-2">
    <div className="font-mono text-[9px] text-[#42557f] tracking-[0.15em]">{label}</div>
    <div className="font-display text-[15px] mt-0.5" style={{ color }}>{value}</div>
  </div>
);

// ── DASHBOARD 2.0 ────────────────────────────────────────────────────
export function DashboardPanel({ snap, onClose, onOpen }: { snap: PltSnapshot; onClose: () => void; onOpen: (p: PanelId) => void }) {
  const rd = REGION_DEFS[snap.region];
  const xpPct = Math.min(100, (snap.playerXp / snap.xpNext) * 100);
  return (
    <PanelShell title="DASHBOARD 2.0" sub="COMMANDER OVERVIEW" onClose={onClose} accent="#3af5ff">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 holo-panel-sm p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-[22px] border-2" style={{ borderColor: rd.color, color: rd.color, boxShadow: `0 0 18px ${rd.color}44` }}>
            {snap.playerLevel}
          </div>
          <div className="flex-1">
            <div className="font-display text-[16px] text-[#eaffff]">COMMANDER</div>
            <div className="font-mono text-[10px]" style={{ color: rd.color }}>{rd.name} · LV {rd.lv[0]}–{rd.lv[1]} ZONE</div>
            <div className="w-full h-[8px] mt-2 bg-[#0a1226] border border-[#1c2c52]">
              <div className="h-full transition-all duration-300" style={{ width: `${xpPct}%`, background: "linear-gradient(90deg,#3af5ff,#b58cff)", boxShadow: "0 0 8px rgba(58,245,255,.7)" }} />
            </div>
            <div className="font-mono text-[9px] text-[#6f86b8] mt-1">{fmt(snap.playerXp)} / {fmt(snap.xpNext)} XP</div>
          </div>
        </div>

        <Stat label="PROFIT" value={fmt(snap.p)} color="#ffc24d" />
        <Stat label="LOVE" value={fmt(snap.l)} color="#ff5ad1" />
        <Stat label="TAX" value={fmt(snap.t)} color="#ff4d5e" />
        <Stat label="ARMY POWER" value={fmt(snap.armyPower)} color="#3af5ff" />
        <Stat label="SUPPLY" value={`${snap.supply}/${snap.supplyMax}`} color="#9fdcff" />
        <Stat label="INTEGRITY" value={`${Math.round(snap.integrity)}%`} color={snap.integrity > 40 ? "#6bff9e" : "#ff4d5e"} />
        <Stat label="CREATURES CAUGHT" value={`${snap.capturedTotal}`} color="#b58cff" />
        <Stat label="BUGS KILLED" value={`${snap.kills}`} color="#ff8b3e" />
        <Stat label="CITADELS DOWN" value={`${snap.citadelsDown}/${snap.citadelsTotal}`} color="#ff4d5e" />
        <Stat label="TOWER" value={`${TOWER_TIERS[snap.tower.tier]} F${snap.tower.floor}`} color={TOWER_TIER_COLORS[TOWER_TIERS[snap.tower.tier]]} />
        <Stat label="PARTY" value={`${snap.party.length}/${snap.partyMax}`} color="#b58cff" />
        <Stat label="WILD CREATURES" value={`${snap.crittersWild}`} color="#6bff9e" />

        <div className="col-span-2 grid grid-cols-2 gap-2">
          <button onClick={() => onOpen("creatures")} className="btn-holo py-2.5 text-[12px]">CREATURES</button>
          <button onClick={() => onOpen("factions")} className="btn-holo btn-magenta py-2.5 text-[12px]">FACTIONS</button>
          <button onClick={() => onOpen("tower")} className="btn-holo btn-amber py-2.5 text-[12px]">TOWER LADDER</button>
          <button onClick={() => onOpen("home")} className="btn-holo py-2.5 text-[12px]" style={{ borderColor: "#6bff9e", color: "#6bff9e" }}>SOUL HOME</button>
        </div>
      </div>
    </PanelShell>
  );
}

// ── CREATURE COLLECTION ─────────────────────────────────────────────
export function CreaturesPanel({ snap, onClose }: { snap: PltSnapshot; onClose: () => void }) {
  const caughtIds = new Set(snap.party.map((p) => p.speciesId));
  return (
    <PanelShell title="CREATURE COLLECTION" sub={`${snap.party.length}/${snap.partyMax} PARTY · ${snap.storageCreatures} IN STORAGE · ${SPECIES.length} SPECIES`} onClose={onClose} accent="#b58cff">
      <div className="mb-3">
        <div className="font-display text-[11px] text-[#b58cff] mb-2">ACTIVE PARTY</div>
        {snap.party.length === 0 ? (
          <div className="font-mono text-[10px] text-[#42557f]">No creatures yet. Weaken a wild creature (let your units attack it) then press C to catch it.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {snap.party.map((c) => (
              <div key={c.uid} className="holo-panel-sm p-2.5 flex flex-col items-center">
                <CreatureGlyph shape={c.shape} color={c.color} size={44} />
                <div className="font-display text-[10px] mt-1" style={{ color: c.color }}>{c.name}</div>
                <div className="font-mono text-[9px] text-[#6f86b8]">Lv.{c.level}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="font-display text-[11px] text-[#6f86b8] mb-2">BESTIARY</div>
      <div className="grid grid-cols-6 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
        {SPECIES.map((sp) => {
          const seen = caughtIds.has(sp.id);
          return (
            <div key={sp.id} title={`${sp.name} · ${sp.desc}`} className="holo-panel-sm p-1.5 flex flex-col items-center" style={{ opacity: seen ? 1 : 0.3, borderColor: seen ? `${sp.color}55` : undefined }}>
              <CreatureGlyph shape={sp.shape} color={seen ? sp.color : "#2a3450"} size={30} />
              <div className="font-mono text-[7px] mt-0.5 text-center leading-tight" style={{ color: seen ? sp.color : "#42557f" }}>{seen ? sp.name : "???"}</div>
            </div>
          );
        })}
      </div>
      <div className="font-mono text-[9px] text-[#42557f] mt-3">
        TIP: creatures glow when catchable (<span className="text-[#6bff9e]">&lt;40% HP</span>). Press <span className="kbd">C</span> near one. Evolutions happen automatically as your party levels.
      </div>
    </PanelShell>
  );
}

// ── FACTIONS ─────────────────────────────────────────────────────────
export function FactionsPanel({ snap, onClose }: { snap: PltSnapshot; onClose: () => void }) {
  return (
    <PanelShell title="FACTION STANDING" sub="EARN REPUTATION · UNLOCK PERKS AT EXALTED (500)" onClose={onClose} accent="#ff3ec8">
      <div className="space-y-3">
        {snap.factions.map((f) => {
          const def = FACTION_DEFS[f.id];
          const next = FACTION_TIERS.find((t) => t.at > f.rep);
          const pct = next ? Math.min(100, ((f.rep - (FACTION_TIERS[FACTION_TIERS.indexOf(next) - 1]?.at ?? 0)) / (next.at - (FACTION_TIERS[FACTION_TIERS.indexOf(next) - 1]?.at ?? 0))) * 100) : 100;
          return (
            <div key={f.id} className="holo-panel-sm p-3">
              <div className="flex items-center justify-between">
                <div className="font-display text-[12px]" style={{ color: def.color }}>{def.name}</div>
                <div className="font-mono text-[9px] px-2 py-0.5 border" style={{ color: def.color, borderColor: `${def.color}55` }}>{f.tier}</div>
              </div>
              <div className="w-full h-[6px] mt-2 bg-[#0a1226] border border-[#1c2c52]">
                <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: def.color, boxShadow: `0 0 8px ${def.color}88` }} />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-[#6f86b8] mt-1">
                <span>{f.rep} REP{next ? ` / ${next.at}` : " (MAX)"}</span>
                <span style={{ color: def.color }}>{def.perk}</span>
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

// ── TOWER LADDER ─────────────────────────────────────────────────────
export function TowerPanel({ snap, onClose }: { snap: PltSnapshot; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const tier = snap.tower.tier;
  const floor = snap.tower.floor;
  const done = tier >= TOWER_TIERS.length;
  const floorPw = done ? 0 : towerFloorPower(tier, floor);
  const isBoss = floor === TOWER_FLOORS;
  const chance = Math.min(0.95, Math.max(0.1, snap.armyPower / (snap.armyPower + floorPw)));

  const ascend = () => {
    setBusy(true);
    bridge.command("towerAscend", {});
    setTimeout(() => setBusy(false), 600);
  };

  return (
    <PanelShell title="ARCADE LADDER" sub="8 TIERS · 10 FLOORS EACH · CLIMB TO THE SOUL TIER" onClose={onClose} accent="#ffc24d">
      <div className="flex gap-1.5 flex-wrap mb-4">
        {TOWER_TIERS.map((t, i) => (
          <div key={t} className="px-2 py-1 font-display text-[9px] border" style={{
            color: i === tier ? TOWER_TIER_COLORS[t] : i < tier ? "#6f86b8" : "#2a3450",
            borderColor: i === tier ? TOWER_TIER_COLORS[t] : "#1c2c52",
            background: i === tier ? `${TOWER_TIER_COLORS[t]}15` : "transparent",
            boxShadow: i === tier ? `0 0 10px ${TOWER_TIER_COLORS[t]}44` : undefined,
          }}>{t}</div>
        ))}
      </div>

      {done ? (
        <div className="holo-panel-sm p-6 text-center">
          <div className="font-display text-[20px] text-[#b58cff]">SOUL TIER COMPLETE</div>
          <div className="font-mono text-[10px] text-[#6f86b8] mt-2">{snap.tower.totalCleared} floors cleared in total</div>
        </div>
      ) : (
        <div className="holo-panel-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[16px]" style={{ color: TOWER_TIER_COLORS[TOWER_TIERS[tier]] }}>{TOWER_TIERS[tier]} TIER</div>
              <div className="font-mono text-[11px] text-[#9fdcff] mt-0.5">FLOOR {floor} / {TOWER_FLOORS}{isBoss ? " · BOSS" : ""}</div>
            </div>
            <div className="text-right font-mono text-[10px] text-[#6f86b8]">
              <div>FLOOR POWER <span className="text-[#ff8b3e]">{floorPw}</span></div>
              <div>YOUR POWER <span className="text-[#3af5ff]">{snap.armyPower}</span></div>
              <div>WIN CHANCE <span style={{ color: chance > 0.6 ? "#6bff9e" : chance > 0.35 ? "#ffc24d" : "#ff4d5e" }}>{Math.round(chance * 100)}%</span></div>
            </div>
          </div>
          <div className="w-full h-[8px] mt-3 bg-[#0a1226] border border-[#1c2c52]">
            <div className="h-full transition-all duration-300" style={{ width: `${(floor / TOWER_FLOORS) * 100}%`, background: TOWER_TIER_COLORS[TOWER_TIERS[tier]], boxShadow: `0 0 8px ${TOWER_TIER_COLORS[TOWER_TIERS[tier]]}88` }} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={ascend} disabled={busy} className="btn-holo btn-amber flex-1 py-3 text-[13px]">{busy ? "BATTLE…" : isBoss ? "⚔ FIGHT BOSS" : "⚔ ASCEND FLOOR"}</button>
            <button onClick={() => bridge.command("towerReset", {})} className="btn-holo btn-magenta px-4 py-3 text-[11px]">RESET</button>
          </div>
        </div>
      )}
      <div className="font-mono text-[9px] text-[#42557f] mt-3">Floors grant Profit + XP + Forge rep. Boss floors promote you to the next tier. Total cleared: {snap.tower.totalCleared}.</div>
    </PanelShell>
  );
}

// ── SOUL HOME ────────────────────────────────────────────────────────
interface HomeState { level: number; garden: { seed: string | null; watered: boolean; progress: number; ready: boolean }[]; storage: { name: string; color: string; value: number }[]; }

export function SoulHomePanel({ snap, onClose }: { snap: PltSnapshot; onClose: () => void }) {
  const [home, setHome] = useState<HomeState>(() => {
    try { const raw = localStorage.getItem("soulfeild_home"); if (raw) return JSON.parse(raw); } catch { /* noop */ }
    return { level: 1, garden: Array(homeGardenPlots(1)).fill(null).map(() => ({ seed: null, watered: false, progress: 0, ready: false })), storage: [] };
  });
  const [, force] = useState(0);

  useEffect(() => {
    localStorage.setItem("soulfeild_home", JSON.stringify(home));
    const iv = setInterval(() => {
      setHome((h) => {
        let changed = false;
        const garden = h.garden.map((g) => {
          if (!g.seed || g.ready) return g;
          const seed = SEEDS[g.seed];
          const grow = seed.growSec * (g.watered ? 0.5 : 1);
          const np = Math.min(1, g.progress + 1 / grow);
          changed = true;
          return { ...g, progress: np, ready: np >= 1 };
        });
        return changed ? { ...h, garden } : h;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const save = (h: HomeState) => { setHome(h); localStorage.setItem("soulfeild_home", JSON.stringify(h)); };

  const plant = (i: number, seedId: string) => {
    const seed = SEEDS[seedId];
    if (snap.p < seed.cost) return;
    bridge.command("grantReward", { p: -seed.cost });
    const garden = [...home.garden];
    garden[i] = { seed: seedId, watered: false, progress: 0, ready: false };
    save({ ...home, garden });
  };
  const water = (i: number) => {
    const garden = [...home.garden];
    if (garden[i].seed && !garden[i].ready) { garden[i] = { ...garden[i], watered: true }; save({ ...home, garden }); }
  };
  const harvest = (i: number) => {
    const g = home.garden[i];
    if (!g.ready || !g.seed) return;
    const item = SEEDS[g.seed].item;
    const garden = [...home.garden];
    garden[i] = { seed: null, watered: false, progress: 0, ready: false };
    save({ ...home, garden, storage: [...home.storage, { name: item.name, color: item.color, value: item.value }] });
  };
  const upgrade = () => {
    if (home.level >= HOME_MAX_LEVEL) return;
    const cost = homeUpgradeCost(home.level);
    if (snap.p < cost.p || snap.l < cost.l) return;
    bridge.command("grantReward", { p: -cost.p, l: -cost.l });
    const plots = homeGardenPlots(home.level + 1);
    const garden = [...home.garden];
    while (garden.length < plots) garden.push({ seed: null, watered: false, progress: 0, ready: false });
    save({ ...home, level: home.level + 1, garden });
  };
  const sellAll = () => {
    const total = home.storage.reduce((s, it) => s + it.value, 0);
    if (!total) return;
    bridge.command("grantReward", { p: total });
    save({ ...home, storage: [] });
  };

  const ucost = homeUpgradeCost(home.level);

  return (
    <PanelShell title="SOUL HOME" sub={`LEVEL ${home.level}/${HOME_MAX_LEVEL} · GARDEN & STORAGE`} onClose={onClose} accent="#6bff9e">
      <div className="flex gap-2 mb-3">
        <button onClick={upgrade} disabled={home.level >= HOME_MAX_LEVEL} className="btn-holo flex-1 py-2.5 text-[11px]" style={{ borderColor: "#6bff9e", color: "#6bff9e" }}>
          {home.level >= HOME_MAX_LEVEL ? "MAX LEVEL" : `UPGRADE → LV${home.level + 1} (${ucost.p}P ${ucost.l}L)`}
        </button>
      </div>

      <div className="font-display text-[11px] text-[#6bff9e] mb-2">GARDEN PLOTS</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {home.garden.map((g, i) => (
          <div key={i} className="holo-panel-sm p-2.5 min-h-[74px] flex flex-col items-center justify-center">
            {!g.seed ? (
              <div className="flex gap-1 flex-wrap justify-center">
                {Object.entries(SEEDS).map(([id, s]) => (
                  <button key={id} onClick={() => plant(i, id)} title={`${s.name} (${s.cost}P)`} className="w-6 h-6 rounded-full border text-[8px] font-mono cursor-pointer" style={{ borderColor: s.item.color, color: s.item.color }}>{s.item.name[0]}</button>
                ))}
              </div>
            ) : (
              <>
                <div className="font-mono text-[9px]" style={{ color: SEEDS[g.seed].item.color }}>{SEEDS[g.seed].name}</div>
                <div className="w-full h-[5px] mt-1.5 bg-[#0a1226] border border-[#1c2c52]">
                  <div className="h-full" style={{ width: `${g.progress * 100}%`, background: SEEDS[g.seed].item.color }} />
                </div>
                {g.ready ? (
                  <button onClick={() => harvest(i)} className="btn-holo px-2 py-1 text-[9px] mt-1.5" style={{ borderColor: "#6bff9e", color: "#6bff9e" }}>HARVEST</button>
                ) : (
                  <button onClick={() => water(i)} disabled={g.watered} className="font-mono text-[8px] mt-1.5 cursor-pointer" style={{ color: g.watered ? "#42557f" : "#3af5ff" }}>{g.watered ? "WATERED" : "WATER (2x)"}</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-[11px] text-[#ffc24d]">STORAGE CHEST ({home.storage.length})</div>
        <button onClick={sellAll} disabled={!home.storage.length} className="btn-holo btn-amber px-3 py-1.5 text-[10px]">SELL ALL (+{home.storage.reduce((s, it) => s + it.value, 0)}P)</button>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[40px] holo-panel-sm p-2">
        {home.storage.length === 0 && <div className="font-mono text-[9px] text-[#42557f]">Empty. Harvest your garden to stock the chest.</div>}
        {home.storage.map((it, i) => (
          <span key={i} className="font-mono text-[9px] px-2 py-1 border" style={{ color: it.color, borderColor: `${it.color}55` }}>{it.name}</span>
        ))}
      </div>
    </PanelShell>
  );
}

// ── shared shell ─────────────────────────────────────────────────────
function PanelShell({ title, sub, onClose, accent, children }: { title: string; sub: string; onClose: () => void; accent: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 bg-[rgba(2,4,10,0.6)] backdrop-blur-[3px] flex items-center justify-center p-6" onClick={onClose}>
      <div className="holo-panel w-[640px] max-w-full max-h-[84vh] flex flex-col rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-[#1c2c52]">
          <div className="flex-1">
            <div className="font-display text-[20px]" style={{ color: accent, textShadow: `0 0 16px ${accent}88` }}>{title}</div>
            <div className="font-mono text-[9px] text-[#6f86b8] tracking-[0.2em] mt-1">{sub}</div>
          </div>
          <button onClick={onClose} className="btn-holo px-3 py-2 text-[11px]">✕ ESC</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── LIVE TICKER ──────────────────────────────────────────────────────
export function LiveTicker() {
  const [items, setItems] = useState<{ t: string; msg: string; tone: string }[]>([]);
  useEffect(() => bridge.on("ticker", (it) => setItems((xs) => [it, ...xs].slice(0, 6))), []);
  if (!items.length) return null;
  const toneColor = (t: string) => (t === "good" ? "#6bff9e" : t === "bad" ? "#ff4d5e" : "#9fdcff");
  return (
    <div className="absolute top-[64px] right-4 z-10 w-[250px] space-y-1 pointer-events-none">
      {items.map((it, i) => (
        <div key={`${it.t}-${i}`} className="holo-panel-sm px-2.5 py-1.5 flex gap-2 items-baseline log-line" style={{ opacity: 1 - i * 0.14 }}>
          <span className="font-mono text-[8px] text-[#42557f] shrink-0">{it.t}</span>
          <span className="font-mono text-[9.5px]" style={{ color: toneColor(it.tone) }}>{it.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── MOBILE CONTROLS ──────────────────────────────────────────────────
export function MobileControls() {
  const joyRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  const setVec = (x: number, y: number) => bridge.command("joy", { x, y });

  const onDown = (e: React.PointerEvent) => {
    activeId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onMove(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId || !joyRef.current || !knobRef.current) return;
    const rect = joyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / (rect.width / 2), dy = (e.clientY - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knobRef.current.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    setVec(dx, dy);
  };
  const onUp = () => {
    activeId.current = null;
    if (knobRef.current) knobRef.current.style.transform = "translate(0,0)";
    setVec(0, 0);
  };

  const ActBtn = ({ label, color, onDown, onUp, sub }: { label: string; color: string; sub?: string; onDown: () => void; onUp?: () => void }) => (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={() => onUp?.()}
      onPointerLeave={() => onUp?.()}
      className="w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-display text-[13px] select-none touch-none"
      style={{ borderColor: color, color, background: `${color}15`, boxShadow: `0 0 12px ${color}33` }}
    >
      {label}
      {sub && <span className="font-mono text-[6px] text-[#6f86b8]">{sub}</span>}
    </button>
  );

  return (
    <div className="absolute inset-x-0 bottom-[120px] z-20 flex items-end justify-between px-6 pointer-events-none md:hidden">
      <div
        ref={joyRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className="w-[120px] h-[120px] rounded-full border border-[#3af5ff55] bg-[rgba(58,245,255,0.05)] relative pointer-events-auto touch-none"
      >
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-[26px] -mt-[26px] w-[52px] h-[52px] rounded-full border-2 border-[#3af5ff] bg-[rgba(58,245,255,0.2)] transition-transform duration-75" />
      </div>
      <div className="grid grid-cols-2 gap-3 pointer-events-auto">
        <ActBtn label="B" sub="BATTLE" color="#ff4d5e" onDown={() => bridge.command("rallyAll", {})} />
        <ActBtn label="C" sub="CATCH" color="#b58cff" onDown={() => bridge.command("catch", {})} />
        <ActBtn label="⇧" sub="SPRINT" color="#ffc24d" onDown={() => bridge.command("sprint", true)} onUp={() => bridge.command("sprint", false)} />
        <ActBtn label="⤒" sub="JUMP" color="#3af5ff" onDown={() => bridge.command("jump", {})} />
      </div>
    </div>
  );
}
