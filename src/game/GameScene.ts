/**
 * SOULFEILD :: SPATIAL OS — GENESIS ARENA + WAR PROTOCOL
 * Isometric 2:1 projection · RTS selection & orders · CPU void citadels ·
 * soul weapons · PLT economy. Phases 1–5 + Milestones 3/4/5/8 fused.
 */
import Phaser from "phaser";
import {
  TILE_W, TILE_H, GRID, cartToIso, isoToCart,
  HOUSE_DEFS, UNIT_DEFS, WEAPON_DEFS, TURRET_COST, TURRET_MAX,
  START_PLT, START_INTEGRITY, EXCHANGE, OBJECTIVE, fmt,
  bridge, HouseId, UnitId, WeaponId, PltSnapshot, EndStats,
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
const ENEMY_BARY: Record<string, number> = { knight: 48, lancer: 48, golem: 58, avatar: 48 };

const CITADEL_SPOTS = [
  { c: -4, r: -4, hp: 650 },
  { c: 19, r: -4, hp: 850 },
  { c: 19, r: 19, hp: 1100 },
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
  bar: Phaser.GameObjects.Graphics;
  barY: number;
  ring: Phaser.GameObjects.Image | null;
  order: Order | null;
  targetF: Fighter | null;
  targetB: Building | null;
  frozen: number; invuln: number;
  flash: number;
  bobSeed: number;
  dead: boolean;
  hpDirty: boolean;
}

interface Building {
  id: number;
  kind: "house" | "turret" | "citadel" | "market";
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
}

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  x: number; y: number;
  targetF: Fighter | null;
  targetB: Building | null;
  lx: number; ly: number;
  speed: number; dmg: number;
  dead: boolean;
}

interface Blast { x: number; y: number; t: number; r: number; dmg: number; hit: Set<number>; }

export class GameScene extends Phaser.Scene {
  // world
  private solids: boolean[][] = [];
  private walkExtents = { minC: -6, maxC: 21, minR: -6, maxR: 21 };
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
  private weaponCd: Record<WeaponId, number> = { blade: 0, arrow: 0, shield: 0, cannon: 0 };
  private armed: WeaponId | null = null;

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
    this.weaponCd = { blade: 0, arrow: 0, shield: 0, cannon: 0 };
    this.armed = null;
    this.selected.clear();
    this.units = []; this.enemies = []; this.buildings = []; this.projectiles = []; this.blasts = [];
    this.kills = 0; this.unitsBuilt = 0; this.wave = 0; this.audits = 0; this.handshakes = 0;
    this.depositsPlt = 0; this.playTime = 0; this.auditTimer = 45;
    this.paused = false; this.ended = false; this.sandbox = false; this.started = false;
    this.handshakeCd = 0; this.respawnTimer = -1; this.npcBubble = null;

    this.buildVoid();
    this.buildGround();
    this.buildProps();
    this.buildBarrier();
    this.buildTerminal();
    this.buildCitadels();
    this.buildPlayer();
    this.buildNpc();
    this.buildCamera();
    this.bindInput();
    this.bindBridge();

    bridge.emit("prompt", null);
    bridge.emit("paused", false);

    this.plots = [
      { c: 2, r: 2, claimed: false },
      { c: 10, r: 1, claimed: false },
      { c: 12, r: 10, claimed: false },
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

  private buildGround() {
    for (let r = -1; r <= GRID; r++) {
      for (let c = -1; c <= GRID; c++) {
        const pos = cartToIso(c, r);
        const inGrid = c >= 0 && c < GRID && r >= 0 && r < GRID;
        const ring = !inGrid;
        let tex = "grass";
        if (ring) tex = "void";
        else if (r === 7 && c >= 4 && c <= 11) tex = "path";
        else if (c === 7 && r >= 8 && r <= 12) tex = "path";
        else if ((c + r * 3) % 7 === 0) tex = "grass2";
        else if ((c * 5 + r) % 11 === 0) tex = "grass3";
        const img = this.add.image(pos.x, pos.y, tex).setDepth(r + c - 10);
        this.groundTiles.push(img);
      }
    }
  }

  private buildProps() {
    const lampSpots = [[4, 6], [11, 6], [7, 9], [3, 12]];
    for (const [c, r] of lampSpots) {
      const p = cartToIso(c, r);
      const lamp = this.add.image(p.x, p.y - 4, "lamp").setOrigin(0.5, 1).setDepth(r + c + 0.5);
      const glow = this.add.image(p.x, p.y - 44, "glow").setDepth(r + c + 0.45).setTint(0xffc24d).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7);
      this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 0.28 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.markSolid(c, r);
      lamp.setData("solid", true);
    }
    const treeSpots = [[0, 0], [15, 0], [0, 15], [15, 15], [1, 9], [14, 5], [6, 0], [9, 15]];
    for (const [c, r] of treeSpots) {
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

  private buildTerminal() {
    const pos = cartToIso(7.5, 6);
    this.terminalPos = pos;
    this.terminal = this.add.image(pos.x, pos.y - 4, "terminal").setOrigin(0.5, 1).setDepth(6 + 7.5 + 0.6);
    this.terminalRing = this.add.image(pos.x, pos.y + 6, "selring").setDepth(6 + 7.5 + 0.2).setAlpha(0);
    this.tweens.add({ targets: this.terminalRing, alpha: { from: 0, to: 0.8 }, duration: 900, yoyo: true, repeat: -1 });
    const holo = this.add.text(pos.x, pos.y - 118, "◈ MARKET TERMINAL", {
      fontFamily: "Silkscreen", fontSize: "10px", color: "#3af5ff",
    }).setOrigin(0.5).setDepth(520).setAlpha(0.85);
    this.tweens.add({ targets: holo, y: pos.y - 124, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.markSolid(7, 6); this.markSolid(8, 6);
    // market building record (invulnerable, no yields)
    this.buildings.push({
      id: this.nextId++, kind: "market", owner: "neutral", c: 7.5, r: 6, sx: pos.x, sy: pos.y,
      solidR: 34, hp: 99999, hpMax: 99999, invulnerable: true, sprite: this.terminal,
      bar: this.add.graphics().setDepth(998), barW: 0, barY: 0, atkTimer: 0,
      raidTimer: 0, raidIdx: 0, announced: false, destroyed: false, hpDirty: false,
    });
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
    const p = cartToIso(7.5, 10);
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
    const center = cartToIso(12, 11);
    const pos = cartToIso(12, 12.6);
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
    const start = cartToIso(7.5, 13);
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
      FIVE: kb.addKey("FIVE"), SIX: kb.addKey("SIX"), SEVEN: kb.addKey("SEVEN"),
    };

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
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
  private supplyMax() { return Math.min(20, 4 + this.owned.length * 2); }
  private supplyUsed() {
    let s = 0;
    for (const f of this.units) if (!f.dead) s += (UNIT_DEFS[f.kind as UnitId]?.supply) ?? 1;
    return s;
  }

  private queueUnit(id: UnitId) {
    if (!this.started || this.paused || this.ended) return;
    const def = UNIT_DEFS[id];
    if (this.queue.length >= 5) { this.log("PRODUCTION QUEUE FULL :: max 5", "bad"); sfx.error(); return; }
    if (this.supplyUsed() + this.queue.reduce((s, q) => s + UNIT_DEFS[q.unit].supply, 0) + def.supply > this.supplyMax()) {
      this.log("SUPPLY CAP REACHED :: claim more houses (+2 each)", "bad"); sfx.error(); return;
    }
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l || this.plt.t < def.cost.t) {
      this.log(`INSUFFICIENT PLT for ${def.name}`, "bad"); sfx.error(); return;
    }
    this.plt.p -= def.cost.p; this.plt.l -= def.cost.l; this.plt.t -= def.cost.t;
    const total = id === "golem" ? 7 : id === "lancer" ? 5 : 4;
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

  // ═══════════════════════════ SOUL WEAPONS ═══════════════════════════
  private armWeapon(id: WeaponId | null) {
    if (!this.started || this.paused || this.ended) return;
    if (id === null) { this.armed = null; return; }
    if (this.armed === id) { this.armed = null; return; }
    const def = WEAPON_DEFS[id];
    if (this.weaponCd[id] > 0) { this.log(`${def.name} recharging :: ${Math.ceil(this.weaponCd[id])}s`, "sys"); sfx.error(); return; }
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l) { this.log(`INSUFFICIENT PLT for ${def.name}`, "bad"); sfx.error(); return; }
    if (!def.targeting) { this.castShield(); this.armed = null; return; }
    this.armed = id;
    sfx.blip();
    this.log(`${def.name} armed :: click the field`, "sys");
  }

  private payWeapon(id: WeaponId): boolean {
    const def = WEAPON_DEFS[id];
    if (this.plt.p < def.cost.p || this.plt.l < def.cost.l) return false;
    this.plt.p -= def.cost.p; this.plt.l -= def.cost.l;
    this.weaponCd[id] = def.cd;
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
    const sprite = this.add.image(cfg.x, cfg.y, cfg.tex).setOrigin(0.5, 1).setDepth(20);
    return {
      id: this.nextId++, side: cfg.side, kind: cfg.kind, name: cfg.name,
      x: cfg.x, y: cfg.y, hp: cfg.hp, hpMax: cfg.hpMax, dmg: cfg.dmg, range: cfg.range,
      atkCdMax: cfg.atkCd, atkCd: 0, speed: cfg.speed, radius: cfg.radius, loot: cfg.loot,
      ranged: cfg.ranged, sprite, bar: this.add.graphics().setDepth(998), barY: cfg.barY,
      ring: null, order: null, targetF: null, targetB: null,
      frozen: 0, invuln: 0, flash: 0, bobSeed: Math.random() * 100, dead: false, hpDirty: true,
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

  private damageFighter(f: Fighter, dmg: number, from: "player" | "enemy") {
    if (f.dead) return;
    if (from === "enemy" && f.invuln > 0) return;
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
    } else {
      f.sprite.destroy();
    }
    f.bar.clear();
    if (f.ring) { f.ring.destroy(); f.ring = null; }
    this.selected.delete(f.id);
    if (f.side === "enemy") {
      this.kills++;
      this.plt.p += f.loot;
      this.floatText(f.x, f.y - 30, `+${f.loot}P`, "#ffc24d");
      this.burst(f.x, f.y - 12, 0xff4d5e, 10);
      sfx.death();
    } else if (f.kind === "avatar") {
      this.burst(f.x, f.y - 14, 0x3af5ff, 18);
      sfx.boom();
      this.shakeCam(6);
      bridge.emit("flash", { color: "rgba(255,77,94,0.3)" });
      this.log("AVATAR DECOMPILED :: respawning at base…", "bad");
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
    this.handshakeCd = 30;
    this.handshakes++;
    this.plt.l += 25;
    this.floatText(this.npc.x, this.npc.y - 44, "+25L", "#ff5ad1");
    this.burst(this.npc.x, this.npc.y - 20, 0xff5ad1, 12);
    sfx.handshake();
    this.npcSay("A2A handshake accepted · +25 LOVE");
    this.log("A2A HANDSHAKE :: WATCHER-07 shares surplus Love", "good");
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
    const dt = Math.min(delta / 1000, 0.05);
    this.updateAmbient(dt);
    if (!this.started || this.ended) return;
    if (!this.paused) {
      this.playTime += dt;
      this.updatePlayer(dt);
      this.updateOrdersAndCombat(dt);
      this.updateProduction(dt);
      this.updateWeaponsAndBlasts(dt);
      this.updateCitadels(dt);
      this.updateEconomy(dt);
    }
    this.updatePrompts();
    this.updateCamera(dt);
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

    const entropyFactor = this.plt.t > this.plt.p + this.plt.l ? 0.72 : 1;
    if (dx !== 0 || dy !== 0) {
      this.avatar.order = null; // manual control overrides orders
      const len = Math.hypot(dx, dy);
      const sp = this.avatar.speed * entropyFactor;
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
      if (f.invuln > 0 && f.side === "player" && f.kind !== "avatar") f.invuln -= dt;
      if (f.flash > 0) {
        f.flash -= dt;
        f.sprite.setTint(f.frozen > 0 ? 0x9fdcff : 0xffffff);
        if (f.flash <= 0 && f.frozen <= 0) f.sprite.clearTint();
      }

      const frozen = f.frozen > 0;
      const speedMul = frozen ? 0.12 : 1;

      // validate targets
      if (f.targetF && f.targetF.dead) f.targetF = null;
      if (f.targetB && f.targetB.destroyed) f.targetB = null;
      if (f.order?.type === "attackBuilding") {
        const b = this.buildings.find((x) => x.id === (f.order as { id: number }).id);
        if (!b || b.destroyed) { f.order = null; f.targetB = null; }
        else f.targetB = b;
      }

      // acquire target
      if (!f.targetF && !f.targetB && !frozen) {
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
              this.fireProjectile(f.x, f.y - 26, f.targetF, f.targetB, f.dmg, f.side);
              sfx.laser();
            } else {
              if (f.targetF) this.damageFighter(f.targetF, f.dmg, f.side === "player" ? "player" : "enemy");
              else if (f.targetB) {
                this.damageBuilding(f.targetB, f.dmg);
                this.burst(f.targetB.sx, f.targetB.sy - 30, 0xffc24d, 3);
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
      if (f.ring) f.ring.setPosition(f.x, f.y + 2);
      const cc = isoToCart(f.x, f.y);
      f.sprite.setDepth(cc.row + cc.col + 0.7);
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

    // player units
    for (const f of allF) {
      if (f.kind === "avatar") continue;
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
        this.burst(p.lx, p.ly, 0x3af5ff, 4);
        if (p.targetF && !p.targetF.dead) this.damageFighter(p.targetF, p.dmg, "player");
        else if (p.targetB && !p.targetB.destroyed) { this.damageBuilding(p.targetB, p.dmg); sfx.hit(); }
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

  private fireProjectile(x: number, y: number, targetF: Fighter | null, targetB: Building | null, dmg: number, _side: "player" | "enemy") {
    const sprite = this.add.image(x, y, targetB ? "ebolt" : "bolt").setDepth(950);
    this.projectiles.push({
      sprite, x, y, targetF, targetB,
      lx: targetF ? targetF.x : targetB ? targetB.sx : x,
      ly: targetF ? targetF.y - 14 : targetB ? targetB.sy - 40 : y,
      speed: 340, dmg, dead: false,
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
    else if (dNpc < 80) prompt = this.handshakeCd > 0 ? `WATCHER-07 :: handshake recharging ${Math.ceil(this.handshakeCd)}s` : "E :: A2A HANDSHAKE — trade Love with the neighbor";

    if (this.armed === "blade") prompt = "THE BLADE :: drag across the field, release to refactor";
    else if (this.armed === "arrow") prompt = "THE ARROW :: click a bug for a surgical strike";
    else if (this.armed === "cannon") prompt = "THE CANNON :: click the target zone";

    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      bridge.emit("prompt", prompt);
    }

    if (!this.terminalOpen && !this.paused && !this.ended && kb.JustDown(this.keys.E) && this.time.now - this.terminalChangedAt > 250) {
      if (dTerm < 100) { sfx.interact(); bridge.emit("terminal", true); }
      else if (dNpc < 82) this.handshake();
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
      if (kb.JustDown(this.keys.FIVE)) this.queueUnit("knight");
      if (kb.JustDown(this.keys.SIX)) this.queueUnit("lancer");
      if (kb.JustDown(this.keys.SEVEN)) this.queueUnit("golem");
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
    };
    bridge.emit("plt", snap);
  }

  shutdown() {
    this.unsub.forEach((u) => u());
    this.unsub = [];
  }
}
