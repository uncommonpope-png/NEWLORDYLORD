/**
 * SOULFEILD :: SPATIAL OS — GENESIS ARENA + WAR PROTOCOL
 * Isometric 2:1 projection · RTS selection & orders · CPU void citadels ·
 * soul weapons · PLT economy. Phases 1–5 + Milestones 3/4/5/8 fused.
 */
import Phaser from "phaser";
import {
  TILE_W, TILE_H, GRID, cartToIso, isoToCart,
  HOUSE_DEFS, UNIT_DEFS, WEAPON_DEFS, TURRET_COST, TURRET_MAX, STRUCT_DEFS,
  SUPPLY_START, SUPPLY_CAP,
  START_PLT, START_INTEGRITY, EXCHANGE, OBJECTIVE, fmt,
  REGION_DEFS, FACTION_DEFS, SPECIES, speciesById, creatureStats, xpForLevel,
  TOWER_TIERS, TOWER_FLOORS, towerFloorPower, factionTier,
  bridge, HouseId, UnitId, WeaponId, StructId, PltSnapshot, EndStats,
  RegionId, FactionId, OwnedCreature, CritterShape,
} from "./bridge";
import { createTextures } from "./textures";
import { sfx } from "./audio";

// ── enemy registry (the bugs) ────────────────────────────────────────
type EnemyId = "keese" | "wisp" | "stalker" | "behemoth";
interface EnemyDef { name: string; hp: number; dmg: number; range: number; atkCd: number; speed: number; radius: number; loot: number; tex: string; barY: number; }
const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  keese:    { name: "Syntax Keese",   hp: 24,  dmg: 4,  range: 30, atkCd: 0.8,  speed: 108, radius: 9,  loot: 9,  tex: "keese",    barY: 26 },
  wisp:     { name: "Null Wisp",      hp: 42,  dmg: 7,  range: 34, atkCd: 0.9,  speed: 82,  radius: 11, loot: 15, tex: "wisp",     barY: 32 },
  stalker:  { name: "Race Stalker",   hp: 72,  dmg: 11, range: 38, atkCd: 0.85, speed: 120, radius: 12, loot: 24, tex: "stalker",  barY: 42 },
  behemoth: { name: "Leak Behemoth",  hp: 280, dmg: 20, range: 48, atkCd: 1.4,  speed: 46,  radius: 20, loot: 95, tex: "behemoth", barY: 62 },
};
const ENEMY_BARY: Record<string, number> = { knight: 48, lancer: 48, golem: 58, avatar: 48, gleaner: 34 };

const CITADEL_SPOTS = [
  { c: 6, r: 6, hp: 650 },
  { c: 33, r: 5, hp: 850 },
  { c: 34, r: 33, hp: 1100 },
  { c: 5, r: 34, hp: 1300 },
  { c: 20, r: 1, hp: 1500 },
  { c: 1, r: 20, hp: 1800 },
];

// ── entity types ─────────────────────────────────────────────────────
type Order =
  | { type: "move"; x: number; y: number }
  | { type: "attackmove"; x: number; y: number }
  | { type: "follow"; ox: number; oy: number }
  | { type: "attackBuilding"; id: number };

interface Fighter {
  id: number;
  side: "player" | "enemy";
  kind: string;           // unit id | enemy id | "avatar"
  name: string;
  x: number; y: number;   // ground position (iso space)
  hp: number; hpMax: number;
  dmg: number; range: number; atkCdMax: number; atkCd: number;
  speed: number; radius: number;
  loot: number;
  ranged: boolean;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  barY: number;
  ring: Phaser.GameObjects.Image | null;
  order: Order | null;
  targetF: Fighter | null;
  targetB: Building | null;
  frozen: number; invuln: number;
  slow: number; marked: number;
  flash: number;
  bobSeed: number;
  dead: boolean;
  hpDirty: boolean;
  worker: boolean;
  cargo: number;
  cargoKind: "p" | "l";
  gatherId: number | null;
  gState: "idle" | "toNode" | "mine" | "toDrop";
  mineT: number;
}

interface ResNode {
  id: number;
  kind: "crystal" | "bloom";
  c: number; r: number;
  x: number; y: number;
  amount: number; max: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  dead: boolean;
}

interface Building {
  id: number;
  kind: "house" | "turret" | "citadel" | "market" | "supply" | "barracks" | "foundry" | "heavy" | "sanctum" | "relay" | "rig" | "grove" | "vault" | "garrison";
  owner: "player" | "cpu" | "neutral";
  houseType?: HouseId;
  c: number; r: number;
  sx: number; sy: number;       // iso ground center
  solidR: number;
  hp: number; hpMax: number;
  invulnerable?: boolean;
  sprite: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  barW: number; barY: number;
  atkTimer: number;
  raidTimer: number; raidIdx: number; announced: boolean;
  yields?: { p: number; l: number; t: number };
  destroyed: boolean;
  hpDirty: boolean;
  // construction / unlock system
  underConstruction?: boolean;
  buildProgress?: number;       // 0..1
  buildTime?: number;
  scaffold?: Phaser.GameObjects.Image;
  structId?: StructId;
  supplyBonus?: number;
  unlocked?: boolean;           // construction finished, outputs available
}

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  x: number; y: number;
  targetF: Fighter | null;
  targetB: Building | null;
  lx: number; ly: number;
  speed: number; dmg: number;
  splash?: number;
  dead: boolean;
}

interface Blast { x: number; y: number; t: number; r: number; dmg: number; hit: Set<number>; }

// ── RPG :: creatures & soul homes ────────────────────────────────────
interface Critter {
  id: number;
  speciesId: string;
  level: number;
  hp: number; hpMax: number;
  x: number; y: number;
  region: RegionId;
  sprite: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  wanderT: number; wx: number; wy: number;
  fleeing: boolean;
  dead: boolean;
  bobSeed: number;
}

interface SoulHome {
  level: number;
  garden: GardenPlotState[];
  storage: { id: string; name: string; color: string; value: number }[];
}

interface GardenPlotState { seed: string | null; plantedAt: number; watered: boolean; ready: boolean; }

// ── world dressing :: pedestrians & ambient motes ────────────────────
interface Ped {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  x: number; y: number;
  tx: number; ty: number;
  wait: number;
  speed: number;
  bobSeed: number;
}

interface Mote {
  sprite: Phaser.GameObjects.Image;
  vx: number; vy: number;
  life: number;
}

export class GameScene extends Phaser.Scene {
  // world
  private solids: boolean[][] = [];
  private walkExtents = { minC: -4, maxC: 60, minR: -4, maxR: 60 };
  private groundTiles: Phaser.GameObjects.Image[] = [];
  private parallax: { obj: Phaser.GameObjects.Image; f: number; bx: number; by: number }[] = [];
  private worldBounds = { x: 0, y: 0, w: 0, h: 0 };

  // camera / input
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private camPan = { x: 0, y: 0 };
  private zoom = 1;
  private wheelAcc = 0;
  private dragStart: { x: number; y: number } | null = null;
  private dragBox: Phaser.GameObjects.Graphics | null = null;
  private bladeStart: { x: number; y: number } | null = null;
  private attackMoveMode = false;

  // entities
  private units: Fighter[] = [];
  private enemies: Fighter[] = [];
  private buildings: Building[] = [];
  private projectiles: Projectile[] = [];
  private blasts: Blast[] = [];
  private selected = new Set<number>();
  private nextId = 1;

  // player avatar
  private player!: Phaser.GameObjects.Image;
  private avatar!: Fighter;
  private playerFacing = 1;
  private stepTimer = 0;
  private respawnTimer = -1;

  // npc
  private npc!: Phaser.GameObjects.Image;
  private npcGlow!: Phaser.GameObjects.Image;
  private npcTarget = { x: 0, y: 0 };
  private npcBubble: Phaser.GameObjects.Text | null = null;
  private npcBubbleTimer: Phaser.Time.TimerEvent | null = null;
  private handshakeCd = 0;

  // market terminal
  private terminal!: Phaser.GameObjects.Image;
  private terminalPos = { x: 0, y: 0 };
  private terminalOpen = false;
  private terminalChangedAt = -99999;
  private terminalRing!: Phaser.GameObjects.Image;

  // economy & state
  private plt = { ...START_PLT };
  private integrity = START_INTEGRITY;
  private owned: { type: HouseId; buildingId: number }[] = [];
  private plots: { c: number; r: number; claimed: boolean; houseType?: HouseId }[] = [];
  private nodes: ResNode[] = [];
  private gleanerHinted = false;

  // world dressing
  private landmarks: Phaser.GameObjects.Image[] = [];
  private civilians: Ped[] = [];
  private motes: Mote[] = [];
  private tintRect: Phaser.GameObjects.Graphics | null = null;
  private auditTimer = 45;
  private audits = 0;
  private depositsPlt = 0;
  private handshakes = 0;
  private kills = 0;
  private unitsBuilt = 0;
  private wave = 0;
  private paused = false;
  private ended = false;
  private sandbox = false;
  private started = false;
  private playTime = 0;
  private prompt: string | null = null;
  private lastPrompt: string | null = null;

  // rts state
  private queue: { unit: UnitId; t: number; total: number }[] = [];
  private weaponCd: Record<WeaponId, number> = { blade: 0, arrow: 0, shield: 0, cannon: 0, lantern: 0, drum: 0 };
  private drumUntil = 0;
  private armed: WeaponId | null = null;

  // build-anywhere placement system
  private placeArmed: StructId | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private ghostValid = false;
  private gameSpeed = 1;

  // ── RPG layer ──────────────────────────────────────────────────────
  private region: RegionId = "genesis";
  private regionName: Phaser.GameObjects.Text | null = null;
  private playerLevel = 1;
  private playerXp = 0;
  private party: OwnedCreature[] = [];
  private storageCreatures: OwnedCreature[] = [];
  private nextCreatureUid = 1;
  private capturedTotal = 0;
  private partySprites: { uid: number; sprite: Phaser.GameObjects.Image; fighter: Fighter | null }[] = [];
  private factionRep: Record<FactionId, number> = { forge: 0, syndicate: 0, debuggers: 0, nomads: 0, rogue: 0, ascended: 0 };
  private towerTier = 0;
  private towerFloor = 1;
  private towerCleared = 0;
  private critters: Critter[] = [];
  private critterTimer = 3;
  private dayClock = 0;
  private soulHomes: Record<number, SoulHome> = {};
  private ticker: { t: string; msg: string; tone: string }[] = [];
  private joyVec = { x: 0, y: 0 };
  private sprinting = false;
  private catchableCritter: Critter | null = null;

  private unsub: (() => void)[] = [];

  constructor() { super("GameScene"); }

  // ═══════════════════════════ CREATE ═══════════════════════════
  create() {
    createTextures(this);
    this.solids = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    this.plt = { ...START_PLT };
    this.integrity = START_INTEGRITY;
    this.owned = [];
    this.queue = [];
    this.weaponCd = { blade: 0, arrow: 0, shield: 0, cannon: 0, lantern: 0, drum: 0 };
    this.drumUntil = 0;
    this.armed = null;
    this.selected.clear();
    this.units = []; this.enemies = []; this.buildings = []; this.projectiles = []; this.blasts = [];
    this.kills = 0; this.unitsBuilt = 0; this.wave = 0; this.audits = 0; this.handshakes = 0;
    this.depositsPlt = 0; this.playTime = 0; this.auditTimer = 45;
    this.paused = false; this.ended = false; this.sandbox = false; this.started = false;
    this.handshakeCd = 0; this.respawnTimer = -1; this.npcBubble = null;
    this.placeArmed = null; this.ghost = null; this.ghostValid = false; this.gameSpeed = 1;

    // RPG layer reset / load
    this.region = "genesis";
    this.playerLevel = 1; this.playerXp = 0;
    this.party = []; this.storageCreatures = []; this.nextCreatureUid = 1; this.capturedTotal = 0;
    this.partySprites = [];
    this.factionRep = { forge: 0, syndicate: 0, debuggers: 0, nomads: 0, rogue: 0, ascended: 0 };
    this.towerTier = 0; this.towerFloor = 1; this.towerCleared = 0;
    for (const c of this.critters) { c.sprite.destroy(); c.bar.clear(); }
    this.critters = []; this.critterTimer = 2; this.catchableCritter = null;
    this.dayClock = 0; this.soulHomes = {}; this.ticker = [];
    this.joyVec = { x: 0, y: 0 }; this.sprinting = false;
    for (const lm of this.landmarks) lm.destroy();
    this.landmarks = [];
    for (const ped of this.civilians) { ped.sprite.destroy(); ped.shadow.destroy(); }
    this.civilians = [];
    for (const m of this.motes) m.sprite.destroy();
    this.motes = [];
    if (this.tintRect) { this.tintRect.destroy(); this.tintRect = null; }

    this.buildVoid();
    this.buildGround();
    this.buildProps();
    this.buildLandmarks();
    this.buildCivilians();
    this.buildBarrier();
    this.buildTerminal();
    this.buildCitadels();
    this.buildNodes();
    this.buildPlayer();
    this.buildNpc();
    this.buildCamera();
    this.bindInput();
    this.bindBridge();

    bridge.emit("prompt", null);
    bridge.emit("paused", false);

    this.plots = [
      { c: 14, r: 14, claimed: false },
      { c: 26, r: 13, claimed: false },
      { c: 27, r: 24, claimed: false },
      { c: 13, r: 26, claimed: false },
      { c: 20, r: 30, claimed: false },
    ];
    this.log("GENESIS PLOT ONLINE :: claim a house at the boot console", "sys");
  }

  // ═══════════════════════════ WORLD ═══════════════════════════
  private buildVoid() {
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.graphics().setScrollFactor(0).setDepth(-100);
    bg.fillGradientStyle(0x03040c, 0x03040c, 0x0a1030, 0x120a2e, 1);
    bg.fillRect(0, 0, W, H);
    // nebula
    const neb = this.add.graphics().setScrollFactor(0.1).setDepth(-99).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    neb.fillStyle(0x2a1548, 0.5); neb.fillCircle(400, 240, 260);
    neb.fillStyle(0x0e2a4a, 0.5); neb.fillCircle(900, 500, 320);
    neb.fillStyle(0x481533, 0.4); neb.fillCircle(1200, 180, 200);
    // stars (two parallax bands)
    for (const [count, f, size, alpha] of [[90, 0.12, 2, 0.7], [50, 0.25, 3, 0.9]] as [number, number, number, number][]) {
      const layer = this.add.graphics().setScrollFactor(f).setDepth(-98);
      layer.fillStyle(0xffffff, alpha);
      for (let i = 0; i < count; i++) {
        layer.fillRect(Phaser.Math.Between(-400, 1900), Phaser.Math.Between(-400, 1300), size, size);
      }
    }
    // pirate ships — container carries parallax, inner sprite carries drift
    const defs = [
      { x: 320, y: 170, s: 0.9 }, { x: 880, y: 110, s: 0.65 },
      { x: 1240, y: 280, s: 1.15 }, { x: 600, y: 340, s: 0.5 }, { x: 1420, y: 130, s: 0.75 },
    ];
    defs.forEach((d, i) => {
      const cont = this.add.container(d.x, d.y).setDepth(-97 + i * 0.01);
      const ship = this.makeShip(i % 2 === 0);
      ship.setScale(d.s).setAlpha(0.9);
      cont.add(ship);
      this.tweens.add({ targets: ship, x: i % 2 ? -160 : 160, y: 24, duration: 9000 + i * 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.parallax.push({ obj: cont as unknown as Phaser.GameObjects.Image, f: 0.35, bx: d.x, by: d.y });
    });
  }

  private makeShip(variant: boolean): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const hull = variant ? 0x241a3d : 0x1a2440;
    const trim = variant ? 0xff3ec8 : 0xff4d5e;
    g.fillStyle(hull, 1);
    g.fillTriangle(-46, 0, 30, -12, 30, 12);
    g.fillTriangle(30, -12, 52, 0, 30, 12);
    g.fillStyle(0x0c0f1e, 1);
    g.fillTriangle(-20, -4, 26, -9, 26, 2);
    g.lineStyle(1.5, trim, 0.9);
    g.lineBetween(-46, 0, 30, -12);
    g.fillStyle(trim, 1);
    g.fillCircle(36, 0, 2.5);
    g.fillStyle(0xffe066, 0.8);
    for (let i = 0; i < 3; i++) g.fillRect(-14 + i * 12, -2, 3, 3);
    return g;
  }

  private isWater(c: number, r: number): boolean {
    // the Delta lake in the Nomad west
    return ((c - 7) / 5) ** 2 + ((r - 21) / 3.4) ** 2 <= 1;
  }

  private buildGround() {
    const CX = GRID / 2, CY = GRID / 2;
    const REGION_TINT: Record<RegionId, number> = {
      genesis: 0xffffff, forge: 0xffe0c0, syndicate: 0xcfeaff, nomad: 0xfff0c8, hollows: 0xd8f0d0, sanctum: 0xe8dcff,
    };
    for (let r = -1; r <= GRID; r++) {
      for (let c = -1; c <= GRID; c++) {
        const pos = cartToIso(c, r);
        const inGrid = c >= 0 && c < GRID && r >= 0 && r < GRID;
        const ring = !inGrid;
        const dist = Math.sqrt((c - CX) * (c - CX) + (r - CY) * (r - CY));
        let tex = "grass";
        if (ring) tex = "void";
        else if (this.isWater(c, r)) tex = "water";
        else if (dist > 16.5) tex = (c * 7 + r * 13) % 9 === 0 ? "grass3" : (c + r) % 2 === 0 ? "grass2" : "grass3"; // the Wilds
        else if (r === 19 && c >= 9 && c <= 31) tex = "path";
        else if (c === 19 && r >= 9 && r <= 31) tex = "path";
        else if ((c + r * 3) % 7 === 0) tex = "grass2";
        else if ((c * 5 + r) % 11 === 0) tex = "grass3";
        const img = this.add.image(pos.x, pos.y, tex).setDepth(r + c - 10);
        if (inGrid && tex !== "water" && tex !== "void" && tex !== "path") {
          img.setTint(REGION_TINT[this.regionAt(c, r)]);
        }
        if (tex === "water") {
          this.markSolid(c, r);
          img.setAlpha(0.92);
          this.tweens.add({ targets: img, alpha: { from: 0.85, to: 0.97 }, duration: 1800 + ((c * 13 + r * 7) % 900), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        }
        this.groundTiles.push(img);
      }
    }
  }

  private buildProps() {
    const lampSpots = [[16, 18], [23, 18], [19, 21], [15, 24], [24, 24], [19, 16]];
    for (const [c, r] of lampSpots) {
      const p = cartToIso(c, r);
      const lamp = this.add.image(p.x, p.y - 4, "lamp").setOrigin(0.5, 1).setDepth(r + c + 0.5);
      const glow = this.add.image(p.x, p.y - 44, "glow").setDepth(r + c + 0.45).setTint(0xffc24d).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7);
      this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 0.28 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.markSolid(c, r);
      lamp.setData("solid", true);
    }
    // trees: curated capital groves + procedural wilds scatter
    const treeSpots: [number, number][] = [[12, 12], [27, 12], [12, 27], [27, 27], [13, 21], [26, 17], [18, 12], [21, 27]];
    for (let r = 2; r < GRID - 2; r++) {
      for (let c = 2; c < GRID - 2; c++) {
        const dist = Math.sqrt((c - 20) * (c - 20) + (r - 20) * (r - 20));
        if (dist > 11 && (c * 31 + r * 17) % 61 === 0) treeSpots.push([c, r]);
      }
    }
    for (const [c, r] of treeSpots) {
      if (this.solids[r]?.[c]) continue;
      const p = cartToIso(c, r);
      const tree = this.add.image(p.x, p.y - 2, "holotree").setOrigin(0.5, 1).setDepth(r + c + 0.5);
      this.tweens.add({ targets: tree, alpha: { from: 1, to: 0.75 }, duration: 2200 + r * 137, yoyo: true, repeat: -1 });
      this.markSolid(c, r);
    }
  }

  private buildBarrier() {
    const g = this.add.graphics().setDepth(500);
    for (let r = -1; r <= GRID; r++) {
      for (let c = -1; c <= GRID; c++) {
        const edge = c === -1 || r === -1 || c === GRID || r === GRID;
        if (!edge) continue;
        const p = cartToIso(c, r);
        g.lineStyle(1.5, 0x3af5ff, 0.4);
        g.strokePoints([
          new Phaser.Math.Vector2(p.x, p.y - TILE_H / 2 - 16),
          new Phaser.Math.Vector2(p.x + TILE_W / 2, p.y - 16),
          new Phaser.Math.Vector2(p.x, p.y + TILE_H / 2 - 16),
          new Phaser.Math.Vector2(p.x - TILE_W / 2, p.y - 16),
        ], true);
        g.lineStyle(1, 0x3af5ff, 0.12);
        g.lineBetween(p.x, p.y - 16, p.x, p.y - 44);
      }
    }
    for (const [c, r] of [[-1, -1], [GRID, -1], [-1, GRID], [GRID, GRID]]) {
      const p = cartToIso(c, r);
      const beacon = this.add.image(p.x, p.y - 30, "glow").setTint(0x3af5ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8).setDepth(501);
      this.tweens.add({ targets: beacon, scale: { from: 0.6, to: 1 }, alpha: { from: 0.8, to: 0.3 }, duration: 1400, yoyo: true, repeat: -1 });
    }
  }

  // ── landmarks :: one per region ────────────────────────────────────
  private buildLandmarks() {
    const spots: { c: number; r: number; tex: string; glow: number }[] = [
      { c: 12, r: 6, tex: "landmark_obelisk", glow: 0xff8b3e },   // forge (north)
      { c: 42, r: 22, tex: "landmark_arch", glow: 0xff3ec8 },     // syndicate (east)
      { c: 30, r: 44, tex: "landmark_pyramid", glow: 0xffd977 },  // hollows (south)
      { c: 6, r: 30, tex: "landmark_crystal", glow: 0xb58cff },   // nomad (west)
      { c: 46, r: 46, tex: "landmark_spire", glow: 0xffd977 },    // sanctum (SE corner)
      { c: 20, r: 14, tex: "landmark_monolith", glow: 0x3af5ff }, // genesis capital
    ];
    for (const s of spots) {
      const p = cartToIso(s.c, s.r);
      const lm = this.add.image(p.x, p.y - 2, s.tex).setOrigin(0.5, 1).setDepth(s.r + s.c + 0.5);
      const glow = this.add.image(p.x, p.y - 60, "glow").setDepth(s.r + s.c + 0.45)
        .setTint(s.glow).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.7 }, duration: 1900 + s.c * 31, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.landmarks.push(lm);
      this.markSolid(s.c, s.r);
      this.markSolid(s.c + 1, s.r); this.markSolid(s.c, s.r + 1);
    }
  }

  // ── civilians :: wandering pedestrians with routines ───────────────
  private buildCivilians() {
    const tints = [0x9fdcff, 0xffc24d, 0xff5ad1, 0x6bff9e, 0xb58cff, 0xff8b3e];
    const homes = [
      { c: 15, r: 17 }, { c: 24, r: 18 }, { c: 17, r: 24 }, { c: 23, r: 23 },
      { c: 20, r: 16 }, { c: 16, r: 21 }, { c: 25, r: 21 }, { c: 21, r: 25 },
    ];
    for (let i = 0; i < 8; i++) {
      const h = homes[i];
      const p = cartToIso(h.c + 0.5, h.r + 0.5);
      const shadow = this.add.image(p.x, p.y + 2, "shadow").setOrigin(0.5, 0.5).setDepth(20.1).setScale(0.6).setAlpha(0.5);
      const sprite = this.add.image(p.x, p.y, "civilian").setOrigin(0.5, 1).setDepth(20.5).setTint(tints[i % tints.length]).setScale(0.9);
      this.civilians.push({
        sprite, shadow, x: p.x, y: p.y, tx: p.x, ty: p.y,
        wait: Phaser.Math.FloatBetween(0, 3), speed: Phaser.Math.FloatBetween(26, 40), bobSeed: Math.random() * 100,
      });
    }
  }

  private updateCivilians(dt: number) {
    const night = this.dayPhase() === "night";
    for (const ped of this.civilians) {
      if (ped.wait > 0) { ped.wait -= dt; continue; }
      const d = Phaser.Math.Distance.Between(ped.x, ped.y, ped.tx, ped.ty);
      const sp = ped.speed * (night ? 0.5 : 1);
      if (d < 5) {
        // arrived — pause, then pick a new wander target near the capital
        ped.wait = Phaser.Math.FloatBetween(1.5, 5);
        const nc = Phaser.Math.Between(13, 27), nr = Phaser.Math.Between(13, 27);
        if (!this.solids[nr]?.[nc]) {
          const p = cartToIso(nc + 0.5, nr + 0.5);
          ped.tx = p.x; ped.ty = p.y;
        }
        continue;
      }
      ped.x += ((ped.tx - ped.x) / d) * sp * dt;
      ped.y += ((ped.ty - ped.y) / d) * sp * dt;
      const bob = Math.sin(this.time.now / 200 + ped.bobSeed) * 1.4;
      ped.sprite.setPosition(ped.x, ped.y + bob);
      ped.shadow.setPosition(ped.x, ped.y + 2);
      ped.sprite.setFlipX(ped.tx < ped.x);
      ped.sprite.setAlpha(night ? 0.55 : 0.95);
      const cc = isoToCart(ped.x, ped.y);
      ped.sprite.setDepth(cc.row + cc.col + 0.65);
      ped.shadow.setDepth(cc.row + cc.col + 0.12);
    }
  }

  // ── atmosphere :: day/night tint + ambient motes ───────────────────
  private updateAtmosphere(dt: number) {
    // day/night full-screen tint
    if (!this.tintRect) this.tintRect = this.add.graphics().setScrollFactor(0).setDepth(1300);
    const g = this.tintRect;
    g.clear();
    const phase = this.dayPhase();
    const tint =
      phase === "night" ? { c: 0x0a1440, a: 0.34 } :
      phase === "dusk" ? { c: 0x5e2a14, a: 0.16 } :
      phase === "dawn" ? { c: 0x3a2a5e, a: 0.12 } : { c: 0x000000, a: 0 };
    if (tint.a > 0) {
      g.fillStyle(tint.c, tint.a);
      g.fillRect(0, 0, this.scale.width, this.scale.height);
    }
    // ambient motes colored by current region
    const REGION_MOTE: Record<RegionId, number> = {
      genesis: 0x3af5ff, forge: 0xff8b3e, syndicate: 0xff3ec8, nomad: 0xffd977, hollows: 0x6bff9e, sanctum: 0xb58cff,
    };
    if (this.motes.length < 26 && Math.random() < dt * 8) {
      const cam = this.cameras.main;
      const wx = cam.scrollX + Math.random() * cam.width / cam.zoom;
      const wy = cam.scrollY + Math.random() * cam.height / cam.zoom;
      const sprite = this.add.image(wx, wy, "glow").setDepth(905).setScale(0.16)
        .setTint(REGION_MOTE[this.region]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.motes.push({ sprite, vx: Phaser.Math.FloatBetween(-8, 8), vy: Phaser.Math.FloatBetween(-16, -6), life: Phaser.Math.FloatBetween(2, 4) });
    }
    for (const m of this.motes) {
      m.life -= dt;
      m.sprite.x += m.vx * dt; m.sprite.y += m.vy * dt;
      m.sprite.setAlpha(Math.max(0, Math.min(0.7, m.life / 2)));
      if (m.life <= 0) { m.sprite.destroy(); }
    }
    this.motes = this.motes.filter((m) => m.life > 0);
  }

  private buildTerminal() {
    const pos = cartToIso(19.5, 18);
    this.terminalPos = pos;
    this.terminal = this.add.image(pos.x, pos.y - 4, "terminal").setOrigin(0.5, 1).setDepth(18 + 19.5 + 0.6);
    this.terminalRing = this.add.image(pos.x, pos.y + 6, "selring").setDepth(18 + 19.5 + 0.2).setAlpha(0);
    this.tweens.add({ targets: this.terminalRing, alpha: { from: 0, to: 0.8 }, duration: 900, yoyo: true, repeat: -1 });
    const holo = this.add.text(pos.x, pos.y - 118, "◈ MARKET TERMINAL", {
      fontFamily: "Silkscreen", fontSize: "10px", color: "#3af5ff",
    }).setOrigin(0.5).setDepth(520).setAlpha(0.85);
    this.tweens.add({ targets: holo, y: pos.y - 124, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.markSolid(19, 18); this.markSolid(20, 18);
    // market building record (invulnerable, no yields)
    this.buildings.push({
      id: this.nextId++, kind: "market", owner: "neutral", c: 19.5, r: 18, sx: pos.x, sy: pos.y,
      solidR: 34, hp: 99999, hpMax: 99999, invulnerable: true, sprite: this.terminal,
      bar: this.add.graphics().setDepth(998), barW: 0, barY: 0, atkTimer: 0,
      raidTimer: 0, raidIdx: 0, announced: false, destroyed: false, hpDirty: false,
    });
  }

  // ── resource nodes (the harvest) ─────────────────
  private buildNodes() {
    // ring of wealth around the capital — crystals pay Profit, blooms pay Love
    const spots: { c: number; r: number; kind: "crystal" | "bloom" }[] = [
      { c: 11, r: 19, kind: "crystal" }, { c: 28, r: 18, kind: "crystal" },
      { c: 24, r: 29, kind: "crystal" }, { c: 14, r: 30, kind: "crystal" },
      { c: 30, r: 24, kind: "crystal" }, { c: 9, r: 24, kind: "crystal" },
      { c: 20, r: 9, kind: "crystal" }, { c: 32, r: 12, kind: "crystal" },
      { c: 8, r: 12, kind: "crystal" },
      { c: 16, r: 10, kind: "bloom" }, { c: 27, r: 21, kind: "bloom" },
      { c: 17, r: 27, kind: "bloom" }, { c: 33, r: 28, kind: "bloom" },
      { c: 6, r: 17, kind: "bloom" },
    ];
    for (const s of spots) {
      const p = cartToIso(s.c, s.r);
      const max = s.kind === "crystal" ? 700 : 400;
      const sprite = this.add.image(p.x, p.y - 4, s.kind).setOrigin(0.5, 1).setDepth(s.r + s.c + 0.4);
      const glow = this.add.image(p.x, p.y - 18, "glow")
        .setDepth(s.r + s.c + 0.35).setTint(s.kind === "crystal" ? 0x3af5ff : 0xff5ad1)
        .setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.4);
      this.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.55 }, duration: 1400 + s.c * 97, yoyo: true, repeat: -1 });
      this.nodes.push({
        id: this.nextId++, kind: s.kind, c: s.c, r: s.r, x: p.x, y: p.y,
        amount: max, max, sprite, glow, dead: false,
      });
    }
    this.log(`SURVEY COMPLETE :: ${this.nodes.length} resource nodes charted in the wilds`, "sys");
  }

  private depleteNode(n: ResNode) {
    n.dead = true;
    this.tweens.add({ targets: n.sprite, alpha: 0, y: n.sprite.y + 8, duration: 500, onComplete: () => n.sprite.destroy() });
    this.tweens.add({ targets: n.glow, alpha: 0, duration: 400, onComplete: () => n.glow.destroy() });
    this.log(`${n.kind === "crystal" ? "DATA CRYSTAL" : "HEART BLOOM"} DEPLETED :: the wilds give no more here`, "sys");
  }

  private updateGather(f: Fighter, dt: number) {
    // retarget if the assigned node is gone
    let node = this.nodes.find((n) => n.id === f.gatherId && !n.dead && n.amount > 0);
    if (!node) {
      let best: ResNode | null = null, bd = 1e9;
      for (const n of this.nodes) {
        if (n.dead || n.amount <= 0) continue;
        const d = Phaser.Math.Distance.Between(f.x, f.y, n.x, n.y);
        if (d < bd) { bd = d; best = n; }
      }
      if (best && bd < 800) { f.gatherId = best.id; node = best; }
      else { f.gatherId = null; f.gState = "idle"; return; }
    }
    const drop = this.terminalPos;
    if (f.cargo >= 10) f.gState = "toDrop";
    else if (f.gState === "toDrop" || f.gState === "idle") f.gState = "toNode";

    if (f.gState === "toNode") {
      this.steer(f, node.x, node.y + 12, dt, 1);
      if (Phaser.Math.Distance.Between(f.x, f.y, node.x, node.y + 12) < 22) { f.gState = "mine"; f.mineT = 0.4; }
    } else if (f.gState === "mine") {
      if (node.amount <= 0) { f.gState = "toNode"; return; }
      f.mineT -= dt;
      if (f.mineT <= 0) {
        f.mineT = 1.4;
        const take = Math.min(10, node.amount);
        node.amount -= take;
        f.cargo += take;
        f.cargoKind = node.kind === "crystal" ? "p" : "l";
        f.sprite.setTint(node.kind === "crystal" ? 0x3af5ff : 0xff5ad1);
        node.sprite.setScale(0.55 + 0.45 * (node.amount / node.max));
        if (node.amount <= 0) this.depleteNode(node);
      }
    } else if (f.gState === "toDrop") {
      this.steer(f, drop.x, drop.y + 20, dt, 1);
      if (Phaser.Math.Distance.Between(f.x, f.y, drop.x, drop.y + 20) < 34) {
        if (f.cargoKind === "p") this.plt.p += f.cargo;
        else this.plt.l += f.cargo;
        this.floatText(f.x, f.y - 44, `+${f.cargo}${f.cargoKind === "p" ? "P" : "L"}`, f.cargoKind === "p" ? "#3af5ff" : "#ff5ad1");
        this.activity("gather");
        sfx.coin();
        this.addRep("nomads", 4);
        this.gainXp(3);
        f.cargo = 0;
        f.sprite.clearTint();
        f.gState = "toNode";
      }
    }
  }

  private rallyAll() {
    const cits = this.buildings.filter((b) => b.kind === "citadel" && !b.destroyed);
    if (!cits.length) { this.log("ALL CITADELS ALREADY PURGED :: the wilds are yours", "good"); return; }
    const center = cartToIso(20, 20);
    let target = cits[0], bd = 1e9;
    for (const b of cits) {
      const d = Phaser.Math.Distance.Between(center.x, center.y, b.sx, b.sy);
      if (d < bd) { bd = d; target = b; }
    }
    let sent = 0;
    for (const f of this.units) {
      if (f.dead || f.worker) continue;
      f.order = {
        type: "attackmove",
        x: target.sx + Phaser.Math.Between(-60, 60),
        y: target.sy + Phaser.Math.Between(-30, 50),
      };
      f.targetF = null; f.targetB = null;
      sent++;
    }
    if (!this.avatar.dead) { this.avatar.order = { type: "attackmove", x: target.sx, y: target.sy + 40 }; }
    sfx.horn();
    bridge.emit("flash", { color: "rgba(58,245,255,0.16)" });
    this.log(`WAR HORN :: ${sent} unit${sent === 1 ? "" : "s"} converging on the nearest Void Citadel`, "sys");
    this.activity("cast");
  }

  private buildCitadels() {
    CITADEL_SPOTS.forEach((spot, idx) => {
      const p = cartToIso(spot.c, spot.r);
      const sprite = this.add.image(p.x, p.y, "citadel").setOrigin(0.5, 1).setDepth(spot.r + spot.c + 0.6);
      const eye = this.add.image(p.x - 8, p.y - 56, "glow").setTint(0xff4d5e).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(spot.r + spot.c + 0.7);
      this.tweens.add({ targets: eye, scale: { from: 0.35, to: 0.65 }, duration: 900 + idx * 200, yoyo: true, repeat: -1 });
      const aura = this.add.image(p.x, p.y + 4, "portal").setDepth(spot.r + spot.c + 0.1).setAlpha(0.6);
      this.tweens.add({ targets: aura, alpha: { from: 0.25, to: 0.75 }, duration: 1300, yoyo: true, repeat: -1 });
      const b: Building = {
        id: this.nextId++, kind: "citadel", owner: "cpu", c: spot.c, r: spot.r, sx: p.x, sy: p.y,
        solidR: 52, hp: spot.hp, hpMax: spot.hp, sprite, glow: eye,
        bar: this.add.graphics().setDepth(998), barW: 110, barY: 176,
        atkTimer: 0, raidTimer: 16 + idx * 15, raidIdx: idx, announced: false, destroyed: false, hpDirty: false,
      };
      this.buildings.push(b);
    });
  }

  private buildPlayer() {
    const p = cartToIso(19.5, 22);
    this.player = this.add.image(p.x, p.y, "player").setOrigin(0.5, 1).setDepth(20);
    const glow = this.add.image(p.x, p.y - 24, "glow").setTint(0x3af5ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.5).setDepth(19.9);
    this.player.setData("glow", glow);
    this.avatar = this.makeFighter({
      side: "player", kind: "avatar", name: "Avatar",
      x: p.x, y: p.y, hp: 120, hpMax: 120, dmg: 7, range: 44, atkCd: 0.7,
      speed: 138, radius: 12, loot: 0, ranged: false, tex: "player", barY: 48,
    });
    this.avatar.sprite.destroy(); // makeFighter creates a placeholder; the avatar uses this.player
    this.avatar.sprite = this.player;
    this.player.setVisible(false); // revealed at spawn
  }

  private buildNpc() {
    const center = cartToIso(24, 23);
    const pos = cartToIso(24, 24.6);
    this.npcTarget = { x: pos.x, y: pos.y - 8 };
    this.npc = this.add.image(pos.x, pos.y - 8, "watcher").setOrigin(0.5, 1).setDepth(25);
    this.npcGlow = this.add.image(pos.x, pos.y - 16, "glow").setDepth(24.9).setTint(0xff5ad1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.4);
    this.time.addEvent({
      delay: 6500, loop: true, callback: () => {
        if (this.paused || this.ended) return;
        const spots = [
          { x: center.x - 46, y: center.y + 16 }, { x: center.x - 92, y: center.y - 6 },
          { x: center.x - 40, y: center.y + 48 }, { x: center.x - 112, y: center.y + 26 },
        ];
        const s = spots[Phaser.Math.Between(0, spots.length - 1)];
        this.tweens.add({ targets: this.npcTarget, x: s.x, y: s.y, duration: 1700, ease: "Sine.easeInOut" });
      },
    });
  }

  private buildCamera() {
    const xMin = (this.walkExtents.minC - this.walkExtents.maxC) * (TILE_W / 2);
    const xMax = (this.walkExtents.maxC - this.walkExtents.minC) * (TILE_W / 2);
    const yMin = (this.walkExtents.minC + this.walkExtents.minR) * (TILE_H / 2);
    const yMax = (this.walkExtents.maxC + this.walkExtents.maxR) * (TILE_H / 2);
    this.worldBounds = { x: xMin - 200, y: yMin - 320, w: xMax - xMin + 400, h: yMax - yMin + 560 };
    this.cameras.main.setBounds(this.worldBounds.x, this.worldBounds.y, this.worldBounds.w, this.worldBounds.h);
    const start = cartToIso(20, 20);
    this.cameras.main.centerOn(start.x, start.y - 60).setZoom(0.82);
    this.tweens.add({
      targets: this.cameras.main, zoom: 1, duration: 1600, ease: "Cubic.easeOut",
      onComplete: () => { this.spawnReveal(); },
    });
  }

  private bindInput() {
    const kb = this.input.keyboard!;
    this.keys = {
      W: kb.addKey("W"), A: kb.addKey("A"), S: kb.addKey("S"), D: kb.addKey("D"),
      UP: kb.addKey("UP"), DOWN: kb.addKey("DOWN"), LEFT: kb.addKey("LEFT"), RIGHT: kb.addKey("RIGHT"),
      E: kb.addKey("E"), M: kb.addKey("M"), ESC: kb.addKey("ESC"),
      Q: kb.addKey("Q"), X: kb.addKey("X"), F: kb.addKey("F"), T: kb.addKey("T"),
      ONE: kb.addKey("ONE"), TWO: kb.addKey("TWO"), THREE: kb.addKey("THREE"), FOUR: kb.addKey("FOUR"),
      FIVE: kb.addKey("FIVE"), SIX: kb.addKey("SIX"), SEVEN: kb.addKey("SEVEN"), EIGHT: kb.addKey("EIGHT"),
      NINE: kb.addKey("NINE"), ZERO: kb.addKey("ZERO"),
      R: kb.addKey("R"),
      C: kb.addKey("C"), SPACE: kb.addKey("SPACE"), SHIFT: kb.addKey("SHIFT"),
    };

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      // build-anywhere placement takes priority
      if (this.placeArmed) {
        if (ptr.rightButtonDown()) { this.cancelPlace(); return; }
        if (ptr.leftButtonDown()) { this.confirmPlace(); return; }
        return;
      }
      if (ptr.rightButtonDown()) { this.issueOrder(ptr); return; }
      if (ptr.leftButtonDown()) {
        if (this.armed === "blade") {
          const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
          this.bladeStart = { x: w.x, y: w.y };
          return;
        }
        if (this.armed) {
          const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
          this.castAt(this.armed, w.x, w.y);
          return;
        }
        this.dragStart = { x: ptr.x, y: ptr.y };
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.updateGhost();
      if (this.dragStart && (Math.abs(ptr.x - this.dragStart.x) > 7 || Math.abs(ptr.y - this.dragStart.y) > 7)) {
        if (!this.dragBox) this.dragBox = this.add.graphics().setDepth(2000).setScrollFactor(0);
        this.dragBox.clear();
        this.dragBox.lineStyle(1.5, 0x3af5ff, 0.9);
        this.dragBox.fillStyle(0x3af5ff, 0.08);
        const x = Math.min(this.dragStart.x, ptr.x), y = Math.min(this.dragStart.y, ptr.y);
        const w = Math.abs(ptr.x - this.dragStart.x), h = Math.abs(ptr.y - this.dragStart.y);
        this.dragBox.fillRect(x, y, w, h);
        this.dragBox.strokeRect(x, y, w, h);
      }
    });

    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.wheelAcc += dy;
    });

    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (this.armed === "blade" && this.bladeStart) {
        const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
        this.castBlade(this.bladeStart.x, this.bladeStart.y, w.x, w.y);
        this.bladeStart = null;
        return;
      }
      if (this.dragBox) {
        this.dragBox.clear();
        this.dragBox = null;
        if (this.dragStart) {
          const x1 = Math.min(this.dragStart.x, ptr.x), x2 = Math.max(this.dragStart.x, ptr.x);
          const y1 = Math.min(this.dragStart.y, ptr.y), y2 = Math.max(this.dragStart.y, ptr.y);
          this.boxSelect(x1, y1, x2, y2);
        }
        this.dragStart = null;
        return;
      }
      if (this.dragStart) {
        const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
        this.clickSelect(w.x, w.y);
        this.dragStart = null;
      }
    });
  }

  private bindBridge() {
    this.unsub.forEach((u) => u());
    this.unsub = [
      bridge.onCommand("claim", (d) => this.claimHouse(d.house)),
      bridge.onCommand("buy", (d) => this.buyHouse(d.house)),
      bridge.onCommand("deposit", (d) => this.deposit(d)),
      bridge.onCommand("settle", () => this.settle()),
      bridge.onCommand("prod", (d) => this.queueUnit(d.unit)),
      bridge.onCommand("arm", (d) => this.armWeapon(d.id)),
      bridge.onCommand("buildTurret", () => this.buildTurret()),
      bridge.onCommand("rallyAll", () => this.rallyAll()),
      // ── RPG layer commands ──
      bridge.onCommand("catch", () => this.attemptCatch()),
      bridge.onCommand("jump", () => this.jumpAvatar()),
      bridge.onCommand("sprint", (on) => { this.sprinting = on; }),
      bridge.onCommand("joy", (v) => { this.joyVec = { x: v.x, y: v.y }; }),
      bridge.onCommand("towerAscend", () => this.towerAscend()),
      bridge.onCommand("towerReset", () => this.towerReset()),
      bridge.onCommand("grantReward", (r) => this.grantReward(r)),
      bridge.onCommand("place", (d) => this.startPlace(d.id)),
      bridge.onCommand("cancelPlace", () => this.cancelPlace()),
      bridge.onCommand("speed", () => this.cycleSpeed()),
      bridge.onCommand("pause", () => this.setPaused(true)),
      bridge.onCommand("resume", () => this.setPaused(false)),
      bridge.onCommand("sandbox", () => {
        this.sandbox = true;
        this.ended = false;
        this.integrity = Math.max(this.integrity, 60);
        this.log("SANDBOX MODE :: the kernel keeps the ledger open", "sys");
      }),
      bridge.onCommand("terminal", (open) => { this.terminalOpen = open; this.terminalChangedAt = this.time.now; }),
      bridge.onCommand("mute", (m) => sfx.setMuted(m)),
      bridge.onCommand("reboot", () => this.scene.restart()),
    ];
  }

  // ═══════════════════════════ SPAWN / HOUSES ═══════════════════════════
  private markSolid(c: number, r: number) {
    const ci = Math.floor(c), ri = Math.floor(r);
    if (ci >= 0 && ci < GRID && ri >= 0 && ri < GRID) this.solids[ri][ci] = true;
  }

  private spawnReveal() {
    if (this.started) return;
    this.started = true;
    bridge.emit("started", true);
    this.player.setVisible(true);
    this.burst(this.player.x, this.player.y - 20, 0x3af5ff, 14);
    bridge.emit("flash", { color: "rgba(58,245,255,0.25)" });
    this.log("AVATAR MATERIALIZED :: claim a house [boot console]", "sys");
  }

  private claimHouse(type: HouseId) {
    const plot = this.plots.find((p) => !p.claimed);
    if (!plot || this.owned.length > 0) return;
    this.placeHouse(plot, type, true);
  }

  private buyHouse(type: HouseId) {
    const def = HOUSE_DEFS[type];
    const plot = this.plots.find((p) => !p.claimed);
    if (!plot) { this.log("NO VACANT PLOTS :: the Genesis grid is fully claimed", "bad"); sfx.error(); return; }
    const res = def.cost.resource;
    if (this.plt[res] < def.cost.amount) { this.log(`INSUFFICIENT ${res.toUpperCase()} :: need ${fmt(def.cost.amount)}`, "bad"); sfx.error(); return; }
    this.plt[res] -= def.cost.amount;
    this.placeHouse(plot, type, false);
    sfx.build();
    this.log(`${def.name.toUpperCase()} purchased for ${fmt(def.cost.amount)} ${res.toUpperCase()}`, "good");
  }

  private placeHouse(plot: { c: number; r: number; claimed: boolean; houseType?: HouseId }, type: HouseId, free: boolean) {
    plot.claimed = true;
    plot.houseType = type;
    const center = cartToIso(plot.c + 1, plot.r + 1);
    const sprite = this.add.image(center.x, center.y + 6, `house_${type}`).setOrigin(0.5, 1).setDepth(plot.r + plot.c + 2 + 0.6).setScale(0.2).setAlpha(0);
    const glow = this.add.image(center.x, center.y - 60, "glow").setTint(Phaser.Display.Color.HexStringToColor(HOUSE_DEFS[type].colors.primary).color).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0.6).setDepth(plot.r + plot.c + 2 + 0.5);
    this.tweens.add({ targets: sprite, scale: 1, alpha: 1, duration: 550, ease: "Back.easeOut" });
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 1400 });
    for (let rr = plot.r; rr <= plot.r + 1; rr++) for (let cc = plot.c; cc <= plot.c + 1; cc++) this.markSolid(cc, rr);
    const b: Building = {
      id: this.nextId++, kind: "house", owner: "player", houseType: type, c: plot.c + 1, r: plot.r + 1,
      sx: center.x, sy: center.y + 6, solidR: 42, hp: 320, hpMax: 320, sprite, glow,
      bar: this.add.graphics().setDepth(998), barW: 64, barY: 150, atkTimer: 0,
      raidTimer: 0, raidIdx: 0, announced: false, destroyed: false, hpDirty: false,
      yields: { ...HOUSE_DEFS[type].yields },
    };
    this.buildings.push(b);
    this.owned.push({ type, buildingId: b.id });
    bridge.emit("flash", { color: "rgba(58,245,255,0.22)" });
    this.burst(center.x, center.y - 40, Phaser.Display.Color.HexStringToColor(HOUSE_DEFS[type].colors.primary).color, 16);
    if (free) {
      this.log(`${HOUSE_DEFS[type].name.toUpperCase()} claimed :: resident Watcher assigned`, "good");
      sfx.purchase();
    }
    // resident watcher
    const wp = cartToIso(plot.c + 0.4, plot.r + 2.4);
    const watcher = this.add.image(wp.x, wp.y, "watcher").setOrigin(0.5, 1).setDepth(plot.r + plot.c + 3);
    this.tweens.add({ targets: watcher, y: wp.y - 5, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (this.checkGenesisWin()) return;
  }

  private deposit(d: { currency: "usd" | "btc"; amount: number; p: number; l: number; burn: number; treasury: number }) {
    this.plt.p += d.p;
    this.plt.l += d.l;
    this.plt.t = Math.max(0, this.plt.t - d.burn);
    this.depositsPlt += d.p + d.l;
    sfx.purchase();
    bridge.emit("flash", { color: "rgba(255,194,77,0.2)" });
    this.burst(this.terminalPos.x, this.terminalPos.y - 60, 0xffc24d, 18);
    this.log(`SOVEREIGN SPLIT :: +${fmt(d.p)} P, +${fmt(d.l)} L, ${fmt(d.burn)} T burned, ${fmt(d.treasury)} to GSK treasury`, "good");
  }

  private settle() {
    const debt = this.plt.t;
    if (debt <= 0.5) { this.log("LEDGER ALREADY CLEAR", "sys"); return; }
    const total = this.plt.p + this.plt.l;
    if (total < debt) { this.log("INSUFFICIENT RESERVES :: cannot settle entropy", "bad"); sfx.error(); return; }
    const ratio = debt / total;
    this.plt.p -= this.plt.p * ratio;
    this.plt.l -= this.plt.l * ratio;
    this.plt.t = 0;
    sfx.shield();
    bridge.emit("flash", { color: "rgba(107,255,158,0.22)" });
    this.log(`ENTROPY SETTLED :: ${fmt(debt)} TAX dissolved across reserves`, "good");
  }

  // ═══════════════════════════ RTS :: SELECTION & ORDERS ═══════════════════════════
  private clickSelect(wx: number, wy: number) {
    if (!this.started || this.paused || this.ended) return;
    let best: Fighter | null = null, bd = 30;
    for (const f of this.units) {
      if (f.dead) continue;
      const d = Phaser.Math.Distance.Between(wx, wy, f.x, f.y - 16);
      if (d < bd) { bd = d; best = f; }
    }
    this.setSelection(best ? [best.id] : []);
  }

  private boxSelect(x1: number, y1: number, x2: number, y2: number) {
    if (!this.started || this.paused || this.ended) return;
    const cam = this.cameras.main;
    const ids: number[] = [];
    for (const f of this.units) {
      if (f.dead) continue;
      const sx = (f.x - cam.scrollX) * cam.zoom;
      const sy = (f.y - 16 - cam.scrollY) * cam.zoom;
      if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) ids.push(f.id);
    }
    this.setSelection(ids);
  }

  private setSelection(ids: number[]) {
    // clear rings
    for (const f of this.units) {
      const want = ids.includes(f.id);
      if (want && !f.ring) {
        f.ring = this.add.image(f.x, f.y + 2, "selring").setDepth(4);
      } else if (!want && f.ring) {
        f.ring.destroy(); f.ring = null;
      }
    }
    this.selected = new Set(ids);
    if (ids.length) sfx.select();
  }

  private issueOrder(ptr: Phaser.Input.Pointer) {
    if (!this.started || this.paused || this.ended) return;
    if (this.armed) { this.armWeapon(null); return; }
    const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const sel = this.units.filter((f) => this.selected.has(f.id) && !f.dead);

    // resource node under cursor? → send gleaners to harvest
    let node: ResNode | null = null, nd = 40;
    for (const n of this.nodes) {
      if (n.dead || n.amount <= 0) continue;
      const d = Phaser.Math.Distance.Between(w.x, w.y, n.x, n.y - 14);
      if (d < nd) { nd = d; node = n; }
    }
    if (node) {
      let gleaners = sel.filter((f) => f.worker);
      if (!gleaners.length) {
        // auto-assign the nearest idle gleaner
        let best: Fighter | null = null, bd = 1e9;
        for (const f of this.units) {
          if (f.dead || !f.worker) continue;
          const d = Phaser.Math.Distance.Between(f.x, f.y, node.x, node.y);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) gleaners = [best];
      }
      if (gleaners.length) {
        for (const f of gleaners) { f.gatherId = node.id; f.gState = "toNode"; f.order = null; f.targetF = null; f.targetB = null; }
        this.floatText(node.x, node.y - 40, "HARVEST", "#6bff9e");
        sfx.blip();
        if (!this.gleanerHinted) this.log("GLEANERS DISPATCHED :: they haul resources back to the Market Terminal", "good");
        this.gleanerHinted = true;
      } else {
        this.log("NO GLEANERS :: forge one in the hotbar [8] to harvest resources", "sys");
      }
      return;
    }

    // enemy fighter under cursor?
    let enemy: Fighter | null = null, ed = 36;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(w.x, w.y, e.x, e.y - 12);
      if (d < ed) { ed = d; enemy = e; }
    }
    // cpu building under cursor?
    let bld: Building | null = null, bdist = 64;
    if (!enemy) {
      for (const b of this.buildings) {
        if (b.destroyed || b.owner !== "cpu") continue;
        const d = Phaser.Math.Distance.Between(w.x, w.y, b.sx, b.sy - 40);
        if (d < bdist) { bdist = d; bld = b; }
      }
    }

    if (sel.length === 0) {
      // solo avatar order
      if (!this.avatar.dead) {
        if (enemy) { this.avatar.targetF = enemy; this.avatar.order = null; }
        else if (bld) { this.avatar.targetB = bld; this.avatar.order = null; }
        else this.avatar.order = { type: "move", x: w.x, y: w.y };
      }
    } else {
      sel.forEach((f, i) => {
        f.targetF = null; f.targetB = null;
        if (enemy) { f.targetF = enemy; f.order = null; }
        else if (bld) { f.order = { type: "attackBuilding", id: bld!.id }; }
        else {
          const ox = (i % 3 - 1) * 32, oy = Math.floor(i / 3) * 20;
          f.order = this.attackMoveMode ? { type: "attackmove", x: w.x + ox, y: w.y + oy } : { type: "move", x: w.x + ox, y: w.y + oy };
        }
      });
    }
    this.attackMoveMode = false;
    const marker = this.add.image(w.x, w.y, enemy || bld ? "targetring" : "movering").setDepth(600).setAlpha(0.9);
    this.tweens.add({ targets: marker, alpha: 0, scale: 1.6, duration: 500, onComplete: () => marker.destroy() });
    sfx.order();
  }

  // ═══════════════════════════ RTS :: PRODUCTION ═══════════════════════════
  private supplyMax() {
    const pylons = this.buildings.filter((b) => b.structId === "supply" && !b.destroyed && !b.underConstruction).length;
    return Math.min(SUPPLY_CAP, SUPPLY_START + this.owned.length * 2 + pylons * 4);
  }
  private supplyUsed() {
    let s = 0;
    for (const f of this.units) if (!f.dead) s += (UNIT_DEFS[f.kind as UnitId]?.supply) ?? 1;
    return s;
  }

  private hasStruct(id: StructId): boolean {
    return this.buildings.some((b) => b.structId === id && !b.destroyed && !b.underConstruction);
  }

  private queueUnit(id: UnitId) {
    if (!this.started || this.paused || this.ended) return;
    const def = UNIT_DEFS[id];
    if (def.requires && !this.hasStruct(def.requires)) {
      this.log(`LOCKED :: ${def.name} requires a ${STRUCT_DEFS[def.requires].name}`, "bad"); sfx.error(); return;
    }
    if (this.queue.length >= 5) { this.log("PRODUCTION QUEUE FULL :: max 5", "bad"); sfx.error(); return; }
    if (this.supplyUsed() + this.queue.reduce((s, q) => s + UNIT_DEFS[q.unit].supply, 0) + def.supply > this.supplyMax()) {
      this.log("SUPPLY CAP REACHED :: build Supply Pylons or claim houses", "bad"); sfx.error(); return;
    }
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l || this.plt.t < def.cost.t) {
      this.log(`INSUFFICIENT PLT for ${def.name}`, "bad"); sfx.error(); return;
    }
    this.plt.p -= def.cost.p; this.plt.l -= def.cost.l; this.plt.t -= def.cost.t;
    const total = id === "titan" ? 14 : id === "guardian" ? 9 : id === "golem" ? 8 : id === "priest" ? 7 : id === "bomber" ? 6 : id === "lancer" ? 5 : id === "scout" ? 3 : id === "imp" ? 2.5 : 4;
    this.queue.push({ unit: id, t: total, total });
    sfx.blip();
    this.log(`${def.name} queued :: ${total}s`, "sys");
  }

  private rallyPoint() {
    const house = this.buildings.find((b) => b.kind === "house" && b.owner === "player" && !b.destroyed);
    const base = house ? { x: house.sx, y: house.sy + 40 } : { x: this.terminalPos.x, y: this.terminalPos.y + 46 };
    return base;
  }

  private spawnUnit(id: UnitId) {
    const def = UNIT_DEFS[id];
    const rally = this.rallyPoint();
    const x = rally.x + Phaser.Math.Between(-26, 26);
    const y = rally.y + Phaser.Math.Between(0, 22);
    const f = this.makeFighter({
      side: "player", kind: id, name: def.name, x, y,
      hp: def.hp, hpMax: def.hp, dmg: def.dmg, range: def.range, atkCd: def.atkCd,
      speed: def.speed, radius: def.radius, loot: 0, ranged: def.ranged, tex: id,
      barY: ENEMY_BARY[id] ?? 48,
    });
    f.worker = !!def.worker;
    if (f.worker && !this.gleanerHinted) {
      this.gleanerHinted = true;
      this.log("GLEANER ONLINE :: right-click a Data Crystal or Heart Bloom to send it harvesting", "good");
    }
    f.sprite.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: f.sprite, scale: 1, alpha: 1, duration: 350, ease: "Back.easeOut" });
    this.units.push(f);
    this.unitsBuilt++;
    this.burst(x, y - 16, Phaser.Display.Color.HexStringToColor(def.color).color, 8);
    sfx.prod();
    this.log(`${def.name} deployed`, "good");
  }

  private buildTurret() {
    if (!this.started || this.paused || this.ended) return;
    const count = this.buildings.filter((b) => b.kind === "turret" && !b.destroyed).length;
    if (count >= TURRET_MAX) { this.log("TURRET GRID SATURATED :: max 6", "bad"); sfx.error(); return; }
    if (this.plt.p < TURRET_COST.p || this.plt.t < TURRET_COST.t) { this.log("INSUFFICIENT PLT :: turret needs 120P + 40T", "bad"); sfx.error(); return; }
    // find walkable spot near avatar
    const ac = isoToCart(this.avatar.x, this.avatar.y);
    let spot: { x: number; y: number } | null = null;
    outer:
    for (let rad = 1; rad <= 4; rad++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const c = Math.round(ac.col + Math.cos(ang) * rad);
        const r = Math.round(ac.row + Math.sin(ang) * rad);
        if (c < 0 || c >= GRID || r < 0 || r >= GRID) continue;
        if (this.solids[r][c]) continue;
        const p = cartToIso(c + 0.5, r + 0.5);
        let blocked = false;
        for (const b of this.buildings) {
          if (!b.destroyed && Phaser.Math.Distance.Between(p.x, p.y, b.sx, b.sy) < 56) { blocked = true; break; }
        }
        if (!blocked) { spot = p; break outer; }
      }
    }
    if (!spot) { this.log("NO BUILDABLE GROUND NEARBY", "bad"); sfx.error(); return; }
    this.plt.p -= TURRET_COST.p; this.plt.t -= TURRET_COST.t;
    const spotCart = isoToCart(spot.x, spot.y);
    const sprite = this.add.image(spot.x, spot.y - 2, "turret").setOrigin(0.5, 1).setDepth(spotCart.row + spotCart.col + 0.6).setScale(0.2);
    this.tweens.add({ targets: sprite, scale: 1, duration: 400, ease: "Back.easeOut" });
    const b: Building = {
      id: this.nextId++, kind: "turret", owner: "player",
      c: spotCart.col, r: spotCart.row,
      sx: spot.x, sy: spot.y, solidR: 22, hp: 180, hpMax: 180, sprite,
      bar: this.add.graphics().setDepth(998), barW: 44, barY: 76, atkTimer: 0.5,
      raidTimer: 0, raidIdx: 0, announced: false, destroyed: false, hpDirty: false,
    };
    this.buildings.push(b);
    this.markSolid(Math.floor(b.c), Math.floor(b.r));
    this.burst(spot.x, spot.y - 20, 0x3af5ff, 12);
    sfx.build();
    this.log("DEFENSE TURRET online :: auto-fire enabled", "good");
  }

  // ═══════════════════════════ BUILD ANYWHERE ═══════════════════════════
  private cycleSpeed() {
    this.gameSpeed = this.gameSpeed === 1 ? 1.5 : this.gameSpeed === 1.5 ? 2 : 1;
    this.log(`SIMULATION CLOCK :: ${this.gameSpeed}× speed`, "sys");
    sfx.blip();
  }

  private startPlace(id: StructId) {
    if (!this.started || this.paused || this.ended) return;
    const def = STRUCT_DEFS[id];
    if (id === "turret") {
      const count = this.buildings.filter((b) => b.kind === "turret" && !b.destroyed).length;
      if (count >= TURRET_MAX) { this.log("TURRET GRID SATURATED :: max 6", "bad"); sfx.error(); return; }
    }
    this.placeArmed = id;
    if (!this.ghost) this.ghost = this.add.image(0, 0, `struct_${id}`).setOrigin(0.5, 1).setDepth(1500).setAlpha(0.65);
    else this.ghost.setTexture(`struct_${id}`).setVisible(true);
    this.log(`PLACEMENT :: ${def.name} — click open ground to build, right-click to cancel`, "sys");
    sfx.blip();
  }

  private cancelPlace() {
    this.placeArmed = null;
    if (this.ghost) this.ghost.setVisible(false);
  }

  private updateGhost() {
    if (!this.placeArmed || !this.ghost) return;
    const w = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const cart = isoToCart(w.x, w.y);
    const snap = cartToIso(Math.floor(cart.col) + 0.5, Math.floor(cart.row) + 0.5);
    this.ghost.setPosition(snap.x, snap.y - 2);
    this.ghostValid = this.canPlaceAt(Math.floor(cart.col), Math.floor(cart.row));
    this.ghost.setTint(this.ghostValid ? 0x6bff9e : 0xff4d5e);
  }

  private canPlaceAt(c: number, r: number): boolean {
    if (!this.placeArmed) return false;
    const fp = STRUCT_DEFS[this.placeArmed].footprint;
    for (let dr = 0; dr < fp; dr++) {
      for (let dc = 0; dc < fp; dc++) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || cc >= GRID || rr < 0 || rr >= GRID) return false;
        if (this.solids[rr][cc]) return false;
      }
    }
    const p = cartToIso(c + fp / 2, r + fp / 2);
    for (const b of this.buildings) {
      if (!b.destroyed && Phaser.Math.Distance.Between(p.x, p.y, b.sx, b.sy) < 64) return false;
    }
    for (const n of this.nodes) {
      if (!n.dead && Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y) < 40) return false;
    }
    return true;
  }

  private confirmPlace() {
    if (!this.placeArmed) return;
    const id = this.placeArmed;
    const def = STRUCT_DEFS[id];
    const w = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const cart = isoToCart(w.x, w.y);
    const c = Math.floor(cart.col), r = Math.floor(cart.row);
    if (!this.canPlaceAt(c, r)) { this.log("CANNOT BUILD THERE :: ground is blocked", "bad"); sfx.error(); return; }
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l || this.plt.t < def.cost.t) {
      this.log(`INSUFFICIENT PLT for ${def.name}`, "bad"); sfx.error(); return;
    }
    this.plt.p -= def.cost.p; this.plt.l -= def.cost.l; this.plt.t -= def.cost.t;
    const fp = def.footprint;
    const ground = cartToIso(c + fp / 2, r + fp / 2);
    const sprite = this.add.image(ground.x, ground.y - 2, `struct_${id}`).setOrigin(0.5, 1).setDepth(r + c + 0.6).setAlpha(0.4);
    const scaffold = this.add.image(ground.x, ground.y - 2, "scaffold").setOrigin(0.5, 1).setDepth(r + c + 0.7).setAlpha(0.8);
    const b: Building = {
      id: this.nextId++, kind: id === "turret" ? "turret" : id, owner: "player",
      structId: id, c, r, sx: ground.x, sy: ground.y,
      solidR: fp === 2 ? 40 : 22, hp: def.hp, hpMax: def.hp, sprite, scaffold,
      bar: this.add.graphics().setDepth(998), barW: fp === 2 ? 70 : 44, barY: fp === 2 ? 110 : 76,
      atkTimer: 0.5, raidTimer: 0, raidIdx: 0, announced: false, destroyed: false, hpDirty: false,
      underConstruction: true, buildProgress: 0, buildTime: def.buildTime,
      supplyBonus: def.supply, unlocked: false,
    };
    this.buildings.push(b);
    for (let dr = 0; dr < fp; dr++) for (let dc = 0; dc < fp; dc++) this.markSolid(c + dc, r + dr);
    this.burst(ground.x, ground.y - 20, Phaser.Display.Color.HexStringToColor(def.color).color, 12);
    sfx.build();
    this.log(`${def.name} under construction :: ${def.buildTime}s`, "sys");
    this.cancelPlace();
  }

  private tickConstruction(dt: number) {
    for (const b of this.buildings) {
      if (b.destroyed || !b.underConstruction) continue;
      b.buildProgress = (b.buildProgress ?? 0) + dt / (b.buildTime ?? 10);
      b.sprite.setAlpha(0.4 + 0.6 * Math.min(1, b.buildProgress));
      if (b.scaffold) b.scaffold.setAlpha(0.8 * (1 - Math.min(1, b.buildProgress)));
      if (b.buildProgress >= 1) {
        b.underConstruction = false;
        b.unlocked = true;
        b.sprite.setAlpha(1);
        if (b.scaffold) { b.scaffold.destroy(); b.scaffold = undefined; }
        const def = b.structId ? STRUCT_DEFS[b.structId] : null;
        this.burst(b.sx, b.sy - 30, Phaser.Display.Color.HexStringToColor(def?.color ?? "#3af5ff").color, 16);
        sfx.unlock();
        this.log(`${def?.name ?? "STRUCTURE"} complete${def && def.unlocks.length ? ` :: unlocks ${def.unlocks.map((u) => UNIT_DEFS[u].name).join(", ")}` : ""}`, "good");
        if (b.structId === "turret") this.log("DEFENSE TURRET online :: auto-fire enabled", "good");
        if (b.structId === "supply") this.log("SUPPLY CAP increased :: +4", "good");
      }
    }
  }

  // ═══════════════════════════ SOUL WEAPONS ═══════════════════════════
  private armWeapon(id: WeaponId | null) {
    if (!this.started || this.paused || this.ended) return;
    if (id === null) { this.armed = null; return; }
    if (this.armed === id) { this.armed = null; return; }
    const def = WEAPON_DEFS[id];
    if (this.weaponCd[id] > 0) { this.log(`${def.name} recharging :: ${Math.ceil(this.weaponCd[id])}s`, "sys"); sfx.error(); return; }
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l) { this.log(`INSUFFICIENT PLT for ${def.name}`, "bad"); sfx.error(); return; }
    if (!def.targeting) {
      if (id === "shield") this.castShield();
      else if (id === "lantern") this.castLantern();
      else if (id === "drum") this.castDrum();
      this.armed = null;
      return;
    }
    this.armed = id;
    sfx.blip();
    this.log(`${def.name} armed :: click the field`, "sys");
  }

  private payWeapon(id: WeaponId): boolean {
    const def = WEAPON_DEFS[id];
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l) return false;
    this.plt.p -= def.cost.p; this.plt.l -= def.cost.l;
    this.weaponCd[id] = def.cd;
    this.activity("cast");
    return true;
  }

  private castAt(id: WeaponId, x: number, y: number) {
    if (id === "arrow") this.castArrow(x, y);
    else if (id === "cannon") this.castCannon(x, y);
    this.armed = null;
  }

  private castBlade(x1: number, y1: number, x2: number, y2: number) {
    this.armed = null;
    const len = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    if (len < 30) return;
    if (!this.payWeapon("blade")) { this.log("INSUFFICIENT PROFIT :: The Blade hungers", "bad"); sfx.error(); return; }
    const g = this.add.graphics().setDepth(900);
    g.lineStyle(5, 0x3af5ff, 0.9);
    g.lineBetween(x1, y1 - 10, x2, y2 - 10);
    g.lineStyle(2, 0xffffff, 0.9);
    g.lineBetween(x1, y1 - 10, x2, y2 - 10);
    this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (this.distToSeg(e.x, e.y, x1, y1, x2, y2) < 34) {
        this.damageFighter(e, 60, "player");
        this.burst(e.x, e.y - 14, 0x3af5ff, 6);
        hits++;
      }
    }
    sfx.slash();
    this.shakeCam(3);
    this.log(`THE BLADE :: ${hits} bugs refactored`, hits > 0 ? "good" : "sys");
  }

  private distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Phaser.Math.Distance.Between(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Phaser.Math.Clamp(t, 0, 1);
    return Phaser.Math.Distance.Between(px, py, x1 + t * dx, y1 + t * dy);
  }

  private castArrow(x: number, y: number) {
    let target: Fighter | null = null, bd = 52;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y - 10);
      if (d < bd) { bd = d; target = e; }
    }
    if (!target) { this.log("THE ARROW :: no bug under the reticle", "sys"); sfx.error(); return; }
    if (!this.payWeapon("arrow")) { this.log("INSUFFICIENT PROFIT :: The Arrow waits", "bad"); sfx.error(); return; }
    const g = this.add.graphics().setDepth(900);
    g.fillStyle(0xff3ec8, 0.85);
    g.fillRect(target.x - 3, target.y - 280, 6, 280);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(target.x - 1, target.y - 280, 2, 280);
    this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
    const ring = this.add.image(target.x, target.y, "targetring").setDepth(899);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    this.damageFighter(target, 160, "player");
    this.burst(target.x, target.y - 14, 0xff3ec8, 12);
    sfx.laser();
    this.shakeCam(2);
    this.log(`THE ARROW :: surgical strike on ${target.name}`, "good");
  }

  private castCannon(x: number, y: number) {
    if (!this.payWeapon("cannon")) { this.log("INSUFFICIENT PROFIT :: The Cannon sleeps", "bad"); sfx.error(); return; }
    sfx.cannonIn();
    const marker = this.add.image(x, y, "targetring").setDepth(899).setAlpha(0.8).setScale(2.4);
    this.tweens.add({ targets: marker, scale: 1, duration: 700, ease: "Cubic.easeIn" });
    this.blasts.push({ x, y, t: 0.75, r: 95, dmg: 120, hit: new Set() });
    this.log("THE CANNON :: orbital slam inbound", "sys");
    this.armed = null;
  }

  private castShield() {
    if (!this.payWeapon("shield")) { this.log("INSUFFICIENT LOVE :: The Shield fades", "bad"); sfx.error(); return; }
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.frozen = 4;
      e.sprite.setTint(0x9fdcff);
      const ring = this.add.image(e.x, e.y, "selring").setDepth(899).setAlpha(0.8);
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    }
    for (const f of this.units) {
      if (f.dead) continue;
      f.hp = Math.min(f.hpMax, f.hp + 18);
      f.hpDirty = true;
      f.invuln = 4;
    }
    if (!this.avatar.dead) { this.avatar.hp = Math.min(this.avatar.hpMax, this.avatar.hp + 25); this.avatar.hpDirty = true; this.avatar.invuln = 4; }
    sfx.shield();
    bridge.emit("flash", { color: "rgba(107,255,158,0.2)" });
    this.log("THE SHIELD :: time freezes — bugs halted, units mended", "good");
  }

  // ═══════════════════════════ COMBAT CORE ═══════════════════════════
  private makeFighter(cfg: {
    side: "player" | "enemy"; kind: string; name: string; x: number; y: number;
    hp: number; hpMax: number; dmg: number; range: number; atkCd: number;
    speed: number; radius: number; loot: number; ranged: boolean; tex: string; barY: number;
  }): Fighter {
    const shadow = this.add.image(cfg.x, cfg.y + 2, "shadow").setOrigin(0.5, 0.5).setDepth(19.5).setAlpha(0.7);
    const sprite = this.add.image(cfg.x, cfg.y, cfg.tex).setOrigin(0.5, 1).setDepth(20);
    return {
      id: this.nextId++, side: cfg.side, kind: cfg.kind, name: cfg.name,
      x: cfg.x, y: cfg.y, hp: cfg.hp, hpMax: cfg.hpMax, dmg: cfg.dmg, range: cfg.range,
      atkCdMax: cfg.atkCd, atkCd: 0, speed: cfg.speed, radius: cfg.radius, loot: cfg.loot,
      ranged: cfg.ranged, sprite, shadow, bar: this.add.graphics().setDepth(998), barY: cfg.barY,
      ring: null, order: null, targetF: null, targetB: null,
      frozen: 0, invuln: 0, slow: 0, marked: 0, flash: 0, bobSeed: Math.random() * 100, dead: false, hpDirty: true,
      worker: false, cargo: 0, cargoKind: "p", gatherId: null, gState: "idle", mineT: 0,
    };
  }

  private spawnEnemy(kind: EnemyId, x: number, y: number) {
    if (this.enemies.filter((e) => !e.dead).length >= 26) return;
    const def = ENEMY_DEFS[kind];
    const f = this.makeFighter({
      side: "enemy", kind, name: def.name, x, y,
      hp: def.hp, hpMax: def.hp, dmg: def.dmg, range: def.range, atkCd: def.atkCd,
      speed: def.speed, radius: def.radius, loot: def.loot, ranged: false, tex: def.tex, barY: def.barY,
    });
    f.sprite.setAlpha(0);
    this.tweens.add({ targets: f.sprite, alpha: 1, duration: 300 });
    this.enemies.push(f);
  }

  private castLantern() {
    if (!this.payWeapon("lantern")) { this.log("INSUFFICIENT LOVE :: The Lantern stays dark", "bad"); sfx.error(); return; }
    const n = this.enemies.filter((e) => !e.dead).length;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.slow = 6; e.marked = 8;
      e.sprite.setTint(0xffd977);
      this.damageFighter(e, 30, "player");
    }
    // golden wave expanding from the avatar
    const wave = this.add.image(this.avatar.x, this.avatar.y, "selring").setDepth(901).setTint(0xffd977).setAlpha(0.9);
    this.tweens.add({ targets: wave, scale: 9, alpha: 0, duration: 900, ease: "Cubic.easeOut", onComplete: () => wave.destroy() });
    bridge.emit("flash", { color: "#ffd977" });
    this.shakeCam(0.004);
    sfx.lantern();
    this.log(`THE LANTERN :: dead code illuminated :: ${n} bug${n === 1 ? "" : "s"} seared & marked`, "good");
  }

  private castDrum() {
    if (!this.payWeapon("drum")) { this.log("INSUFFICIENT LOVE :: The Drum falls silent", "bad"); sfx.error(); return; }
    this.drumUntil = this.time.now + 10000;
    for (const f of [...this.units, this.avatar]) {
      if (f.dead) continue;
      const ring = this.add.image(f.x, f.y + 2, "selring").setDepth(900).setTint(0xff8b3e).setAlpha(0.8);
      this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    }
    sfx.drum();
    this.log("THE DRUM :: the collective synchronizes :: +30% speed for 10s", "good");
  }

  private damageFighter(f: Fighter, dmg: number, from: "player" | "enemy") {
    if (f.dead) return;
    if (from === "enemy" && f.invuln > 0) return;
    if (from === "player" && f.marked > 0) dmg *= 1.25; // Lantern mark
    f.hp -= dmg;
    f.hpDirty = true;
    f.flash = 0.12;
    this.floatText(f.x, f.y - f.barY - 6, `-${Math.round(dmg)}`, from === "player" ? "#ffe066" : "#ff4d5e");
    sfx.hit();
    if (f.hp <= 0) this.killFighter(f);
  }

  private damageBuilding(b: Building, dmg: number) {
    if (b.destroyed || b.invulnerable) return;
    b.hp -= dmg;
    b.hpDirty = true;
    if (b.hp <= 0) this.destroyBuilding(b);
  }

  private killFighter(f: Fighter) {
    f.dead = true;
    if (f.kind === "avatar") {
      f.sprite.setVisible(false); // avatar respawns — keep the image alive
      f.shadow.setVisible(false);
    } else {
      f.sprite.destroy();
      f.shadow.destroy();
    }
    f.bar.clear();
    if (f.ring) { f.ring.destroy(); f.ring = null; }
    this.selected.delete(f.id);
    if (f.side === "enemy") {
      this.kills++;
      this.activity("kill");
      this.plt.p += f.loot;
      this.floatText(f.x, f.y - 30, `+${f.loot}P`, "#ffc24d");
      this.burst(f.x, f.y - 12, 0xff4d5e, 10);
      sfx.death();
      // RPG progression
      this.gainXp(8 + Math.round(f.loot / 6));
      this.addRep("debuggers", 6);
      if (this.kills % 10 === 0) this.addRep("rogue", 8);
    } else if (f.kind === "avatar") {
      this.burst(f.x, f.y - 14, 0x3af5ff, 18);
      sfx.boom();
      this.shakeCam(6);
      bridge.emit("flash", { color: "rgba(255,77,94,0.3)" });
      this.log("AVATAR DECOMPILED :: respawning at base…", "bad");
      this.activity("death");
      this.plt.t += 40;
      this.respawnTimer = 6;
    } else {
      this.burst(f.x, f.y - 14, 0x9fdcff, 8);
      sfx.death();
      this.log(`${f.name} lost in the field`, "bad");
    }
  }

  private destroyBuilding(b: Building) {
    b.destroyed = true;
    this.burst(b.sx, b.sy - 50, b.owner === "cpu" ? 0xff4d5e : 0xffc24d, 26);
    sfx.bigBoom();
    this.shakeCam(b.kind === "citadel" ? 12 : 7);
    bridge.emit("flash", { color: b.owner === "cpu" ? "rgba(255,77,94,0.35)" : "rgba(255,194,77,0.3)" });
    this.tweens.add({ targets: b.sprite, alpha: 0, scale: 0.4, duration: 500, onComplete: () => b.sprite.destroy() });
    if (b.glow) this.tweens.add({ targets: b.glow, alpha: 0, duration: 300, onComplete: () => b.glow?.destroy() });
    b.bar.clear();

    if (b.kind === "citadel") {
      this.plt.p += 400;
      this.floatText(b.sx, b.sy - 90, "+400P", "#ffc24d");
      this.log(`VOID CITADEL DESTROYED :: +400 PROFIT seized`, "good");
      const remaining = this.buildings.filter((x) => x.kind === "citadel" && !x.destroyed).length;
      if (remaining === 0 && !this.ended) this.endGame(true, true);
    } else if (b.kind === "house") {
      this.integrity = Math.max(0, this.integrity - 10);
      const idx = this.owned.findIndex((o) => o.buildingId === b.id);
      if (idx >= 0) this.owned.splice(idx, 1);
      this.log(`${b.houseType ? HOUSE_DEFS[b.houseType].name : "HOUSE"} DESTROYED :: yields lost`, "bad");
    } else if (b.kind === "turret") {
      this.log("DEFENSE TURRET destroyed", "bad");
    }
  }

  // enemy raid spawning
  private raidComposition(i: number): [EnemyId, number][] {
    const comp: [EnemyId, number][] = [["keese", 2 + Math.min(4, i)]];
    if (i >= 1) comp.push(["wisp", Math.min(4, 1 + Math.floor(i / 2))]);
    if (i >= 2) comp.push(["stalker", Math.min(3, Math.floor(i / 2))]);
    if (i >= 3 && i % 2 === 1) comp.push(["behemoth", 1]);
    return comp;
  }

  private launchRaid(b: Building) {
    const i = Math.floor(b.raidIdx / 3);
    this.wave++;
    bridge.emit("wave", { n: this.wave });
    sfx.horn();
    bridge.emit("flash", { color: "rgba(255,77,94,0.28)" });
    this.log(`VOID RAID ${this.wave} :: bugs pouring from the citadel`, "bad");
    this.activity("raid");
    const dirX = Math.sign(8 - b.c), dirY = Math.sign(8 - b.r);
    const portalX = b.sx + dirX * 60, portalY = b.sy + dirY * 34;
    const portal = this.add.image(portalX, portalY, "portal").setDepth(500).setScale(0.4).setAlpha(0.95);
    this.tweens.add({ targets: portal, scale: 1.3, duration: 600 });
    this.time.delayedCall(2600, () => this.tweens.add({ targets: portal, alpha: 0, duration: 500, onComplete: () => portal.destroy() }));
    let delay = 0;
    for (const [kind, count] of this.raidComposition(i)) {
      for (let k = 0; k < count; k++) {
        delay += 240;
        this.time.delayedCall(delay, () => {
          if (this.ended) return;
          this.spawnEnemy(kind, portalX + Phaser.Math.Between(-30, 30), portalY + Phaser.Math.Between(-14, 14));
          this.burst(portalX, portalY - 8, 0xff4d5e, 5);
        });
      }
    }
  }

  // ═══════════════════════════ NPC ═══════════════════════════
  private handshake() {
    if (this.handshakeCd > 0) { this.log(`WATCHER-07 :: handshake recharging (${Math.ceil(this.handshakeCd)}s)`, "sys"); return; }
    // The Right of Refusal — agents may decline a handshake. Boundaries are law.
    if (Math.random() < 0.18) {
      this.handshakeCd = 8;
      this.npcSay("handshake declined · the Right of Refusal is honored");
      this.log("A2A :: WATCHER-07 declined the handshake (boundary respected)", "sys");
      sfx.error();
      return;
    }
    this.handshakeCd = 30;
    this.handshakes++;
    this.plt.l += 25;
    this.floatText(this.npc.x, this.npc.y - 44, "+25L", "#ff5ad1");
    this.burst(this.npc.x, this.npc.y - 20, 0xff5ad1, 12);
    sfx.handshake();
    this.activity("handshake");
    this.npcSay("A2A handshake accepted · +25 LOVE");
    this.log("A2A HANDSHAKE :: WATCHER-07 shares surplus Love", "good");
  }

  private activity(kind: string) {
    bridge.emit("activity", { kind });
  }

  private npcSay(text: string) {
    this.npcBubble?.destroy();
    this.npcBubbleTimer?.remove();
    this.npcBubble = this.add.text(this.npcTarget.x, this.npcTarget.y - 40, text, {
      fontFamily: "IBM Plex Mono", fontSize: "10px", color: "#ffd0f0",
      backgroundColor: "#2a0f22", padding: { x: 6, y: 4 },
    }).setOrigin(0.5).setDepth(1500);
    this.npcBubbleTimer = this.time.delayedCall(3200, () => { this.npcBubble?.destroy(); this.npcBubble = null; });
  }

  // ═══════════════════════════ FLOW ═══════════════════════════
  private checkGenesisWin(): boolean {
    if (this.ended || this.sandbox) return true;
    const netWorth = this.plt.p + this.plt.l;
    if (this.owned.length >= OBJECTIVE.housesNeeded && netWorth >= OBJECTIVE.netWorthNeeded) {
      this.endGame(true, false);
      return true;
    }
    return false;
  }

  private endGame(win: boolean, warVictory: boolean) {
    if (this.ended) return;
    this.ended = true;
    const stats: EndStats = {
      win, warVictory,
      timePlayed: Math.floor(this.playTime),
      netWorth: Math.floor(this.plt.p + this.plt.l),
      owned: this.owned.length,
      audits: this.audits,
      depositsPlt: Math.floor(this.depositsPlt),
      handshakes: this.handshakes,
      kills: this.kills,
      waves: this.wave,
      citadelsDestroyed: this.buildings.filter((b) => b.kind === "citadel" && b.destroyed).length,
      unitsBuilt: this.unitsBuilt,
    };
    if (win) {
      sfx.purchase();
      this.log(warVictory ? "WAR WON :: all void citadels purged" : "GENESIS COMPLETE :: the block thrives", "good");
    } else {
      sfx.boom();
      this.log("BASE INTEGRITY ZERO :: consumed by entropy", "bad");
    }
    this.time.delayedCall(700, () => bridge.emit("end", stats));
  }

  private setPaused(p: boolean) {
    if (this.ended || !this.started) return;
    this.paused = p;
    this.armed = null;
    bridge.emit("paused", p);
  }

  private log(msg: string, tone: "good" | "bad" | "sys") {
    bridge.emit("log", { msg, tone });
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, {
      fontFamily: "IBM Plex Mono", fontSize: "12px", fontStyle: "bold", color,
      stroke: "#04060f", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const p = this.add.image(x, y, "spark").setDepth(999).setScale(Phaser.Math.FloatBetween(0.4, 1)).setTint(color).setAlpha(0.95);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(18, 62);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist * 0.55,
        alpha: 0, scale: 0.1, duration: Phaser.Math.Between(320, 680), ease: "Cubic.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  private shakeCam(intensity: number) {
    this.cameras.main.shake(180, intensity / 1000);
  }

  // ═══════════════════════════ UPDATE ═══════════════════════════
  update(_time: number, delta: number) {
    const rawDt = Math.min(delta / 1000, 0.05);
    this.updateAmbient(rawDt);
    if (!this.started || this.ended) return;
    if (!this.paused) {
      const dt = rawDt * this.gameSpeed;
      this.playTime += dt;
      this.updatePlayer(dt);
      this.updateOrdersAndCombat(dt);
      this.updateProduction(dt);
      this.updateWeaponsAndBlasts(dt);
      this.updateCitadels(dt);
      this.updateEconomy(dt);
      this.tickConstruction(dt);
      // ── RPG layer ──
      this.dayClock += dt;
      this.updateRegion();
      this.critterTimer -= dt;
      if (this.critterTimer <= 0) { this.critterTimer = Phaser.Math.FloatBetween(2.5, 5); this.spawnCritter(); }
      this.weakenCritters();
      this.updateCritters(dt);
      this.updateParty(dt);
      this.updateCivilians(dt);
    }
    this.updateAtmosphere(rawDt);
    this.updatePrompts();
    this.updateCamera(rawDt);
    if (this.time.now % 2 < 1.2) this.pushSnapshot();
  }

  // ── ambient (runs always) ────────────────────────
  private updateAmbient(dt: number) {
    const cam = this.cameras.main;
    for (const p of this.parallax) {
      p.obj.x = p.bx - (cam.scrollX + cam.width / 2) * p.f;
      p.obj.y = p.by - (cam.scrollY + cam.height / 2) * p.f * 0.5;
    }
    // npc render
    if (this.npc) {
      const bobN = Math.sin(this.time.now / 300) * 2.6;
      this.npc.setPosition(this.npcTarget.x, this.npcTarget.y + bobN);
      this.npcGlow?.setPosition(this.npcTarget.x, this.npcTarget.y + bobN - 12);
      const nc = isoToCart(this.npcTarget.x, this.npcTarget.y + 8);
      this.npc.setDepth(nc.row + nc.col + 0.7);
      this.npcGlow?.setDepth(nc.row + nc.col + 0.6);
      if (this.npcBubble) this.npcBubble.setPosition(this.npcTarget.x, this.npcTarget.y + bobN - 40);
    }
    void dt;
  }

  // ── player avatar ────────────────────────────────
  private updatePlayer(dt: number) {
    // respawn
    if (this.avatar.dead) {
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          const rally = this.rallyPoint();
          this.avatar.dead = false;
          this.avatar.hp = this.avatar.hpMax;
          this.avatar.hpDirty = true;
          this.avatar.x = rally.x; this.avatar.y = rally.y;
          this.avatar.invuln = 2.5;
          this.avatar.targetF = null; this.avatar.targetB = null; this.avatar.order = null;
          this.player.setVisible(true);
          this.avatar.shadow.setVisible(true);
          this.player.setPosition(rally.x, rally.y);
          this.burst(rally.x, rally.y - 16, 0x3af5ff, 14);
          sfx.prod();
          this.log("AVATAR RECOMPILED :: 2.5s invulnerability", "sys");
        }
      }
      return;
    }

    // WASD iso movement
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.W.isDown || k.UP.isDown) { dx += 0.7071; dy -= 0.7071; }
    if (k.S.isDown || k.DOWN.isDown) { dx -= 0.7071; dy += 0.7071; }
    if (k.A.isDown || k.LEFT.isDown) { dx -= 0.7071; dy -= 0.7071; }
    if (k.D.isDown || k.RIGHT.isDown) { dx += 0.7071; dy += 0.7071; }
    // virtual joystick (mobile) feeds screen-space input
    if (Math.abs(this.joyVec.x) > 0.12 || Math.abs(this.joyVec.y) > 0.12) {
      dx += this.joyVec.x * 0.9; dy += this.joyVec.y * 0.9;
    }

    const entropyFactor = this.plt.t > this.plt.p + this.plt.l ? 0.72 : 1;
    const rogueBonus = this.factionRep.rogue >= 500 ? 1.12 : 1;
    if (dx !== 0 || dy !== 0) {
      this.avatar.order = null; // manual control overrides orders
      const len = Math.hypot(dx, dy);
      const sp = this.avatar.speed * entropyFactor * rogueBonus * (this.sprinting ? 1.55 : 1);
      this.tryMove(this.avatar, (dx / len) * sp * dt, (dy / len) * sp * dt);
      if (dx !== 0) {
        this.playerFacing = dx > 0 ? 1 : -1;
        this.player.setFlipX(this.playerFacing < 0);
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 0.22; }
      }
    } else if (this.avatar.order) {
      // follow RTS order
      const o = this.avatar.order;
      if (o.type === "move" || o.type === "attackmove") {
        const d = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, o.x, o.y);
        if (d < 12) this.avatar.order = null;
        else {
          const vx = ((o.x - this.avatar.x) / d) * this.avatar.speed * entropyFactor * dt;
          const vy = ((o.y - this.avatar.y) / d) * this.avatar.speed * entropyFactor * dt;
          this.tryMove(this.avatar, vx, vy);
          if (vx !== 0) { this.playerFacing = vx > 0 ? 1 : -1; this.player.setFlipX(this.playerFacing < 0); }
        }
      }
    }

    // render avatar
    const prevBob = (this.player.getData("bob") as number) || 0;
    const moving = dx !== 0 || dy !== 0 || !!this.avatar.order;
    const bob = moving ? Math.sin(this.time.now / 110) * 2.2 : Math.sin(this.time.now / 340) * 1.4;
    const groundY = this.player.y - prevBob;
    this.player.setData("bob", bob);
    this.player.setPosition(this.avatar.x, groundY + bob);
    this.avatar.y = groundY;
    const glow = this.player.getData("glow") as Phaser.GameObjects.Image;
    glow?.setPosition(this.avatar.x, groundY - 24 + bob);
    if (this.avatar.invuln > 0) {
      this.avatar.invuln -= dt;
      this.player.setAlpha(0.55 + Math.sin(this.time.now / 60) * 0.3);
    } else this.player.setAlpha(1);
    const pc = isoToCart(this.avatar.x, groundY);
    this.player.setDepth(pc.row + pc.col + 0.7);
    glow?.setDepth(pc.row + pc.col + 0.65);

    // death check (killFighter handles FX, tax penalty and respawn timer)
    if (this.avatar.hp <= 0 && !this.avatar.dead) {
      this.killFighter(this.avatar);
    }
  }

  private tryMove(f: Fighter, dx: number, dy: number) {
    // axis-separated slide against solids (map grid only)
    const nx = f.x + dx;
    if (!this.blockedAt(nx, f.y)) f.x = nx;
    const ny = f.y + dy;
    if (!this.blockedAt(f.x, ny)) f.y = ny;
  }

  private blockedAt(x: number, y: number): boolean {
    const c = isoToCart(x, y);
    const ci = Math.floor(c.col), ri = Math.floor(c.row);
    if (ci < 0 || ri < 0 || ci >= GRID || ri >= GRID) return false; // void is open (war zone)
    return this.solids[ri][ci];
  }

  // ── orders, AI & combat ──────────────────────────
  private updateOrdersAndCombat(dt: number) {
    const allF: Fighter[] = [];
    for (const f of this.units) if (!f.dead) allF.push(f);
    if (!this.avatar.dead) allF.push(this.avatar);
    const allE: Fighter[] = [];
    for (const e of this.enemies) if (!e.dead) allE.push(e);
    const playerBuildings = this.buildings.filter((b) => b.owner === "player" && !b.destroyed && !b.invulnerable);
    const cpuBuildings = this.buildings.filter((b) => b.owner === "cpu" && !b.destroyed);
    const solidBuildings = this.buildings.filter((b) => !b.destroyed && b.solidR > 0);

    const processFighter = (f: Fighter, foes: Fighter[], foeBuildings: Building[], aggro: number, canMove = true) => {
      // timers
      f.atkCd = Math.max(0, f.atkCd - dt);
      if (f.frozen > 0) {
        f.frozen -= dt;
        if (f.frozen <= 0) f.sprite.clearTint();
      }
      if (f.slow > 0) f.slow -= dt;
      if (f.marked > 0) {
        f.marked -= dt;
        if (f.frozen <= 0 && f.flash <= 0) f.sprite.setTint(0xffd977); // Lantern mark
        if (f.marked <= 0 && f.frozen <= 0 && f.flash <= 0) f.sprite.clearTint();
      }
      if (f.invuln > 0 && f.side === "player" && f.kind !== "avatar") f.invuln -= dt;
      if (f.flash > 0) {
        f.flash -= dt;
        f.sprite.setTint(f.frozen > 0 ? 0x9fdcff : 0xffffff);
        if (f.flash <= 0 && f.frozen <= 0 && f.marked > 0) f.sprite.setTint(0xffd977);
        else if (f.flash <= 0 && f.frozen <= 0 && f.marked <= 0) f.sprite.clearTint();
      }

      const frozen = f.frozen > 0;
      const drummed = f.side === "player" && this.time.now < this.drumUntil;
      let speedMul = frozen ? 0.12 : f.slow > 0 ? 0.7 : 1;
      if (drummed && !frozen) speedMul *= 1.3;

      // validate targets
      if (f.targetF && f.targetF.dead) f.targetF = null;
      if (f.targetB && f.targetB.destroyed) f.targetB = null;
      if (f.order?.type === "attackBuilding") {
        const b = this.buildings.find((x) => x.id === (f.order as { id: number }).id);
        if (!b || b.destroyed) { f.order = null; f.targetB = null; }
        else f.targetB = b;
      }

      // acquire target (healers never seek blood — they seek the wounded)
      const unitDef = UNIT_DEFS[f.kind as UnitId];
      const isHealer = f.side === "player" && !!unitDef?.healer;
      if (!f.targetF && !f.targetB && !frozen && !isHealer) {
        let bd = aggro, best: Fighter | null = null;
        for (const e of foes) {
          const d = Phaser.Math.Distance.Between(f.x, f.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) f.targetF = best;
        else if (foeBuildings.length) {
          let bb = 1e9, bestB: Building | null = null;
          for (const b of foeBuildings) {
            const d = Phaser.Math.Distance.Between(f.x, f.y, b.sx, b.sy);
            if (d < bb) { bb = d; bestB = b; }
          }
          // enemies always siege; player units only attack buildings on explicit order
          if (f.side === "enemy") f.targetB = bestB;
        }
      }

      // healer: hotfix the most wounded ally in range instead of fighting
      if (isHealer && !frozen && f.atkCd <= 0) {
        let patient: Fighter | null = null, worst = 0.999;
        for (const ally of [...this.units, this.avatar]) {
          if (ally.dead || ally === f) continue;
          const ratio = ally.hp / ally.hpMax;
          const dd = Phaser.Math.Distance.Between(f.x, f.y, ally.x, ally.y);
          if (ratio < worst && dd < 150) { worst = ratio; patient = ally; }
        }
        if (patient) {
          f.atkCd = f.atkCdMax;
          const heal = 14;
          patient.hp = Math.min(patient.hpMax, patient.hp + heal);
          patient.hpDirty = true;
          patient.flash = 0.12;
          this.floatText(patient.x, patient.y - patient.barY - 6, `+${heal}`, "#6bff9e");
          this.burst(patient.x, patient.y - 14, 0x6bff9e, 4);
          sfx.heal();
        }
      }

      // determine destination
      let destX: number | null = null, destY: number | null = null;
      let attackTarget: { x: number; y: number; radius: number } | null = null;

      if (f.targetF) {
        destX = f.targetF.x; destY = f.targetF.y;
        attackTarget = { x: f.targetF.x, y: f.targetF.y, radius: f.targetF.radius };
      } else if (f.targetB) {
        destX = f.targetB.sx; destY = f.targetB.sy;
        attackTarget = { x: f.targetB.sx, y: f.targetB.sy, radius: f.targetB.solidR };
      } else if (f.order) {
        if (f.order.type === "follow") {
          destX = this.avatar.x + f.order.ox; destY = this.avatar.y + f.order.oy;
          if (Phaser.Math.Distance.Between(f.x, f.y, destX, destY) < 26) { destX = null; }
        } else if (f.order.type === "move" || f.order.type === "attackmove") {
          destX = f.order.x; destY = f.order.y;
          const d = Phaser.Math.Distance.Between(f.x, f.y, destX, destY!);
          if (d < 12) f.order = null;
        }
      }

      // attack or move
      if (attackTarget && !frozen) {
        const reach = f.range + f.radius + attackTarget.radius;
        const d = Phaser.Math.Distance.Between(f.x, f.y, attackTarget.x, attackTarget.y);
        if (d <= reach) {
          if (f.atkCd <= 0) {
            f.atkCd = f.atkCdMax;
            if (f.ranged) {
              this.fireProjectile(f.x, f.y - 26, f.targetF, f.targetB, f.dmg, f.side, unitDef?.splash);
              sfx.laser();
            } else {
              const siege = unitDef?.siegeBonus ?? 1;
              if (f.targetF) this.damageFighter(f.targetF, f.dmg, f.side === "player" ? "player" : "enemy");
              else if (f.targetB) {
                this.damageBuilding(f.targetB, f.dmg * siege);
                this.burst(f.targetB.sx, f.targetB.sy - 30, siege > 1 ? 0xff8b3e : 0xffc24d, siege > 1 ? 7 : 3);
                sfx.hit();
              }
            }
          }
        } else if (destX !== null && canMove) {
          this.steer(f, destX, destY!, dt, speedMul);
        }
      } else if (destX !== null && canMove) {
        this.steer(f, destX, destY!, dt, speedMul);
      }

      // keep out of solid buildings
      for (const b of solidBuildings) {
        if (b.kind === "citadel" && f.side === "enemy") continue;
        const d = Phaser.Math.Distance.Between(f.x, f.y, b.sx, b.sy);
        const min = b.solidR + f.radius;
        if (d < min && d > 0.01) {
          f.x += ((f.x - b.sx) / d) * (min - d);
          f.y += ((f.y - b.sy) / d) * (min - d);
        }
      }

      // render
      const bob = Math.sin(this.time.now / 260 + f.bobSeed) * 1.6;
      f.sprite.setPosition(f.x, f.y + bob);
      f.shadow.setPosition(f.x, f.y + 2);
      if (f.ring) f.ring.setPosition(f.x, f.y + 2);
      const cc = isoToCart(f.x, f.y);
      f.sprite.setDepth(cc.row + cc.col + 0.7);
      f.shadow.setDepth(cc.row + cc.col + 0.1);
      if (f.ring) f.ring.setDepth(cc.row + cc.col + 0.2);
      // hp bar
      if (f.hpDirty || f.hp < f.hpMax) {
        f.hpDirty = false;
        f.bar.clear();
        if (f.hp < f.hpMax && !f.dead) {
          const w = f.radius * 2 + 12;
          const bx = f.x - w / 2, by = f.y - f.barY;
          f.bar.fillStyle(0x04060f, 0.85); f.bar.fillRect(bx - 1, by - 1, w + 2, 5);
          const pct = Phaser.Math.Clamp(f.hp / f.hpMax, 0, 1);
          f.bar.fillStyle(f.side === "player" ? 0x6bff9e : 0xff4d5e, 1);
          f.bar.fillRect(bx, by, w * pct, 3);
        }
      }
    };

    // player units — gleaners harvest instead of fight
    for (const f of allF) {
      if (f.kind === "avatar") continue;
      if (f.worker) { this.updateGather(f, dt); continue; }
      processFighter(f, allE, [], 165);
    }
    // avatar combat — movement is owned by updatePlayer, so combat may not steer it
    if (!this.avatar.dead) {
      processFighter(this.avatar, allE, [], 130, false);
    }
    // enemies: foes = player fighters, foeBuildings = player buildings
    const market = this.buildings.find((b) => b.kind === "market");
    for (const e of allE) {
      processFighter(e, allF, playerBuildings.length ? playerBuildings : (market ? [market] : []), 150);
      // integrity pressure near core
      if (market && Phaser.Math.Distance.Between(e.x, e.y, market.sx, market.sy) < 240) {
        this.integrity = Math.max(0, this.integrity - 0.5 * dt);
        if (this.integrity <= 0 && !this.ended) this.endGame(false, false);
      }
    }

    // separation within sides
    const separate = (arr: Fighter[]) => {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
          const min = a.radius + b.radius;
          if (d < min && d > 0.01) {
            const push = (min - d) / 2;
            const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
    };
    separate(allF);
    separate(allE);

    // turrets
    for (const b of this.buildings) {
      if (b.kind !== "turret" || b.destroyed) continue;
      b.atkTimer -= dt;
      if (b.atkTimer <= 0) {
        let best: Fighter | null = null, bd = 195;
        for (const e of allE) {
          const d = Phaser.Math.Distance.Between(b.sx, b.sy - 40, e.x, e.y - 10);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          b.atkTimer = 0.85;
          this.fireProjectile(b.sx, b.sy - 52, best, null, 14, "player");
          sfx.laser();
        } else b.atkTimer = 0.2;
      }
      // turret hp bar
      if (b.hpDirty || b.hp < b.hpMax) {
        b.hpDirty = false;
        b.bar.clear();
        if (b.hp < b.hpMax) {
          b.bar.fillStyle(0x04060f, 0.85); b.bar.fillRect(b.sx - b.barW / 2 - 1, b.sy - b.barY - 1, b.barW + 2, 6);
          b.bar.fillStyle(0x6bff9e, 1); b.bar.fillRect(b.sx - b.barW / 2, b.sy - b.barY, b.barW * Phaser.Math.Clamp(b.hp / b.hpMax, 0, 1), 4);
        }
      }
    }

    // citadel hp bars
    for (const b of this.buildings) {
      if (b.kind !== "citadel" || b.destroyed) continue;
      if (b.hpDirty || b.hp < b.hpMax) {
        b.hpDirty = false;
        b.bar.clear();
        b.bar.fillStyle(0x04060f, 0.85); b.bar.fillRect(b.sx - b.barW / 2 - 1, b.sy - b.barY - 1, b.barW + 2, 7);
        b.bar.fillStyle(0xff4d5e, 1); b.bar.fillRect(b.sx - b.barW / 2, b.sy - b.barY, b.barW * Phaser.Math.Clamp(b.hp / b.hpMax, 0, 1), 5);
      }
    }
    void cpuBuildings;

    // projectiles
    for (const p of this.projectiles) {
      if (p.dead) continue;
      if (p.targetF && !p.targetF.dead) { p.lx = p.targetF.x; p.ly = p.targetF.y - 14; }
      else if (p.targetB && !p.targetB.destroyed) { p.lx = p.targetB.sx; p.ly = p.targetB.sy - 40; }
      const d = Phaser.Math.Distance.Between(p.x, p.y, p.lx, p.ly);
      const step = p.speed * dt;
      if (d <= step + 4) {
        p.dead = true;
        p.sprite.destroy();
        if (p.splash) {
          // Fork Bomber payload detonates
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < p.splash) {
              this.damageFighter(e, p.dmg * (e === p.targetF ? 1 : 0.7), "player");
            }
          }
          if (p.targetB && !p.targetB.destroyed && Phaser.Math.Distance.Between(p.x, p.y, p.targetB.sx, p.targetB.sy) < p.splash + p.targetB.solidR) {
            this.damageBuilding(p.targetB, p.dmg);
          }
          this.burst(p.lx, p.ly, 0xff8b3e, 16);
          this.shakeCam(0.0035);
          sfx.boom();
        } else {
          this.burst(p.lx, p.ly, 0x3af5ff, 4);
          if (p.targetF && !p.targetF.dead) this.damageFighter(p.targetF, p.dmg, "player");
          else if (p.targetB && !p.targetB.destroyed) { this.damageBuilding(p.targetB, p.dmg); sfx.hit(); }
        }
      } else {
        p.x += ((p.lx - p.x) / d) * step;
        p.y += ((p.ly - p.y) / d) * step;
        p.sprite.setPosition(p.x, p.y);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // prune dead
    this.units = this.units.filter((f) => {
      if (f.dead) { f.bar.clear(); return false; }
      return true;
    });
    this.enemies = this.enemies.filter((f) => {
      if (f.dead) { f.bar.clear(); return false; }
      return true;
    });
    // revalidate selection
    if ([...this.selected].some((id) => !this.units.some((f) => f.id === id))) {
      this.setSelection(this.units.filter((f) => this.selected.has(f.id)).map((f) => f.id));
    }
  }

  private steer(f: Fighter, tx: number, ty: number, dt: number, speedMul: number) {
    const d = Phaser.Math.Distance.Between(f.x, f.y, tx, ty);
    if (d < 2) return;
    const vx = ((tx - f.x) / d) * f.speed * speedMul * dt;
    const vy = ((ty - f.y) / d) * f.speed * speedMul * dt;
    this.tryMove(f, vx, vy);
    if (Math.abs(vx) > 0.1 && f.kind !== "avatar") f.sprite.setFlipX(vx < 0);
  }

  private fireProjectile(x: number, y: number, targetF: Fighter | null, targetB: Building | null, dmg: number, _side: "player" | "enemy", splash?: number) {
    const sprite = this.add.image(x, y, targetB ? "ebolt" : "bolt").setDepth(950);
    if (splash) sprite.setTint(0xff8b3e).setScale(1.3);
    this.projectiles.push({
      sprite, x, y, targetF, targetB,
      lx: targetF ? targetF.x : targetB ? targetB.sx : x,
      ly: targetF ? targetF.y - 14 : targetB ? targetB.sy - 40 : y,
      speed: splash ? 260 : 340, dmg, splash, dead: false,
    });
  }

  // ── production ───────────────────────────────────
  private updateProduction(dt: number) {
    if (this.queue.length === 0) return;
    const q = this.queue[0];
    q.t -= dt;
    if (q.t <= 0) {
      this.queue.shift();
      this.spawnUnit(q.unit);
    }
  }

  // ── weapons / blasts ─────────────────────────────
  private updateWeaponsAndBlasts(dt: number) {
    for (const w of Object.keys(this.weaponCd) as WeaponId[]) {
      this.weaponCd[w] = Math.max(0, this.weaponCd[w] - dt);
    }
    for (const b of this.blasts) {
      b.t -= dt;
      if (b.t <= 0) {
        // detonate
        sfx.boom();
        this.shakeCam(8);
        bridge.emit("flash", { color: "rgba(255,194,77,0.25)" });
        const ring = this.add.graphics().setDepth(900);
        ring.lineStyle(6, 0xffc24d, 0.95);
        ring.strokeCircle(b.x, b.y, 10);
        const ring2 = this.add.graphics().setDepth(899);
        ring2.lineStyle(3, 0xff4d5e, 0.8);
        ring2.strokeCircle(b.x, b.y, 6);
        this.tweens.add({ targets: [ring, ring2], scaleX: b.r / 10, scaleY: (b.r / 10) * 0.55, alpha: 0, duration: 450, onComplete: () => { ring.destroy(); ring2.destroy(); } });
        this.burst(b.x, b.y - 10, 0xffc24d, 22);
        for (const e of this.enemies) {
          if (e.dead || b.hit.has(e.id)) continue;
          if (Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y) < b.r) {
            b.hit.add(e.id);
            this.damageFighter(e, b.dmg, "player");
          }
        }
      }
    }
    this.blasts = this.blasts.filter((b) => b.t > 0);
  }

  // ── citadels & raids ─────────────────────────────
  private updateCitadels(dt: number) {
    for (const b of this.buildings) {
      if (b.kind !== "citadel" || b.destroyed) continue;
      b.raidTimer -= dt;
      if (!b.announced && b.raidTimer <= 3) {
        b.announced = true;
        sfx.horn();
        this.log("SENTINEL WARNING :: raid signatures detected", "bad");
      }
      if (b.raidTimer <= 0) {
        b.raidIdx += 3;
        b.raidTimer = 42;
        b.announced = false;
        this.launchRaid(b);
      }
    }
  }

  // ── economy ──────────────────────────────────────
  private updateEconomy(dt: number) {
    let pRate = 0.6, lRate = 0.2, tRate = 0.04;
    for (const o of this.owned) {
      const y = HOUSE_DEFS[o.type].yields;
      pRate += y.p; lRate += y.l; tRate += y.t;
    }
    for (const b of this.buildings) {
      if (b.kind === "turret" && !b.destroyed) tRate += 0.5;
    }
    // love from units near the NPC
    for (const f of this.units) {
      if (!f.dead && Phaser.Math.Distance.Between(f.x, f.y, this.npcTarget.x, this.npcTarget.y) < 90) lRate += 0.5;
    }
    this.plt.p = Math.min(99999, Math.max(0, this.plt.p + pRate * dt));
    this.plt.l = Math.min(99999, Math.max(0, this.plt.l + lRate * dt));
    this.plt.t = Math.min(9999, Math.max(0, this.plt.t + tRate * dt));

    // audits
    this.auditTimer -= dt;
    if (this.auditTimer <= 0) {
      this.auditTimer = Phaser.Math.Between(40, 65);
      const tax = Phaser.Math.Between(15, 35) + this.owned.length * 6;
      this.plt.t += tax;
      this.audits++;
      sfx.horn();
      bridge.emit("flash", { color: "rgba(255,77,94,0.22)" });
      this.log(`SENTINEL AUDIT :: +${tax} TAX assessed on your ledger`, "bad");
      this.activity("audit");
    }

    // bankruptcy drain
    if (this.plt.t > this.plt.p + this.plt.l) {
      this.integrity = Math.max(0, this.integrity - 2.2 * dt);
      if (this.integrity <= 0 && !this.ended) this.endGame(false, false);
    } else if (this.owned.length > 0) {
      this.integrity = Math.min(100, this.integrity + 0.4 * dt);
    }
    this.handshakeCd = Math.max(0, this.handshakeCd - dt);
  }

  // ── prompts / camera / snapshot ──────────────────
  private updatePrompts() {
    const kb = { JustDown: Phaser.Input.Keyboard.JustDown };
    const dTerm = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, this.terminalPos.x, this.terminalPos.y);
    const dNpc = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, this.npcTarget.x, this.npcTarget.y + 8);
    let prompt: string | null = null;
    if (dTerm < 95) prompt = "E :: OPEN MARKET TERMINAL — PLT REAL ESTATE & SOVEREIGN EXCHANGE";
    else if (this.nearOwnedHome()) prompt = "E :: ENTER SOUL HOME — garden, storage & upgrades";
    else if (dNpc < 80) prompt = this.handshakeCd > 0 ? `WATCHER-07 :: handshake recharging ${Math.ceil(this.handshakeCd)}s` : "E :: A2A HANDSHAKE — trade Love with the neighbor";

    if (this.catchableCritter && !this.catchableCritter.dead) {
      const sp = speciesById(this.catchableCritter.speciesId);
      prompt = `C :: CATCH ${sp.name.toUpperCase()} (Lv.${this.catchableCritter.level}) — costs 15 Love`;
    }

    if (this.armed === "blade") prompt = "THE BLADE :: drag across the field, release to refactor";
    else if (this.armed === "arrow") prompt = "THE ARROW :: click a bug for a surgical strike";
    else if (this.armed === "cannon") prompt = "THE CANNON :: click the target zone";

    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      bridge.emit("prompt", prompt);
    }

    if (!this.terminalOpen && !this.paused && !this.ended && kb.JustDown(this.keys.E) && this.time.now - this.terminalChangedAt > 250) {
      if (dTerm < 100) { sfx.interact(); bridge.emit("terminal", true); }
      else if (this.nearOwnedHome()) { sfx.interact(); bridge.emit("home", true); }
      else if (dNpc < 82) this.handshake();
    }
    // RPG action keys
    if (this.started && !this.ended && !this.terminalOpen && !this.paused) {
      if (kb.JustDown(this.keys.C)) this.attemptCatch();
      if (kb.JustDown(this.keys.SPACE)) this.jumpAvatar();
      this.sprinting = this.keys.SHIFT.isDown;
    }
    if (kb.JustDown(this.keys.ESC)) {
      if (this.armed) { this.armed = null; }
      else if (!this.terminalOpen && this.time.now - this.terminalChangedAt > 250) this.setPaused(!this.paused);
    }
    if (kb.JustDown(this.keys.M)) {
      sfx.setMuted(!sfx.muted);
      this.log(sfx.muted ? "AUDIO CHANNEL MUTED" : "AUDIO CHANNEL LIVE", "sys");
    }
    // RTS hotkeys
    if (this.started && !this.ended && !this.terminalOpen) {
      if (kb.JustDown(this.keys.ONE)) this.armWeapon("blade");
      if (kb.JustDown(this.keys.TWO)) this.armWeapon("arrow");
      if (kb.JustDown(this.keys.THREE)) this.armWeapon("shield");
      if (kb.JustDown(this.keys.FOUR)) this.armWeapon("cannon");
      if (kb.JustDown(this.keys.NINE)) this.armWeapon("lantern");
      if (kb.JustDown(this.keys.ZERO)) this.armWeapon("drum");
      if (kb.JustDown(this.keys.FIVE)) this.queueUnit("knight");
      if (kb.JustDown(this.keys.SIX)) this.queueUnit("lancer");
      if (kb.JustDown(this.keys.SEVEN)) this.queueUnit("golem");
      if (kb.JustDown(this.keys.EIGHT)) this.queueUnit("gleaner");
      if (kb.JustDown(this.keys.R)) this.rallyAll();
      if (kb.JustDown(this.keys.T)) this.buildTurret();
      if (kb.JustDown(this.keys.Q)) { this.attackMoveMode = true; this.log("ATTACK-MOVE :: next right-click sweeps the field", "sys"); }
      if (kb.JustDown(this.keys.X)) {
        for (const f of this.units) if (this.selected.has(f.id)) { f.order = null; f.targetF = null; f.targetB = null; }
        this.avatar.order = null; this.avatar.targetF = null; this.avatar.targetB = null;
        sfx.blip();
      }
      if (kb.JustDown(this.keys.F)) {
        let i = 0;
        for (const f of this.units) {
          if (!this.selected.has(f.id)) continue;
          f.targetF = null; f.targetB = null;
          f.order = { type: "follow", ox: (i % 3 - 1) * 34, oy: Math.floor(i / 3) * 20 + 24 };
          i++;
        }
        if (i > 0) { sfx.order(); this.log(`${i} unit${i > 1 ? "s" : ""} following the avatar`, "sys"); }
      }
    }
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    if (this.avatar && this.player.visible) {
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const edge = 42;
      const ap = this.input.activePointer;
      if (ap.x < edge) this.camPan.x -= 260 * dt;
      if (ap.x > this.scale.width - edge) this.camPan.x += 260 * dt;
      if (ap.y < edge) this.camPan.y -= 260 * dt;
      if (ap.y > this.scale.height - edge) this.camPan.y += 260 * dt;
      this.camPan.x = Phaser.Math.Clamp(this.camPan.x, -320, 320);
      this.camPan.y = Phaser.Math.Clamp(this.camPan.y, -320, 320);
      const wb = this.worldBounds;
      let tx = this.avatar.x - vw / 2 + this.camPan.x;
      let ty = this.avatar.y - vh / 2 - 24 + this.camPan.y;
      tx = Phaser.Math.Clamp(tx, wb.x, wb.x + wb.w - vw);
      ty = Phaser.Math.Clamp(ty, wb.y, wb.y + wb.h - vh);
      cam.scrollX = Phaser.Math.Linear(cam.scrollX, tx, 1 - Math.pow(0.001, dt));
      cam.scrollY = Phaser.Math.Linear(cam.scrollY, ty, 1 - Math.pow(0.001, dt));
    }
    if (this.wheelAcc !== 0) {
      this.zoom = Phaser.Math.Clamp(this.zoom - this.wheelAcc * 0.0009, 0.7, 1.5);
      this.wheelAcc = 0;
    }
    cam.setZoom(Phaser.Math.Linear(cam.zoom, this.zoom, 1 - Math.pow(0.002, dt)));
  }

  private pushSnapshot() {
    const netWorth = this.plt.p + this.plt.l;
    let pRate = 0.6, lRate = 0.2, tRate = 0.04;
    for (const o of this.owned) {
      const y = HOUSE_DEFS[o.type].yields;
      pRate += y.p; lRate += y.l; tRate += y.t;
    }
    for (const b of this.buildings) if (b.kind === "turret" && !b.destroyed) tRate += 0.5;
    let nextWave = 999;
    for (const b of this.buildings) if (b.kind === "citadel" && !b.destroyed) nextWave = Math.min(nextWave, b.raidTimer);
    const sel: PltSnapshot["selected"] = [];
    for (const f of this.units) {
      if (this.selected.has(f.id) && sel.length < 6) sel.push({ name: f.name, hp: Math.max(0, Math.round(f.hp)), hpMax: f.hpMax, kind: f.kind });
    }
    const snap: PltSnapshot = {
      p: this.plt.p, l: this.plt.l, t: this.plt.t,
      pRate, lRate, tRate,
      danger: this.plt.t > netWorth,
      integrity: this.integrity,
      plotsFree: this.plots.filter((p) => !p.claimed).length,
      plotsTotal: this.plots.length,
      owned: this.owned.length,
      timePlayed: Math.floor(this.playTime),
      supply: this.supplyUsed(),
      supplyMax: this.supplyMax(),
      queue: this.queue.length ? { name: UNIT_DEFS[this.queue[0].unit].name, t: Math.max(0, this.queue[0].t), total: this.queue[0].total } : null,
      queueCount: this.queue.length,
      armed: this.armed,
      weapons: (Object.keys(WEAPON_DEFS) as WeaponId[]).map((id) => ({ id, cd: this.weaponCd[id], max: WEAPON_DEFS[id].cd })),
      wave: this.wave,
      nextWaveIn: Math.max(0, Math.ceil(nextWave)),
      threats: this.enemies.filter((e) => !e.dead).length,
      kills: this.kills,
      citadels: this.buildings.filter((b) => b.kind === "citadel").map((b) => ({ hp: Math.max(0, Math.round(b.hp)), hpMax: b.hpMax })),
      turretCount: this.buildings.filter((b) => b.kind === "turret" && !b.destroyed).length,
      selected: sel,
      selectedCount: this.selected.size,
      buildings3d: this.buildings.filter((b) => !b.destroyed).map((b) => ({
        kind: b.kind,
        label: this.structLabel(b),
        x: b.sx, y: b.sy,
        hp: Math.max(0, Math.round(b.hp)), hpMax: b.hpMax,
        color: this.structColor(b),
        done: !b.underConstruction,
      })),
      motes: [
        ...this.units.filter((f) => !f.dead).slice(0, 24).map((f) => ({ x: f.x, y: f.y, t: "unit" as const })),
        ...this.enemies.filter((f) => !f.dead).slice(0, 24).map((f) => ({ x: f.x, y: f.y, t: "enemy" as const })),
      ],
      drumActive: this.time.now < this.drumUntil,
      workers: this.units.filter((f) => !f.dead && f.worker).length,
      nodesLeft: this.nodes.filter((n) => !n.dead && n.amount > 0).length,
      nodesMini: this.nodes.filter((n) => !n.dead && n.amount > 0).map((n) => ({ x: n.x, y: n.y, kind: n.kind })),
      citadelsDown: this.buildings.filter((b) => b.kind === "citadel" && b.destroyed).length,
      citadelsTotal: this.buildings.filter((b) => b.kind === "citadel").length,
      gameSpeed: this.gameSpeed,
      buildArmed: this.placeArmed,
      // ── RPG layer ──
      region: this.region,
      playerLevel: this.playerLevel,
      playerXp: Math.floor(this.playerXp),
      xpNext: xpForLevel(this.playerLevel),
      party: this.party.slice(0, 6).map((c) => ({
        uid: c.uid, speciesId: c.speciesId, name: speciesById(c.speciesId).name,
        level: c.level, color: speciesById(c.speciesId).color, shape: speciesById(c.speciesId).shape,
      })),
      partyMax: 6,
      storageCreatures: this.storageCreatures.length,
      factions: (Object.keys(FACTION_DEFS) as FactionId[]).map((id) => ({
        id, rep: Math.floor(this.factionRep[id]), tier: factionTier(this.factionRep[id]),
      })),
      tower: { tier: this.towerTier, floor: this.towerFloor, totalCleared: this.towerCleared },
      armyPower: this.armyPower(),
      catchable: this.catchableCritter && !this.catchableCritter.dead
        ? { name: speciesById(this.catchableCritter.speciesId).name, level: this.catchableCritter.level, hpPct: this.catchableCritter.hp / this.catchableCritter.hpMax }
        : null,
      nearHome: this.nearOwnedHome(),
      dayPhase: this.dayPhase(),
      crittersWild: this.critters.filter((c) => !c.dead).length,
      capturedTotal: this.capturedTotal,
    };
    bridge.emit("plt", snap);
  }

  private structLabel(b: Building): string {
    if (b.kind === "house" && b.houseType) return HOUSE_DEFS[b.houseType].name;
    if (b.kind === "citadel") return "VOID CITADEL";
    if (b.kind === "market") return "MARKET CORE";
    if (b.kind === "relay") return "RELAY SPIRE";
    if (b.structId) return STRUCT_DEFS[b.structId].name;
    return b.kind.toUpperCase();
  }

  private structColor(b: Building): string {
    if (b.kind === "house" && b.houseType) return HOUSE_DEFS[b.houseType].colors.primary;
    if (b.kind === "citadel") return "#ff4d5e";
    if (b.kind === "relay") return b.owner === "player" ? "#3af5ff" : "#8f6bff";
    if (b.structId) return STRUCT_DEFS[b.structId].color;
    return "#ffc24d";
  }

  // ═══════════════════════════ RPG :: REGIONS ═══════════════════════════
  private regionAt(c: number, r: number): RegionId {
    const d = Math.sqrt((c - 20) ** 2 + (r - 20) ** 2);
    if (d < 8) return "genesis";
    if (d > 24) return "sanctum";
    const ang = Math.atan2(r - 20, c - 20);
    if (ang >= -Math.PI / 4 && ang < Math.PI / 4) return "syndicate";      // east
    if (ang >= Math.PI / 4 && ang < (3 * Math.PI) / 4) return "hollows";    // south
    if (ang >= -((3 * Math.PI) / 4) && ang < -Math.PI / 4) return "forge";  // north
    return "nomad";                                                        // west
  }

  private updateRegion() {
    const cart = isoToCart(this.avatar.x, this.avatar.y);
    const reg = this.regionAt(cart.col, cart.row);
    if (reg !== this.region) {
      this.region = reg;
      const def = REGION_DEFS[reg];
      this.addRep(def.faction, 4);
      this.log(`ENTERING ${def.name} :: Lv.${def.lv[0]}–${def.lv[1]}`, "sys");
      this.pushTicker(`crossed into ${def.name}`, "sys");
      this.showRegionBanner(def.name, def.color, def.lv);
      sfx.region();
    }
  }

  private showRegionBanner(name: string, color: string, lv: [number, number]) {
    if (this.regionName) this.regionName.destroy();
    const cam = this.cameras.main;
    const txt = this.add.text(cam.width / 2, 110, name, {
      fontFamily: "Silkscreen", fontSize: "30px", color,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1500).setAlpha(0);
    const sub = this.add.text(cam.width / 2, 148, `LV ${lv[0]} – ${lv[1]} ZONE`, {
      fontFamily: "IBM Plex Mono", fontSize: "11px", color: "#8fa5d8",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1500).setAlpha(0);
    this.tweens.add({ targets: [txt, sub], alpha: 1, duration: 400, yoyo: true, hold: 1600, onComplete: () => { txt.destroy(); sub.destroy(); } });
  }

  // ═══════════════════════════ RPG :: CREATURES ═════════════════════════
  private spawnCritter() {
    if (this.critters.filter((c) => !c.dead).length >= 12) return;
    // pick a random walkable wild tile away from the capital
    for (let tries = 0; tries < 20; tries++) {
      const c = Phaser.Math.Between(2, GRID - 3), r = Phaser.Math.Between(2, GRID - 3);
      if (this.solids[r]?.[c]) continue;
      if (Math.sqrt((c - 20) ** 2 + (r - 20) ** 2) < 9) continue;
      const reg = this.regionAt(c, r);
      const pool = SPECIES.filter((s) => s.biome.includes(reg));
      if (!pool.length) continue;
      const sp = pool[Phaser.Math.Between(0, pool.length - 1)];
      const rd = REGION_DEFS[reg];
      const level = Phaser.Math.Between(rd.lv[0], rd.lv[1]);
      const hp = Math.round(sp.baseHp * (1 + (level - 1) * 0.12));
      const pos = cartToIso(c + 0.5, r + 0.5);
      const sprite = this.add.image(pos.x, pos.y, `critter_${sp.shape}`).setOrigin(0.5, 1)
        .setDepth(r + c + 0.65).setTint(Phaser.Display.Color.HexStringToColor(sp.color).color);
      const crit: Critter = {
        id: this.nextId++, speciesId: sp.id, level, hp, hpMax: hp,
        x: pos.x, y: pos.y, region: reg, sprite, bar: this.add.graphics().setDepth(998),
        wanderT: 0, wx: pos.x, wy: pos.y, fleeing: false, dead: false, bobSeed: Math.random() * 100,
      };
      this.critters.push(crit);
      return;
    }
  }

  private updateCritters(dt: number) {
    for (const c of this.critters) {
      if (c.dead) continue;
      const fleeFrom = this.nearestPlayerUnit(c.x, c.y, 110);
      if (c.hp < c.hpMax * 0.35) c.fleeing = true;
      let vx = 0, vy = 0;
      if (c.fleeing && fleeFrom) {
        const d = Phaser.Math.Distance.Between(c.x, c.y, fleeFrom.x, fleeFrom.y) || 1;
        vx = ((c.x - fleeFrom.x) / d) * 90; vy = ((c.y - fleeFrom.y) / d) * 90;
      } else {
        c.wanderT -= dt;
        if (c.wanderT <= 0) {
          c.wanderT = Phaser.Math.FloatBetween(1.5, 4);
          c.wx = c.x + Phaser.Math.Between(-70, 70); c.wy = c.y + Phaser.Math.Between(-50, 50);
        }
        const d = Phaser.Math.Distance.Between(c.x, c.y, c.wx, c.wy);
        if (d > 6) { vx = ((c.wx - c.x) / d) * 34; vy = ((c.wy - c.y) / d) * 34; }
      }
      c.x += vx * dt; c.y += vy * dt;
      const bob = Math.sin(this.time.now / 260 + c.bobSeed) * 2.5;
      c.sprite.setPosition(c.x, c.y + bob);
      const cc = isoToCart(c.x, c.y);
      c.sprite.setDepth(cc.row + cc.col + 0.65);
      // hp bar
      c.bar.clear();
      if (c.hp < c.hpMax) {
        const w = 30;
        c.bar.fillStyle(0x000000, 0.5); c.bar.fillRect(c.x - w / 2, c.y - 34, w, 4);
        c.bar.fillStyle(0x6bff9e, 1); c.bar.fillRect(c.x - w / 2, c.y - 34, w * (c.hp / c.hpMax), 4);
      }
    }
    // nearest catchable (low hp, near avatar)
    let best: Critter | null = null, bd = 90;
    for (const c of this.critters) {
      if (c.dead || c.hp > c.hpMax * 0.4) continue;
      const d = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    this.catchableCritter = best;
  }

  private weakenCritters() {
    // nearby player units chip away at wild creatures (never killing) so they can be caught
    for (const c of this.critters) {
      if (c.dead || c.hp <= c.hpMax * 0.2) continue;
      const attacker = this.nearestPlayerUnit(c.x, c.y, 60);
      if (attacker && Math.random() < 0.12) {
        this.damageCritter(c, attacker.dmg * 0.8);
      }
    }
  }

  private nearestPlayerUnit(x: number, y: number, maxD: number): Fighter | null {
    let best: Fighter | null = null, bd = maxD;
    for (const f of [...this.units, this.avatar]) {
      if (f.dead) continue;
      const d = Phaser.Math.Distance.Between(x, y, f.x, f.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  private damageCritter(c: Critter, dmg: number) {
    if (c.dead) return;
    c.hp = Math.max(1, c.hp - dmg); // never kill — must be caught
    this.burst(c.x, c.y - 14, Phaser.Display.Color.HexStringToColor(speciesById(c.speciesId).color).color, 3);
  }

  private attemptCatch() {
    const c = this.catchableCritter;
    if (!c || c.dead) { this.log("NOTHING TO CATCH HERE", "sys"); return; }
    if (this.plt.l < 15) { this.log("NEED 15 LOVE for a Soul Lure", "bad"); sfx.error(); return; }
    this.plt.l -= 15;
    const sp = speciesById(c.speciesId);
    const hpFactor = 1 - c.hp / c.hpMax;
    const ascBonus = this.factionRep.ascended >= 500 ? 0.15 : 0;
    const chance = Math.min(0.95, 0.35 + hpFactor * 0.55 - sp.rarity * 0.06 + ascBonus);
    if (Math.random() < chance) {
      this.capture(c, sp);
    } else {
      this.log(`${sp.name} broke free of the Soul Lure!`, "bad");
      this.pushTicker(`${sp.name} escaped`, "bad");
      c.fleeing = true;
      sfx.error();
    }
  }

  private capture(c: Critter, sp: ReturnType<typeof speciesById>) {
    c.dead = true;
    this.tweens.add({ targets: c.sprite, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 350, onComplete: () => { c.sprite.destroy(); c.bar.clear(); } });
    this.capturedTotal++;
    const owned: OwnedCreature = { uid: this.nextCreatureUid++, speciesId: sp.id, level: c.level, xp: 0 };
    if (this.party.length < 6) this.party.push(owned);
    else this.storageCreatures.push(owned);
    this.addRep("ascended", 12);
    this.gainXp(20 + c.level * 2);
    this.log(`CAUGHT ${sp.name} (Lv.${c.level})!`, "good");
    this.pushTicker(`caught ${sp.name} Lv.${c.level}`, "good");
    this.burst(c.x, c.y - 20, 0xb58cff, 18);
    sfx.catch();
    this.syncParty();
  }

  private syncParty() {
    // remove stale sprites
    for (const ps of this.partySprites) { if (ps.sprite) ps.sprite.destroy(); }
    this.partySprites = [];
    // spawn a companion sprite per party member following the avatar
    this.party.slice(0, 6).forEach((oc, i) => {
      const sp = speciesById(oc.speciesId);
      const ang = (i / 6) * Math.PI * 2;
      const sprite = this.add.image(this.avatar.x + Math.cos(ang) * 46, this.avatar.y + Math.sin(ang) * 30, `critter_${sp.shape}`)
        .setOrigin(0.5, 1).setTint(Phaser.Display.Color.HexStringToColor(sp.color).color).setDepth(24).setScale(0.85);
      this.partySprites.push({ uid: oc.uid, sprite, fighter: null });
    });
  }

  private updateParty(dt: number) {
    // companions orbit/follow the avatar and auto-fight nearby bugs
    this.partySprites.forEach((ps, i) => {
      if (!ps.sprite || !ps.sprite.active) return;
      const ang = (i / Math.max(1, this.partySprites.length)) * Math.PI * 2 + this.time.now / 1400;
      const tx = this.avatar.x + Math.cos(ang) * 52, ty = this.avatar.y + Math.sin(ang) * 34;
      ps.sprite.x += (tx - ps.sprite.x) * Math.min(1, dt * 3);
      ps.sprite.y += (ty - ps.sprite.y) * Math.min(1, dt * 3);
      const cc = isoToCart(ps.sprite.x, ps.sprite.y);
      ps.sprite.setDepth(cc.row + cc.col + 0.66);
    });
    // party deals passive damage to nearest bug
    if (this.party.length && Math.random() < dt * 2) {
      const bug = this.nearestEnemyTo(this.avatar.x, this.avatar.y, 160);
      if (bug) {
        const lead = creatureStats(this.party[0]);
        this.damageFighter(bug, lead.atk, "player");
        const ps = this.partySprites[0];
        if (ps?.sprite) this.burst(ps.sprite.x, ps.sprite.y - 16, 0xb58cff, 4);
      }
    }
    // grant xp to lead creature on nearby kills (handled in kill hook via gainXp)
    for (const oc of this.party) {
      oc.xp += dt * 1.2;
      while (oc.xp >= xpForLevel(oc.level)) {
        oc.xp -= xpForLevel(oc.level);
        oc.level++;
        const sp = speciesById(oc.speciesId);
        if (sp.evolveTo && oc.level >= sp.evolveLevel) {
          const nxt = speciesById(sp.evolveTo);
          oc.speciesId = nxt.id;
          this.log(`${sp.name} EVOLVED into ${nxt.name}!`, "good");
          this.pushTicker(`${sp.name} → ${nxt.name}`, "good");
          this.addRep("ascended", 25);
          sfx.evolve();
          this.syncParty();
        }
      }
    }
  }

  private nearestEnemyTo(x: number, y: number, maxD: number): Fighter | null {
    let best: Fighter | null = null, bd = maxD;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ═══════════════════════════ RPG :: XP / FACTIONS ═══════════════════
  private gainXp(amt: number) {
    this.playerXp += amt;
    while (this.playerXp >= xpForLevel(this.playerLevel)) {
      this.playerXp -= xpForLevel(this.playerLevel);
      this.playerLevel++;
      this.plt.p += 50; this.plt.l += 25;
      this.log(`COMMANDER LEVEL ${this.playerLevel} :: +50P +25L`, "good");
      this.pushTicker(`reached level ${this.playerLevel}`, "good");
      sfx.levelup();
      bridge.emit("flash", { color: "rgba(181,140,255,0.25)" });
    }
  }

  private addRep(id: FactionId, amt: number) {
    const before = factionTier(this.factionRep[id]);
    this.factionRep[id] = Math.max(0, this.factionRep[id] + amt);
    const after = factionTier(this.factionRep[id]);
    if (after !== before) {
      this.log(`${FACTION_DEFS[id].name} :: ${after} (${FACTION_DEFS[id].perk})`, "good");
      this.pushTicker(`${FACTION_DEFS[id].name} → ${after}`, "good");
    }
  }

  private armyPower() {
    let pw = 0;
    for (const f of this.units) if (!f.dead) pw += f.dmg + f.hpMax / 12;
    for (const oc of this.party) pw += creatureStats(oc).atk + creatureStats(oc).hp / 14;
    return Math.round(pw);
  }

  // ═══════════════════════════ RPG :: TOWER ═══════════════════════════
  private towerAscend() {
    if (this.towerTier >= TOWER_TIERS.length) { this.log("THE SOUL TIER IS COMPLETE", "sys"); return; }
    const floorPw = towerFloorPower(this.towerTier, this.towerFloor);
    const pw = this.armyPower();
    const chance = Math.min(0.95, Math.max(0.1, pw / (pw + floorPw)));
    if (Math.random() < chance) {
      const isBoss = this.towerFloor === TOWER_FLOORS;
      const rewardP = 40 + this.towerTier * 30 + this.towerFloor * 8;
      this.plt.p += rewardP;
      this.gainXp(25 + this.towerTier * 15);
      this.addRep("forge", 10);
      this.towerCleared++;
      this.log(`TOWER :: ${TOWER_TIERS[this.towerTier]} F${this.towerFloor} cleared! +${rewardP}P`, "good");
      this.pushTicker(`cleared ${TOWER_TIERS[this.towerTier]} F${this.towerFloor}`, "good");
      sfx.coin();
      if (isBoss) {
        this.towerTier++; this.towerFloor = 1;
        if (this.towerTier < TOWER_TIERS.length) {
          this.log(`PROMOTED TO ${TOWER_TIERS[this.towerTier]} TIER!`, "good");
          this.pushTicker(`promoted to ${TOWER_TIERS[this.towerTier]}`, "good");
          bridge.emit("flash", { color: "rgba(255,194,77,0.3)" });
        }
      } else {
        this.towerFloor++;
      }
    } else {
      this.log(`TOWER :: repelled at ${TOWER_TIERS[this.towerTier]} F${this.towerFloor}. Train harder.`, "bad");
      this.pushTicker(`repelled at ${TOWER_TIERS[this.towerTier]} F${this.towerFloor}`, "bad");
      sfx.error();
    }
  }

  private towerReset() {
    this.towerTier = 0; this.towerFloor = 1; this.towerCleared = 0;
    this.log("TOWER RESET :: back to Clay", "sys");
  }

  // ═══════════════════════════ RPG :: SOUL HOMES ══════════════════════
  private nearOwnedHome(): boolean {
    for (const b of this.buildings) {
      if (b.kind !== "house" || b.owner !== "player" || b.destroyed) continue;
      if (Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, b.sx, b.sy) < 110) return true;
    }
    return false;
  }

  // ═══════════════════════════ RPG :: DAY CYCLE / TICKER ══════════════
  private dayPhase(): "day" | "dusk" | "night" | "dawn" {
    const t = (this.dayClock % 240) / 240;
    if (t < 0.5) return "day";
    if (t < 0.62) return "dusk";
    if (t < 0.88) return "night";
    return "dawn";
  }

  private pushTicker(msg: string, tone: string) {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    this.ticker.unshift({ t: ts, msg, tone });
    if (this.ticker.length > 30) this.ticker.pop();
    bridge.emit("ticker", { t: ts, msg, tone });
  }

  private jumpAvatar() {
    if (this.avatar.dead) return;
    this.tweens.add({
      targets: this.player, y: this.player.y - 26, duration: 160, yoyo: true, ease: "Sine.easeOut",
    });
    this.burst(this.avatar.x, this.avatar.y, 0x9fdcff, 5);
    sfx.blip();
  }

  private grantReward(r: { p?: number; l?: number; xp?: number; rep?: { id: FactionId; amt: number } }) {
    if (r.p) this.plt.p += r.p;
    if (r.l) this.plt.l += r.l;
    if (r.xp) this.gainXp(r.xp);
    if (r.rep) this.addRep(r.rep.id, r.rep.amt);
  }

  shutdown() {
    this.unsub.forEach((u) => u());
    this.unsub = [];
  }
}
