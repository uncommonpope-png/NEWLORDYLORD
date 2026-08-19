import { useCallback, useEffect, useRef, useState } from "react";
import { mountGame } from "./game/main";
import { bridge, BridgeCommands, PltSnapshot, EndStats, HouseId, UnitId, WeaponId } from "./game/bridge";
import { sfx } from "./game/audio";
import { TopBar, PromptBar, LogPanel, Hotbar, WarPanel, SelectionPanel, WaveBanner, LogEntry } from "./components/HUD";
import { BootScreen, HouseSelect, MarketTerminal, PauseScreen, EndScreen } from "./components/Overlays";

type Screen = "boot" | "select" | "game";

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

  // mount Phaser once
  useEffect(() => {
    if (!containerRef.current) return;
    const game = mountGame(containerRef.current);
    return () => game.destroy(true);
  }, []);

  // bridge subscriptions
  useEffect(() => {
    const offs = [
      bridge.on("plt", (s) => setSnap(s)),
      bridge.on("log", (l) => setLogs((prev) => [...prev.slice(-6), l])),
      bridge.on("prompt", (p) => setPrompt(p)),
      bridge.on("flash", (f) => setFlash({ ...f, key: Date.now() })),
      bridge.on("terminal", (open) => setTerminalOpen(open)),
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
      if (e.key === "Escape" && terminalOpen) {
        setTerminalOpen(false);
        gameCommand("terminal", false);
      }
      if ((e.key === "m" || e.key === "M") && screen === "game") {
        setMuted((m) => {
          sfx.setMuted(!m);
          return !m;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [terminalOpen, screen, gameCommand]);

  const reboot = () => {
    setSnap(null);
    setLogs([]);
    setPrompt(null);
    setTerminalOpen(false);
    setPaused(false);
    setEnded(null);
    setWave(0);
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

      {/* CRT dressing */}
      <div className="scanlines absolute inset-0 z-[15]" />
      <div className="crt-vignette absolute inset-0 z-[14]" />
      {danger && screen === "game" && !ended && <div className="alarm-vignette absolute inset-0 z-[13]" />}
      {flash && <div key={flash.key} className="screen-flash absolute inset-0 z-[16]" style={{ background: flash.color }} />}

      {/* HUD */}
      {screen === "game" && snap && !ended && (
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
          <PromptBar prompt={prompt} />
          <WaveBanner wave={wave} />
        </>
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
