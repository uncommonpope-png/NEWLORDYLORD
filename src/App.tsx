import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { initGame, destroyGame } from "./game/main";
import { bridge, PltSnapshot, LogEntry, EndStats, HouseId } from "./game/bridge";
import { sfx } from "./game/audio";
import { HUD } from "./components/HUD";
import { BootScreen, HouseSelect, MarketTerminal, PauseScreen, EndScreen } from "./components/Overlays";

type Phase = "boot" | "select" | "game";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [snap, setSnap] = useState<PltSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [end, setEnd] = useState<EndStats | null>(null);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);

  // mount Phaser
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    gameRef.current = initGame(containerRef.current);
    const offs = [
      bridge.on("state", setSnap),
      bridge.on("log", (l) => setLogs((prev) => [...prev.slice(-5), l])),
      bridge.on("prompt", setPrompt),
      bridge.on("terminal", setTerminalOpen),
      bridge.on("paused", setPaused),
      bridge.on("flash", (c) => setFlash({ color: c, key: Date.now() + Math.random() })),
      bridge.on("end", (e) => { setEnd(e); setTerminalOpen(false); setPaused(false); }),
    ];
    return () => {
      offs.forEach((off) => off());
      if (gameRef.current) {
        destroyGame(gameRef.current);
        gameRef.current = null;
      }
    };
  }, []);

  // overlay keyboard (close terminal, sync mute)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (terminalOpen && (e.key === "Escape" || e.key.toLowerCase() === "e")) {
        e.preventDefault();
        sfx.ui();
        bridge.emit("terminal", false);
      }
      if (e.key.toLowerCase() === "m") setTimeout(() => setMuted(sfx.isMuted()), 30);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [terminalOpen]);

  const startBoot = () => {
    sfx.init();
    sfx.ui();
    setPhase("select");
  };

  const claim = (id: HouseId) => {
    sfx.ui();
    bridge.emit("spawn", id);
    setPhase("game");
  };

  const reboot = () => window.location.reload();

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#04060f] font-body">
      {/* Phaser canvas */}
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

      {/* CRT dressing */}
      <div className="scanlines absolute inset-0 z-40" />
      <div className="crt-vignette absolute inset-0 z-40" />
      {snap?.danger && phase === "game" && !end && <div className="alarm-vignette absolute inset-0 z-30" />}
      {flash && <div key={flash.key} className="screen-flash absolute inset-0 z-30" style={{ background: flash.color }} />}

      {/* HUD */}
      {phase === "game" && snap && !end && (
        <HUD
          snap={snap}
          logs={logs}
          prompt={prompt}
          muted={muted}
          onPause={() => (paused ? bridge.emit("resume", undefined) : bridge.emit("pause", undefined))}
          onMute={() => { sfx.setMuted(!sfx.isMuted()); setMuted(sfx.isMuted()); }}
        />
      )}

      {/* screens */}
      {phase === "boot" && <BootScreen onStart={startBoot} />}
      {phase === "select" && <HouseSelect onClaim={claim} />}
      {phase === "game" && terminalOpen && snap && !end && (
        <MarketTerminal
          snap={snap}
          onClose={() => { sfx.ui(); bridge.emit("terminal", false); }}
          onBuy={(id) => bridge.emit("buy", id)}
          onDeposit={(d) => bridge.emit("deposit", d)}
          onSettle={() => bridge.emit("settle", undefined)}
        />
      )}
      {phase === "game" && paused && !terminalOpen && !end && (
        <PauseScreen onResume={() => bridge.emit("resume", undefined)} onReboot={reboot} />
      )}
      {end && <EndScreen stats={end} onReboot={reboot} onSandbox={() => { bridge.emit("sandbox", undefined); setEnd(null); }} />}
    </div>
  );
}
