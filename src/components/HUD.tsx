import { useState } from "react";
import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { bridge, PltSnapshot, RESOURCE_META, fmt, HOUSE_DEFS, OBJECTIVE, WEAPON_DEFS, UNIT_DEFS, UNIT_ORDER, STRUCT_DEFS, TURRET_COST, TURRET_MAX, WeaponId, UnitId, StructId } from "../game/bridge";

export type LogEntry = { msg: string; tone: "good" | "bad" | "sys" };

// ── inline SVG icons (no emoji) ──────────────────────────────────────
const IconP = ({ s = 15 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="none" stroke="#ffc24d" strokeWidth="1.6" /><circle cx="8" cy="8" r="2.4" fill="#ffc24d" /></svg>
);
const IconL = ({ s = 15 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 16 16"><path d="M8 14 C3 10 1.5 6.5 3.5 4 C5.5 1.8 8 3.5 8 5 C8 3.5 10.5 1.8 12.5 4 C14.5 6.5 13 10 8 14 Z" fill="none" stroke="#ff5ad1" strokeWidth="1.5" /></svg>
);
const IconT = ({ s = 15 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="#ff4d5e" strokeWidth="1.6" /><line x1="2" y1="8" x2="14" y2="8" stroke="#ff4d5e" strokeWidth="1.4" /></svg>
);
const IconBlade = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path d="M3 21 L14 10 L17 3 L21 7 L14 10 L3 21 Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><line x1="6" y1="15" x2="9" y2="18" stroke="currentColor" strokeWidth="1.7" /></svg>
);
const IconArrow = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" strokeWidth="1.7" /><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.7" /><line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.7" /><line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.7" /></svg>
);
const IconShield = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><line x1="12" y1="7" x2="12" y2="15" stroke="currentColor" strokeWidth="1.7" /><line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.7" /></svg>
);
const IconCannon = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" /><line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.8" /><line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" /><line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.8" /><line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.8" /><line x1="5" y1="5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.8" /><line x1="16" y1="16" x2="19" y2="19" stroke="currentColor" strokeWidth="1.8" /><line x1="19" y1="5" x2="16" y2="8" stroke="currentColor" strokeWidth="1.8" /><line x1="8" y1="16" x2="5" y2="19" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const IconTurret = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path d="M4 21 L20 21 L17 14 L7 14 Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><rect x="10" y="4" width="4" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="3" r="1.6" fill="currentColor" /></svg>
);
const UnitIcon = ({ kind, s = 22 }: { kind: UnitId; s?: number }) => {
  if (kind === "knight") return (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M5 20 L5 8 L12 3 L19 8 L19 20 Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.5" /><line x1="12" y1="12" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" /></svg>
  );
  if (kind === "lancer") return (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M6 21 C6 10 10 5 20 3 C15 8 14 14 13 21 Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="1.3" /></svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="8" y="3" width="8" height="4" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="9.5" y="11" width="5" height="5" fill="currentColor" /></svg>
  );
};

const IconLantern = ({ s = 26 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#ffd977" strokeWidth="1.6">
    <path d="M12 3l5 7-5 7-5-7z" fill="#ffd97722" />
    <path d="M12 6v11M9.5 7.5h5" />
    <path d="M12 1v1M12 22v1M2 10h1.5M20.5 10H22" strokeWidth="1.2" />
  </svg>
);
const IconDrum = ({ s = 26 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#ff8b3e" strokeWidth="1.6">
    <ellipse cx="12" cy="7" rx="8" ry="3" fill="#ff8b3e22" />
    <path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" strokeWidth="1.1" />
    <path d="M9 2l3 5M15 2l-3 5" strokeWidth="1.2" />
  </svg>
);

const WEAPON_ICONS: Record<WeaponId, (p: { s?: number }) => ReactElement> = {
  blade: IconBlade, arrow: IconArrow, shield: IconShield, cannon: IconCannon, lantern: IconLantern, drum: IconDrum,
};

// ── minimap (phase 8) ────────────────────────────────────────────────
const MM_W = 176, MM_H = 120;
const mmx = (x: number) => ((x + 1050) / 2100) * MM_W;
const mmy = (y: number) => ((y + 60) / 1020) * MM_H;

export function Minimap({ snap }: { snap: PltSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MM_W, MM_H);
    ctx.fillStyle = "rgba(4,6,15,0.85)";
    ctx.fillRect(0, 0, MM_W, MM_H);
    // capital district around the Market Core
    ctx.beginPath();
    ctx.moveTo(mmx(0), mmy(192));
    ctx.lineTo(mmx(256), mmy(320));
    ctx.lineTo(mmx(0), mmy(448));
    ctx.lineTo(mmx(-256), mmy(320));
    ctx.closePath();
    ctx.fillStyle = "rgba(34,60,40,0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(58,245,255,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // resource nodes
    for (const n of snap.nodesMini) {
      ctx.fillStyle = n.kind === "crystal" ? "#3af5ff" : "#ff5ad1";
      ctx.beginPath();
      ctx.arc(mmx(n.x), mmy(n.y), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // structures
    for (const b of snap.buildings3d) {
      ctx.fillStyle = b.color;
      if (b.kind === "citadel") {
        ctx.save();
        ctx.translate(mmx(b.x), mmy(b.y));
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else {
        ctx.fillRect(mmx(b.x) - 2, mmy(b.y) - 2, 4, 4);
      }
    }
    // motes
    for (const m of snap.motes) {
      ctx.fillStyle = m.t === "unit" ? "#3af5ff" : "#ff4d5e";
      ctx.fillRect(mmx(m.x) - 1, mmy(m.y) - 1, 2.4, 2.4);
    }
  }, [snap]);
  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
      <div className="holo-panel-sm p-1.5">
        <canvas ref={ref} width={MM_W} height={MM_H} className="block" />
        <div className="font-mono text-[8px] text-[#42557f] tracking-[0.25em] text-center mt-1">OPEN WORLD · 56×56</div>
      </div>
    </div>
  );
}

// ── resource readout ─────────────────────────────────────────────────
const rate = (r: number) => (r >= 0 ? `+${r.toFixed(1)}` : r.toFixed(1));

export function ResourceReadout({ res, value, r }: { res: "p" | "l" | "t"; value: number; r: number }) {
  const meta = RESOURCE_META[res];
  const rateColor = res === "t" ? (r > 0 ? "#ff4d5e" : "#6bff9e") : r < 0 ? "#ff4d5e" : "#6f86b8";
  return (
    <div className="holo-panel-sm flex items-center gap-2.5 px-3 py-1.5 min-w-[118px]">
      <span className="shrink-0">{res === "p" ? <IconP /> : res === "l" ? <IconL /> : <IconT />}</span>
      <div className="leading-none">
        <div className="font-mono text-[15px] font-semibold" style={{ color: meta.color }}>{fmt(value)}</div>
        <div className="font-mono text-[9px] mt-0.5" style={{ color: rateColor }}>{meta.label} {rate(r)}/s</div>
      </div>
    </div>
  );
}

// ── warcraft command card (train units / build structures) ──────────
function CostLine({ p, l, t }: { p: number; l: number; t: number }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[8.5px] leading-none">
      {p > 0 && <span style={{ color: RESOURCE_META.p.color }}>{p}P</span>}
      {l > 0 && <span style={{ color: RESOURCE_META.l.color }}>{l}L</span>}
      {t > 0 && <span style={{ color: RESOURCE_META.t.color }}>{t}T</span>}
    </span>
  );
}

function UnitGlyph({ color, kind, s = 26 }: { color: string; kind: string; s?: number }) {
  const shapes: Record<string, ReactElement> = {
    imp: <polygon points="12,3 21,20 3,20" fill={color} />,
    knight: <rect x="5" y="5" width="14" height="14" fill={color} />,
    scout: <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke={color} strokeWidth="2.5" />,
    lancer: <polygon points="12,2 15,10 22,12 15,14 12,22 9,14 2,12 9,10" fill={color} />,
    bomber: <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="2.5" />,
    golem: <rect x="4" y="4" width="16" height="16" fill="none" stroke={color} strokeWidth="2.5" />,
    guardian: <path d="M12 2 L21 6 V13 C21 18 17 21 12 22 C7 21 3 18 3 13 V6 Z" fill={color} />,
    priest: <path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z" fill={color} />,
    titan: <polygon points="12,1 15,8 22,8 16.5,12.5 18.5,20 12,15.5 5.5,20 7.5,12.5 2,8 9,8" fill="none" stroke={color} strokeWidth="2" />,
    gleaner: <circle cx="12" cy="12" r="6" fill={color} />,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24">{shapes[kind] ?? shapes.knight}</svg>;
}

function StructGlyph({ color, kind, s = 26 }: { color: string; kind: string; s?: number }) {
  const shapes: Record<string, ReactElement> = {
    supply: <polygon points="12,2 15,9 12,22 9,9" fill={color} />,
    barracks: <g><rect x="3" y="10" width="18" height="11" fill={color} /><polygon points="2,10 12,3 22,10" fill="none" stroke={color} strokeWidth="2" /></g>,
    foundry: <g><rect x="4" y="8" width="16" height="13" fill={color} /><circle cx="12" cy="5" r="3" fill="none" stroke={color} strokeWidth="2" /></g>,
    heavy: <g><rect x="3" y="6" width="18" height="15" fill="none" stroke={color} strokeWidth="2.5" /><rect x="8" y="11" width="8" height="10" fill={color} /></g>,
    sanctum: <polygon points="12,1 20,21 4,21" fill="none" stroke={color} strokeWidth="2.5" />,
    turret: <g><rect x="9" y="4" width="6" height="12" fill={color} /><rect x="4" y="16" width="16" height="6" fill="none" stroke={color} strokeWidth="2" /></g>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24">{shapes[kind] ?? shapes.barracks}</svg>;
}

export interface CommandCardProps {
  snap: PltSnapshot;
  onProd: (id: UnitId) => void;
  onPlace: (id: StructId) => void;
  onSpeed: () => void;
}

export function CommandCard({ snap, onProd, onPlace, onSpeed }: CommandCardProps) {
  const [tab, setTab] = useState<"train" | "build">("train");
  const builtKinds = new Set(snap.buildings3d.filter((b) => b.done).map((b) => b.kind));
  const isLocked = (req: StructId | null) => !!req && !builtKinds.has(req);

  return (
    <div className="absolute bottom-4 right-4 z-10 w-[270px] pointer-events-auto">
      <div className="holo-panel p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <button className={`tab-btn flex-1 ${tab === "train" ? "active" : ""}`} onClick={() => setTab("train")}>TRAIN</button>
          <button className={`tab-btn flex-1 ${tab === "build" ? "active" : ""}`} onClick={() => setTab("build")}>BUILD</button>
          <button
            onClick={onSpeed}
            className="font-mono text-[9px] px-2 py-1 border border-[#1c2c52] cursor-pointer hover:border-[#ffc24d88] hover:text-[#ffc24d] transition-colors"
            style={{ color: snap.gameSpeed > 1 ? "#ffc24d" : "#6f86b8" }}
            title="cycle simulation speed"
          >
            {snap.gameSpeed}×
          </button>
        </div>

        {snap.buildArmed && (
          <div className="mb-2 px-2 py-1.5 border border-[#ffc24d66] bg-[#ffc24d0f] font-mono text-[9px] text-[#ffc24d] text-center">
            PLACING :: {snap.buildArmed.toUpperCase()} — click ground · right-click cancel
          </div>
        )}

        {tab === "train" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {UNIT_ORDER.map((id) => {
              const def = UNIT_DEFS[id];
              const locked = isLocked(def.requires);
              const broke = snap.p < def.cost.p || snap.l < def.cost.l || snap.t < def.cost.t;
              const supplyFull = snap.supply >= snap.supplyMax;
              const disabled = locked || broke;
              const reqName = def.requires ? STRUCT_DEFS[def.requires].name : "";
              return (
                <button
                  key={id}
                  onClick={() => onProd(id)}
                  disabled={disabled}
                  title={locked
                    ? `LOCKED :: requires ${reqName}`
                    : `${def.name} :: ${def.desc} (${def.supply} supply)`}
                  className="relative flex flex-col items-center gap-1 p-1.5 border transition-all cursor-pointer group"
                  style={{
                    borderColor: disabled ? "#16233f" : `${def.color}55`,
                    background: disabled ? "rgba(8,12,26,0.5)" : `${def.color}0d`,
                    opacity: disabled ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${def.color}44`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                >
                  <UnitGlyph color={def.color} kind={id} />
                  <span className="font-display text-[7px] leading-none text-center" style={{ color: def.color }}>{def.name.split(" ")[1] ?? def.name.split(" ")[0]}</span>
                  <CostLine {...def.cost} />
                  {locked && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[rgba(4,6,15,0.6)]">
                      <svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" fill="none" stroke="#6f86b8" strokeWidth="1.5" /><path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="#6f86b8" strokeWidth="1.5" /></svg>
                    </span>
                  )}
                  {supplyFull && !locked && <span className="absolute top-0.5 right-0.5 font-mono text-[7px] text-[#ff4d5e]">!</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(STRUCT_DEFS) as StructId[]).map((id) => {
              const def = STRUCT_DEFS[id];
              const broke = snap.p < def.cost.p || snap.l < def.cost.l || snap.t < def.cost.t;
              const maxed = id === "turret" && snap.turretCount >= TURRET_MAX;
              const disabled = broke || maxed;
              return (
                <button
                  key={id}
                  onClick={() => onPlace(id)}
                  disabled={disabled}
                  title={`${def.name} :: ${def.desc}`}
                  className="relative flex flex-col items-center gap-1 p-1.5 border transition-all cursor-pointer"
                  style={{
                    borderColor: disabled ? "#16233f" : `${def.color}55`,
                    background: disabled ? "rgba(8,12,26,0.5)" : `${def.color}0d`,
                    opacity: disabled ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${def.color}44`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                >
                  <StructGlyph color={def.color} kind={id} />
                  <span className="font-display text-[7px] leading-none text-center" style={{ color: def.color }}>{def.name.split(" ")[1] ?? def.name.split(" ")[0]}</span>
                  <CostLine {...def.cost} />
                  {maxed && <span className="absolute top-0.5 right-0.5 font-mono text-[7px] text-[#ff4d5e]">MAX</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── top bar ──────────────────────────────────────────────────────────
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function TopBar({ snap }: { snap: PltSnapshot }) {
  const netWorth = snap.p + snap.l;
  const integrityColor = snap.integrity > 55 ? "#6bff9e" : snap.integrity > 25 ? "#ffc24d" : "#ff4d5e";
  return (
    <div className="absolute top-0 inset-x-0 z-10 pointer-events-none">
      <div className="flex items-start gap-3 px-4 pt-3">
        <div className="holo-panel px-4 py-2 flex items-center gap-3">
          <span className="font-display text-[15px] text-[#3af5ff] leading-none" style={{ textShadow: "0 0 12px rgba(58,245,255,.6)" }}>SOULFEILD</span>
          <span className="font-mono text-[9px] text-[#6f86b8] leading-tight">GENESIS<br />ARENA</span>
        </div>
        <ResourceReadout res="p" value={snap.p} r={snap.pRate} />
        <ResourceReadout res="l" value={snap.l} r={snap.lRate} />
        <ResourceReadout res="t" value={snap.t} r={snap.tRate} />

        <div className="flex-1" />

        <div className="holo-panel-sm px-3 py-2 text-right">
          <div className="font-mono text-[10px] text-[#6f86b8]">BASE INTEGRITY</div>
          <div className="w-[150px] h-[8px] mt-1 bg-[#0a1226] border border-[#1c2c52]">
            <div className="h-full transition-all duration-300" style={{ width: `${snap.integrity}%`, background: integrityColor, boxShadow: `0 0 8px ${integrityColor}` }} />
          </div>
          {snap.danger && <div className="font-mono text-[9px] text-[#ff4d5e] mt-1 animate-pulse">BANKRUPTCY :: INTEGRITY DRAINING</div>}
        </div>

        <div className="holo-panel-sm px-3 py-2 text-right">
          <div className="font-mono text-[10px] text-[#6f86b8]">OBJECTIVE</div>
          <div className="font-mono text-[10px] text-[#cfe3ff] mt-0.5 leading-tight">
            <span style={{ color: snap.owned >= OBJECTIVE.housesNeeded ? "#6bff9e" : "#ffc24d" }}>{snap.owned}/{OBJECTIVE.housesNeeded} HOUSES</span>
            {" · "}
            <span style={{ color: netWorth >= OBJECTIVE.netWorthNeeded ? "#6bff9e" : "#ffc24d" }}>{fmt(netWorth)}/{fmt(OBJECTIVE.netWorthNeeded)} PLT</span>
          </div>
          <div className="font-mono text-[10px] mt-0.5 leading-tight" style={{ color: snap.citadels.every((c) => c.hp <= 0) ? "#6bff9e" : "#ff4d5e" }}>
            OR PURGE {snap.citadels.filter((c) => c.hp > 0).length} CITADELS
          </div>
        </div>

        <div className="holo-panel-sm px-3 py-2 text-center">
          <div className="font-mono text-[15px] text-[#9fdcff]">{fmtTime(snap.timePlayed)}</div>
          <div className="font-mono text-[8.5px] text-[#6f86b8]">T+{snap.owned > 0 ? "LIVE" : "BOOT"}</div>
        </div>
      </div>
    </div>
  );
}

// ── log feed (right side) ────────────────────────────────────────────
const TONE_COLOR: Record<LogEntry["tone"], string> = { sys: "#ffc24d", good: "#6bff9e", bad: "#ff4d5e" };

export function LogPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="absolute right-4 top-[92px] z-10 w-[300px] pointer-events-none space-y-1">
      {logs.map((l, i) => (
        <div key={`${i}-${l.msg}`} className="log-line font-mono text-[10px] leading-snug px-2 py-1 bg-[rgba(6,10,24,0.72)] border-l-2" style={{ borderColor: TONE_COLOR[l.tone], color: l.tone === "sys" ? "#cfe3ff" : TONE_COLOR[l.tone] }}>
          <span style={{ color: TONE_COLOR[l.tone] }}>▸</span> {l.msg}
        </div>
      ))}
    </div>
  );
}

// ── war status panel (right bottom) ──────────────────────────────────
export function WarPanel({ snap }: { snap: PltSnapshot }) {
  return (
    <div className="absolute right-4 bottom-[104px] z-10 holo-panel px-4 py-3 w-[220px] pointer-events-none">
      <div className="font-display text-[10px] text-[#ff4d5e] tracking-[0.2em]">VOID WAR STATUS</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 font-mono text-[10px]">
        <span className="text-[#6f86b8]">WAVE</span><span className="text-[#eaffff] text-right">{snap.wave}</span>
        <span className="text-[#6f86b8]">NEXT RAID</span>
        <span className="text-right" style={{ color: snap.nextWaveIn < 6 ? "#ff4d5e" : "#eaffff" }}>{snap.nextWaveIn >= 900 ? "—" : `${snap.nextWaveIn}s`}</span>
        <span className="text-[#6f86b8]">THREATS</span><span className="text-right" style={{ color: snap.threats > 0 ? "#ff4d5e" : "#6bff9e" }}>{snap.threats}</span>
        <span className="text-[#6f86b8]">KILLS</span><span className="text-[#eaffff] text-right">{snap.kills}</span>
        <span className="text-[#6f86b8]">TURRETS</span><span className="text-[#eaffff] text-right">{snap.turretCount}/{TURRET_MAX}</span>
        <span className="text-[#6f86b8]">GLEANERS</span><span className="text-[#6bff9e] text-right">{snap.workers}</span>
        <span className="text-[#6f86b8]">NODES</span><span className="text-[#eaffff] text-right">{snap.nodesLeft}</span>
        <span className="text-[#6f86b8]">CITADELS</span>
        <span className="text-right" style={{ color: snap.citadelsDown > 0 ? "#6bff9e" : "#eaffff" }}>
          {snap.citadelsDown}/{snap.citadelsTotal} DOWN
        </span>
      </div>
      <button
        onClick={() => bridge.command("rallyAll", {})}
        className="btn-holo btn-magenta w-full py-1.5 text-[10px] mt-2 pointer-events-auto"
      >
        ⚔ SEND ALL ARMIES [R]
      </button>
      <div className="mt-2 pt-2 border-t border-[#1c2c52]">
        <div className="font-mono text-[9px] text-[#6f86b8] mb-1">CITADELS</div>
        <div className="space-y-1">
          {snap.citadels.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 10,10 0,10" fill={c.hp > 0 ? "#ff4d5e" : "#1c2c52"} /></svg>
              <div className="flex-1 h-[6px] bg-[#0a1226] border border-[#1c2c52]">
                <div className="h-full transition-all duration-300" style={{ width: `${(c.hp / c.hpMax) * 100}%`, background: c.hp > 0 ? "#ff4d5e" : "transparent" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── selection panel (left bottom) ────────────────────────────────────
export function SelectionPanel({ snap }: { snap: PltSnapshot }) {
  return (
    <div className="absolute left-4 bottom-[104px] z-10 w-[240px] pointer-events-none space-y-2">
      {snap.queue && (
        <div className="holo-panel-sm px-3 py-2">
          <div className="flex justify-between font-mono text-[9px] text-[#6f86b8]">
            <span>FORGING :: {snap.queue.name.toUpperCase()}{snap.queueCount > 1 ? ` (+${snap.queueCount - 1})` : ""}</span>
            <span className="text-[#3af5ff]">{Math.ceil(snap.queue.t)}s</span>
          </div>
          <div className="w-full h-[6px] mt-1 bg-[#0a1226] border border-[#1c2c52]">
            <div className="h-full bg-[#3af5ff] transition-all duration-200" style={{ width: `${(1 - snap.queue.t / snap.queue.total) * 100}%`, boxShadow: "0 0 8px rgba(58,245,255,.7)" }} />
          </div>
        </div>
      )}
      <div className="holo-panel px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[10px] text-[#3af5ff] tracking-[0.15em]">SELECTION</span>
          <span className="font-mono text-[10px]" style={{ color: snap.supply >= snap.supplyMax ? "#ff4d5e" : "#9fdcff" }}>
            SUPPLY {snap.supply}/{snap.supplyMax}
          </span>
        </div>
        {snap.selectedCount === 0 ? (
          <div className="font-mono text-[9.5px] text-[#42557f] mt-1.5">drag to select · right-click to command</div>
        ) : (
          <div className="mt-1.5 space-y-1">
            {snap.selected.map((u, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[9.5px]">
                <span className="text-[#9fdcff] w-[86px] truncate">{u.name}</span>
                <div className="flex-1 h-[5px] bg-[#0a1226] border border-[#1c2c52]">
                  <div className="h-full" style={{ width: `${(u.hp / u.hpMax) * 100}%`, background: u.hp / u.hpMax > 0.4 ? "#6bff9e" : "#ffc24d" }} />
                </div>
                <span className="text-[#6f86b8] w-[26px] text-right">{u.hp}</span>
              </div>
            ))}
            {snap.selectedCount > 6 && <div className="font-mono text-[9px] text-[#42557f]">+{snap.selectedCount - 6} more…</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── hotbar ───────────────────────────────────────────────────────────
interface HotbarProps {
  snap: PltSnapshot;
  onArm: (id: WeaponId | null) => void;
  onProd: (id: UnitId) => void;
  onTurret: () => void;
}

function HotSlot({ label, sub, color, cd, cdMax, armed, disabled, onClick, children, title }: {
  label: string; sub: string; color: string; cd: number; cdMax: number; armed?: boolean; disabled?: boolean;
  onClick: () => void; children: ReactNode; title: string;
}) {
  const pct = cdMax > 0 ? Math.min(1, cd / cdMax) : 0;
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled && !armed}
      className="relative w-[64px] h-[64px] holo-panel-sm flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer group"
      style={{
        borderColor: armed ? color : undefined,
        boxShadow: armed ? `0 0 18px ${color}66` : undefined,
        opacity: disabled && !armed ? 0.45 : 1,
      }}
    >
      <span style={{ color }}>{children}</span>
      <span className="font-display text-[8px] leading-none" style={{ color }}>{label}</span>
      <span className="font-mono text-[7.5px] text-[#6f86b8] leading-none">{sub}</span>
      {pct > 0 && (
        <span className="absolute inset-0 flex items-end overflow-hidden pointer-events-none">
          <span className="w-full bg-[rgba(2,4,12,0.75)]" style={{ height: `${pct * 100}%` }} />
        </span>
      )}
      {pct > 0 && <span className="absolute inset-0 flex items-center justify-center font-mono text-[13px] text-[#eaffff] pointer-events-none">{Math.ceil(cd)}</span>}
      {armed && <span className="absolute -top-[7px] left-1/2 -translate-x-1/2 font-display text-[7px] px-1" style={{ color, background: "#04060f" }}>ARMED</span>}
    </button>
  );
}

export function Hotbar({ snap, onArm, onProd, onTurret }: HotbarProps) {
  const weapons = (Object.keys(WEAPON_DEFS) as WeaponId[]);
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-end gap-2 pointer-events-auto">
      <div className="holo-panel p-2 flex gap-1.5 items-end">
        <div className="font-display text-[8px] text-[#6f86b8] px-1 pb-1 self-center" style={{ writingMode: "vertical-rl" }}>SOUL</div>
        {weapons.map((id) => {
          const def = WEAPON_DEFS[id];
          const state = snap.weapons.find((w) => w.id === id)!;
          const costTxt = def.cost.p ? `${def.cost.p}P` : `${def.cost.l}L`;
          const Icon = WEAPON_ICONS[id];
          return (
            <HotSlot
              key={id} label={def.key} sub={costTxt} color={def.color}
              cd={state.cd} cdMax={state.max} armed={snap.armed === id}
              disabled={state.cd > 0}
              onClick={() => onArm(snap.armed === id ? null : id)}
              title={`${def.name} [${def.key}] :: ${def.desc} (${costTxt}, ${def.cd}s CD)`}
            >
              <Icon />
            </HotSlot>
          );
        })}
      </div>
      {snap.armed && (
        <div className="holo-panel-sm px-3 py-2 font-mono text-[10px] animate-pulse" style={{ color: WEAPON_DEFS[snap.armed].color }}>
          TARGETING :: CLICK MAP<br /><span className="text-[#6f86b8]">ESC to cancel</span>
        </div>
      )}
    </div>
  );
}

// ── wave banner ──────────────────────────────────────────────────────
export function WaveBanner({ wave }: { wave: number }) {
  if (wave === 0) return null;
  return (
    <div key={wave} className="absolute top-[24%] inset-x-0 z-10 flex justify-center pointer-events-none">
      <div className="rise-in text-center">
        <div className="font-display text-[38px] text-[#ff4d5e]" style={{ textShadow: "0 0 26px rgba(255,77,94,.8), 3px 3px 0 #2a0510" }}>
          VOID RAID {wave}
        </div>
        <div className="font-mono text-[11px] text-[#ffb3ba] tracking-[0.3em] mt-1">THE BUGS ARE BREACHING THE FOG</div>
      </div>
    </div>
  );
}

// ── prompt ───────────────────────────────────────────────────────────
export function PromptBar({ prompt }: { prompt: string | null }) {
  if (!prompt) return null;
  return (
    <div className="absolute bottom-[112px] left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="holo-panel-sm px-4 py-2 font-mono text-[11.5px] text-[#9fdcff] rise-in" style={{ borderColor: "#3af5ff55" }}>
        {prompt}
      </div>
    </div>
  );
}

export { HOUSE_DEFS };
