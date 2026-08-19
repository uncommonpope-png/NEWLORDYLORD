import Phaser from "phaser";

const P = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const diamond = (cx: number, cy: number, hw: number, hh: number) => [
  P(cx, cy - hh), P(cx + hw, cy), P(cx, cy + hh), P(cx - hw, cy),
];

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeTextures(scene: Phaser.Scene) {
  // ── ground tiles (64x32 diamonds) ──
  const grassTones = [
    ["#17453a", "#1d5a4a", "#0f332b"],
    ["#1a4a38", "#226150", "#113a2d"],
    ["#153f3d", "#1b5349", "#0e2f30"],
  ];
  grassTones.forEach((tones, vi) => {
    tex(scene, `tile_grass${vi}`, 64, 32, (g) => {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(tones[0]).color, 1);
      g.fillPoints(diamond(32, 16, 32, 16), true);
      const r2 = mulberry32(77 + vi * 31);
      for (let i = 0; i < 5; i++) {
        const px = 12 + r2() * 40, py = 8 + r2() * 16;
        g.fillStyle(Phaser.Display.Color.HexStringToColor(r2() > 0.5 ? tones[1] : tones[2]).color, 0.8);
        g.fillPoints(diamond(px, py, 3 + r2() * 4, 1.5 + r2() * 2), true);
      }
      g.lineStyle(1, Phaser.Display.Color.HexStringToColor(tones[1]).color, 0.7);
      g.beginPath(); g.moveTo(1, 16); g.lineTo(32, 1); g.lineTo(63, 16); g.strokePath();
    });
  });

  tex(scene, "tile_path", 64, 32, (g) => {
    g.fillStyle(0x33405e, 1);
    g.fillPoints(diamond(32, 16, 32, 16), true);
    const r2 = mulberry32(991);
    for (let i = 0; i < 7; i++) {
      const px = 10 + r2() * 44, py = 7 + r2() * 18;
      g.fillStyle(r2() > 0.6 ? 0x46588a : 0x2a3550, 1);
      g.fillPoints(diamond(px, py, 4 + r2() * 4, 2 + r2() * 2), true);
    }
    g.lineStyle(1, 0x3af5ff, 0.22);
    g.strokePoints(diamond(32, 16, 30, 14.5), true);
  });

  tex(scene, "tile_void", 64, 32, (g) => {
    g.fillStyle(0x0a0e1d, 1);
    g.fillPoints(diamond(32, 16, 32, 16), true);
    g.lineStyle(1, 0x3af5ff, 0.09);
    g.strokePoints(diamond(32, 16, 31, 15.5), true);
    const r2 = mulberry32(555);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0xff3ec8, 0.14 + r2() * 0.15);
      g.fillCircle(8 + r2() * 48, 6 + r2() * 20, 1);
    }
  });

  // ── barrier panel ──
  tex(scene, "barrier", 64, 58, (g) => {
    const pts = [P(10, 58), P(54, 58), P(60, 12), P(32, 0), P(4, 12)];
    g.fillStyle(0x3af5ff, 0.13);
    g.fillPoints(pts, true);
    g.lineStyle(1.5, 0x3af5ff, 0.55);
    g.strokePoints(pts, true);
    g.lineStyle(1, 0x3af5ff, 0.3);
    g.beginPath(); g.moveTo(32, 8); g.lineTo(32, 54); g.strokePath();
    g.beginPath(); g.moveTo(14, 40); g.lineTo(50, 40); g.strokePath();
    g.fillStyle(0x9ffbff, 0.9);
    g.fillCircle(32, 4, 2.2);
  });

  // ── plot for-sale marker ──
  tex(scene, "plot_marker", 140, 74, (g) => {
    g.lineStyle(2, 0x3af5ff, 0.8);
    g.strokePoints(diamond(70, 37, 66, 33), true);
    g.lineStyle(1, 0xff3ec8, 0.6);
    g.strokePoints(diamond(70, 37, 54, 27), true);
    [P(70, 4), P(136, 37), P(70, 70), P(4, 37)].forEach((p) => {
      g.fillStyle(0x3af5ff, 1); g.fillCircle(p.x, p.y, 3);
    });
  });

  // ── NEON SPIRE ──
  tex(scene, "house_neon", 150, 220, (g) => {
    const cx = 75, baseY = 186;
    g.fillStyle(0x0a1226, 1); g.fillPoints(diamond(cx, baseY, 66, 33), true);
    g.lineStyle(1.5, 0x3af5ff, 0.8); g.strokePoints(diamond(cx, baseY, 66, 33), true);
    const hw = 40, hh = 20, H = 132;
    const L = P(cx - hw, baseY), B = P(cx, baseY + hh), R = P(cx + hw, baseY);
    g.fillStyle(0x16255c, 1);
    g.fillPoints([L, B, P(B.x, B.y - H), P(L.x, L.y - H)], true);
    g.fillStyle(0x0d1738, 1);
    g.fillPoints([B, R, P(R.x, R.y - H), P(B.x, B.y - H)], true);
    g.fillStyle(0x1e3070, 1);
    g.fillPoints(diamond(cx, baseY - H, hw, hh), true);
    const H2 = 34, hw2 = 26, hh2 = 13, y2 = baseY - H;
    g.fillStyle(0x1a2c66, 1);
    g.fillPoints([P(cx - hw2, y2), P(cx, y2 + hh2), P(cx, y2 + hh2 - H2), P(cx - hw2, y2 - H2)], true);
    g.fillStyle(0x101d46, 1);
    g.fillPoints([P(cx, y2 + hh2), P(cx + hw2, y2), P(cx + hw2, y2 - H2), P(cx, y2 + hh2 - H2)], true);
    g.fillStyle(0x243a86, 1);
    g.fillPoints(diamond(cx, y2 - H2, hw2, hh2), true);
    g.lineStyle(2, 0x8fa5d8, 1); g.beginPath(); g.moveTo(cx, y2 - H2); g.lineTo(cx, y2 - H2 - 26); g.strokePath();
    g.fillStyle(0xff3ec8, 1); g.fillCircle(cx, y2 - H2 - 28, 3.4);
    for (let i = 0; i < 6; i++) {
      const wy = baseY - 18 - i * 19;
      g.fillStyle(i % 2 ? 0xff3ec8 : 0x3af5ff, 0.9);
      g.fillPoints([P(cx + 8, wy + 4), P(cx + hw - 6, wy - 3), P(cx + hw - 6, wy - 7), P(cx + 8, wy)], true);
    }
    g.fillStyle(0x0a1226, 1);
    g.fillPoints([P(cx - hw + 6, baseY - 34), P(cx - 8, baseY - 21), P(cx - 8, baseY - 61), P(cx - hw + 6, baseY - 74)], true);
    g.lineStyle(1.5, 0xff3ec8, 1);
    g.strokePoints([P(cx - hw + 6, baseY - 34), P(cx - 8, baseY - 21), P(cx - 8, baseY - 61), P(cx - hw + 6, baseY - 74)], true);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x3af5ff, 0.95);
      g.fillPoints([P(cx - hw + 12, baseY - 42 - i * 10), P(cx - 14, baseY - 29 - i * 10), P(cx - 14, baseY - 32 - i * 10), P(cx - hw + 12, baseY - 45 - i * 10)], true);
    }
    g.fillStyle(0x050a1c, 1);
    g.fillPoints([P(cx + 10, baseY + 12), P(cx + 26, baseY + 4), P(cx + 26, baseY - 24), P(cx + 10, baseY - 16)], true);
    g.lineStyle(1.5, 0x3af5ff, 0.9);
    g.strokePoints([P(cx + 10, baseY + 12), P(cx + 26, baseY + 4), P(cx + 26, baseY - 24), P(cx + 10, baseY - 16)], true);
    g.lineStyle(1, 0x3af5ff, 0.35);
    g.beginPath(); g.moveTo(cx - hw, baseY); g.lineTo(cx - hw, baseY - H); g.moveTo(cx + hw, baseY); g.lineTo(cx + hw, baseY - H); g.strokePath();
  });

  // ── HEARTHWOOD LODGE ──
  tex(scene, "house_hearth", 150, 200, (g) => {
    const cx = 75, baseY = 168, hw = 52, hh = 26, H = 66;
    g.fillStyle(0x12291f, 0.9); g.fillPoints(diamond(cx, baseY, 64, 32), true);
    const L = P(cx - hw, baseY), B = P(cx, baseY + hh), R = P(cx + hw, baseY);
    g.fillStyle(0x6b4a2f, 1);
    g.fillPoints([L, B, P(B.x, B.y - H), P(L.x, L.y - H)], true);
    g.fillStyle(0x4e3421, 1);
    g.fillPoints([B, R, P(R.x, R.y - H), P(B.x, B.y - H)], true);
    g.lineStyle(2, 0x3a2415, 0.9);
    for (let i = 1; i < 3; i++) {
      g.beginPath(); g.moveTo(L.x, L.y - (H / 3) * i); g.lineTo(B.x, B.y - (H / 3) * i); g.lineTo(R.x, R.y - (H / 3) * i); g.strokePath();
    }
    const ry = baseY - H, apex = P(cx, ry - 52);
    const TL = P(cx - hw - 8, ry + 2), TB = P(cx, ry + hh + 6), TR = P(cx + hw + 8, ry + 2), TT = P(cx, ry - hh - 6);
    g.fillStyle(0x2c5e42, 1); g.fillPoints([apex, TT, TR], true);
    g.fillStyle(0x234c35, 1); g.fillPoints([apex, TR, TB], true);
    g.fillStyle(0x387050, 1); g.fillPoints([apex, TB, TL], true);
    g.fillStyle(0x2c5e42, 1); g.fillPoints([apex, TL, TT], true);
    g.lineStyle(1.5, 0x8fd96b, 0.5);
    g.beginPath(); g.moveTo(apex.x, apex.y); g.lineTo(TB.x, TB.y); g.moveTo(apex.x, apex.y); g.lineTo(TR.x, TR.y); g.strokePath();
    const r2 = mulberry32(4242);
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0x8fd96b, 0.35 + r2() * 0.3);
      g.fillCircle(cx - 40 + r2() * 80, ry - 30 + r2() * 40, 1.6 + r2() * 1.6);
    }
    g.fillStyle(0x5b5f6b, 1); g.fillRect(cx + 22, ry - 58, 14, 30);
    g.fillStyle(0x71768a, 1); g.fillPoints(diamond(cx + 29, ry - 58, 8, 4), true);
    g.fillStyle(0x2a2d38, 1); g.fillPoints(diamond(cx + 29, ry - 58, 5, 2.5), true);
    g.fillStyle(0xffc24d, 0.95); g.fillCircle(cx - 26, baseY - 32, 7);
    g.lineStyle(2, 0x3a2415, 1); g.strokeCircle(cx - 26, baseY - 32, 7);
    g.beginPath(); g.moveTo(cx - 33, baseY - 32); g.lineTo(cx - 19, baseY - 32); g.strokePath();
    g.fillStyle(0x2f1d10, 1);
    g.fillPoints([P(cx + 12, baseY + 14), P(cx + 32, baseY + 4), P(cx + 32, baseY - 26), P(cx + 12, baseY - 16)], true);
    g.fillStyle(0xffc24d, 1); g.fillCircle(cx + 16, baseY - 6, 1.8);
    [[cx - 52, baseY + 6], [cx - 44, baseY + 14], [cx + 48, baseY + 10]].forEach(([fx, fy], i) => {
      g.fillStyle(i % 2 ? 0xff5ad1 : 0x8fd96b, 0.9); g.fillCircle(fx, fy, 2.4);
      g.fillStyle(i % 2 ? 0xff5ad1 : 0x8fd96b, 0.25); g.fillCircle(fx, fy, 5.5);
    });
  });

  // ── MONOLITH BUNKER ──
  tex(scene, "house_monolith", 150, 200, (g) => {
    const cx = 75, baseY = 168, hw = 58, hh = 29, H = 84;
    g.fillStyle(0x20242e, 1); g.fillPoints(diamond(cx, baseY, 66, 33), true);
    const L = P(cx - hw, baseY), B = P(cx, baseY + hh), R = P(cx + hw, baseY);
    g.fillStyle(0x5a6472, 1);
    g.fillPoints([L, B, P(B.x, B.y - H), P(L.x, L.y - H)], true);
    g.fillStyle(0x3d4552, 1);
    g.fillPoints([B, R, P(R.x, R.y - H), P(B.x, B.y - H)], true);
    const ry = baseY - H;
    g.fillStyle(0x6a7588, 1);
    g.fillPoints([P(L.x, ry), P(B.x, ry + hh), P(B.x, ry + hh - 8), P(L.x, ry - 8)], true);
    g.fillStyle(0x4a5464, 1);
    g.fillPoints([P(B.x, ry + hh), P(R.x, ry), P(R.x, ry - 8), P(B.x, ry + hh - 8)], true);
    g.fillStyle(0x77839a, 1);
    g.fillPoints([P(L.x, ry - 8), P(B.x, ry + hh - 8), P(R.x, ry - 8), P(cx, ry - hh - 8)], true);
    for (let i = 0; i < 4; i++) {
      const wy = baseY - 22 - i * 14;
      g.fillStyle(0x14181f, 1);
      g.fillPoints([P(cx + 12, wy + 5), P(cx + hw - 10, wy - 2), P(cx + hw - 10, wy - 6), P(cx + 12, wy + 1)], true);
    }
    g.fillStyle(0x232932, 1);
    g.fillPoints([P(cx - 44, baseY + 4), P(cx - 12, baseY + 20), P(cx - 12, baseY - 26), P(cx - 44, baseY - 42)], true);
    for (let i = 0; i < 5; i++) {
      const sy = baseY + 14 - i * 10;
      g.fillStyle(i % 2 ? 0xffc24d : 0x11141a, 1);
      g.fillPoints([P(cx - 42, sy), P(cx - 14, sy + 14), P(cx - 14, sy + 9), P(cx - 42, sy - 5)], true);
    }
    const r2 = mulberry32(88);
    for (let i = 0; i < 12; i++) {
      g.fillStyle(0x2c323e, 1);
      g.fillCircle(cx - 50 + r2() * 100, baseY - 8 - r2() * 66, 1.4);
    }
    g.lineStyle(2, 0x2c323e, 1); g.beginPath(); g.moveTo(cx + 20, ry - 14); g.lineTo(cx + 20, ry - 38); g.strokePath();
    g.fillStyle(0xff4d5e, 1); g.fillCircle(cx + 20, ry - 40, 3.4);
    g.fillStyle(0xff4d5e, 0.25); g.fillCircle(cx + 20, ry - 40, 7);
    g.fillStyle(0xff4d5e, 0.8);
    g.fillPoints([P(cx + 20, baseY - 52), P(cx + hw - 16, baseY - 60), P(cx + hw - 16, baseY - 64), P(cx + 20, baseY - 56)], true);
  });

  // ── market terminal ──
  tex(scene, "terminal", 72, 122, (g) => {
    const cx = 36, baseY = 106;
    g.fillStyle(0x0a1226, 1); g.fillPoints(diamond(cx, baseY, 32, 16), true);
    g.lineStyle(1.5, 0x3af5ff, 0.7); g.strokePoints(diamond(cx, baseY, 32, 16), true);
    const H = 74, hw = 17, hh = 8.5;
    g.fillStyle(0x14224a, 1);
    g.fillPoints([P(cx - hw, baseY), P(cx, baseY + hh), P(cx, baseY + hh - H), P(cx - hw, baseY - H)], true);
    g.fillStyle(0x0b1430, 1);
    g.fillPoints([P(cx, baseY + hh), P(cx + hw, baseY), P(cx + hw, baseY - H), P(cx, baseY + hh - H)], true);
    g.fillStyle(0x1e3070, 1);
    g.fillPoints(diamond(cx, baseY - H, hw, hh), true);
    g.fillStyle(0x031018, 1);
    g.fillPoints([P(cx + 3, baseY - 8), P(cx + hw - 3, baseY - 14), P(cx + hw - 3, baseY - 52), P(cx + 3, baseY - 46)], true);
    g.lineStyle(1.5, 0x3af5ff, 0.95);
    g.strokePoints([P(cx + 3, baseY - 8), P(cx + hw - 3, baseY - 14), P(cx + hw - 3, baseY - 52), P(cx + 3, baseY - 46)], true);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0xff3ec8 : 0x3af5ff, 0.9);
      g.fillPoints([P(cx + 6, baseY - 16 - i * 8), P(cx + hw - 6, baseY - 19 - i * 8), P(cx + hw - 6, baseY - 21 - i * 8), P(cx + 6, baseY - 18 - i * 8)], true);
    }
    g.fillStyle(0xffc24d, 1); g.fillRect(cx - hw + 5, baseY - 24, 8, 3);
    g.lineStyle(1, 0x3af5ff, 0.5);
    g.beginPath(); g.moveTo(cx - hw, baseY); g.lineTo(cx - hw, baseY - H); g.strokePath();
    g.fillStyle(0x3af5ff, 1); g.fillCircle(cx, baseY - H - 4, 2.4);
  });

  // ── player avatar ──
  tex(scene, "player", 30, 46, (g) => {
    const cx = 15;
    g.fillStyle(0x101d3a, 1); g.fillRect(cx - 7, 32, 5, 10); g.fillRect(cx + 2, 32, 5, 10);
    g.fillStyle(0x1b2f5e, 1); g.fillRoundedRect(cx - 9, 16, 18, 18, 4);
    g.fillStyle(0x2a4585, 1); g.fillRoundedRect(cx - 9, 16, 9, 18, 4);
    g.fillStyle(0x3af5ff, 1); g.fillCircle(cx, 23, 2.6);
    g.fillStyle(0x3af5ff, 0.25); g.fillCircle(cx, 23, 5.5);
    g.fillStyle(0xff3ec8, 1); g.fillRoundedRect(cx + 6, 18, 5, 12, 2);
    g.fillStyle(0x223a6e, 1); g.fillCircle(cx, 9, 8);
    g.fillStyle(0x3af5ff, 1); g.fillRoundedRect(cx - 6, 6, 12, 5, 2.5);
    g.fillStyle(0xeaffff, 0.9); g.fillRect(cx - 4, 7, 3, 3);
    g.fillStyle(0x3af5ff, 0.85); g.fillRect(cx - 10, 16, 3, 6); g.fillRect(cx + 7, 16, 3, 6);
  });

  // ── watcher agent ──
  tex(scene, "watcher", 28, 38, (g) => {
    const cx = 14, cy = 17;
    g.fillStyle(0xff3ec8, 0.25); g.fillCircle(cx, cy + 2, 13);
    g.fillStyle(0x7a1a5e, 1); g.fillTriangle(cx, cy - 14, cx - 11, cy, cx, cy + 3);
    g.fillStyle(0xff3ec8, 1); g.fillTriangle(cx, cy - 14, cx + 11, cy, cx, cy + 3);
    g.fillStyle(0xb02a8a, 1); g.fillTriangle(cx - 11, cy, cx, cy + 3, cx, cy + 15);
    g.fillStyle(0xe05ab4, 1); g.fillTriangle(cx + 11, cy, cx, cy + 3, cx, cy + 15);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 3.6);
    g.fillStyle(0x3af5ff, 1); g.fillCircle(cx, cy, 1.8);
  });

  // ── pirate ship ──
  tex(scene, "ship", 120, 52, (g) => {
    g.fillStyle(0x141b30, 1);
    g.fillPoints([P(4, 30), P(26, 18), P(60, 12), P(100, 16), P(116, 26), P(96, 36), P(40, 40)], true);
    g.fillStyle(0x0c1122, 1);
    g.fillPoints([P(34, 12), P(52, 2), P(60, 12)], true);
    g.lineStyle(1.5, 0xff3ec8, 0.7);
    g.beginPath(); g.moveTo(6, 31); g.lineTo(96, 35); g.strokePath();
    [38, 58, 78].forEach((px) => { g.fillStyle(0xffc24d, 0.95); g.fillCircle(px, 24, 2.4); g.fillStyle(0xffc24d, 0.25); g.fillCircle(px, 24, 5); });
    g.fillStyle(0x3af5ff, 0.9); g.fillCircle(8, 30, 3);
    g.fillStyle(0x3af5ff, 0.25); g.fillCircle(8, 30, 7);
    g.fillStyle(0x141b30, 1);
    g.fillTriangle(96, 36, 108, 40, 100, 44);
    g.fillTriangle(70, 39, 82, 42, 74, 47);
  });

  // ── props ──
  tex(scene, "prop_lamp", 26, 66, (g) => {
    g.fillStyle(0x2a3550, 1); g.fillRect(11, 14, 4, 48);
    g.fillStyle(0x2a3550, 1); g.fillPoints(diamond(13, 62, 9, 4.5), true);
    g.fillStyle(0x0b1430, 1); g.fillRoundedRect(4, 4, 18, 12, 3);
    g.fillStyle(0x3af5ff, 1); g.fillRoundedRect(6, 6, 14, 8, 2);
  });
  tex(scene, "prop_tree", 52, 84, (g) => {
    g.fillStyle(0x4e3421, 1); g.fillRect(23, 48, 7, 30);
    const blobs: [number, number, number, number][] = [
      [26, 30, 20, 0x1d5a4a], [14, 40, 13, 0x17453a], [38, 42, 14, 0x226150], [26, 18, 13, 0x226150],
    ];
    blobs.forEach(([x, y, r, c]) => { g.fillStyle(c, 1); g.fillCircle(x, y, r); });
    const r2 = mulberry32(31);
    for (let i = 0; i < 6; i++) { g.fillStyle(0x8fd96b, 0.7); g.fillCircle(10 + r2() * 32, 10 + r2() * 36, 1.4); }
    g.fillStyle(0xff5ad1, 0.9); g.fillCircle(32, 26, 2); g.fillCircle(18, 34, 2);
  });
  tex(scene, "prop_rack", 42, 58, (g) => {
    g.fillStyle(0x10162a, 1); g.fillRect(4, 6, 34, 46);
    g.fillStyle(0x1a2340, 1); g.fillRect(4, 6, 34, 6);
    g.lineStyle(1, 0x2a3550, 1); g.strokeRect(4, 6, 34, 46);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x0b1020, 1); g.fillRect(8, 16 + i * 9, 26, 5);
      g.fillStyle(i % 2 ? 0x3af5ff : 0xffc24d, 0.95); g.fillCircle(11, 18.5 + i * 9, 1.4);
      g.fillStyle(0xff4d5e, 0.8); g.fillCircle(30, 18.5 + i * 9, 1.2);
    }
  });

  // ── fx ──
  tex(scene, "spark", 10, 10, (g) => {
    g.fillStyle(0xffffff, 1); g.fillCircle(5, 5, 3);
    g.fillStyle(0xffffff, 0.35); g.fillCircle(5, 5, 5);
  });
  tex(scene, "glow", 64, 64, (g) => {
    for (let i = 8; i > 0; i--) { g.fillStyle(0xffffff, 0.045); g.fillCircle(32, 32, i * 4); }
    g.fillStyle(0xffffff, 0.5); g.fillCircle(32, 32, 5);
  });
  tex(scene, "smoke", 14, 14, (g) => {
    g.fillStyle(0xaab6cc, 0.5); g.fillCircle(7, 7, 5);
    g.fillStyle(0xaab6cc, 0.25); g.fillCircle(7, 7, 7);
  });
  tex(scene, "rain", 2, 12, (g) => {
    g.fillStyle(0x9fdcff, 0.7); g.fillRect(0, 0, 2, 12);
  });
  tex(scene, "shadow", 48, 24, (g) => {
    g.fillStyle(0x000000, 0.35); g.fillEllipse(24, 12, 44, 20);
  });
  tex(scene, "stars", 1600, 900, (g) => {
    const r2 = mulberry32(2024);
    const neb: [number, number, number, number][] = [
      [380, 260, 0x3af5ff, 150], [1150, 620, 0xff3ec8, 180], [800, 140, 0x6bff9e, 110], [1350, 180, 0xffc24d, 90],
    ];
    neb.forEach(([x, y, c, rad]) => {
      for (let i = 10; i > 0; i--) { g.fillStyle(c, 0.012); g.fillCircle(x, y, (rad / 10) * i); }
    });
    for (let i = 0; i < 220; i++) {
      const c = r2();
      g.fillStyle(c > 0.85 ? 0xff9de6 : c > 0.6 ? 0x9fdcff : 0xffffff, 0.25 + r2() * 0.65);
      g.fillCircle(r2() * 1600, r2() * 900, r2() > 0.9 ? 1.8 : 1);
    }
  });
}
