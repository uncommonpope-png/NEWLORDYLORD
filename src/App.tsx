import { useCallback, useEffect, useRef, useState } from "react";
import { mountGame } from "./game/main";
import { bridge, BridgeCommands, PltSnapshot, EndStats, HouseId, UnitId, WeaponId, StructId, fmt } from "./game/bridge";
import { sfx } from "./game/audio";
import { TopBar, PromptBar, LogPanel, Hotbar, WarPanel, SelectionPanel, WaveBanner, Minimap, CommandCard, LogEntry } from "./components/HUD";
import { DashboardPanel, CreaturesPanel, FactionsPanel, TowerPanel, SoulHomePanel, LiveTicker, MobileControls, PanelId } from "./components/Panels";
import { BootScreen, HouseSelect, MarketTerminal, PauseScreen, EndScreen } from "./components/Overlays";
import { TerminalShell } from "./components/TerminalShell";
import { mountCommandCenter } from "./game/CommandCenter";
import type { CC3DHandle, HoverInfo } from "./game/CommandCenter";

type Screen = "boot" | "select" | "game";
type View = "arena" | "command";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>("boot");
  const [snap, setSnap] = useState<PltSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState<EndStats | null>(null);
  const [wave, setWave] = useState(0);
  const [muted, setMuted] = useState(false);
  const [view, setView] = useState<View>("arena");
  const [shellOpen, setShellOpen] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [homeOpen, setHomeOpen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const ccMountRef = useRef<HTMLDivElement>(null);
  const ccHandleRef = useRef<CC3DHandle | null>(null);
  const snapRef = useRef<PltSnapshot | null>(null);

  // mount Phaser once
  useEffect(() => {
    if (!containerRef.current) return;
    const game = mountGame(containerRef.current);
    return () => game.destroy(true);
  }, []);

  // bridge subscriptions
  useEffect(() => {
    const offs = [
      bridge.on("plt", (s) => { snapRef.current = s; setSnap(s); ccHandleRef.current?.update(s); }),
      bridge.on("activity", (a) => ccHandleRef.current?.activity(a.kind)),
      bridge.on("log", (l) => setLogs((prev) => [...prev.slice(-6), l])),
      bridge.on("prompt", (p) => setPrompt(p)),
      bridge.on("flash", (f) => setFlash({ ...f, key: Date.now() })),
      bridge.on("terminal", (open) => setTerminalOpen(open)),
      bridge.on("home", (open) => { setHomeOpen(open); if (open) sfx.blip(); }),
      bridge.on("paused", (p) => setPaused(p)),
      bridge.on("started", () => setScreen((s) => (s === "boot" ? s : "game"))),
      bridge.on("wave", (w) => setWave(w.n)),
      bridge.on("end", (stats) => setEnded(stats)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const gameCommand = useCallback(<K extends keyof BridgeCommands>(cmd: K, payload: BridgeCommands[K]) => {
    bridge.command(cmd, payload);
  }, []);

  // mount the Three.js Command Center the first time it is opened
  useEffect(() => {
    if (view !== "command" || screen !== "game" || ended) return;
    if (ccHandleRef.current || !ccMountRef.current) return;
    const handle = mountCommandCenter(ccMountRef.current, (w) => gameCommand("arm", { id: w }), setHoverInfo);
    ccHandleRef.current = handle;
    if (snapRef.current) handle.update(snapRef.current);
    sfx.blip();
  }, [view, screen, ended, gameCommand]);

  // start → house select
  const startGame = () => {
    sfx.ensure();
    sfx.blip();
    setScreen("select");
  };
  const claimHouse = (house: HouseId) => {
    sfx.purchase();
    gameCommand("claim", { house });
    setScreen("game");
  };

  // keyboard: pause / mute / escape from terminal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        if (terminalOpen) { setTerminalOpen(false); gameCommand("terminal", false); }
        else if (shellOpen) setShellOpen(false);
        else if (view === "command") setView("arena");
        return;
      }
      if ((e.key === "m" || e.key === "M") && screen === "game") {
        setMuted((m) => {
          sfx.setMuted(!m);
          return !m;
        });
      }
      if ((e.key === "v" || e.key === "V") && screen === "game" && !ended && !paused) {
        setView((v) => (v === "arena" ? "command" : "arena"));
        sfx.blip();
      }
      if (e.key === "`" && screen === "game" && !ended && !paused) {
        setShellOpen((s) => !s);
        sfx.blip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [terminalOpen, shellOpen, view, screen, ended, paused, gameCommand]);

  const reboot = () => {
    setSnap(null);
    setLogs([]);
    setPrompt(null);
    setTerminalOpen(false);
    setPaused(false);
    setEnded(null);
    setWave(0);
    setView("arena");
    setShellOpen(false);
    setScreen("boot");
    sfx.blip();
    gameCommand("reboot", {});
  };

  const danger = !!snap?.danger;

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#04060f] select-none"
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: snap?.armed ? "crosshair" : undefined }}
    >
      {/* Phaser canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Three.js Command Center (Dual Reality layer) */}
      {screen === "game" && (
        <div ref={ccMountRef} className="absolute inset-0" style={{ display: view === "command" ? "block" : "none" }} />
      )}
      {view === "command" && screen === "game" && (
        <div className="absolute inset-0 z-[12] pointer-events-none">
          <div className="absolute top-4 left-4 flex items-center gap-3 pointer-events-auto">
            <button onClick={() => setView("arena")} className="btn-holo px-4 py-2 text-[11px]">◄ ARENA [V]</button>
            <span className="font-display text-[12px] text-[#ff3ec8] tracking-[0.2em]" style={{ textShadow: "0 0 14px rgba(255,62,200,.6)" }}>
              GSK COMMAND CENTER
            </span>
          </div>
          {snap && (
            <div className="absolute top-4 right-4 flex gap-2 font-mono text-[11px]">
              <span className="holo-panel-sm px-2.5 py-1.5 text-[#ffc24d]">P {fmt(snap.p)}</span>
              <span className="holo-panel-sm px-2.5 py-1.5 text-[#ff5ad1]">L {fmt(snap.l)}</span>
              <span className="holo-panel-sm px-2.5 py-1.5 text-[#ff4d5e]">T {fmt(snap.t)}</span>
              <span className="holo-panel-sm px-2.5 py-1.5 text-[#9fdcff]">WAVE {snap.wave}</span>
            </div>
          )}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] text-[#42557f] tracking-[0.2em]">
            DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A PEDESTAL TO ARM A SOUL WEAPON
          </div>
          {hoverInfo && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 holo-panel-sm px-4 py-2 text-center">
              <div className="font-display text-[12px]" style={{ color: hoverInfo.color }}>{hoverInfo.title}</div>
              <div className="font-mono text-[9.5px] text-[#8fa5d8] mt-0.5">{hoverInfo.sub}</div>
            </div>
          )}
        </div>
      )}

      {/* CRT dressing */}
      <div className="scanlines absolute inset-0 z-[15]" />
      <div className="crt-vignette absolute inset-0 z-[14]" />
      {danger && screen === "game" && !ended && <div className="alarm-vignette absolute inset-0 z-[13]" />}
      {flash && <div key={flash.key} className="screen-flash absolute inset-0 z-[16]" style={{ background: flash.color }} />}

      {/* HUD (arena view) */}
      {screen === "game" && view === "arena" && snap && !ended && (
        <>
          <TopBar snap={snap} />
          <LogPanel logs={logs} />
          <WarPanel snap={snap} />
          <SelectionPanel snap={snap} />
          <Hotbar
            snap={snap}
            onArm={(id: WeaponId | null) => gameCommand("arm", { id })}
            onProd={(id: UnitId) => gameCommand("prod", { unit: id })}
            onTurret={() => gameCommand("buildTurret", {})}
          />
          <CommandCard
            snap={snap}
            onProd={(id: UnitId) => gameCommand("prod", { unit: id })}
            onPlace={(id: StructId) => gameCommand("place", { id })}
            onSpeed={() => gameCommand("speed", {})}
          />
          <PromptBar prompt={prompt} />
          <WaveBanner wave={wave} />
          <Minimap snap={snap} />
        </>
      )}

      {/* GSK operator shell */}
      {screen === "game" && view === "arena" && shellOpen && !ended && !paused && (
        <TerminalShell onClose={() => setShellOpen(false)} />
      )}

      {/* view chip */}
      {screen === "game" && view === "arena" && !ended && (
        <div className="absolute top-3 right-4 z-10 flex gap-2" style={{ marginTop: 100 }}>
          <button
            onClick={() => { setView("command"); sfx.blip(); }}
            className="font-mono text-[9px] px-2 py-1 border border-[#1c2c52] text-[#6f86b8] hover:text-[#ff3ec8] hover:border-[#ff3ec855] transition-colors cursor-pointer bg-[rgba(6,10,24,0.7)]"
          >
            [V] GSK COMMAND CENTER
          </button>
          <button
            onClick={() => { setShellOpen((s) => !s); sfx.blip(); }}
            className="font-mono text-[9px] px-2 py-1 border border-[#1c2c52] text-[#6f86b8] hover:text-[#3af5ff] hover:border-[#3af5ff55] transition-colors cursor-pointer bg-[rgba(6,10,24,0.7)]"
          >
            [`] GSK SHELL
          </button>
        </div>
      )}

      {/* overlays */}
      {screen === "boot" && <BootScreen onStart={startGame} />}
      {screen === "select" && <HouseSelect onClaim={claimHouse} />}
      {screen === "game" && terminalOpen && snap && !ended && (
        <MarketTerminal
          snap={snap}
          onClose={() => { setTerminalOpen(false); gameCommand("terminal", false); }}
          onBuy={(house) => gameCommand("buy", { house })}
          onDeposit={(d) => gameCommand("deposit", d)}
          onSettle={() => gameCommand("settle", {})}
        />
      )}
      {screen === "game" && paused && !ended && (
        <PauseScreen
          onResume={() => gameCommand("resume", {})}
          onReboot={reboot}
        />
      )}
      {ended && (
        <EndScreen
          stats={ended}
          onReboot={reboot}
          onSandbox={() => { setEnded(null); gameCommand("sandbox", {}); }}
        />
      )}

      {/* mute chip */}
      {screen === "game" && (
        <button
          onClick={() => { setMuted((m) => { sfx.setMuted(!m); return !m; }); }}
          className="absolute top-3 right-4 z-10 font-mono text-[9px] px-2 py-1 border border-[#1c2c52] text-[#6f86b8] hover:text-[#9fdcff] hover:border-[#3af5ff55] transition-colors cursor-pointer bg-[rgba(6,10,24,0.7)]"
          style={{ marginTop: 64 }}
        >
          [M] {muted ? "SOUND OFF" : "SOUND ON"}
        </button>
      )}
    </div>
  );
}
