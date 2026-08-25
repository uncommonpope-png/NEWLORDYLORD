/**
 * SOULFEILD :: PROCEDURAL TEXTURE FOUNDRY
 * Every sprite in the Spatial OS is forged in code — isometric boxes,
 * houses, units, bugs, citadels, FX. Zero external assets.
 */
import Phaser from "phaser";

const P = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

/** Classic 2:1 iso box with light from the top-left. */
function isoBox(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, w: number, h: number, color: string, heightScale = 1) {
  const hw = w / 2, hh = w / 4, dh = h * heightScale;
  const top = baseY - dh;
  const topPts = [P(cx, top - hh), P(cx + hw, top), P(cx, top + hh), P(cx - hw, top)];
  const leftPts = [P(cx - hw, top), P(cx, top + hh), P(cx, baseY + hh), P(cx - hw, baseY)];
  const rightPts = [P(cx, top + hh), P(cx + hw, top), P(cx + hw, baseY), P(cx, baseY + hh)];
  g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
  g.fillPoints(topPts, true);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(shade(color, 0.66)).color, 1);
  g.fillPoints(leftPts, true);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(shade(color, 0.42)).color, 1);
  g.fillPoints(rightPts, true);
  g.lineStyle(1, Phaser.Display.Color.HexStringToColor(shade(color, 1.5)).color, 0.28);
  g.strokePoints(topPts, true);
  return { top, hw, hh };
}

/** Diamond ground tile. */
function tile(g: Phaser.GameObjects.Graphics, w: number, h: number, color: string, opts?: { edge?: string; detail?: (g: Phaser.GameObjects.Graphics) => void }) {
  const cx = w / 2, cy = h / 2;
  const pts = [P(cx, 0), P(w, cy), P(cx, h), P(0, cy)];
  g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
  g.fillPoints(pts, true);
  g.lineStyle(1, 0x000000, 0.22);
  g.strokePoints(pts, true);
  if (opts?.edge) {
    g.lineStyle(1, Phaser.Display.Color.HexStringToColor(opts.edge).color, 0.65);
    g.lineBetween(cx, 1, w - 1, cy);
    g.lineBetween(cx, 1, 1, cy);
  }
  opts?.detail?.(g);
}

function diamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, color: string, alpha = 1) {
  g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, alpha);
  g.fillPoints([P(cx, cy - h / 2), P(cx + w / 2, cy), P(cx, cy + h / 2), P(cx - w / 2, cy)], true);
}

export function createTextures(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, fn: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    fn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // ── ground tiles ────────────────────────────────
  make("grass", 64, 32, (g) => tile(g, 64, 32, "#15294a", {
    detail: (d) => {
      d.fillStyle(0x1e3a63, 0.9);
      d.fillRect(20, 14, 2, 2); d.fillRect(40, 18, 2, 2); d.fillRect(30, 22, 2, 2);
    },
  }));
  make("grass2", 64, 32, (g) => tile(g, 64, 32, "#132642", {
    detail: (d) => {
      d.lineStyle(1, 0x2c4d7d, 0.9);
      d.lineBetween(26, 18, 26, 14); d.lineBetween(38, 20, 38, 16);
    },
  }));
  make("grass3", 64, 32, (g) => tile(g, 64, 32, "#182f54", {
    detail: (d) => { d.fillStyle(0x0d1c36, 1); d.fillRect(36, 12, 3, 2); d.fillRect(24, 20, 3, 2); },
  }));
  make("path", 64, 32, (g) => tile(g, 64, 32, "#232d4d", {
    edge: "#3d4f82",
    detail: (d) => {
      d.lineStyle(1, 0x31406b, 1);
      d.lineBetween(16, 16, 30, 9); d.lineBetween(34, 25, 48, 18);
      d.fillStyle(0x3af5ff, 0.5); d.fillRect(31, 15, 2, 2);
    },
  }));
  make("void", 64, 32, (g) => tile(g, 64, 32, "#0a0d1c", {
    detail: (d) => {
      d.lineStyle(1, 0xff4d5e, 0.35);
      d.lineBetween(18, 14, 26, 18); d.lineBetween(40, 12, 34, 20);
      d.fillStyle(0xff4d5e, 0.4); d.fillRect(44, 17, 2, 2);
    },
  }));

  // ── houses (iso architecture, base at bottom center) ──────────────
  make("house_neon", 132, 176, (g) => {
    const cx = 66;
    isoBox(g, cx, 150, 96, 62, "#12234d");
    isoBox(g, cx, 150 - 62, 96, 10, "#1b3468");
    isoBox(g, cx - 20, 150 - 72, 44, 46, "#0e1c3d");
    isoBox(g, cx - 20, 150 - 72 - 46, 44, 8, "#3af5ff", 0.5);
    g.lineStyle(2, 0x3af5ff, 0.9); g.lineBetween(cx - 20, 150 - 120, cx - 20, 150 - 148);
    g.fillStyle(0xff3ec8, 1); g.fillCircle(cx - 20, 150 - 151, 3);
    g.fillStyle(0x050a18, 1);
    g.fillRect(cx - 34, 150 - 40, 20, 26);
    g.lineStyle(1.5, 0xff3ec8, 1); g.strokeRect(cx - 34, 150 - 40, 20, 26);
    for (let i = 0; i < 4; i++) {
      g.lineStyle(2, i % 2 ? 0xff3ec8 : 0x3af5ff, 0.95);
      g.lineBetween(cx + 14, 140 - i * 17, cx + 40, 127 - i * 17);
    }
    g.fillStyle(0x3af5ff, 0.12);
    g.fillPoints([P(cx, 152), P(cx + 52, 126), P(cx, 100), P(cx - 52, 126)], true);
  });

  make("house_hearth", 132, 160, (g) => {
    const cx = 66;
    isoBox(g, cx, 146, 100, 54, "#5a3f28");
    g.lineStyle(2, 0x3c2a1a, 1);
    g.lineBetween(cx - 48, 120, cx - 2, 143); g.lineBetween(cx - 48, 106, cx - 2, 129);
    isoBox(g, cx + 34, 146 - 54, 22, 30, "#6b7280");
    g.fillStyle(0x2b2f38, 1); g.fillEllipse(cx + 34, 146 - 54 - 30, 24, 10);
    isoBox(g, cx - 16, 146 - 54, 34, 34, "#4a3320");
    g.fillStyle(0x0d1c12, 1);
    g.fillPoints([P(cx - 16, 146 - 88 - 30), P(cx - 66, 146 - 46), P(cx - 16, 146 - 46 + 18), P(cx + 34, 146 - 46)], true);
    g.lineStyle(2, 0x8fd96b, 0.8);
    g.strokePoints([P(cx - 16, 146 - 118), P(cx - 66, 146 - 46), P(cx - 16, 146 - 28), P(cx + 34, 146 - 46)], true);
    g.fillStyle(0x241505, 1);
    g.fillRect(cx - 26, 146 - 34, 20, 34);
    g.lineStyle(1.5, 0xffc24d, 1); g.strokeRect(cx - 26, 146 - 34, 20, 34);
    g.fillStyle(0xffc24d, 0.9); g.fillCircle(cx + 20, 128, 5);
    g.lineStyle(1.5, 0xffc24d, 1); g.strokeCircle(cx + 20, 128, 8);
    g.fillStyle(0x8fd96b, 1);
    g.fillCircle(cx - 52, 140, 3); g.fillCircle(cx + 48, 134, 3); g.fillCircle(cx - 40, 150, 2);
  });

  make("house_monolith", 132, 168, (g) => {
    const cx = 66;
    isoBox(g, cx, 152, 104, 66, "#4b5563");
    g.fillStyle(0x23272f, 1);
    g.fillPoints([P(cx - 52, 152 - 66), P(cx, 152 - 66 + 26), P(cx, 152 - 66 + 38), P(cx - 52, 152 - 66 + 12)], true);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x14181f, 1);
      g.fillPoints([P(cx + 8, 146 - i * 15), P(cx + 44, 128 - i * 15), P(cx + 44, 132 - i * 15), P(cx + 8, 150 - i * 15)], true);
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0xff4d5e : 0x11141a, 1);
      g.fillPoints([P(cx - 44 + i * 11, 150 - i * 5.5), P(cx - 34 + i * 11, 145 - i * 5.5), P(cx - 34 + i * 11, 151 - i * 5.5), P(cx - 44 + i * 11, 156 - i * 5.5)], true);
    }
    g.fillStyle(0x11141a, 1);
    g.fillRect(cx - 14, 152 - 46, 28, 46);
    g.lineStyle(2, 0x9aa7bd, 1); g.strokeRect(cx - 14, 152 - 46, 28, 46);
    g.lineStyle(1, 0x9aa7bd, 0.7); g.lineBetween(cx, 152 - 46, cx, 152);
    g.lineStyle(2, 0x9aa7bd, 0.9); g.lineBetween(cx + 30, 152 - 66, cx + 30, 152 - 92);
    g.fillStyle(0xff4d5e, 1); g.fillCircle(cx + 30, 152 - 95, 3);
  });

  // ── market terminal ─────────────────────────────
  make("terminal", 88, 104, (g) => {
    const cx = 44;
    isoBox(g, cx, 96, 56, 30, "#1b2a52");
    g.fillStyle(0x04121f, 1);
    g.fillPoints([P(cx - 20, 96 - 30 - 24), P(cx + 4, 96 - 30 - 12), P(cx + 4, 96 - 30 + 6), P(cx - 20, 96 - 30 - 6)], true);
    g.lineStyle(1.5, 0x3af5ff, 1);
    g.strokePoints([P(cx - 20, 96 - 54), P(cx + 4, 96 - 42), P(cx + 4, 96 - 24), P(cx - 20, 96 - 36)], true);
    for (let i = 0; i < 3; i++) {
      g.lineStyle(1.5, i === 1 ? 0xff3ec8 : 0x3af5ff, 0.9);
      g.lineBetween(cx - 16, 96 - 48 + i * 6, cx - 2, 96 - 41 + i * 6);
    }
    g.lineStyle(2, 0xffc24d, 0.95); g.lineBetween(cx + 12, 96 - 30, cx + 12, 96 - 62);
    g.fillStyle(0xffc24d, 1); g.fillCircle(cx + 12, 96 - 65, 3);
    g.fillStyle(0x3af5ff, 0.25); g.fillCircle(cx + 12, 96 - 65, 6);
    diamond(g, cx, 99, 60, 30, "#3af5ff", 0.12);
  });

  // ── characters ──────────────────────────────────
  const unit = (key: string, primary: string, glow: string, kind: "avatar" | "knight" | "lancer" | "golem") => {
    const w = kind === "golem" ? 46 : 36, h = kind === "golem" ? 56 : 48;
    make(key, w, h, (g) => {
      const cx = w / 2, feet = h - 4;
      diamond(g, cx, feet, w - 8, (w - 8) / 2, "#000000", 0.35);
      isoBox(g, cx, feet - 2, kind === "golem" ? 30 : 20, kind === "golem" ? 26 : 18, shade(primary, 0.5));
      isoBox(g, cx, feet - 2 - (kind === "golem" ? 26 : 18), kind === "golem" ? 24 : 16, kind === "golem" ? 18 : 14, primary);
      if (kind === "golem") {
        isoBox(g, cx - 16, feet - 20, 10, 14, shade(primary, 0.7));
        isoBox(g, cx + 16, feet - 20, 10, 14, shade(primary, 0.7));
        g.fillStyle(Phaser.Display.Color.HexStringToColor(glow).color, 1);
        g.fillRect(cx - 3, feet - 36, 6, 6);
        g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(glow).color, 0.9);
        g.strokeRect(cx - 6, feet - 39, 12, 12);
      } else {
        g.fillStyle(Phaser.Display.Color.HexStringToColor(glow).color, 1);
        if (kind === "lancer") {
          g.fillRect(cx - 6, feet - 34, 4, 3); g.fillRect(cx + 2, feet - 34, 4, 3);
          g.lineStyle(2, 0xe8f4ff, 1);
          g.lineBetween(cx + 12, feet - 40, cx + 12, feet - 8);
          g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(glow).color, 1);
          g.lineBetween(cx + 12, feet - 40, cx + 20, feet - 24);
          g.lineBetween(cx + 20, feet - 24, cx + 12, feet - 8);
        } else {
          g.fillRect(cx - 6, feet - 32, 12, 3);
          if (kind === "knight") {
            g.fillStyle(0xe8f4ff, 1);
            g.fillPoints([P(cx + 12, feet - 6), P(cx + 15, feet - 6), P(cx + 15, feet - 30), P(cx + 13.5, feet - 36), P(cx + 12, feet - 30)], true);
            g.fillStyle(Phaser.Display.Color.HexStringToColor(glow).color, 1);
            g.fillRect(cx + 10, feet - 8, 7, 3);
          } else {
            g.lineStyle(2, Phaser.Display.Color.HexStringToColor(glow).color, 1);
            g.lineBetween(cx + 10, feet - 10, cx + 10, feet - 34);
          }
        }
      }
    });
  };
  unit("player", "#3af5ff", "#ffffff", "avatar");
  unit("knight", "#3af5ff", "#9ff7ff", "knight");
  unit("lancer", "#ff3ec8", "#ffd0f0", "lancer");
  unit("golem", "#ffc24d", "#ffe2a8", "golem");
  make("gleaner", 30, 30, (g) => {
    diamond(g, 15, 27, 18, 8, "#000000", 0.28);
    g.fillStyle(0x173324, 1); g.fillCircle(15, 15, 7.5);
    g.lineStyle(1.5, 0x6bff9e, 0.95); g.strokeCircle(15, 15, 7.5);
    g.fillStyle(0x6bff9e, 0.25); g.fillCircle(15, 15, 7.5);
    g.lineStyle(1.2, 0x9fdcff, 0.8);
    g.lineBetween(8, 10, 3, 5); g.lineBetween(22, 10, 27, 5);
    g.lineBetween(8, 20, 3, 25); g.lineBetween(22, 20, 27, 25);
    g.fillStyle(0x9fdcff, 0.9);
    g.fillCircle(3, 5, 2); g.fillCircle(27, 5, 2); g.fillCircle(3, 25, 2); g.fillCircle(27, 25, 2);
    g.fillStyle(0xeaffff, 1); g.fillCircle(15, 15, 2.2);
  });

  // ── new roster units ─────────────────────────────
  make("imp", 28, 30, (g) => {
    diamond(g, 14, 27, 18, 8, "#000000", 0.3);
    g.fillStyle(0x8a2418, 1); g.fillCircle(14, 17, 8);
    g.fillStyle(0xff6b5e, 1);
    g.fillPoints([P(7, 11), P(4, 3), P(11, 8)], true);
    g.fillPoints([P(21, 11), P(24, 3), P(17, 8)], true);
    g.fillStyle(0xffe066, 1); g.fillRect(10, 14, 3, 3); g.fillRect(16, 14, 3, 3);
    g.fillStyle(0x3d120c, 1); g.fillRect(11, 21, 7, 2);
  });
  make("scout", 30, 36, (g) => {
    diamond(g, 15, 33, 18, 8, "#000000", 0.3);
    isoBox(g, 15, 31, 12, 8, "#1e4a6e");
    isoBox(g, 15, 23, 10, 10, "#9fdcff");
    g.fillStyle(0x0c2233, 1); g.fillCircle(15, 9, 4);
    g.lineStyle(1.4, 0x9fdcff, 0.9); g.strokeCircle(15, 9, 4);
    g.fillStyle(0xeaffff, 1); g.fillRect(13.5, 7.5, 3, 3);
    g.lineStyle(1.2, 0x9fdcff, 0.7); g.lineBetween(21, 20, 27, 14);
  });
  make("bomber", 32, 34, (g) => {
    diamond(g, 16, 31, 20, 9, "#000000", 0.3);
    g.fillStyle(0x5e2c10, 1); g.fillCircle(16, 19, 10);
    g.lineStyle(1.5, 0xff8b3e, 0.95); g.strokeCircle(16, 19, 10);
    g.fillStyle(0xff8b3e, 0.2); g.fillCircle(16, 19, 10);
    g.lineStyle(1.2, 0xffc24d, 0.85);
    g.lineBetween(16, 9, 16, 4); g.strokeCircle(16, 3, 1.8);
    g.fillStyle(0xffe066, 1); g.fillRect(11, 16, 3, 3); g.fillRect(18, 16, 3, 3);
    g.fillStyle(0x3d1d0a, 1);
    g.fillRect(8, 24, 4, 3); g.fillRect(20, 24, 4, 3);
  });
  make("guardian", 40, 52, (g) => {
    diamond(g, 20, 48, 28, 12, "#000000", 0.3);
    isoBox(g, 20, 46, 24, 20, "#1e3a5e");
    isoBox(g, 20, 26, 20, 14, "#5ea8ff");
    g.fillStyle(0x16293f, 1); g.fillCircle(20, 10, 5.5);
    g.fillStyle(0x5ea8ff, 1); g.fillRect(17.5, 8, 5, 4);
    g.lineStyle(2, 0x9fdcff, 0.9); g.strokeRect(6, 26, 7, 18);
    g.fillStyle(0x5ea8ff, 0.35); g.fillRect(6, 26, 7, 18);
  });
  make("priest", 30, 40, (g) => {
    diamond(g, 15, 37, 18, 8, "#000000", 0.3);
    isoBox(g, 15, 35, 16, 12, "#8a7fa8");
    isoBox(g, 15, 23, 12, 10, "#f5f0ff");
    g.fillStyle(0xd8cfec, 1); g.fillCircle(15, 9, 4.5);
    g.fillStyle(0xffd977, 1);
    g.fillRect(13.5, 25, 3, 9); g.fillRect(11, 27.5, 8, 3);
    g.lineStyle(1.2, 0xffd977, 0.8); g.strokeCircle(15, 6, 6);
  });
  make("titan", 58, 74, (g) => {
    diamond(g, 29, 69, 42, 18, "#000000", 0.35);
    isoBox(g, 29, 66, 38, 30, "#5e4a1e");
    isoBox(g, 29, 36, 32, 22, "#ffd977");
    isoBox(g, 29 - 21, 52, 12, 18, "#b8934a");
    isoBox(g, 29 + 21, 52, 12, 18, "#b8934a");
    g.fillStyle(0x3d2f10, 1); g.fillCircle(29, 13, 7);
    g.fillStyle(0xffe9b0, 1); g.fillRect(25, 10, 8, 5);
    g.fillStyle(0xffd977, 0.3); g.fillCircle(29, 40, 9);
    g.lineStyle(2, 0xffe9b0, 0.8); g.strokeCircle(29, 40, 9);
  });

  // ── buildable structures ────────────────────────
  // ── wild creature shapes (tinted per species) ─────────────────────
  make("critter_blob", 30, 26, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15, 15, 10);
    g.fillStyle(0x0a0f1e, 1); g.fillCircle(11, 13, 2.2); g.fillCircle(19, 13, 2.2);
    g.fillStyle(0xffffff, 0.85); g.fillCircle(15, 19, 2.4);
  });
  make("critter_quad", 34, 26, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(17, 16, 22, 13);
    g.fillCircle(27, 9, 6);
    g.fillTriangle(23, 4, 26, -1, 28, 5);
    g.fillTriangle(28, 5, 31, -1, 32, 6);
    g.fillStyle(0x0a0f1e, 1); g.fillCircle(28, 8, 1.8);
    g.fillStyle(0xffffff, 1); g.fillRect(9, 21, 3, 5); g.fillRect(20, 21, 3, 5);
  });
  make("critter_wing", 34, 28, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(17, 16, 12, 16);
    g.fillTriangle(11, 12, -1, 4, 9, 20);
    g.fillTriangle(23, 12, 35, 4, 25, 20);
    g.fillStyle(0x0a0f1e, 1); g.fillCircle(14, 12, 2); g.fillCircle(20, 12, 2);
  });
  make("critter_snake", 36, 22, (g) => {
    g.lineStyle(6, 0xffffff, 1);
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const x = 4 + i * 1.4; const y = 12 + Math.sin(i / 3) * 5; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.strokePath();
    g.fillStyle(0xffffff, 1); g.fillCircle(32, 10, 5);
    g.fillStyle(0x0a0f1e, 1); g.fillCircle(33, 9, 1.6);
  });
  make("critter_rock", 32, 28, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints([P(16, 2), P(28, 10), P(26, 24), P(6, 24), P(4, 10)], true);
    g.fillStyle(0x0a0f1e, 0.35); g.fillPoints([P(16, 8), P(23, 13), P(16, 20), P(9, 13)], true);
    g.fillStyle(0x0a0f1e, 1); g.fillCircle(12, 13, 2); g.fillCircle(20, 13, 2);
  });
  // ── world dressing :: shadows, civilians, water, landmarks ─────────
  make("shadow", 48, 20, (g) => {
    g.fillStyle(0x000000, 0.32);
    g.fillEllipse(24, 10, 40, 14);
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(24, 10, 30, 10);
  });

  make("civilian", 28, 38, (g) => {
    diamond(g, 14, 36, 18, 8, "#000000", 0.25);
    g.fillStyle(0x2a3450, 1); g.fillRect(9, 18, 10, 14);          // coat
    g.fillStyle(0x3d4a70, 1); g.fillRect(9, 18, 10, 4);           // shoulders
    g.fillStyle(0xd8c8a8, 1); g.fillCircle(14, 13, 5.5);          // head
    g.fillStyle(0x5e4a3d, 1); g.fillCircle(14, 10.5, 5);          // hood/hair
    g.fillStyle(0x1a2038, 1); g.fillRect(10, 30, 3, 5); g.fillRect(15, 30, 3, 5); // legs
  });

  make("water", 64, 32, (g) => {
    diamond(g, 32, 16, 64, 32, "#0a2c4a", 1);
    g.lineStyle(1.4, 0x3af5ff, 0.5);
    g.lineBetween(14, 14, 26, 14); g.lineBetween(34, 19, 50, 19); g.lineBetween(22, 23, 34, 23);
    g.lineStyle(1, 0x9fdcff, 0.3);
    g.lineBetween(40, 10, 50, 10); g.lineBetween(12, 19, 20, 19);
  });

  make("landmark_obelisk", 56, 110, (g) => {
    diamond(g, 28, 102, 44, 20, "#1a0f0a", 0.9);
    g.fillStyle(0x14100c, 1);
    g.fillPoints([P(18, 100), P(38, 100), P(33, 8), P(23, 8)], true);
    g.fillStyle(0x2a2018, 1);
    g.fillPoints([P(28, 100), P(38, 100), P(33, 8), P(28, 8)], true);
    g.fillStyle(0xff8b3e, 0.95);
    g.fillRect(25, 20, 2, 12); g.fillRect(29, 42, 2, 16); g.fillRect(24, 70, 2, 10);
    g.fillStyle(0xffc24d, 1); g.fillTriangle(23, 8, 33, 8, 28, 0);
  });

  make("landmark_pyramid", 96, 84, (g) => {
    diamond(g, 48, 76, 88, 40, "#3d2f14", 0.9);
    g.fillStyle(0x8e7040, 1);
    g.fillPoints([P(10, 72), P(48, 84), P(48, 18)], true);
    g.fillStyle(0x5e4a28, 1);
    g.fillPoints([P(86, 72), P(48, 84), P(48, 18)], true);
    g.fillStyle(0xc9a860, 1); g.fillTriangle(40, 32, 56, 32, 48, 18);
    g.fillStyle(0xffd977, 1); g.fillCircle(48, 18, 3.5);
    g.lineStyle(1, 0x3d2f14, 0.8);
    g.lineBetween(24, 60, 66, 60); g.lineBetween(32, 46, 60, 46);
  });

  make("landmark_arch", 84, 96, (g) => {
    g.fillStyle(0x0e1c3d, 1);
    g.fillRect(10, 20, 10, 72); g.fillRect(64, 20, 10, 72);
    g.fillRect(4, 12, 76, 10); g.fillRect(10, 28, 64, 6);
    g.fillStyle(0xff3ec8, 1);
    g.fillRect(4, 10, 76, 3); g.fillRect(12, 26, 60, 2);
    g.fillStyle(0x3af5ff, 0.9);
    g.fillRect(13, 34, 4, 4); g.fillRect(67, 34, 4, 4);
    g.fillStyle(0xff3ec8, 0.35); g.fillCircle(42, 52, 14);
    g.fillStyle(0xff3ec8, 1); g.fillCircle(42, 52, 5);
  });

  make("landmark_crystal", 72, 100, (g) => {
    diamond(g, 36, 92, 60, 26, "#1a0f2a", 0.9);
    const shard = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0x3d2a5e, 1);
      g.fillPoints([P(x, y), P(x + w, y + h * 0.4), P(x, y + h), P(x - w, y + h * 0.4)], true);
      g.fillStyle(0xb58cff, 0.95);
      g.fillPoints([P(x, y), P(x + w * 0.4, y + h * 0.4), P(x, y + h), P(x - w * 0.25, y + h * 0.4)], true);
    };
    shard(36, 6, 12, 66); shard(20, 34, 8, 46); shard(52, 30, 9, 50);
    g.fillStyle(0xe6dcff, 0.9); g.fillRect(34, 14, 2, 8); g.fillRect(51, 40, 2, 6);
  });

  make("landmark_spire", 60, 120, (g) => {
    g.fillStyle(0xf5f0ff, 0.95);
    g.fillPoints([P(22, 112), P(38, 112), P(34, 20), P(26, 20)], true);
    g.fillStyle(0xcfc4f0, 1);
    g.fillPoints([P(30, 112), P(38, 112), P(34, 20), P(30, 20)], true);
    g.fillStyle(0xffd977, 1); g.fillTriangle(26, 20, 34, 20, 30, 6);
    g.lineStyle(2, 0xffd977, 0.9); g.strokeCircle(30, 60, 16);
    g.fillStyle(0xffd977, 0.3); g.fillCircle(30, 60, 16);
    g.fillStyle(0xb58cff, 0.9); g.fillCircle(30, 6, 3.5);
  });

  make("landmark_monolith", 64, 104, (g) => {
    diamond(g, 32, 98, 52, 22, "#141a2a", 0.95);
    isoBox(g, 32, 96, 40, 52, "#2a3450");
    isoBox(g, 32, 44, 32, 30, "#3d4a70");
    isoBox(g, 32, 14, 22, 18, "#5e6ea0");
    g.fillStyle(0x3af5ff, 0.95); g.fillCircle(32, 10, 4);
    g.fillStyle(0x3af5ff, 0.3); g.fillCircle(32, 10, 9);
    g.fillStyle(0xffc24d, 1); g.fillRect(26, 66, 12, 2); g.fillRect(26, 74, 12, 2);
  });

  make("critter_wisp", 26, 30, (g) => {
    g.fillStyle(0xffffff, 0.9); g.fillCircle(13, 11, 8);
    g.fillStyle(0xffffff, 0.5);
    g.fillTriangle(8, 16, 13, 30, 13, 17);
    g.fillTriangle(13, 17, 15, 28, 18, 16);
    g.fillStyle(0x0a0f1e, 1); g.fillCircle(10, 10, 1.8); g.fillCircle(16, 10, 1.8);
  });

  // ── FEEL layer :: loot & weather ────────────────────
  make("coin", 16, 16, (g) => {
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 7);
    g.fillStyle(0xfff4c8, 1); g.fillCircle(8, 8, 5.5);
    g.fillStyle(0xffc24d, 1); g.fillCircle(8, 8, 3.2);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(6.5, 6.5, 1.4);
  });
  make("ember", 6, 6, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(3, 3, 2.6); });
  make("rain", 2, 14, (g) => { g.fillStyle(0xffffff, 0.9); g.fillRect(0, 0, 1.6, 14); });
  make("sand", 5, 5, (g) => { g.fillStyle(0xffffff, 0.8); g.fillCircle(2.5, 2.5, 2); });
  make("spore", 7, 7, (g) => {
    g.fillStyle(0xffffff, 0.7); g.fillCircle(3.5, 3.5, 2.2);
    g.fillStyle(0xffffff, 0.35); g.fillCircle(3.5, 3.5, 3.4);
  });

  make("scaffold", 70, 80, (g) => {
    g.lineStyle(2, 0xffc24d, 0.7);
    g.strokePoints([P(35, 6), P(64, 22), P(35, 38), P(6, 22)], true);
    g.lineBetween(35, 6, 35, 70); g.lineBetween(6, 22, 6, 58); g.lineBetween(64, 22, 64, 58);
    g.lineStyle(1, 0xffc24d, 0.45);
    g.lineBetween(6, 58, 35, 70); g.lineBetween(64, 58, 35, 70);
    g.lineBetween(6, 40, 64, 40); g.lineBetween(20, 13, 20, 63); g.lineBetween(50, 13, 50, 63);
  });
  make("struct_supply", 56, 78, (g) => {
    const cx = 28, feet = 72;
    diamond(g, cx, feet, 48, 24, "#0c2418", 0.85);
    isoBox(g, cx, feet - 2, 24, 12, "#1e4a34");
    g.fillStyle(0x12331f, 1);
    g.fillPoints([P(cx - 7, feet - 14), P(cx + 7, feet - 14), P(cx + 3, feet - 52), P(cx - 3, feet - 52)], true);
    g.fillStyle(0x6bff9e, 1); g.fillCircle(cx, feet - 56, 5);
    g.fillStyle(0x6bff9e, 0.3); g.fillCircle(cx, feet - 56, 10);
    g.lineStyle(1.5, 0x6bff9e, 0.85);
    g.lineBetween(cx - 10, feet - 20, cx - 16, feet - 30); g.lineBetween(cx + 10, feet - 20, cx + 16, feet - 30);
  });
  make("struct_barracks", 90, 96, (g) => {
    const cx = 45, feet = 88;
    diamond(g, cx, feet, 82, 41, "#0c2233", 0.85);
    isoBox(g, cx, feet - 2, 70, 34, "#1e3a5e");
    isoBox(g, cx, feet - 36, 70, 10, "#3d5a8e");
    g.fillStyle(0x16293f, 1);
    g.fillPoints([P(cx - 35, feet - 46), P(cx, feet - 60), P(cx + 35, feet - 46), P(cx, feet - 32)], true);
    g.fillStyle(0x3af5ff, 1); g.fillRect(cx - 4, feet - 24, 8, 14);
    g.fillStyle(0x3af5ff, 0.25); g.fillRect(cx - 26, feet - 28, 12, 8); g.fillRect(cx + 14, feet - 28, 12, 8);
    g.lineStyle(1.5, 0x3af5ff, 0.8); g.strokeCircle(cx, feet - 50, 5);
  });
  make("struct_foundry", 90, 96, (g) => {
    const cx = 45, feet = 88;
    diamond(g, cx, feet, 82, 41, "#2a0c22", 0.85);
    isoBox(g, cx, feet - 2, 68, 32, "#5e1e4a");
    isoBox(g, cx, feet - 34, 68, 10, "#8e3d70");
    g.fillStyle(0x3d1233, 1); g.fillRect(cx + 14, feet - 58, 12, 24);
    g.fillStyle(0xff3ec8, 0.3); g.fillCircle(cx + 20, feet - 60, 9);
    g.fillStyle(0xff3ec8, 1); g.fillRect(cx - 20, feet - 22, 40, 4);
    g.fillStyle(0xffc24d, 1); g.fillRect(cx - 6, feet - 16, 12, 8);
    g.lineStyle(1.5, 0xff3ec8, 0.85); g.strokeCircle(cx - 18, feet - 30, 4);
  });
  make("struct_heavy", 90, 96, (g) => {
    const cx = 45, feet = 88;
    diamond(g, cx, feet, 82, 41, "#2a240c", 0.85);
    isoBox(g, cx, feet - 2, 72, 30, "#5e4a1e");
    isoBox(g, cx, feet - 32, 72, 12, "#8e7030");
    g.fillStyle(0x3d3010, 1);
    g.fillRect(cx - 30, feet - 48, 16, 18); g.fillRect(cx + 14, feet - 48, 16, 18);
    g.fillStyle(0xffc24d, 1); g.fillRect(cx - 4, feet - 26, 8, 12);
    g.lineStyle(2, 0xffc24d, 0.8);
    g.lineBetween(cx - 34, feet - 8, cx - 20, feet - 8); g.lineBetween(cx + 20, feet - 8, cx + 34, feet - 8);
    g.fillStyle(0xffe066, 0.9); g.fillCircle(cx, feet - 44, 4);
  });
  make("struct_sanctum", 90, 104, (g) => {
    const cx = 45, feet = 96;
    diamond(g, cx, feet, 82, 41, "#241e33", 0.85);
    isoBox(g, cx, feet - 2, 64, 36, "#4a3d6e");
    g.fillStyle(0x6e5e9e, 1);
    g.fillPoints([P(cx - 32, feet - 38), P(cx, feet - 74), P(cx + 32, feet - 38)], true);
    g.fillStyle(0xf5f0ff, 0.25); g.fillCircle(cx, feet - 20, 10);
    g.lineStyle(1.5, 0xf5f0ff, 0.9); g.strokeCircle(cx, feet - 20, 10);
    g.fillStyle(0xffd977, 1); g.fillCircle(cx, feet - 74, 4.5);
    g.fillStyle(0xffd977, 0.3); g.fillCircle(cx, feet - 74, 10);
    g.lineStyle(1.2, 0xf5f0ff, 0.7);
    g.lineBetween(cx - 20, feet - 46, cx - 26, feet - 58); g.lineBetween(cx + 20, feet - 46, cx + 26, feet - 58);
  });
  make("struct_turret", 56, 74, (g) => {
    const cx = 28, feet = 68;
    diamond(g, cx, feet, 48, 24, "#000000", 0.35);
    isoBox(g, cx, feet - 2, 40, 16, "#2a3450");
    isoBox(g, cx, feet - 18, 26, 10, "#3d4a70");
    g.fillStyle(0x141b30, 1);
    g.fillPoints([P(cx - 5, feet - 28), P(cx + 5, feet - 28), P(cx + 4, feet - 52), P(cx - 4, feet - 52)], true);
    g.fillStyle(0x3af5ff, 1); g.fillRect(cx - 3, feet - 56, 6, 5);
    g.fillStyle(0x3af5ff, 0.3); g.fillCircle(cx, feet - 54, 8);
    g.lineStyle(1.5, 0x3af5ff, 0.8); g.strokeCircle(cx, feet - 8, 13);
  });

  make("watcher", 34, 42, (g) => {
    const cx = 17, feet = 38;
    diamond(g, cx, feet, 22, 11, "#000000", 0.3);
    g.lineStyle(1.5, 0xff5ad1, 0.9);
    g.strokeCircle(cx, feet - 14, 9);
    g.fillStyle(0xff5ad1, 0.2); g.fillCircle(cx, feet - 14, 9);
    g.fillStyle(0xff5ad1, 1); g.fillCircle(cx, feet - 14, 3.5);
    g.lineStyle(1, 0xff5ad1, 0.8);
    g.lineBetween(cx, feet - 23, cx - 5, feet - 28);
    g.lineBetween(cx, feet - 23, cx + 5, feet - 28);
    g.fillStyle(0xff5ad1, 1);
    g.fillCircle(cx - 5, feet - 28, 1.5); g.fillCircle(cx + 5, feet - 28, 1.5);
  });

  // ── turret ──────────────────────────────────────
  make("turret", 56, 74, (g) => {
    const cx = 28, feet = 68;
    diamond(g, cx, feet, 48, 24, "#000000", 0.35);
    isoBox(g, cx, feet - 2, 40, 16, "#2a3450");
    isoBox(g, cx, feet - 18, 26, 10, "#3d4a70");
    g.fillStyle(0x141b30, 1);
    g.fillPoints([P(cx - 5, feet - 28), P(cx + 5, feet - 28), P(cx + 4, feet - 52), P(cx - 4, feet - 52)], true);
    g.fillStyle(0x3af5ff, 1); g.fillRect(cx - 3, feet - 56, 6, 5);
    g.fillStyle(0x3af5ff, 0.3); g.fillCircle(cx, feet - 54, 8);
    g.lineStyle(1.5, 0x3af5ff, 0.8); g.strokeCircle(cx, feet - 8, 13);
  });

  // ── void citadel (CPU fortress) ─────────────────
  make("citadel", 150, 190, (g) => {
    const cx = 75;
    diamond(g, cx, 178, 130, 65, "#1a0510", 0.9);
    isoBox(g, cx, 168, 112, 74, "#2b1020");
    isoBox(g, cx, 168 - 74, 112, 12, "#3d1830");
    // spikes
    g.fillStyle(0x120409, 1);
    const spikes = [[cx - 44, 94, 26], [cx - 14, 88, 40], [cx + 18, 92, 30], [cx + 46, 98, 20]];
    for (const [sx, sy, sh] of spikes) {
      g.fillPoints([P(sx - 7, sy + 14), P(sx + 7, sy + 14), P(sx, sy + 14 - sh)], true);
    }
    // eye
    g.fillStyle(0x0a0208, 1);
    g.fillPoints([P(cx - 22, 128), P(cx + 6, 114), P(cx + 6, 140), P(cx - 22, 154)], true);
    g.fillStyle(0xff4d5e, 1); g.fillCircle(cx - 8, 134, 6);
    g.fillStyle(0xffe0e0, 1); g.fillCircle(cx - 8, 134, 2);
    g.fillStyle(0xff4d5e, 0.18); g.fillCircle(cx - 8, 134, 12);
    // gate
    g.fillStyle(0x0a0208, 1);
    g.fillRect(cx - 16, 168 - 34, 32, 34);
    g.lineStyle(2, 0xff4d5e, 0.8); g.strokeRect(cx - 16, 168 - 34, 32, 34);
    g.lineStyle(1, 0xff4d5e, 0.5);
    g.lineBetween(cx - 8, 168 - 34, cx - 8, 168); g.lineBetween(cx + 8, 168 - 34, cx + 8, 168);
    // aura cracks
    g.lineStyle(1.5, 0xff4d5e, 0.5);
    g.lineBetween(cx - 56, 160, cx - 40, 150); g.lineBetween(cx + 52, 156, cx + 38, 148);
  });

  // ── resource nodes ──────────────────────────────
  make("crystal", 44, 52, (g) => {
    diamond(g, 22, 46, 30, 15, "#0c2233", 0.85);
    const shard = (x: number, y: number, w: number, h: number, c: number, a = 1) => {
      g.fillStyle(c, a);
      g.fillPoints([P(x, y), P(x + w, y + h * 0.4), P(x, y + h), P(x - w, y + h * 0.4)], true);
    };
    shard(22, 4, 7, 34, 0x123c55); shard(22, 4, 4.5, 34, 0x3af5ff, 0.95);
    shard(12, 16, 5, 24, 0x0f3148); shard(12, 16, 3, 24, 0x6fd8ff, 0.9);
    shard(32, 14, 5, 26, 0x0f3148); shard(32, 14, 3, 26, 0x6fd8ff, 0.9);
    g.fillStyle(0xeaffff, 0.9); g.fillRect(20, 8, 2, 6); g.fillRect(31, 18, 2, 4);
  });
  make("bloom", 40, 46, (g) => {
    diamond(g, 20, 40, 26, 13, "#2a1530", 0.85);
    g.lineStyle(2, 0x4e7d3a, 1); g.lineBetween(20, 40, 20, 20);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillStyle(0xff5ad1, 0.92);
      g.fillCircle(20 + Math.cos(a) * 7, 16 + Math.sin(a) * 5.5, 4.4);
    }
    g.fillStyle(0xffd1f0, 1); g.fillCircle(20, 16, 4);
    g.fillStyle(0xffc24d, 1); g.fillCircle(20, 16, 1.8);
    g.fillStyle(0x8fd96b, 1); g.fillCircle(13, 32, 2.4); g.fillCircle(27, 34, 2);
  });

  // ── bugs (enemies) ──────────────────────────────
  make("keese", 32, 26, (g) => {
    g.fillStyle(0x8a1626, 1);
    g.fillPoints([P(2, 8), P(12, 4), P(13, 12)], true);
    g.fillPoints([P(30, 8), P(20, 4), P(19, 12)], true);
    isoBox(g, 16, 20, 14, 8, "#c22333");
    g.fillStyle(0xffe066, 1); g.fillRect(12, 8, 3, 3); g.fillRect(18, 8, 3, 3);
  });
  make("wisp", 28, 28, (g) => {
    g.fillStyle(0xd8e6ff, 0.25); g.fillCircle(14, 14, 12);
    g.fillStyle(0xd8e6ff, 0.85); g.fillCircle(14, 14, 6);
    g.fillStyle(0x27407a, 1); g.fillRect(10, 12, 3, 4); g.fillRect(16, 12, 3, 4);
    g.lineStyle(1, 0xd8e6ff, 0.6); g.strokeCircle(14, 14, 10);
  });
  make("stalker", 30, 40, (g) => {
    const cx = 15;
    diamond(g, cx, 36, 20, 10, "#000000", 0.3);
    g.fillStyle(0x5e0f1e, 1);
    g.fillPoints([P(cx - 8, 34), P(cx + 8, 34), P(cx + 5, 14), P(cx - 5, 14)], true);
    g.fillPoints([P(cx - 5, 14), P(cx + 5, 14), P(cx, 4)], true);
    g.fillStyle(0xff4d5e, 1); g.fillRect(cx - 4, 12, 8, 2);
    g.lineStyle(1.5, 0xff4d5e, 0.8);
    g.lineBetween(cx + 6, 30, cx + 14, 20); g.lineBetween(cx - 6, 30, cx - 14, 20);
  });
  make("behemoth", 66, 62, (g) => {
    const cx = 33;
    diamond(g, cx, 56, 56, 28, "#000000", 0.35);
    isoBox(g, cx, 52, 52, 30, "#3b1030");
    isoBox(g, cx, 52 - 30, 52, 16, "#521741");
    g.lineStyle(2, 0xff4d5e, 0.7);
    g.lineBetween(cx - 18, 44, cx - 8, 36); g.lineBetween(cx - 8, 36, cx - 14, 28);
    g.lineBetween(cx + 14, 46, cx + 6, 38);
    g.fillStyle(0xffe066, 1);
    g.fillCircle(cx - 10, 18, 3); g.fillCircle(cx + 2, 16, 3); g.fillCircle(cx + 12, 20, 2.4);
    isoBox(g, cx - 28, 40, 14, 12, "#521741");
    isoBox(g, cx + 28, 40, 14, 12, "#521741");
  });

  // ── FX / markers ────────────────────────────────
  make("portal", 76, 42, (g) => {
    g.lineStyle(3, 0xff4d5e, 0.9); g.strokeEllipse(38, 21, 64, 32);
    g.lineStyle(2, 0xff8a94, 0.7); g.strokeEllipse(38, 21, 44, 22);
    g.fillStyle(0xff4d5e, 0.14); g.fillEllipse(38, 21, 64, 32);
    g.fillStyle(0xffe0e0, 0.9); g.fillCircle(38, 21, 3);
  });
  make("bolt", 18, 18, (g) => {
    g.fillStyle(0x3af5ff, 0.35); g.fillCircle(9, 9, 8);
    diamond(g, 9, 9, 10, 10, "#bffbff", 1);
  });
  make("ebolt", 16, 16, (g) => {
    g.fillStyle(0xff4d5e, 0.35); g.fillCircle(8, 8, 7);
    diamond(g, 8, 8, 8, 8, "#ffb3ba", 1);
  });
  make("selring", 52, 28, (g) => {
    g.lineStyle(2, 0x3af5ff, 0.95); g.strokeEllipse(26, 14, 46, 24);
    g.lineStyle(1, 0x3af5ff, 0.4); g.strokeEllipse(26, 14, 52, 28);
  });
  make("targetring", 52, 28, (g) => {
    g.lineStyle(2, 0xff4d5e, 0.95); g.strokeEllipse(26, 14, 46, 24);
  });
  make("movering", 26, 14, (g) => {
    g.lineStyle(2, 0x6bff9e, 0.9); g.strokeEllipse(13, 7, 20, 10);
  });
  make("spark", 14, 14, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints([P(7, 0), P(9, 5), P(14, 7), P(9, 9), P(7, 14), P(5, 9), P(0, 7), P(5, 5)], true);
  });
  make("glow", 64, 64, (g) => {
    for (let i = 6; i > 0; i--) {
      g.fillStyle(0xffffff, 0.05);
      g.fillCircle(32, 32, i * 5);
    }
  });
  make("star", 3, 3, (g) => { g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 3, 3); });

  // ── props ───────────────────────────────────────
  make("lamp", 24, 58, (g) => {
    g.fillStyle(0x22304f, 1); g.fillRect(10, 18, 4, 36);
    diamond(g, 12, 56, 16, 8, "#1a2540", 1);
    g.fillStyle(0xffc24d, 1); g.fillCircle(12, 12, 5);
    g.fillStyle(0xffc24d, 0.18); g.fillCircle(12, 12, 11);
  });
  make("holotree", 34, 62, (g) => {
    g.fillStyle(0x16233f, 1); g.fillRect(14, 38, 6, 20);
    g.lineStyle(1.5, 0x3af5ff, 0.7);
    g.strokeTriangle(17, 6, 4, 40, 30, 40);
    g.lineStyle(1.5, 0x3af5ff, 0.45);
    g.strokeTriangle(17, 18, 8, 42, 26, 42);
    g.fillStyle(0x3af5ff, 0.12); g.fillTriangle(17, 6, 4, 40, 30, 40);
    g.fillStyle(0x9ff7ff, 0.9); g.fillCircle(17, 6, 2);
  });
}
