import { useEffect, useRef, useState } from "react";
import { bridge, WEAPON_DEFS, UNIT_DEFS, fmt } from "../game/bridge";
import type { PltSnapshot, WeaponId, UnitId } from "../game/bridge";
import { sfx } from "../game/audio";

interface Line { text: string; color: string; }

const BOOT: Line[] = [
  { text: "GSK SHELL v0.5.1 — connected to genesis arena", color: "#3af5ff" },
  { text: "type `help` for the command codex · ESC closes the shell", color: "#6f86b8" },
];

export function TerminalShell({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>(BOOT);
  const [value, setValue] = useState("");
  const snapRef = useRef<PltSnapshot | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const un = bridge.on("plt", (s) => { snapRef.current = s; });
    inputRef.current?.focus();
    return un;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const print = (text: string, color = "#cfe3ff") => setLines((l) => [...l.slice(-60), { text, color }]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    print(`operator@genesis:~$ ${cmd}`, "#8fa5d8");
    const [name, ...args] = cmd.split(/\s+/);
    const s = snapRef.current;
    switch (name.toLowerCase()) {
      case "help":
        print("  plt            — read the PROFIT·LOVE·TAX ledger", "#6f86b8");
        print("  status         — war state, integrity, supply", "#6f86b8");
        print("  scan           — sentinel threat sweep", "#6f86b8");
        print("  ls             — list structures on the grid", "#6f86b8");
        print("  cast <weapon>  — deploy a Soul Weapon (" + Object.keys(WEAPON_DEFS).join("|") + ")", "#6f86b8");
        print("  forge <unit>   — queue a unit (" + Object.keys(UNIT_DEFS).join("|") + ")", "#6f86b8");
        print("  turret         — raise a defense turret", "#6f86b8");
        print("  settle         — settle entropy (burn TAX from reserves)", "#6f86b8");
        print("  pause / resume — suspend the simulation", "#6f86b8");
        print("  clear          — wipe the scrollback", "#6f86b8");
        break;
      case "plt":
        if (s) print(`P ${fmt(s.p)}  ·  L ${fmt(s.l)}  ·  T ${fmt(s.t)}   [${s.danger ? "!! BANKRUPTCY PRESSURE" : "ledger stable"}]`, s.danger ? "#ff4d5e" : "#ffc24d");
        break;
      case "status":
        if (s) print(`integrity ${Math.round(s.integrity)}% · wave ${s.wave} · threats ${s.threats} · kills ${s.kills} · supply ${s.supply}/${s.supplyMax} · next raid ~${s.nextWaveIn}s`, "#9fdcff");
        break;
      case "scan":
        if (s) print(s.threats ? `SENTINEL :: ${s.threats} hostile signatures in the field — citadels charging` : "SENTINEL :: field clean. the void is quiet… for now", s.threats ? "#ff4d5e" : "#6bff9e");
        break;
      case "ls":
        if (s) s.buildings3d.forEach((b) => print(`  ${b.label.padEnd(18)} hp ${b.hp}/${b.hpMax}`, b.kind === "citadel" ? "#ff4d5e" : "#8fa5d8"));
        break;
      case "cast": {
        const id = (args[0] || "").toLowerCase() as WeaponId;
        if (WEAPON_DEFS[id]) {
          bridge.command("arm", { id });
          print(WEAPON_DEFS[id].targeting ? `${WEAPON_DEFS[id].name} armed — close the shell & click the field` : `channeling ${WEAPON_DEFS[id].name}…`, WEAPON_DEFS[id].color);
          sfx.blip();
        } else print(`unknown weapon '${args[0] ?? ""}' — try: ${Object.keys(WEAPON_DEFS).join(", ")}`, "#ff4d5e");
        break;
      }
      case "forge": {
        const id = (args[0] || "").toLowerCase() as UnitId;
        if (UNIT_DEFS[id]) { bridge.command("prod", { unit: id }); print(`forge queue :: ${UNIT_DEFS[id].name} compiling…`, "#3af5ff"); sfx.blip(); }
        else print(`unknown unit '${args[0] ?? ""}' — try: ${Object.keys(UNIT_DEFS).join(", ")}`, "#ff4d5e");
        break;
      }
      case "turret": bridge.command("buildTurret", {}); print("raising defense turret…", "#3af5ff"); break;
      case "settle": bridge.command("settle", {}); print("settling entropy ledger…", "#ffc24d"); break;
      case "pause": bridge.command("pause", {}); print("simulation suspended", "#ffc24d"); break;
      case "resume": bridge.command("resume", {}); print("simulation resumed", "#6bff9e"); break;
      case "clear": setLines(BOOT); break;
      default:
        print(`shell: command not found :: ${name} — type 'help'`, "#ff4d5e");
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[680px] max-w-[92vw] rise-in">
      <div className="holo-panel">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1c2c52]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d5e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffc24d]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#6bff9e]" />
          <span className="font-display text-[11px] text-[#3af5ff] ml-2">GSK SHELL</span>
          <span className="font-mono text-[9px] text-[#42557f] tracking-[0.2em]">operator@genesis-arena</span>
          <button onClick={onClose} className="ml-auto font-mono text-[10px] text-[#6f86b8] hover:text-[#ff4d5e] cursor-pointer">ESC ✕</button>
        </div>
        <div ref={scrollRef} className="h-[240px] overflow-y-auto px-4 py-3 font-mono text-[12px] leading-[1.65] bg-[rgba(2,4,10,0.55)]">
          {lines.map((l, i) => <div key={i} className="log-line whitespace-pre-wrap" style={{ color: l.color }}>{l.text}</div>)}
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[#1c2c52]">
          <span className="font-mono text-[12px] text-[#6bff9e]">operator@genesis:~$</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { run(value); setValue(""); sfx.blip(); }
              if (e.key === "Escape") onClose();
            }}
            className="flex-1 bg-transparent outline-none font-mono text-[12px] text-[#eaffff] caret-[#3af5ff]"
            placeholder="type 'help'…"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
