import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WEAPON_DEFS, HOUSE_DEFS, fmt } from "./bridge";
import type { PltSnapshot, WeaponId } from "./bridge";

export interface HoverInfo {
  title: string;
  sub: string;
  color: string;
  kind: "weapon" | "structure" | "core";
}

export interface CC3DHandle {
  update(snap: PltSnapshot): void;
  activity(kind: string): void;
  destroy(): void;
}

interface Beam { mesh: THREE.Mesh; t: number; }

const ACTIVITY_COLOR: Record<string, number> = {
  kill: 0x6bff9e, cast: 0x3af5ff, raid: 0xff4d5e, audit: 0xff4d5e,
  handshake: 0xff5ad1, death: 0xff4d5e, buy: 0xffc24d, forge: 0x3af5ff,
};

// iso screen-space → 3D plane
const M = 0.13;
const to3 = (x: number, y: number) => new THREE.Vector3(x * M, 0, (y - 240) * M);

export function mountCommandCenter(
  el: HTMLDivElement,
  onCast: (w: WeaponId) => void,
  onHover: (info: HoverInfo | null) => void,
): CC3DHandle {
  const W = el.clientWidth || 960;
  const H = el.clientHeight || 640;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060f);
  scene.fog = new THREE.FogExp2(0x04060f, 0.0035);

  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1200);
  camera.position.set(0, 108, 96);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 10, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 42;
  controls.maxDistance = 300;
  controls.maxPolarAngle = 1.32;

  // ── lights ──
  scene.add(new THREE.AmbientLight(0x334466, 1.1));
  const dir = new THREE.DirectionalLight(0x9fdcff, 0.9);
  dir.position.set(40, 90, 30);
  scene.add(dir);
  const coreLight = new THREE.PointLight(0x3af5ff, 3.2, 220);
  coreLight.position.set(0, 40, 0);
  scene.add(coreLight);

  // ── ground ──
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(190, 48),
    new THREE.MeshStandardMaterial({ color: 0x070b18, roughness: 0.95, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(300, 30, 0x1c2c52, 0x0c1428);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  grid.position.y = 0.05;
  scene.add(grid);
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 23, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x0d1730, emissive: 0x123055, emissiveIntensity: 0.6 }),
  );
  dais.position.y = 0.8;
  scene.add(dais);

  // ── starfield ──
  const starGeo = new THREE.BufferGeometry();
  const starPos: number[] = [];
  for (let i = 0; i < 500; i++) {
    const r = 320 + Math.random() * 260;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.48;
    starPos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7 + 20, r * Math.sin(ph) * Math.sin(th));
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8fb4ff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.75 })));

  // ── the Monolith (GSK) ──
  const monolith = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x0e1c3d, emissive: 0x3af5ff, emissiveIntensity: 0.65, roughness: 0.3, metalness: 0.6 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(9, 32, 9), towerMat);
  tower.position.y = 18;
  monolith.add(tower);
  const wire = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 34.4, 11.4),
    new THREE.MeshBasicMaterial({ color: 0x3af5ff, wireframe: true, transparent: true, opacity: 0.22 }),
  );
  wire.position.y = 18;
  monolith.add(wire);
  const codeRing = new THREE.Mesh(
    new THREE.TorusGeometry(14.5, 0.4, 8, 44),
    new THREE.MeshBasicMaterial({ color: 0x3af5ff, transparent: true, opacity: 0.55 }),
  );
  codeRing.rotation.x = Math.PI / 2;
  codeRing.position.y = 9;
  monolith.add(codeRing);
  const drumRing = new THREE.Mesh(
    new THREE.TorusGeometry(17.5, 0.55, 8, 44),
    new THREE.MeshBasicMaterial({ color: 0xff8b3e, transparent: true, opacity: 0 }),
  );
  drumRing.rotation.x = Math.PI / 2;
  drumRing.position.y = 4;
  monolith.add(drumRing);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), new THREE.MeshBasicMaterial({ color: 0xeaffff }));
  beacon.position.y = 38;
  monolith.add(beacon);
  scene.add(monolith);

  // ── weapon pedestals ──
  const pedestalGroup = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const pedestalMats: Record<string, THREE.MeshStandardMaterial> = {};
  const weaponIds = Object.keys(WEAPON_DEFS) as WeaponId[];
  weaponIds.forEach((id, i) => {
    const def = WEAPON_DEFS[id];
    const ang = (i / weaponIds.length) * Math.PI * 2 - Math.PI / 2;
    const g = new THREE.Group();
    g.position.set(Math.cos(ang) * 42, 0, Math.sin(ang) * 42);
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.8, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x0d1730, emissive: new THREE.Color(def.color), emissiveIntensity: 0.12, roughness: 0.6 }),
    );
    ped.position.y = 3;
    g.add(ped);
    const col = new THREE.Color(def.color);
    let geo: THREE.BufferGeometry;
    if (id === "blade") geo = new THREE.BoxGeometry(0.9, 11, 2.4);
    else if (id === "arrow") geo = new THREE.ConeGeometry(2.2, 9, 4);
    else if (id === "shield") geo = new THREE.TorusGeometry(3.2, 0.9, 8, 20);
    else if (id === "cannon") geo = new THREE.SphereGeometry(2.9, 12, 10);
    else if (id === "lantern") geo = new THREE.OctahedronGeometry(3);
    else geo = new THREE.CylinderGeometry(2.9, 2.9, 2.6, 14);
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.4, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 11.5;
    if (id === "blade") mesh.rotation.z = 0.5;
    if (id === "shield") mesh.rotation.y = 0.6;
    mesh.userData = { type: "weapon", id, baseY: 11.5 };
    g.add(mesh);
    pedestalMats[id] = mat;
    pickables.push(mesh);
    pedestalGroup.add(g);
  });
  scene.add(pedestalGroup);

  // ── structures (mirrors the 2D arena) ──
  const structGroup = new THREE.Group();
  scene.add(structGroup);
  let structSig = "";

  // ── motes (units & bugs) ──
  const unitPool: THREE.Mesh[] = [];
  const enemyPool: THREE.Mesh[] = [];
  const moteGeo = new THREE.SphereGeometry(1.5, 8, 6);
  for (let i = 0; i < 24; i++) {
    const u = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({ color: 0x3af5ff, transparent: true, opacity: 0.95 }));
    u.visible = false; scene.add(u); unitPool.push(u);
    const e = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.95 }));
    e.scale.setScalar(1.25);
    e.visible = false; scene.add(e); enemyPool.push(e);
  }
  const moteTargets: { x: number; z: number }[] = [];
  const enemyTargets: { x: number; z: number }[] = [];

  // ── beams ──
  const beams: Beam[] = [];
  let pulse = 0;

  function spawnBeam(color: number) {
    const ang = Math.random() * Math.PI * 2;
    const from = new THREE.Vector3(Math.cos(ang) * 150, 90 + Math.random() * 50, Math.sin(ang) * 150);
    const to = new THREE.Vector3(0, 36, 0);
    const len = from.distanceTo(to);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.4, len, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    scene.add(mesh);
    beams.push({ mesh, t: 1 });
    pulse = 1;
  }

  // ── picking ──
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered: THREE.Object3D | null = null;

  function pick(ev: PointerEvent): THREE.Object3D | null {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(pickables, false);
    return hits.length ? hits[0].object : null;
  }

  const onMove = (ev: PointerEvent) => {
    const obj = pick(ev);
    if (obj !== hovered) {
      hovered = obj;
      renderer.domElement.style.cursor = obj ? "pointer" : "grab";
      if (obj && obj.userData.type === "weapon") {
        const def = WEAPON_DEFS[obj.userData.id as WeaponId];
        const cd = lastSnap ? (lastSnap.weapons.find((w) => w.id === obj.userData.id)?.cd ?? 0) : 0;
        onHover({
          title: def.name.toUpperCase(),
          sub: cd > 0 ? `RECHARGING ${Math.ceil(cd)}s` : `${def.cost.p ? fmt(def.cost.p) + " P" : ""}${def.cost.l ? fmt(def.cost.l) + " L" : ""} · click to deploy into the arena`,
          color: def.color,
          kind: "weapon",
        });
      } else if (!obj) onHover(null);
    }
  };
  const onClick = (ev: PointerEvent) => {
    const obj = pick(ev);
    if (obj && obj.userData.type === "weapon") {
      const id = obj.userData.id as WeaponId;
      const cd = lastSnap ? (lastSnap.weapons.find((w) => w.id === id)?.cd ?? 0) : 0;
      if (cd <= 0) {
        onCast(id);
        spawnBeam(new THREE.Color(WEAPON_DEFS[id].color).getHex());
      }
    }
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onClick);

  // ── state ──
  let lastSnap: PltSnapshot | null = null;
  let raf = 0;
  const clock = new THREE.Clock();
  const bg = new THREE.Color(0x04060f);
  const bgCalm = new THREE.Color(0x04060f);
  const bgWar = new THREE.Color(0x16060c);

  function rebuildStructures(snap: PltSnapshot) {
    const sig = snap.buildings3d.map((b) => `${b.kind}${Math.round(b.x)}${Math.round(b.y)}${b.hp}`).join("|");
    if (sig === structSig) return;
    structSig = sig;
    while (structGroup.children.length) {
      const c = structGroup.children[0];
      structGroup.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    pickables.length = 0;
    weaponIds.forEach((id, i) => {
      const ang = (i / weaponIds.length) * Math.PI * 2 - Math.PI / 2;
      const mesh = pedestalGroup.children[i].children[1];
      pickables.push(mesh);
      void ang;
    });
    for (const b of snap.buildings3d) {
      const p = to3(b.x, b.y);
      let h = 12, w = 7;
      if (b.kind === "citadel") { h = 24; w = 11; }
      else if (b.kind === "turret") { h = 7; w = 4; }
      else if (b.kind === "market") { h = 10; w = 8; }
      else if (b.kind === "house") {
        const t = Object.values(HOUSE_DEFS).find((d) => d.name === b.label);
        h = t ? (b.label.includes("Spire") ? 20 : b.label.includes("Lodge") ? 12 : 15) : 14;
      }
      const col = new THREE.Color(b.color);
      const mesh = new THREE.Mesh(
        b.kind === "turret" ? new THREE.CylinderGeometry(w * 0.4, w * 0.55, h, 8) : new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({
          color: col.clone().multiplyScalar(0.35),
          emissive: col,
          emissiveIntensity: b.kind === "citadel" ? 0.5 : 0.75,
          roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.95,
        }),
      );
      mesh.position.set(p.x, h / 2, p.z);
      if (b.kind === "citadel") mesh.rotation.y = Math.PI / 4;
      mesh.userData = { type: "struct", label: b.label, hp: b.hp, hpMax: b.hpMax, color: b.color };
      structGroup.add(mesh);
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(w * 0.75, w * 0.95, 24),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(p.x, 0.12, p.z);
      structGroup.add(halo);
    }
  }

  const ro = new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(el);

  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    controls.update();

    // monolith breathing + pulse kick
    pulse = Math.max(0, pulse - dt * 1.6);
    const breath = 1 + Math.sin(t * 1.5) * 0.028 + pulse * 0.12;
    monolith.scale.set(breath, 1 + Math.sin(t * 1.5) * 0.02 + pulse * 0.16, breath);
    towerMat.emissiveIntensity = 0.6 + Math.sin(t * 1.5) * 0.18 + pulse * 1.6;
    coreLight.intensity = 3 + Math.sin(t * 1.5) * 0.8 + pulse * 5;
    codeRing.rotation.z += dt * 0.5;
    codeRing.scale.setScalar(1 + Math.sin(t * 2.2) * 0.04);
    beacon.rotation.y += dt * 2;
    drumRing.material.opacity = lastSnap?.drumActive ? 0.5 + Math.sin(t * 6) * 0.3 : Math.max(0, ((drumRing.material as THREE.MeshBasicMaterial).opacity - dt));

    // PLT-driven sky + core color
    if (lastSnap) {
      const total = lastSnap.p + lastSnap.l + lastSnap.t + 1;
      const tShare = lastSnap.t / total;
      const war = Math.min(1, lastSnap.threats / 12);
      bg.copy(bgCalm).lerp(bgWar, Math.max(war * 0.7, tShare * 1.4, lastSnap.danger ? 0.8 : 0));
      (scene.background as THREE.Color).lerp(bg, dt * 2);
      const coreCol = new THREE.Color(0x3af5ff).lerp(new THREE.Color(0xff4d5e), Math.min(1, tShare * 2.2 + war * 0.3));
      coreLight.color.lerp(coreCol, dt * 2);
      // pedestal cooldown dimming + float
      for (const id of weaponIds) {
        const w = lastSnap.weapons.find((x) => x.id === id);
        const mat = pedestalMats[id];
        const frac = w && w.max > 0 ? w.cd / w.max : 0;
        mat.emissiveIntensity = 0.25 + (1 - frac) * 0.75;
        mat.opacity = 0.45 + (1 - frac) * 0.55;
      }
    }
    pedestalGroup.children.forEach((g, i) => {
      const mesh = g.children[1];
      mesh.position.y = (mesh.userData.baseY as number) + Math.sin(t * 1.8 + i) * 0.8;
      mesh.rotation.y += dt * (hovered === mesh ? 2.4 : 0.7);
      const target = hovered === mesh ? 1.28 : 1;
      mesh.scale.lerp(new THREE.Vector3(target, target, target), dt * 8);
    });

    // motes
    unitPool.forEach((m, i) => {
      const tgt = moteTargets[i];
      m.visible = !!tgt;
      if (tgt) { m.position.x += (tgt.x - m.position.x) * Math.min(1, dt * 4); m.position.z += (tgt.z - m.position.z) * Math.min(1, dt * 4); m.position.y = 2.4 + Math.sin(t * 3 + i) * 0.7; }
    });
    enemyPool.forEach((m, i) => {
      const tgt = enemyTargets[i];
      m.visible = !!tgt;
      if (tgt) { m.position.x += (tgt.x - m.position.x) * Math.min(1, dt * 4); m.position.z += (tgt.z - m.position.z) * Math.min(1, dt * 4); m.position.y = 2.2 + Math.sin(t * 4 + i * 2) * 0.5; }
    });

    // beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t -= dt * 1.5;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.t) * 0.9;
      b.mesh.scale.x = b.mesh.scale.z = Math.max(0.05, b.t);
      if (b.t <= 0) { scene.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); beams.splice(i, 1); }
    }

    renderer.render(scene, camera);
  }
  tick();

  return {
    update(snap: PltSnapshot) {
      lastSnap = snap;
      rebuildStructures(snap);
      moteTargets.length = 0;
      enemyTargets.length = 0;
      for (const m of snap.motes) {
        const p = to3(m.x, m.y);
        (m.t === "unit" ? moteTargets : enemyTargets).push({ x: p.x, z: p.z });
      }
    },
    activity(kind: string) {
      spawnBeam(ACTIVITY_COLOR[kind] ?? 0x3af5ff);
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onClick);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    },
  };
}
