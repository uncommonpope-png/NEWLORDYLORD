import { fmt, OBJECTIVE, PltSnapshot, LogEntry, RESOURCE_META } from "../game/bridge";

const IconP = () => (
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1 13 7 7 13 1 7Z" fill="none" stroke="#ffc24d" strokeWidth="1.6" /><circle cx="7" cy="7" r="2" fill="#ffc24d" /></svg>
);
const IconL = () => (
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12.5 1.8 7.3a3.2 3.2 0 0 1 0-4.5 3 3 0 0 1 4.4 0L7 3.6l.8-.8a3 3 0 0 1 4.4 0 3.2 3.2 0 0 1 0 4.5Z" fill="#ff5ad1" /></svg>
);
const IconT = () => (
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8 1 3 8h3l-1 5 6-8H8Z" fill="none" stroke="#ff4d5e" strokeWidth="1.5" strokeLinejoin="round" /></svg>
);

function rate(r: number) {
  const v = Math.round(r * 10) / 10;
  return v >= 0 ? `+${v}` : `${v}`;
}

export function ResourceReadout({ res, value, r }: { res: "p" | "l" | "t"; value: number; r: number }) {
  const meta = RESOURCE_META[res];
  // for PROFIT/LOVE, negative flow is bad; for TAX, positive accumulation is bad
  const rateColor = res === "t" ? (r > 0 ? "#ff4d5e" : "#6bff9e") : r < 0 ? "#ff4d5e" : "#6f86b8";
  return (
    <div className="holo-panel-sm flex items-center gap-2.5 px-3 py-1.5 min-w-[118px]">
      <span className="shrink-0">{res === "p" ? <IconP /> : res === "l" ? <IconL /> : <IconT />}</span>
      <div className="leading-none">
        <div className="font-mono text-[15px] font-semibold" style={{ color: meta.color }}>{fmt(value)}</div>
        <div className="font-mono text-[9px] mt-0.5" style={{ color: rateColor }}>
          {meta.label} {rate(r)}/s
        </div>
      </div>
    </div>
  );
}

interface HUDProps {
  snap: PltSnapshot;
  logs: LogEntry[];
  prompt: string | null;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
}

export function HUD({ snap, logs, prompt, muted, onPause, onMute }: HUDProps) {
  const netGoal = OBJECTIVE.netWorthNeeded;
  const netPct = Math.max(0, Math.min(100, (snap.netWorth / netGoal) * 100));
  const toneColor = { info: "#9fdcff", good: "#6bff9e", bad: "#ff4d5e", sys: "#ffc24d" } as const;

  return (
    <>
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start gap-3 p-3 pointer-events-none">
        <div className="holo-panel-sm px-3 py-2 leading-none pointer-events-auto">
          <div className="font-display text-[13px] text-[#3af5ff] tracking-wide">SOULFEILD</div>
          <div className="font-mono text-[8.5px] text-[#6f86b8] mt-1">SPATIAL OS // PHASE 05 · GENESIS PLOT</div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1.5">
          <div className="flex gap-2">
            <ResourceReadout res="p" value={snap.p} r={snap.rates.p} />
            <ResourceReadout res="l" value={snap.l} r={snap.rates.l} />
            <ResourceReadout res="t" value={snap.t} r={snap.rates.t} />
          </div>
          <div className="holo-panel-sm px-3 py-1.5 flex items-center gap-2 w-[300px]">
            <svg width="13" height="14" viewBox="0 0 13 14" className="shrink-0">
              <path d="M6.5 1 12 3v4c0 3.4-2.3 5.6-5.5 6.8C3.3 12.6 1 10.4 1 7V3Z" fill="none" stroke={snap.danger ? "#ff4d5e" : "#3af5ff"} strokeWidth="1.4" />
            </svg>
            <div className="flex-1 h-[7px] bg-[#101a33] border border-[#1c2c52] overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${snap.integrity}%`,
                  background: snap.danger ? "linear-gradient(90deg,#ff4d5e,#ff9d5e)" : "linear-gradient(90deg,#1c8ba0,#3af5ff)",
                  boxShadow: snap.danger ? "0 0 10px #ff4d5e" : "0 0 10px rgba(58,245,255,.5)",
                }}
              />
            </div>
            <span className="font-mono text-[10px]" style={{ color: snap.danger ? "#ff4d5e" : "#3af5ff" }}>
              {Math.floor(snap.integrity)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="holo-panel-sm px-3 py-2 min-w-[218px]">
            <div className="font-display text-[9px] text-[#6f86b8] mb-1.5">{snap.sandbox ? "SANDBOX MODE" : "GENESIS OBJECTIVE"}</div>
            <div className="flex items-center gap-2 font-mono text-[10.5px]">
              <span style={{ color: snap.owned >= OBJECTIVE.housesNeeded ? "#6bff9e" : "#d7e6ff" }}>
                {snap.owned >= OBJECTIVE.housesNeeded ? "◆" : "◇"} STRUCTURES {snap.owned}/{OBJECTIVE.housesNeeded}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10.5px]" style={{ color: snap.netWorth >= netGoal ? "#6bff9e" : "#d7e6ff" }}>
                {snap.netWorth >= netGoal ? "◆" : "◇"} NET {fmt(snap.netWorth)}/{fmt(netGoal)}
              </span>
            </div>
            <div className="h-[4px] bg-[#101a33] border border-[#1c2c52] mt-1.5 overflow-hidden">
              <div className="h-full transition-all duration-500" style={{ width: `${netPct}%`, background: "#ffc24d" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onMute} className="holo-panel-sm px-2.5 py-1.5 font-mono text-[10px] text-[#9fdcff] hover:text-[#3af5ff] transition-colors cursor-pointer" title="Mute (M)">
              {muted ? "SND OFF" : "SND ON"}
            </button>
            <button onClick={onPause} className="holo-panel-sm px-2.5 py-1.5 font-mono text-[10px] text-[#9fdcff] hover:text-[#3af5ff] transition-colors cursor-pointer" title="Pause (ESC)">
              ▮▮ PAUSE
            </button>
          </div>
          <div className="font-mono text-[9px] text-[#6f86b8] pr-1">T+{snap.timePlayed}s · {snap.plotsFree} PLOTS VACANT</div>
        </div>
      </div>

      {/* log ticker */}
      <div className="absolute bottom-3 left-3 z-10 w-[400px] pointer-events-none space-y-1">
        {logs.map((l) => (
          <div key={l.id} className="log-line font-mono text-[10px] leading-snug flex gap-2" style={{ color: toneColor[l.tone], textShadow: "0 1px 4px rgba(0,0,0,.9)" }}>
            <span className="text-[#42557f] shrink-0">[T+{String(l.t).padStart(3, "0")}]</span>
            <span>{l.msg}</span>
          </div>
        ))}
      </div>

      {/* interaction prompt */}
      {prompt && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 rise-in pointer-events-none">
          <div className="holo-panel-sm px-4 py-2 font-mono text-[11px] text-[#9fdcff] flex items-center gap-2">
            <span className="kbd">E</span>
            <span>{prompt}</span>
          </div>
        </div>
      )}

      {/* control hint */}
      {!prompt && (
        <div className="absolute bottom-3 right-3 z-10 font-mono text-[9.5px] text-[#42557f] flex items-center gap-2 pointer-events-none">
          <span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span> MOVE
          <span className="kbd">SCROLL</span> ZOOM
          <span className="kbd">ESC</span> PAUSE
        </div>
      )}
    </>
  );
}
