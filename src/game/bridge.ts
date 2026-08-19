/**
 * SOULFEILD :: SHARED CONTRACT
 * Types, economic constants and the event bridge between the Phaser
 * spatial layer and the React command layer.
 */
import Phaser from "phaser";

// ── world constants ──────────────────────────────────────────────────
export const TILE_W = 64;
export const TILE_H = 32;
export const GRID = 16;

export const cartToIso = (col: number, row: number) => ({
  x: (col - row) * (TILE_W / 2),
  y: (col + row) * (TILE_H / 2),
});
export const isoToCart = (x: number, y: number) => ({
  col: (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2,
  row: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
});

// ── house archetypes ─────────────────────────────────────────────────
export type HouseId = "neon" | "hearth" | "monolith";
export type PltRes = "p" | "l" | "t";

export interface HouseDef {
  id: HouseId;
  name: string;
  archetype: string;
  tagline: string;
  cost: { resource: PltRes; amount: number };
  yields: { p: number; l: number; t: number };
  colors: { primary: string; glow: string; dark: string };
}

export const HOUSE_DEFS: Record<HouseId, HouseDef> = {
  neon: {
    id: "neon",
    name: "Neon Spire",
    archetype: "Cyberpunk",
    tagline: "Holo-antennas milk the datastream. High Profit output, thin walls.",
    cost: { resource: "p", amount: 500 },
    yields: { p: 7, l: 1, t: 1 },
    colors: { primary: "#3af5ff", glow: "#ff3ec8", dark: "#0e1c3d" },
  },
  hearth: {
    id: "hearth",
    name: "Hearthwood Lodge",
    archetype: "Rustic Fantasy",
    tagline: "Stone chimneys and glowing flora. Neighbors gather here — high Love.",
    cost: { resource: "l", amount: 500 },
    yields: { p: 1, l: 7, t: 1 },
    colors: { primary: "#8fd96b", glow: "#ffc24d", dark: "#4e3421" },
  },
  monolith: {
    id: "monolith",
    name: "Monolith Bunker",
    archetype: "Brutalist",
    tagline: "Raw geometry, blast doors, exposed vents. Converts entropy into defense.",
    cost: { resource: "t", amount: 500 },
    yields: { p: 0, l: 0, t: -6 },
    colors: { primary: "#9aa7bd", glow: "#ff4d5e", dark: "#23272f" },
  },
};

// ── army :: production units ─────────────────────────────────────────
export type UnitId = "knight" | "lancer" | "golem";

export interface UnitDef {
  id: UnitId;
  name: string;
  hp: number;
  dmg: number;
  range: number;
  atkCd: number;
  speed: number;
  radius: number;
  supply: number;
  cost: { p: number; l: number; t: number };
  key: string;
  desc: string;
  color: string;
  ranged: boolean;
}

export const UNIT_DEFS: Record<UnitId, UnitDef> = {
  knight: {
    id: "knight", name: "Compiler Knight", hp: 70, dmg: 9, range: 42, atkCd: 0.65,
    speed: 94, radius: 12, supply: 1, cost: { p: 80, l: 0, t: 0 }, key: "5",
    desc: "Melee frontline. Refactors bugs on contact.", color: "#3af5ff", ranged: false,
  },
  lancer: {
    id: "lancer", name: "Hex Lancer", hp: 45, dmg: 12, range: 175, atkCd: 1.1,
    speed: 86, radius: 11, supply: 1, cost: { p: 100, l: 20, t: 0 }, key: "6",
    desc: "Ranged debugger. Fires hex bolts from afar.", color: "#ff3ec8", ranged: true,
  },
  golem: {
    id: "golem", name: "Refactor Golem", hp: 210, dmg: 16, range: 46, atkCd: 1.25,
    speed: 62, radius: 16, supply: 2, cost: { p: 150, l: 0, t: 40 }, key: "7",
    desc: "Heavy tank. Absorbs entropy so others don't have to.", color: "#ffc24d", ranged: false,
  },
};

// ── soul weapons ─────────────────────────────────────────────────────
export type WeaponId = "blade" | "arrow" | "shield" | "cannon" | "lantern" | "drum";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cost: { p: number; l: number; t: number };
  cd: number;
  key: string;
  desc: string;
  color: string;
  targeting: boolean; // needs a map click
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  blade: { id: "blade", name: "The Blade", cost: { p: 60, l: 0, t: 0 }, cd: 12, key: "1", targeting: true, color: "#3af5ff", desc: "Drag a line across the field — every bug it crosses is refactored." },
  arrow: { id: "arrow", name: "The Arrow", cost: { p: 40, l: 0, t: 0 }, cd: 6, key: "2", targeting: true, color: "#ff3ec8", desc: "Surgical strike from the orbital layer on a single bug." },
  shield: { id: "shield", name: "The Shield", cost: { p: 0, l: 80, t: 0 }, cd: 20, key: "3", targeting: false, color: "#6bff9e", desc: "Freeze all bugs in time for 4s and mend every unit." },
  cannon: { id: "cannon", name: "The Cannon", cost: { p: 100, l: 0, t: 0 }, cd: 18, key: "4", targeting: true, color: "#ffc24d", desc: "Orbital slam on an area. Loud. Effective." },
  lantern: { id: "lantern", name: "The Lantern", cost: { p: 0, l: 50, t: 0 }, cd: 20, key: "5", targeting: false, color: "#ffd977", desc: "Illuminates dead code: 30 dmg to every bug, marks them (+25% dmg taken) and slows them for 6s." },
  drum: { id: "drum", name: "The Drum", cost: { p: 0, l: 75, t: 0 }, cd: 30, key: "6", targeting: false, color: "#ff8b3e", desc: "Synchronizes the collective: all agents move and strike 30% faster for 10s." },
};

export const TURRET_COST = { p: 120, l: 0, t: 40 };
export const TURRET_MAX = 6;

// ── economy / law ────────────────────────────────────────────────────
export const START_PLT = { p: 320, l: 140, t: 40 };
export const START_INTEGRITY = 100;

export const RESOURCE_META: Record<PltRes, { label: string; color: string; short: string }> = {
  p: { label: "PROFIT", color: "#ffc24d", short: "P" },
  l: { label: "LOVE", color: "#ff5ad1", short: "L" },
  t: { label: "TAX", color: "#ff4d5e", short: "T" },
};

/** Decree #12 — the Sovereign Split for fiat/crypto deposits. */
export const EXCHANGE = {
  usd: { rate: 12, label: "FIAT · USD", prefix: "$", quick: [10, 25, 50, 100] },
  btc: { rate: 30, label: "CRYPTO · mBTC", prefix: "₿", quick: [1, 5, 10, 25] },
  split: { wallet: 0.6, treasury: 0.2, burn: 0.2 },
};

export const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.floor(n)}`;

export const OBJECTIVE = { housesNeeded: 3, netWorthNeeded: 1500, citadels: 3 };

export interface PltSnapshot {
  p: number; l: number; t: number;
  pRate: number; lRate: number; tRate: number;
  danger: boolean;
  integrity: number;
  plotsFree: number; plotsTotal: number; owned: number;
  timePlayed: number;
  supply: number; supplyMax: number;
  queue: { name: string; t: number; total: number } | null;
  queueCount: number;
  armed: WeaponId | null;
  weapons: { id: WeaponId; cd: number; max: number }[];
  wave: number; nextWaveIn: number; threats: number; kills: number;
  citadels: { hp: number; hpMax: number }[];
  turretCount: number;
  selected: { name: string; hp: number; hpMax: number; kind: string }[];
  selectedCount: number;
  // 3D command center feed
  buildings3d: { kind: string; label: string; x: number; y: number; hp: number; hpMax: number; color: string }[];
  motes: { x: number; y: number; t: "unit" | "enemy" }[];
  drumActive: boolean;
}

export type BridgeCommands = {
  claim: { house: HouseId };
  buy: { house: HouseId };
  deposit: { currency: "usd" | "btc"; amount: number; p: number; l: number; burn: number; treasury: number };
  settle: {};
  prod: { unit: UnitId };
  arm: { id: WeaponId | null };
  buildTurret: {};
  resume: {};
  pause: {};
  reboot: {};
  sandbox: {};
  terminal: boolean;
  mute: boolean;
};

export type BridgeEvents = {
  plt: PltSnapshot;
  log: { msg: string; tone: "good" | "bad" | "sys" };
  prompt: string | null;
  flash: { color: string };
  terminal: boolean;
  paused: boolean;
  started: boolean;
  end: EndStats;
  wave: { n: number };
  activity: { kind: string };
};

export interface EndStats {
  win: boolean;
  warVictory: boolean;
  timePlayed: number;
  netWorth: number;
  owned: number;
  audits: number;
  depositsPlt: number;
  handshakes: number;
  kills: number;
  waves: number;
  citadelsDestroyed: number;
  unitsBuilt: number;
}

// ── event bus ────────────────────────────────────────────────────────
class Bridge {
  private ee = new Phaser.Events.EventEmitter();
  on<K extends keyof BridgeEvents>(ev: K, fn: (payload: BridgeEvents[K]) => void) {
    this.ee.on(ev, fn as (...args: unknown[]) => void);
    return () => { this.ee.off(ev, fn as (...args: unknown[]) => void); };
  }
  emit<K extends keyof BridgeEvents>(ev: K, payload: BridgeEvents[K]) {
    this.ee.emit(ev, payload);
  }
  command<K extends keyof BridgeCommands>(cmd: K, payload: BridgeCommands[K]) {
    this.ee.emit(`cmd:${cmd}`, payload);
  }
  onCommand<K extends keyof BridgeCommands>(cmd: K, fn: (payload: BridgeCommands[K]) => void) {
    this.ee.on(`cmd:${cmd}`, fn as (...args: unknown[]) => void);
    return () => { this.ee.off(`cmd:${cmd}`, fn as (...args: unknown[]) => void); };
  }
  reset() { this.ee.removeAllListeners(); }
}

export const bridge = new Bridge();
