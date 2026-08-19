// ─── SOULFEILD RTS :: React <-> Phaser bridge & shared economy constants ───

export type HouseId = "neon" | "hearth" | "monolith";

export interface HouseDef {
  id: HouseId;
  name: string;
  archetype: string;
  tagline: string;
  cost: { resource: "p" | "l" | "t"; amount: number };
  yields: { p: number; l: number; t: number };
  colors: { primary: string; glow: string; dark: string };
}

export const HOUSE_DEFS: Record<HouseId, HouseDef> = {
  neon: {
    id: "neon",
    name: "NEON SPIRE",
    archetype: "Cyberpunk",
    tagline: "Rain-slicked tower humming with ad-holo light. Pure profit engine.",
    cost: { resource: "p", amount: 500 },
    yields: { p: 7, l: 1, t: 1 },
    colors: { primary: "#3af5ff", glow: "#ff3ec8", dark: "#0e1c3d" },
  },
  hearth: {
    id: "hearth",
    name: "HEARTHWOOD LODGE",
    archetype: "Rustic Fantasy",
    tagline: "Stone chimney, glowing flora. Neighbors gather here — love flows.",
    cost: { resource: "l", amount: 500 },
    yields: { p: 1, l: 7, t: 1 },
    colors: { primary: "#8fd96b", glow: "#ffc24d", dark: "#4e3421" },
  },
  monolith: {
    id: "monolith",
    name: "MONOLITH BUNKER",
    archetype: "Brutalist",
    tagline: "Raw concrete entropy-furnace. Burns TAX and anchors the defense grid.",
    cost: { resource: "t", amount: 500 },
    yields: { p: 2, l: 2, t: -6 },
    colors: { primary: "#9aa7bd", glow: "#ff4d5e", dark: "#3d4552" },
  },
};

export const RESOURCE_META = {
  p: { label: "PROFIT", color: "#ffc24d", short: "P" },
  l: { label: "LOVE", color: "#ff5ad1", short: "L" },
  t: { label: "TAX", color: "#ff4d5e", short: "T" },
} as const;

// Fiat exchange: $1 = 12 PLT, 1 mBTC = 30 PLT
export const EXCHANGE = {
  usd: { rate: 12, label: "USD", prefix: "$", quick: [10, 25, 50] },
  btc: { rate: 30, label: "mBTC", prefix: "₿m", quick: [1, 5, 10] },
  split: { wallet: 0.6, treasury: 0.2, burn: 0.2 },
};

export const OBJECTIVE = { housesNeeded: 3, netWorthNeeded: 1500 };
export const START_PLT = { p: 150, l: 150, t: 0 };

export interface PltSnapshot {
  p: number; l: number; t: number;
  rates: { p: number; l: number; t: number };
  integrity: number;
  danger: boolean;
  owned: number;
  plotsFree: number;
  netWorth: number;
  timePlayed: number;
  sandbox: boolean;
}

export interface LogEntry { id: number; msg: string; tone: "info" | "good" | "bad" | "sys"; t: number }

export interface EndStats {
  win: boolean;
  timePlayed: number;
  netWorth: number;
  owned: number;
  audits: number;
  depositsPlt: number;
  handshakes: number;
}

type Events = {
  state: PltSnapshot;
  log: LogEntry;
  prompt: string | null;
  terminal: boolean;
  paused: boolean;
  flash: string; // css color
  end: EndStats;
  // commands (React -> scene)
  spawn: HouseId;
  buy: HouseId;
  deposit: { currency: "usd" | "btc"; amount: number; p: number; l: number; burn: number; treasury: number };
  settle: void;
  pause: void;
  resume: void;
  sandbox: void;
  closeTerminal: void;
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

class Bridge {
  private handlers: { [K in keyof Events]?: Set<Handler<K>> } = {};
  on<K extends keyof Events>(key: K, fn: Handler<K>): () => void {
    const set = (this.handlers[key] ??= new Set() as never) as Set<Handler<K>>;
    set.add(fn);
    return () => set.delete(fn);
  }
  emit<K extends keyof Events>(key: K, payload: Events[K]) {
    const set = this.handlers[key] as Set<Handler<K>> | undefined;
    if (set) set.forEach((fn) => fn(payload));
  }
}

export const bridge = new Bridge();

export const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");
