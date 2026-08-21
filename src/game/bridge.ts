/**
 * SOULFEILD :: SHARED CONTRACT
 * Types, economic constants and the event bridge between the Phaser
 * spatial layer and the React command layer.
 */
import Phaser from "phaser";

// ── world constants ──────────────────────────────────────────────────
export const TILE_W = 64;
export const TILE_H = 32;
export const GRID = 56;

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

// ── army :: production units (warcraft-grade roster) ─────────────────
export type UnitId =
  | "imp" | "knight" | "scout"
  | "lancer" | "bomber" | "golem"
  | "guardian" | "priest" | "titan"
  | "gleaner";

export type StructId = "supply" | "barracks" | "foundry" | "heavy" | "sanctum" | "turret" | "rig" | "grove" | "vault" | "garrison";

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
  worker?: boolean;
  requires: StructId | null;
  splash?: number;
  siegeBonus?: number;
  healer?: boolean;
}

export const UNIT_ORDER: UnitId[] = ["imp", "knight", "scout", "lancer", "bomber", "golem", "guardian", "priest", "titan", "gleaner"];

export const UNIT_DEFS: Record<UnitId, UnitDef> = {
  imp: {
    id: "imp", name: "Script Imp", hp: 24, dmg: 4, range: 30, atkCd: 0.55,
    speed: 124, radius: 8, supply: 1, cost: { p: 40, l: 0, t: 0 }, key: "",
    desc: "Disposable swarm script. Cheap, fast, angry.", color: "#ff6b5e", ranged: false, requires: "barracks",
  },
  knight: {
    id: "knight", name: "Compiler Knight", hp: 70, dmg: 9, range: 42, atkCd: 0.65,
    speed: 94, radius: 12, supply: 1, cost: { p: 80, l: 0, t: 0 }, key: "5",
    desc: "Melee frontline. Refactors bugs on contact.", color: "#3af5ff", ranged: false, requires: "barracks",
  },
  scout: {
    id: "scout", name: "Async Scout", hp: 32, dmg: 4, range: 32, atkCd: 0.7,
    speed: 168, radius: 9, supply: 1, cost: { p: 60, l: 10, t: 0 }, key: "",
    desc: "Blistering recon. Charts the wilds, pokes the Void.", color: "#9fdcff", ranged: false, requires: "barracks",
  },
  lancer: {
    id: "lancer", name: "Hex Lancer", hp: 45, dmg: 12, range: 175, atkCd: 1.1,
    speed: 86, radius: 11, supply: 1, cost: { p: 100, l: 20, t: 0 }, key: "6",
    desc: "Ranged debugger. Fires hex bolts from afar.", color: "#ff3ec8", ranged: true, requires: "foundry",
  },
  bomber: {
    id: "bomber", name: "Fork Bomber", hp: 36, dmg: 18, range: 150, atkCd: 1.6,
    speed: 84, radius: 10, supply: 1, cost: { p: 120, l: 0, t: 30 }, key: "",
    desc: "Lobs forking payloads. Splash damage on impact.", color: "#ff8b3e", ranged: true, requires: "foundry", splash: 58,
  },
  golem: {
    id: "golem", name: "Refactor Golem", hp: 210, dmg: 16, range: 46, atkCd: 1.25,
    speed: 62, radius: 16, supply: 2, cost: { p: 150, l: 0, t: 40 }, key: "7",
    desc: "Siege engine. ×3 damage vs structures.", color: "#ffc24d", ranged: false, requires: "heavy", siegeBonus: 3,
  },
  guardian: {
    id: "guardian", name: "Mutex Guardian", hp: 280, dmg: 13, range: 42, atkCd: 1.0,
    speed: 58, radius: 15, supply: 2, cost: { p: 180, l: 0, t: 60 }, key: "",
    desc: "Locks the line. A wall of synchronized steel.", color: "#5ea8ff", ranged: false, requires: "heavy",
  },
  priest: {
    id: "priest", name: "Patch Priest", hp: 42, dmg: 0, range: 140, atkCd: 1.0,
    speed: 88, radius: 10, supply: 1, cost: { p: 150, l: 60, t: 0 }, key: "",
    desc: "Hotfixes wounded allies in range. Does not attack.", color: "#f5f0ff", ranged: true, requires: "sanctum", healer: true,
  },
  titan: {
    id: "titan", name: "Kernel Titan", hp: 650, dmg: 34, range: 55, atkCd: 1.5,
    speed: 44, radius: 19, supply: 4, cost: { p: 400, l: 100, t: 80 }, key: "",
    desc: "The monolith walks. Slow, furious, nearly eternal.", color: "#ffd977", ranged: false, requires: "sanctum",
  },
  gleaner: {
    id: "gleaner", name: "Gleaner Drone", hp: 34, dmg: 0, range: 0, atkCd: 99,
    speed: 118, radius: 9, supply: 1, cost: { p: 60, l: 0, t: 0 }, key: "8",
    desc: "Worker NPC. Send it to Data Crystals / Heart Blooms to harvest PLT.", color: "#6bff9e", ranged: false, worker: true, requires: null,
  },
};

// ── structures :: build anywhere ─────────────────────────────────────
export interface StructDef {
  id: StructId;
  name: string;
  cost: { p: number; l: number; t: number };
  hp: number;
  supply: number;
  buildTime: number;
  color: string;
  desc: string;
  unlocks: UnitId[];
  footprint: number;
  needsNode?: boolean;      // must be placed beside a resource node
  yields?: { p: number; l: number; t: number };
  attractsRaids?: boolean;  // pirates covet it
}

export const STRUCT_DEFS: Record<StructId, StructDef> = {
  supply: {
    id: "supply", name: "Supply Pylon", cost: { p: 80, l: 0, t: 10 }, hp: 260, supply: 4, buildTime: 8,
    color: "#6bff9e", desc: "+4 supply cap. Feeds the war machine.", unlocks: [], footprint: 1,
  },
  barracks: {
    id: "barracks", name: "Compile Barracks", cost: { p: 200, l: 0, t: 40 }, hp: 520, supply: 0, buildTime: 16,
    color: "#3af5ff", desc: "Trains Script Imps, Compiler Knights, Async Scouts.", unlocks: ["imp", "knight", "scout"], footprint: 2,
  },
  foundry: {
    id: "foundry", name: "Hex Foundry", cost: { p: 260, l: 40, t: 0 }, hp: 520, supply: 0, buildTime: 18,
    color: "#ff3ec8", desc: "Forges Hex Lancers and Fork Bombers.", unlocks: ["lancer", "bomber"], footprint: 2,
  },
  heavy: {
    id: "heavy", name: "Heavy Works", cost: { p: 340, l: 0, t: 80 }, hp: 640, supply: 0, buildTime: 22,
    color: "#ffc24d", desc: "Assembles Mutex Guardians and Refactor Golems.", unlocks: ["guardian", "golem"], footprint: 2,
  },
  sanctum: {
    id: "sanctum", name: "Soul Sanctum", cost: { p: 460, l: 140, t: 0 }, hp: 560, supply: 0, buildTime: 26,
    color: "#f5f0ff", desc: "Summons Patch Priests and Kernel Titans.", unlocks: ["priest", "titan"], footprint: 2,
  },
  turret: {
    id: "turret", name: "Defense Turret", cost: { p: 100, l: 0, t: 30 }, hp: 300, supply: 0, buildTime: 12,
    color: "#9fdcff", desc: "Auto-fires on bugs in range. Max 6.", unlocks: [], footprint: 1,
  },
  rig: {
    id: "rig", name: "Harvest Rig", cost: { p: 240, l: 0, t: 20 }, hp: 420, supply: 0, buildTime: 18,
    color: "#3af5ff", desc: "Drills Data Crystals beside it. +3.5 Profit/s. Build on a crystal.", unlocks: [], footprint: 1, needsNode: true, yields: { p: 3.5, l: 0, t: 0.4 },
  },
  grove: {
    id: "grove", name: "Heart Grove", cost: { p: 0, l: 240, t: 20 }, hp: 420, supply: 0, buildTime: 18,
    color: "#ff5ad1", desc: "Cultivates Heart Blooms beside it. +3.5 Love/s. Build on a bloom.", unlocks: [], footprint: 1, needsNode: true, yields: { p: 0, l: 3.5, t: 0.4 },
  },
  vault: {
    id: "vault", name: "API Vault", cost: { p: 400, l: 0, t: 60 }, hp: 700, supply: 0, buildTime: 26,
    color: "#ffc24d", desc: "+7 Profit/s of pure yield — but pirates and bugs covet its keys.", unlocks: [], footprint: 2, yields: { p: 7, l: 0, t: 1 }, attractsRaids: true,
  },
  garrison: {
    id: "garrison", name: "Fortress Garrison", cost: { p: 360, l: 60, t: 80 }, hp: 900, supply: 4, buildTime: 28,
    color: "#5ea8ff", desc: "+4 supply and a bastion wall. Your frontier command post.", unlocks: [], footprint: 2,
  },
};

export const SUPPLY_START = 10;
export const SUPPLY_CAP = 80;

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
  lantern: { id: "lantern", name: "The Lantern", cost: { p: 0, l: 50, t: 0 }, cd: 20, key: "9", targeting: false, color: "#ffd977", desc: "Illuminates dead code: 30 dmg to every bug, marks them (+25% dmg taken) and slows them for 6s." },
  drum: { id: "drum", name: "The Drum", cost: { p: 0, l: 75, t: 0 }, cd: 30, key: "0", targeting: false, color: "#ff8b3e", desc: "Synchronizes the collective: all agents move and strike 30% faster for 10s." },
};

export const TURRET_COST = { p: 120, l: 0, t: 40 };
export const TURRET_MAX = 6;

// ── OPEN WORLD :: 6 REGIONS ──────────────────────────────────────────
export type RegionId = "genesis" | "forge" | "syndicate" | "hollows" | "nomad" | "sanctum";

export interface RegionDef {
  id: RegionId; name: string; lv: [number, number]; color: string; desc: string; faction: FactionId;
}

export const REGION_DEFS: Record<RegionId, RegionDef> = {
  genesis:   { id: "genesis",   name: "GENESIS CAPITAL", lv: [1, 10],   color: "#3af5ff", desc: "The fortified capital. Market hums, barriers glow.", faction: "syndicate" },
  forge:     { id: "forge",     name: "FORGE LANDS",     lv: [5, 20],   color: "#ffc24d", desc: "Sparks rain on iron fields. The Forge faction toils here.", faction: "forge" },
  syndicate: { id: "syndicate", name: "SYNDICATE STRIP", lv: [15, 35],  color: "#ff3ec8", desc: "Neon bazaars and data dens. Everything has a price.", faction: "syndicate" },
  hollows:   { id: "hollows",   name: "DEBUGGER HOLLOWS",lv: [25, 55],  color: "#6bff9e", desc: "Mist-shrouded ravines where wild code breeds.", faction: "debuggers" },
  nomad:     { id: "nomad",     name: "NOMAD EXPANSE",   lv: [40, 75],  color: "#ff8b3e", desc: "Endless dunes of static. Caravans trade in silence.", faction: "nomads" },
  sanctum:   { id: "sanctum",   name: "SOUL SANCTUM",    lv: [70, 100], color: "#b58cff", desc: "The deep frontier. Citadels brood; only legends return.", faction: "ascended" },
};

// ── FACTION SYSTEM :: 6 FACTIONS ─────────────────────────────────────
export type FactionId = "forge" | "syndicate" | "debuggers" | "nomads" | "rogue" | "ascended";

export interface FactionDef {
  id: FactionId; name: string; color: string; perk: string; sigil: string;
}

export const FACTION_DEFS: Record<FactionId, FactionDef> = {
  forge:     { id: "forge",     name: "The Forge",        color: "#ffc24d", perk: "Construction costs −15%", sigil: "anvil" },
  syndicate: { id: "syndicate", name: "Code Syndicate",   color: "#ff3ec8", perk: "PLT income +12%", sigil: "circuit" },
  debuggers: { id: "debuggers", name: "The Debuggers",    color: "#6bff9e", perk: "Damage vs bugs +20%", sigil: "bugslash" },
  nomads:    { id: "nomads",    name: "Desert Nomads",    color: "#ff8b3e", perk: "Harvest yield +30%", sigil: "dune" },
  rogue:     { id: "rogue",     name: "Rogue AI",         color: "#9fdcff", perk: "Unit speed +12%", sigil: "eye" },
  ascended:  { id: "ascended",  name: "The Ascended",     color: "#b58cff", perk: "Catch rate +15%", sigil: "halo" },
};

export const FACTION_TIERS = [
  { name: "NEUTRAL", at: 0 },
  { name: "FRIENDLY", at: 100 },
  { name: "HONORED", at: 250 },
  { name: "EXALTED", at: 500 },
];

export const factionTier = (rep: number) => {
  let t = FACTION_TIERS[0];
  for (const tier of FACTION_TIERS) if (rep >= tier.at) t = tier;
  return t.name;
};

// ── CREATURE COLLECTION :: 18 SPECIES ────────────────────────────────
export type CritterShape = "blob" | "quad" | "wing" | "snake" | "rock" | "wisp";

export interface SpeciesDef {
  id: string; name: string; shape: CritterShape; color: string; rarity: number; // 1..5
  baseHp: number; baseAtk: number; evolveTo: string | null; evolveLevel: number;
  biome: RegionId[]; desc: string;
}

export const SPECIES: SpeciesDef[] = [
  { id: "bitling",    name: "Bitling",      shape: "blob",  color: "#6bff9e", rarity: 1, baseHp: 26, baseAtk: 4,  evolveTo: "nibbler",     evolveLevel: 8,  biome: ["genesis", "hollows"], desc: "A stray bit given appetite." },
  { id: "nibbler",    name: "Nibbler",      shape: "blob",  color: "#3ad47f", rarity: 2, baseHp: 58, baseAtk: 8,  evolveTo: "bytefang",    evolveLevel: 18, biome: ["hollows"], desc: "Nibbles firewalls for fun." },
  { id: "bytefang",   name: "Bytefang",     shape: "quad",  color: "#1fae62", rarity: 3, baseHp: 130, baseAtk: 17, evolveTo: null, evolveLevel: 99, biome: ["hollows", "nomad"], desc: "Apex packet predator." },
  { id: "sparkit",    name: "Sparkit",      shape: "quad",  color: "#ffd977", rarity: 1, baseHp: 22, baseAtk: 5,  evolveTo: "voltcat",     evolveLevel: 10, biome: ["genesis", "forge"], desc: "Purrs at 60Hz." },
  { id: "voltcat",    name: "Voltcat",      shape: "quad",  color: "#ffc24d", rarity: 2, baseHp: 52, baseAtk: 10, evolveTo: "stormlynx",   evolveLevel: 22, biome: ["forge"], desc: "Its tail grounds the enemy." },
  { id: "stormlynx",  name: "Stormlynx",    shape: "quad",  color: "#ff9d2e", rarity: 4, baseHp: 120, baseAtk: 22, evolveTo: null, evolveLevel: 99, biome: ["forge", "nomad"], desc: "Thunder rolls where it walks." },
  { id: "mospuff",    name: "Mospuff",      shape: "blob",  color: "#b8e6a0", rarity: 1, baseHp: 34, baseAtk: 3,  evolveTo: "shroomcap",   evolveLevel: 9,  biome: ["genesis", "hollows"], desc: "Soft, damp, mildly sentient." },
  { id: "shroomcap",  name: "Shroomcap",    shape: "blob",  color: "#e08f6b", rarity: 2, baseHp: 74, baseAtk: 7,  evolveTo: "mycelord",    evolveLevel: 20, biome: ["hollows"], desc: "Spores of mild disruption." },
  { id: "mycelord",   name: "Mycelord",     shape: "rock",  color: "#c96f9e", rarity: 4, baseHp: 160, baseAtk: 19, evolveTo: null, evolveLevel: 99, biome: ["hollows", "sanctum"], desc: "The forest floor obeys it." },
  { id: "glim",       name: "Glim",         shape: "wisp",  color: "#9fdcff", rarity: 1, baseHp: 18, baseAtk: 6,  evolveTo: "lanternwisp", evolveLevel: 12, biome: ["genesis", "syndicate"], desc: "A lost cursor of light." },
  { id: "lanternwisp",name: "Lanternwisp",  shape: "wisp",  color: "#5ec8ff", rarity: 2, baseHp: 44, baseAtk: 12, evolveTo: "beaconflare", evolveLevel: 24, biome: ["syndicate"], desc: "Guides travelers; bills them." },
  { id: "beaconflare",name: "Beaconflare",  shape: "wisp",  color: "#3af5ff", rarity: 4, baseHp: 96, baseAtk: 26, evolveTo: null, evolveLevel: 99, biome: ["syndicate", "sanctum"], desc: "Visible from three biomes away." },
  { id: "pebblix",    name: "Pebblix",      shape: "rock",  color: "#9aa7bd", rarity: 1, baseHp: 46, baseAtk: 4,  evolveTo: "bouldron",    evolveLevel: 14, biome: ["forge", "nomad"], desc: "Patient as a compile queue." },
  { id: "bouldron",   name: "Bouldron",     shape: "rock",  color: "#7e8ba3", rarity: 3, baseHp: 110, baseAtk: 12, evolveTo: "terragolem",  evolveLevel: 28, biome: ["nomad"], desc: "Carries its own collision mesh." },
  { id: "terragolem", name: "Terragolem",   shape: "rock",  color: "#5f6f8c", rarity: 5, baseHp: 240, baseAtk: 24, evolveTo: null, evolveLevel: 99, biome: ["nomad", "sanctum"], desc: "Older than the grid itself." },
  { id: "hexling",    name: "Hexling",      shape: "snake", color: "#ff8bd0", rarity: 2, baseHp: 30, baseAtk: 8,  evolveTo: "cipherfox",   evolveLevel: 16, biome: ["syndicate", "hollows"], desc: "Casts minor curses (debuffs)." },
  { id: "cipherfox",  name: "Cipherfox",    shape: "snake", color: "#ff5ad1", rarity: 3, baseHp: 84, baseAtk: 15, evolveTo: "enigma",      evolveLevel: 32, biome: ["sanctum"], desc: "Its tail is an encrypted stream." },
  { id: "enigma",     name: "Enigma",       shape: "snake", color: "#b58cff", rarity: 5, baseHp: 190, baseAtk: 30, evolveTo: null, evolveLevel: 99, biome: ["sanctum"], desc: "Solved once. Never again." },
];

export const speciesById = (id: string) => SPECIES.find((s) => s.id === id)!;

export interface OwnedCreature {
  uid: number; speciesId: string; level: number; xp: number;
}

export const creatureStats = (c: OwnedCreature) => {
  const s = speciesById(c.speciesId);
  const m = 1 + (c.level - 1) * 0.09;
  return { hp: Math.round(s.baseHp * m), atk: Math.round(s.baseAtk * m), def: s };
};

export const xpForLevel = (lv: number) => lv * 40 + lv * lv * 4;

// ── ARCADE LADDER :: 8 TIERS ─────────────────────────────────────────
export const TOWER_TIERS = ["CLAY", "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "SOUL"];
export const TOWER_FLOORS = 10;
export const TOWER_TIER_COLORS: Record<string, string> = {
  CLAY: "#b5714f", IRON: "#9aa7bd", BRONZE: "#d08a4e", SILVER: "#cfd8e6",
  GOLD: "#ffc24d", PLATINUM: "#9fdcff", DIAMOND: "#3af5ff", SOUL: "#b58cff",
};
export const towerFloorPower = (tier: number, floor: number) => 40 + tier * 90 + floor * 14 + (floor === TOWER_FLOORS ? 120 : 0);

// ── SOUL HOMES :: garden, storage, upgrades ──────────────────────────
export const HOME_MAX_LEVEL = 3;
export const homeUpgradeCost = (lv: number) => ({ p: 200 * lv, l: 80 * lv, t: 30 * lv });
export const homeGardenPlots = (lv: number) => lv * 2;

export interface GardenPlot { seed: string | null; plantedAt: number; watered: boolean; ready: boolean; }
export interface ItemDef { id: string; name: string; color: string; value: number; }

export const SEEDS: Record<string, { name: string; cost: number; growSec: number; item: ItemDef }> = {
  dataseed:  { name: "Data Seed",    cost: 30, growSec: 45, item: { id: "datafruit",  name: "Data Fruit",    color: "#3af5ff", value: 55 } },
  lovespore: { name: "Love Spore",   cost: 30, growSec: 60, item: { id: "lovebloom",  name: "Love Bloom",    color: "#ff5ad1", value: 70 } },
  taxroot:   { name: "Tax Root",     cost: 20, growSec: 90, item: { id: "entropygem", name: "Entropy Gem",   color: "#ff4d5e", value: 110 } },
  soulberry: { name: "Soul Berry",   cost: 60, growSec: 120, item: { id: "soulberry",  name: "Soul Berry",    color: "#b58cff", value: 160 } },
};

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
  buildings3d: { kind: string; label: string; x: number; y: number; hp: number; hpMax: number; color: string; done: boolean }[];
  gameSpeed: number;
  buildArmed: string | null;
  motes: { x: number; y: number; t: "unit" | "enemy" }[];
  drumActive: boolean;
  workers: number;
  nodesLeft: number;
  nodesMini: { x: number; y: number; kind: string }[];
  citadelsDown: number;
  citadelsTotal: number;
  // ── RPG layer ──
  region: RegionId;
  playerLevel: number; playerXp: number; xpNext: number;
  party: { uid: number; speciesId: string; name: string; level: number; color: string; shape: CritterShape }[];
  partyMax: number;
  storageCreatures: number;
  factions: { id: FactionId; rep: number; tier: string }[];
  tower: { tier: number; floor: number; totalCleared: number };
  armyPower: number;
  catchable: { name: string; level: number; hpPct: number } | null;
  nearHome: boolean;
  dayPhase: "day" | "dusk" | "night" | "dawn";
  crittersWild: number;
  capturedTotal: number;
}

export type BridgeCommands = {
  claim: { house: HouseId };
  buy: { house: HouseId };
  deposit: { currency: "usd" | "btc"; amount: number; p: number; l: number; burn: number; treasury: number };
  settle: {};
  prod: { unit: UnitId };
  arm: { id: WeaponId | null };
  buildTurret: {};
  rallyAll: {};
  place: { id: StructId };
  cancelPlace: {};
  speed: {};
  resume: {};
  pause: {};
  reboot: {};
  sandbox: {};
  terminal: boolean;
  mute: boolean;
  // ── RPG layer ──
  catch: {};
  joy: { x: number; y: number };
  sprint: boolean;
  jump: {};
  towerAscend: {};
  towerReset: {};
  grantReward: { p?: number; l?: number; xp?: number; rep?: { id: FactionId; amt: number } };
};

export type BridgeEvents = {
  plt: PltSnapshot;
  log: { msg: string; tone: "good" | "bad" | "sys" };
  prompt: string | null;
  flash: { color: string };
  terminal: boolean;
  home: boolean;
  paused: boolean;
  started: boolean;
  end: EndStats;
  wave: { n: number };
  activity: { kind: string };
  ticker: { t: string; msg: string; tone: string };
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
