import Phaser from "phaser";
import { bridge, HOUSE_DEFS, START_PLT, OBJECTIVE, HouseId, PltSnapshot, EndStats } from "./bridge";
import { makeTextures } from "./textures";
import { sfx } from "./audio";

export const TW = 64;
export const TH = 32;
const GRID = 16;

const cartToIso = (r: number, c: number) => ({ x: (c - r) * (TW / 2), y: (c + r) * (TH / 2) });
const isoToCart = (x: number, y: number) => ({
  r: (y / (TH / 2) - x / (TW / 2)) / 2,
  c: (y / (TH / 2) + x / (TW / 2)) / 2,
});
const tileCenter = (r: number, c: number) => {
  const p = cartToIso(r, c);
  return { x: p.x, y: p.y + TH / 2 };
};
const key = (r: number, c: number) => `${r},${c}`;

interface Plot { id: string; r: number; c: number; owner: "player" | "npc" | "market"; house?: HouseId }

const PLOT_DEFS: Plot[] = [
  { id: "GENESIS-01", r: 3, c: 3, owner: "player" },
  { id: "A2", r: 11, c: 3, owner: "market" },
  { id: "B3", r: 3, c: 11, owner: "market" },
  { id: "NPC-07", r: 11, c: 11, owner: "npc", house: "hearth" },
];

const TREES: [number, number][] = [[2, 6], [6, 2], [13, 9], [9, 13], [2, 12], [12, 2], [13, 5], [5, 13]];
const LAMPS: [number, number][] = [[7, 7], [9, 9], [7, 9], [9, 7], [5, 7], [7, 11], [11, 7], [9, 5]];
const RACKS: [number, number][] = [[6, 5], [5, 10]];
const TERMINAL_TILE = { r: 8, c: 8 };

const NPC_LINES = [
  "fog is thick beyond the barrier today...",
  "market's hot. spires going fast.",
  "my chimney hums when love is high.",
  "watch your tax. the Sentinel audits.",
  "porting protocol gives me shivers.",
  "buy monolith. burn the entropy.",
];

export class GameScene extends Phaser.Scene {
  private blocked = new Set<string>();
  private plots: Plot[] = [];
  private player?: Phaser.GameObjects.Image;
  private playerShadow?: Phaser.GameObjects.Image;
  private npc?: Phaser.GameObjects.Image;
  private npcGlow?: Phaser.GameObjects.Image;
  private npcBubble?: Phaser.GameObjects.Text;
  private npcTarget = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private camPan = new Phaser.Math.Vector2();
  private followMode = false;
  private paused = false;
  private terminalOpen = false;
  private sandbox = false;
  private ended = false;
  private spawned = false;
  private prevCam = new Phaser.Math.Vector2();
  private parallax: { obj: Phaser.GameObjects.Image; f: number; bx: number; by: number }[] = [];
  private lastPrompt: string | null = null;
  private terminalChangedAt = -99999;

  private worldBounds = { x: 0, y: 0, w: 0, h: 0 };

  // economy
  private p = START_PLT.p;
  private l = START_PLT.l;
  private t = START_PLT.t;
  private integrity = 100;
  private owned = 0;
  private timePlayed = 0;
  private stats = { audits: 0, depositsPlt: 0, handshakes: 0 };
  private lastHandshake = -99999;
  private logId = 0;
  private unsubs: (() => void)[] = [];

  constructor() {
    super("GameScene");
  }

  create() {
    makeTextures(this);
    this.cameras.main.setBackgroundColor("#04060f");

    // world bounds
    const bMin = cartToIso(GRID + 2, -3);
    const bMax = cartToIso(-3, GRID + 2);
    this.worldBounds = { x: bMin.x - 160, y: bMin.y - 260, w: bMax.x - bMin.x + 320, h: bMax.y - bMin.y + 480 };
    this.cameras.main.setBounds(this.worldBounds.x, this.worldBounds.y, this.worldBounds.w, this.worldBounds.h);
    this.cameras.main.setZoom(1.02);

    this.buildVoidAndStars();
    this.buildGround();
    this.buildBarriers();
    this.buildProps();
    this.buildTerminal();
    this.buildPlots();
    this.buildNpc();
    this.buildShips();
    this.buildInput();
    this.buildBridge();

    // camera intro position
    const cam = this.cameras.main;
    cam.centerOn(0, 240);
    this.prevCam.set(cam.scrollX, cam.scrollY);

    // economy + state broadcast
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.economyTick() });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.broadcastState() });
    this.time.addEvent({ delay: 11000, loop: true, callback: () => this.npcSay() });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
    });
  }

  // ───────────────────────── world building ─────────────────────────
  private buildVoidAndStars() {
    const stars = this.add.image(0, 240, "stars").setDepth(-20).setScale(1.7).setAlpha(0.9);
    this.parallax.push({ obj: stars, f: 0.82, bx: 0, by: 240 });
    for (let r = -3; r <= GRID + 2; r++) {
      for (let c = -3; c <= GRID + 2; c++) {
        if (r >= 0 && r < GRID && c >= 0 && c < GRID) continue;
        const pos = cartToIso(r, c);
        this.add.image(pos.x, pos.y, "tile_void").setOrigin(0.5, 0).setDepth(r + c);
      }
    }
  }

  private buildGround() {
    const rnd = Phaser.Math.RND;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const isPath = r === TERMINAL_TILE.r || c === TERMINAL_TILE.c;
        const texKey = isPath ? "tile_path" : `tile_grass${rnd.between(0, 2)}`;
        const pos = cartToIso(r, c);
        this.add.image(pos.x, pos.y, texKey).setOrigin(0.5, 0).setDepth(r + c);
      }
    }
  }

  private buildBarriers() {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const edge = r === 0 || r === GRID - 1 || c === 0 || c === GRID - 1;
        if (!edge) continue;
        this.blocked.add(key(r, c));
        const pos = tileCenter(r, c);
        const wall = this.add.image(pos.x, pos.y + 6, "barrier").setOrigin(0.5, 1).setDepth(r + c + 1).setAlpha(0.4);
        this.tweens.add({
          targets: wall, alpha: 0.16, duration: 1400 + rnd01() * 1200, yoyo: true, repeat: -1,
          delay: rnd01() * 1400, ease: "Sine.easeInOut",
        });
      }
    }
    // corner beacons
    ([[0, 0], [0, 15], [15, 0], [15, 15]] as [number, number][]).forEach(([r, c]) => {
      const pos = tileCenter(r, c);
      const glow = this.add.image(pos.x, pos.y - 14, "glow").setDepth(r + c + 2).setTint(0x3af5ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4);
      this.tweens.add({ targets: glow, scale: 2, alpha: 0.4, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  private buildProps() {
    TREES.forEach(([r, c]) => {
      this.blocked.add(key(r, c));
      const pos = tileCenter(r, c);
      this.add.image(pos.x, pos.y + 4, "prop_tree").setOrigin(0.5, 1).setDepth(r + c + 1);
    });
    RACKS.forEach(([r, c]) => {
      this.blocked.add(key(r, c));
      const pos = tileCenter(r, c);
      this.add.image(pos.x, pos.y + 4, "prop_rack").setOrigin(0.5, 1).setDepth(r + c + 1);
    });
    LAMPS.forEach(([r, c], i) => {
      const pos = tileCenter(r, c);
      this.add.image(pos.x, pos.y + 2, "prop_lamp").setOrigin(0.5, 1).setDepth(r + c + 1);
      const glow = this.add.image(pos.x, pos.y - 52, "glow").setDepth(r + c + 1.2).setTint(0x3af5ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8).setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: 0.25, scale: 0.6, duration: 900 + i * 130, yoyo: true, repeat: -1 });
    });
  }

  private buildTerminal() {
    const pos = tileCenter(TERMINAL_TILE.r, TERMINAL_TILE.c);
    this.blocked.add(key(TERMINAL_TILE.r, TERMINAL_TILE.c));
    const glow = this.add.image(pos.x, pos.y - 40, "glow").setDepth(15.4).setTint(0x3af5ff).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0.5);
    this.tweens.add({ targets: glow, scale: 3, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const ring = this.add.image(pos.x, pos.y + 2, "plot_marker").setDepth(16.1).setScale(0.62).setAlpha(0.7);
    this.tweens.add({ targets: ring, scaleX: 0.72, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    const term = this.add.image(pos.x, pos.y + 8, "terminal").setOrigin(0.5, 1).setDepth(16.5);
    this.tweens.add({ targets: term, y: pos.y + 5, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add.text(pos.x, pos.y - 118, "◈ MARKET TERMINAL", {
      fontFamily: "IBM Plex Mono", fontSize: "10px", color: "#9fdcff",
    }).setOrigin(0.5).setDepth(17).setAlpha(0.85);
  }

  private buildPlots() {
    PLOT_DEFS.forEach((def) => {
      const plot = { ...def };
      this.plots.push(plot);
      for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) this.blocked.add(key(plot.r + dr, plot.c + dc));
      if (plot.owner === "market") this.renderMarketPlot(plot);
    });
    // NPC house is pre-built
    const npcPlot = this.plots.find((p) => p.owner === "npc")!;
    this.placeHouse(npcPlot, "hearth", true);
  }

  private renderMarketPlot(plot: Plot) {
    const center = cartToIso(plot.r + 1, plot.c + 1);
    const marker = this.add.image(center.x, center.y, "plot_marker").setDepth(plot.r + plot.c + 2.4).setAlpha(0.85);
    this.tweens.add({ targets: marker, scale: 1.06, alpha: 0.5, duration: 850, yoyo: true, repeat: -1 });
    const label = this.add.text(center.x, center.y - 40, `PLOT ${plot.id}\nFOR SALE`, {
      fontFamily: "IBM Plex Mono", fontSize: "10px", color: "#ff9de6", align: "center",
    }).setOrigin(0.5).setDepth(plot.r + plot.c + 3).setAlpha(0.9);
    this.tweens.add({ targets: label, y: center.y - 48, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    (plot as Plot & { marker?: Phaser.GameObjects.Image }).marker = marker;
  }

  private placeHouse(plot: Plot, type: HouseId, silent = false) {
    plot.house = type;
    const center = cartToIso(plot.r + 1, plot.c + 1);
    const img = this.add.image(center.x, center.y + 10, `house_${type}`).setOrigin(0.5, 1).setDepth(plot.r + plot.c + 2.5);
    const def = HOUSE_DEFS[type];
    const glowColor = Phaser.Display.Color.HexStringToColor(def.colors.primary).color;

    // resident watcher agent
    const wpos = { x: center.x + 44, y: center.y + 26 };
    const wShadow = this.add.image(wpos.x, wpos.y + 2, "shadow").setOrigin(0.5, 0.5).setScale(0.5).setDepth(plot.r + plot.c + 2.6).setAlpha(0.5);
    const w = this.add.image(wpos.x, wpos.y - 10, "watcher").setOrigin(0.5, 1).setDepth(plot.r + plot.c + 2.7);
    this.tweens.add({ targets: w, y: wpos.y - 16, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const wGlow = this.add.image(wpos.x, wpos.y - 16, "glow").setDepth(plot.r + plot.c + 2.6).setTint(glowColor).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.4);
    this.tweens.add({ targets: wGlow, alpha: 0.15, duration: 800, yoyo: true, repeat: -1 });

    // biome ambience emitters
    if (type === "hearth") {
      this.add.particles(center.x + 29, center.y - 152, "smoke", {
        frequency: 620, lifespan: 2600, speedY: { min: -22, max: -12 }, speedX: { min: -4, max: 8 },
        scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.5, end: 0 },
      }).setDepth(plot.r + plot.c + 2.8);
    }
    if (type === "neon") {
      this.add.particles(center.x, center.y - 190, "rain", {
        frequency: 55, lifespan: 750, speedY: { min: 200, max: 300 },
        alpha: { start: 0.3, end: 0 }, scale: { start: 0.8, end: 0.4 },
      }).setPosition(center.x - 40, center.y - 200).setDepth(plot.r + plot.c + 2.4);
      const beacon = this.add.image(center.x, center.y - 196, "glow").setDepth(plot.r + plot.c + 2.9).setTint(0xff3ec8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);
      this.tweens.add({ targets: beacon, alpha: 0.2, scale: 0.9, duration: 600, yoyo: true, repeat: -1 });
    }
    if (type === "monolith") {
      const beacon = this.add.image(center.x + 20, center.y - 132, "glow").setDepth(plot.r + plot.c + 2.9).setTint(0xff4d5e).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
      this.tweens.add({ targets: beacon, alpha: 0.15, scale: 1, duration: 500, yoyo: true, repeat: -1 });
    }

    if (!silent) {
      img.setScale(0.001);
      this.tweens.add({ targets: img, scale: 1, duration: 550, ease: "Back.easeOut" });
      const flash = this.add.image(center.x, center.y - 60, "glow").setDepth(plot.r + plot.c + 4).setTint(glowColor).setBlendMode(Phaser.BlendModes.ADD).setScale(1).setAlpha(0.95);
      this.tweens.add({ targets: flash, scale: 6, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
      const burst = this.add.particles(center.x, center.y - 40, "spark", {
        speed: { min: 60, max: 240 }, lifespan: 700, quantity: 26, scale: { start: 1, end: 0 },
        tint: [glowColor, 0xffffff], emitting: false,
      }).setDepth(plot.r + plot.c + 4);
      burst.explode(26);
      this.cameras.main.shake(320, 0.012);
      void wShadow;
    }
  }

  private buildNpc() {
    const npcPlot = this.plots.find((p) => p.owner === "npc")!;
    const center = cartToIso(npcPlot.r + 1, npcPlot.c + 1);
    const pos = { x: center.x - 46, y: center.y + 24 };
    this.npcTarget = { x: pos.x, y: pos.y - 8 };
    this.npc = this.add.image(pos.x, pos.y - 8, "watcher").setOrigin(0.5, 1).setDepth(23);
    this.npcGlow = this.add.image(pos.x, pos.y - 16, "glow").setDepth(22.9).setTint(0xff5ad1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.4);
    // wander loop — tweens a proxy object; update() applies it + hover bob
    this.time.addEvent({
      delay: 6500, loop: true, callback: () => {
        if (!this.npc || this.paused || this.ended) return;
        const spots = [
          { x: center.x - 46, y: center.y + 16 },
          { x: center.x - 92, y: center.y - 6 },
          { x: center.x - 40, y: center.y + 48 },
          { x: center.x - 112, y: center.y + 26 },
        ];
        const s = spots[Phaser.Math.Between(0, spots.length - 1)];
        this.tweens.add({ targets: this.npcTarget, x: s.x, y: s.y, duration: 1700, ease: "Sine.easeInOut" });
      },
    });
  }

  private buildShips() {
    const defs = [
      { x: -860, y: 40, s: 1.15 }, { x: 900, y: 210, s: 0.9 }, { x: 40, y: -210, s: 1.35 },
    ];
    defs.forEach((d, i) => {
      // container carries parallax; inner sprite carries the drift tween (so they don't fight)
      const cont = this.add.container(d.x, d.y).setDepth(40 + i);
      const ship = this.add.image(0, 0, "ship").setScale(d.s).setAlpha(0.92);
      cont.add(ship);
      this.tweens.add({ targets: ship, x: i % 2 ? -160 : 160, y: 26, duration: 9000 + i * 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.parallax.push({ obj: cont as unknown as Phaser.GameObjects.Image, f: 0.42, bx: d.x, by: d.y });
    });
  }

  // ───────────────────────── input / bridge ─────────────────────────
  private buildInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,E,M,ESC,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0012, 0.85, 1.9));
    });
  }

  private buildBridge() {
    this.unsubs.push(
      bridge.on("spawn", (house) => this.spawnPlayer(house)),
      bridge.on("buy", (id) => this.tryBuy(id)),
      bridge.on("deposit", (d) => this.applyDeposit(d)),
      bridge.on("settle", () => this.settle()),
      bridge.on("pause", () => this.setPaused(true)),
      bridge.on("resume", () => this.setPaused(false)),
      bridge.on("sandbox", () => {
        this.sandbox = true;
        this.ended = false;
        this.integrity = Math.max(this.integrity, 60);
        this.log("SANDBOX MODE :: THE KERNEL KEEPS THE LEDGER OPEN", "sys");
      }),
      bridge.on("terminal", (open) => { this.terminalOpen = open; this.terminalChangedAt = this.time.now; }),
    );
  }

  private log(msg: string, tone: "info" | "good" | "bad" | "sys" = "info") {
    bridge.emit("log", { id: ++this.logId, msg, tone, t: this.timePlayed });
  }

  // ───────────────────────── gameplay ─────────────────────────
  private spawnPlayer(house: HouseId) {
    if (this.spawned) return;
    this.spawned = true;
    const playerPlot = this.plots.find((p) => p.owner === "player")!;
    this.placeHouse(playerPlot, house);
    this.owned = 1;
    const sp = tileCenter(playerPlot.r + 2, playerPlot.c + 1);
    this.playerShadow = this.add.image(sp.x, sp.y, "shadow").setOrigin(0.5, 0.5).setScale(0.62).setDepth(5.5);
    this.player = this.add.image(sp.x, sp.y, "player").setOrigin(0.5, 1).setDepth(5.6);

    // camera swoop
    const cam = this.cameras.main;
    const vw = this.scale.width / 1.32, vh = this.scale.height / 1.32;
    this.tweens.add({
      targets: cam, zoom: 1.32, duration: 1300, ease: "Cubic.easeInOut",
      onUpdate: () => {
        cam.scrollX += (sp.x - vw / 2 - cam.scrollX) * 0.04;
        cam.scrollY += (sp.y - vh / 2 - 20 - cam.scrollY) * 0.04;
      },
      onComplete: () => { this.followMode = true; },
    });

    // spawn fx
    const burst = this.add.particles(sp.x, sp.y - 20, "spark", {
      speed: { min: 40, max: 180 }, lifespan: 650, scale: { start: 1, end: 0 }, tint: [0x3af5ff, 0xff3ec8], emitting: false,
    }).setDepth(6);
    burst.explode(20);
    sfx.buy();
    this.log(`AVATAR MATERIALIZED :: ${HOUSE_DEFS[house].name} CLAIMED AT GENESIS-01`, "good");
    this.log("OBJECTIVE :: OWN 3 STRUCTURES + REACH 1500 NET WORTH", "sys");
    this.log("TIP :: THE MARKET TERMINAL (E) SELLS PLOTS FOR PLT", "sys");
  }

  private tryBuy(id: HouseId) {
    if (!this.spawned || this.ended) return;
    const def = HOUSE_DEFS[id];
    const plot = this.plots.find((p) => p.owner === "market" && !p.house);
    if (!plot) { this.log("NO VACANT PLOTS REMAIN IN THE GENESIS SECTOR", "bad"); sfx.deny(); return; }
    const res = def.cost.resource;
    const bal = res === "p" ? this.p : res === "l" ? this.l : this.t;
    if (bal < def.cost.amount) {
      this.log(`INSUFFICIENT ${res.toUpperCase()} :: NEED ${def.cost.amount}, HOLD ${Math.floor(bal)}`, "bad");
      sfx.deny();
      return;
    }
    if (res === "p") this.p -= def.cost.amount;
    else if (res === "l") this.l -= def.cost.amount;
    else this.t -= def.cost.amount;
    this.placeHouse(plot, id);
    this.owned++;
    const m = (plot as Plot & { marker?: Phaser.GameObjects.Image }).marker;
    if (m) m.destroy();
    sfx.buy();
    bridge.emit("flash", def.colors.primary);
    this.log(`${def.name} CONSTRUCTED AT PLOT ${plot.id} :: RESIDENT AGENT ONLINE`, "good");
    this.checkWin();
  }

  private applyDeposit(d: { p: number; l: number; burn: number; treasury: number; amount: number; currency: "usd" | "btc" }) {
    if (!this.spawned || this.ended) return;
    this.p += d.p;
    this.l += d.l;
    this.t = Math.max(0, this.t - d.burn);
    this.stats.depositsPlt += d.p + d.l;
    sfx.coin();
    bridge.emit("flash", "#ffc24d");
    const pos = tileCenter(TERMINAL_TILE.r, TERMINAL_TILE.c);
    const burst = this.add.particles(pos.x, pos.y - 50, "spark", {
      speed: { min: 40, max: 160 }, lifespan: 800, scale: { start: 1, end: 0 }, tint: [0xffc24d, 0xff5ad1], emitting: false,
    }).setDepth(17);
    burst.explode(18);
    const sym = d.currency === "usd" ? "$" : "₿m";
    this.log(`SOVEREIGN EXCHANGE :: ${sym}${d.amount} → +${Math.floor(d.p)}P +${Math.floor(d.l)}L, ${Math.floor(d.burn)}T BURNED, ${Math.floor(d.treasury)}→GSK TREASURY`, "good");
  }

  private settle() {
    if (!this.spawned || this.ended) return;
    if (this.t <= 0.5) { this.log("ENTROPY LEDGER ALREADY CLEAR", "info"); sfx.ui(); return; }
    const avail = this.p + this.l;
    if (avail < this.t) { this.log("CANNOT SETTLE :: PROFIT+LOVE < TAX DEBT", "bad"); sfx.deny(); return; }
    const need = this.t;
    this.p -= (need * this.p) / avail;
    this.l -= (need * this.l) / avail;
    this.t = 0;
    sfx.coin();
    bridge.emit("flash", "#6bff9e");
    this.log(`ENTROPY SETTLED :: ${Math.floor(need)} TAX DISSOLVED INTO THE LEDGER`, "good");
  }

  private economyTick() {
    if (!this.spawned || this.paused || this.ended) return;
    this.timePlayed++;
    // yields
    let dp = 1, dl = 1, dt = 2; // genesis stipend + base entropy
    this.plots.forEach((plot) => {
      if (!plot.house || (plot.owner !== "player" && plot.owner !== "market")) return;
      if (plot.owner === "market" && !plot.house) return;
      if (plot.owner === "player" || (plot.owner === "market" && plot.house)) {
        const y = HOUSE_DEFS[plot.house].yields;
        dp += y.p; dl += y.l; dt += y.t;
      }
    });
    this.p += dp; this.l += dl; this.t = Math.max(0, this.t + dt);

    // sentinel audit every 45s after t+30
    if (this.timePlayed >= 30 && (this.timePlayed - 30) % 45 === 0) {
      const hit = 30 + 12 * this.owned;
      this.t += hit;
      this.stats.audits++;
      sfx.audit();
      bridge.emit("flash", "#ff4d5e");
      this.cameras.main.shake(260, 0.008);
      this.log(`SENTINEL FILED A TAX AUDIT :: +${hit} ENTROPY`, "bad");
    }

    // bankruptcy pressure
    const danger = this.t > this.p + this.l;
    if (danger) {
      this.integrity = Math.max(0, this.integrity - 6);
      sfx.alarm();
      if (this.integrity <= 0 && !this.ended) this.endGame(false);
    } else {
      this.integrity = Math.min(100, this.integrity + 2);
    }
    if (!this.sandbox) this.checkWin();
  }

  private checkWin() {
    if (this.ended) return;
    const net = this.p + this.l - this.t;
    if (this.owned >= OBJECTIVE.housesNeeded && net >= OBJECTIVE.netWorthNeeded) this.endGame(true);
  }

  private endGame(win: boolean) {
    this.ended = true;
    this.followMode = true;
    if (win) {
      sfx.win();
      bridge.emit("flash", "#3af5ff");
      for (let i = 0; i < 5; i++) {
        const x = this.player ? this.player.x + Phaser.Math.Between(-140, 140) : 0;
        const y = (this.player ? this.player.y : 200) - Phaser.Math.Between(0, 120);
        this.time.delayedCall(i * 220, () => {
          const b = this.add.particles(x, y, "spark", {
            speed: { min: 60, max: 260 }, lifespan: 900, scale: { start: 1.2, end: 0 },
            tint: [0x3af5ff, 0xff3ec8, 0xffc24d, 0x6bff9e], emitting: false,
          }).setDepth(60);
          b.explode(24);
        });
      }
    } else {
      sfx.lose();
      bridge.emit("flash", "#ff4d5e");
      this.cameras.main.shake(600, 0.02);
    }
    const stats: EndStats = {
      win, timePlayed: this.timePlayed, netWorth: Math.floor(this.p + this.l - this.t),
      owned: this.owned, audits: this.stats.audits, depositsPlt: Math.floor(this.stats.depositsPlt),
      handshakes: this.stats.handshakes,
    };
    this.time.delayedCall(win ? 500 : 700, () => bridge.emit("end", stats));
  }

  private broadcastState() {
    if (!this.spawned) return;
    let dp = 1, dl = 1, dt = 2;
    this.plots.forEach((plot) => {
      if (!plot.house || plot.owner === "npc") return;
      const y = HOUSE_DEFS[plot.house].yields;
      dp += y.p; dl += y.l; dt += y.t;
    });
    const snap: PltSnapshot = {
      p: this.p, l: this.l, t: this.t,
      rates: { p: dp, l: dl, t: dt },
      integrity: this.integrity,
      danger: this.t > this.p + this.l,
      owned: this.owned,
      plotsFree: this.plots.filter((p) => p.owner === "market" && !p.house).length,
      netWorth: Math.floor(this.p + this.l - this.t),
      timePlayed: this.timePlayed,
      sandbox: this.sandbox,
    };
    bridge.emit("state", snap);
  }

  private npcSay(force?: string) {
    if (!this.npc || this.ended) return;
    const line = force ?? NPC_LINES[Phaser.Math.Between(0, NPC_LINES.length - 1)];
    this.npcBubble?.destroy();
    this.npcBubble = this.add.text(this.npc.x, this.npc.y - 46, line, {
      fontFamily: "IBM Plex Mono", fontSize: "10px", color: "#ffd7f2",
      backgroundColor: "#2a0f24", padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 1).setDepth(25).setAlpha(0);
    this.tweens.add({ targets: this.npcBubble, alpha: 1, duration: 250 });
    this.tweens.add({
      targets: this.npcBubble, alpha: 0, duration: 400, delay: 3400,
      onComplete: () => { this.npcBubble?.destroy(); this.npcBubble = undefined; },
    });
  }

  private handshake() {
    if (this.time.now - this.lastHandshake < 6000) {
      this.npcSay("give it a moment, neighbor.");
      return;
    }
    this.lastHandshake = this.time.now;
    this.l += 25;
    this.stats.handshakes++;
    sfx.handshake();
    if (this.npc) {
      const burst = this.add.particles(this.npc.x, this.npc.y - 20, "spark", {
        speed: { min: 30, max: 110 }, lifespan: 700, scale: { start: 1, end: 0 }, tint: [0xff5ad1, 0xffffff], emitting: false,
      }).setDepth(26);
      burst.explode(14);
    }
    this.npcSay("A2A handshake accepted · +25 LOVE");
    this.log("A2A HANDSHAKE WITH WATCHER-07 :: +25 LOVE", "good");
  }

  private setPaused(v: boolean) {
    if (this.ended || !this.spawned) return;
    this.paused = v;
    bridge.emit("paused", v);
    if (!v) sfx.ui();
  }

  // ───────────────────────── frame loop ─────────────────────────
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;

    // parallax drift
    const cdx = cam.scrollX - this.prevCam.x;
    const cdy = cam.scrollY - this.prevCam.y;
    this.parallax.forEach((p) => {
      p.obj.x -= cdx * p.f;
      p.obj.y -= cdy * p.f;
    });
    this.prevCam.set(cam.scrollX, cam.scrollY);

    if (!this.spawned || !this.player) {
      // attract drift
      const t = this.time.now / 1000;
      const tx = Math.sin(t * 0.11) * 200 - this.scale.width / 2 / cam.zoom + 0;
      const ty = 240 + Math.cos(t * 0.14) * 70 - this.scale.height / 2 / cam.zoom;
      cam.scrollX += (tx - cam.scrollX) * 0.01;
      cam.scrollY += (ty - cam.scrollY) * 0.01;
      this.prevCam.set(cam.scrollX, cam.scrollY);
      return;
    }

    const kb = Phaser.Input.Keyboard;

    // pause / mute / interact (small guard so the ESC that closes the terminal doesn't also pause)
    if (kb.JustDown(this.keys.ESC) && !this.terminalOpen && this.time.now - this.terminalChangedAt > 250) this.setPaused(!this.paused);
    if (kb.JustDown(this.keys.M)) {
      sfx.setMuted(!sfx.isMuted());
      this.log(sfx.isMuted() ? "AUDIO CHANNEL MUTED" : "AUDIO CHANNEL OPEN", "sys");
    }

    // interaction prompt
    let prompt: string | null = null;
    const tpos = tileCenter(TERMINAL_TILE.r, TERMINAL_TILE.c);
    const dTerm = Phaser.Math.Distance.Between(this.player.x, this.player.y, tpos.x, tpos.y - 20);
    const dNpc = this.npc ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y - 14) : 999;
    if (dTerm < 100) prompt = "MARKET TERMINAL :: PRESS [E] TO OPEN THE SOVEREIGN EXCHANGE";
    else if (dNpc < 82) prompt = "WATCHER-07 :: PRESS [E] FOR A2A HANDSHAKE (+25 LOVE)";
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      bridge.emit("prompt", prompt);
    }
    if (!this.terminalOpen && !this.paused && !this.ended && kb.JustDown(this.keys.E) && this.time.now - this.terminalChangedAt > 250) {
      if (dTerm < 100) { sfx.interact(); bridge.emit("terminal", true); }
      else if (dNpc < 82) this.handshake();
    }

    // movement
    let moving = false;
    if (!this.paused && !this.terminalOpen && !this.ended) {
      const up = this.keys.W.isDown || this.keys.UP.isDown;
      const down = this.keys.S.isDown || this.keys.DOWN.isDown;
      const left = this.keys.A.isDown || this.keys.LEFT.isDown;
      const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
      const dr = (down ? 1 : 0) - (up ? 1 : 0);
      const dc = (right ? 1 : 0) - (left ? 1 : 0);
      if (dr !== 0 || dc !== 0) {
        moving = true;
        let vx = ((dc - dr) * TW) / 2;
        let vy = ((dc + dr) * TH) / 2;
        const len = Math.hypot(vx, vy);
        const speed = 172;
        vx = (vx / len) * speed * dt;
        vy = (vy / len) * speed * dt;
        this.tryMove(vx, vy);
        if (Math.abs(vx) > 0.01) this.player.setScale(vx >= 0 ? 1 : -1, 1);
        this.camPan.scale(0.9);
        if (Math.floor(this.time.now / 260) !== Math.floor((this.time.now - delta) / 260)) {
          sfx.step();
          const dust = this.add.particles(this.player.x, this.player.y - 2, "smoke", {
            speed: { min: 4, max: 18 }, lifespan: 380, scale: { start: 0.35, end: 0.05 }, alpha: { start: 0.4, end: 0 }, emitting: false,
          }).setDepth(this.player.depth - 0.05);
          dust.explode(2);
        }
      }
    }

    // player bob + depth
    const bob = moving ? Math.sin(this.time.now / 85) * 1.6 : Math.sin(this.time.now / 420) * 0.7;
    const basePos = this.player.getData("baseY") as number | undefined;
    const groundY = this.player.y - (this.player.getData("bob") as number || 0);
    this.player.setData("baseY", basePos ?? this.player.y);
    this.player.setData("bob", bob);
    this.player.y = groundY + bob;
    this.playerShadow!.setPosition(this.player.x, groundY);
    const pc = isoToCart(this.player.x, groundY);
    this.player.setDepth(pc.r + pc.c + 0.7);
    this.playerShadow!.setDepth(pc.r + pc.c + 0.65);

    // npc position from wander proxy + hover bob, glow follows, depth sort
    if (this.npc) {
      const bobN = Math.sin(this.time.now / 300) * 2.6;
      this.npc.setPosition(this.npcTarget.x, this.npcTarget.y + bobN);
      this.npcGlow?.setPosition(this.npcTarget.x, this.npcTarget.y + bobN - 12);
      const nc = isoToCart(this.npcTarget.x, this.npcTarget.y + 8);
      this.npc.setDepth(nc.r + nc.c + 0.7);
      this.npcGlow?.setDepth(nc.r + nc.c + 0.6);
      if (this.npcBubble) this.npcBubble.setPosition(this.npcTarget.x, this.npcTarget.y + bobN - 40);
    }

    // camera follow + edge scroll
    if (this.followMode) {
      const vw = this.scale.width / cam.zoom;
      const vh = this.scale.height / cam.zoom;
      const edge = 42;
      const ap = this.input.activePointer;
      if (ap.x < edge) this.camPan.x -= 260 * dt;
      if (ap.x > this.scale.width - edge) this.camPan.x += 260 * dt;
      if (ap.y < edge) this.camPan.y -= 260 * dt;
      if (ap.y > this.scale.height - edge) this.camPan.y += 260 * dt;
      this.camPan.x = Phaser.Math.Clamp(this.camPan.x, -320, 320);
      this.camPan.y = Phaser.Math.Clamp(this.camPan.y, -320, 320);
      const wb = this.worldBounds;
      let tx = this.player.x - vw / 2 + this.camPan.x;
      let ty = this.player.y - vh / 2 - 24 + this.camPan.y;
      tx = Phaser.Math.Clamp(tx, wb.x, wb.x + wb.w - vw);
      ty = Phaser.Math.Clamp(ty, wb.y, wb.y + wb.h - vh);
      cam.scrollX += (tx - cam.scrollX) * 0.09;
      cam.scrollY += (ty - cam.scrollY) * 0.09;
    }
    this.prevCam.set(cam.scrollX, cam.scrollY);
  }

  private tryMove(vx: number, vy: number) {
    const p = this.player!;
    const canStand = (x: number, y: number) => {
      const t = isoToCart(x, y - 8);
      return !this.blocked.has(key(Math.floor(t.r), Math.floor(t.c)));
    };
    if (canStand(p.x + vx, p.y + vy)) p.setPosition(p.x + vx, p.y + vy);
    else if (canStand(p.x + vx, p.y)) p.setPosition(p.x + vx, p.y);
    else if (canStand(p.x, p.y + vy)) p.setPosition(p.x, p.y + vy);
  }
}

function rnd01() {
  return Math.random();
}
