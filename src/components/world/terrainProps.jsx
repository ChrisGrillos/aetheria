/**
 * TerrainProps — Procedural scatter of trees, rocks, grass, and POI buildings.
 * Separated from terrain mesh generation for cleanliness.
 * All meshes are added to a single THREE.Group for easy cleanup.
 */

import * as THREE from "three";
import { getTile, getZoneAt, ZONES, POINTS_OF_INTEREST } from "@/components/shared/worldZones";
import { getTerrainHeight } from "./proceduralTerrain";

const TILE_SIZE = 2;

// ─── SEEDED HASH ─────────────────────────────────────────────────────────────

function hash2(x, y) { return ((x * 2477 + y * 8191) % 10000) / 10000; }
function hash2b(x, y) { return ((x * 5381 + y * 1373) % 10000) / 10000; }
function hash2c(x, y) { return ((x * 3571 + y * 6257) % 10000) / 10000; }

// ─── TREE BUILDER (improved) ─────────────────────────────────────────────────

function addTree(group, wx, baseY, wz, treeType = "pine") {
  const hv = hash2(Math.round(wx), Math.round(wz));
  const hv2 = hash2b(Math.round(wx), Math.round(wz));
  const hv3 = hash2c(Math.round(wx), Math.round(wz));

  if (treeType === "dead") {
    // Bare trunk with multiple branches
    const trunkH = 0.7 + hv * 0.6;
    const tGeo = new THREE.CylinderGeometry(0.035, 0.10, trunkH, 5);
    const tMat = new THREE.MeshLambertMaterial({ color: 0x2a1e10 });
    const trunk = new THREE.Mesh(tGeo, tMat);
    trunk.position.set(wx, baseY + trunkH * 0.5, wz);
    trunk.rotation.z = (hv2 - 0.5) * 0.20;
    trunk.castShadow = true;
    group.add(trunk);

    // Bare branches (more detailed)
    const branchCount = 2 + Math.floor(hv3 * 3);
    for (let i = 0; i < branchCount; i++) {
      const brH = 0.18 + hash2c(Math.round(wx) + i, Math.round(wz)) * 0.22;
      const brGeo = new THREE.CylinderGeometry(0.01, 0.025, brH, 3);
      const brMat = new THREE.MeshLambertMaterial({ color: 0x2a1e10 });
      const br = new THREE.Mesh(brGeo, brMat);
      const side = (i % 2 === 0) ? 1 : -1;
      const heightPct = 0.45 + (i / branchCount) * 0.45;
      br.position.set(wx + side * 0.10, baseY + trunkH * heightPct, wz + (hash2(i, Math.round(wx)) - 0.5) * 0.08);
      br.rotation.z = side * (0.6 + hash2b(i, Math.round(wz)) * 0.5);
      br.rotation.y = hash2c(i, Math.round(wz)) * 1.2;
      group.add(br);
    }

    // Exposed roots at base
    for (let r = 0; r < 2; r++) {
      const rootAngle = (r / 2) * Math.PI + hv2;
      const rootGeo = new THREE.CylinderGeometry(0.01, 0.035, 0.18, 3);
      const rootMat = new THREE.MeshLambertMaterial({ color: 0x2a1e10 });
      const root = new THREE.Mesh(rootGeo, rootMat);
      root.position.set(wx + Math.cos(rootAngle) * 0.10, baseY + 0.04, wz + Math.sin(rootAngle) * 0.10);
      root.rotation.z = Math.cos(rootAngle) * 1.2;
      root.rotation.x = Math.sin(rootAngle) * 0.4;
      group.add(root);
    }
    return;
  }

  if (treeType === "oak" || treeType === "broadleaf") {
    // Deciduous / oak tree with round canopy
    const trunkH = 0.5 + hv * 0.4;
    const tGeo = new THREE.CylinderGeometry(0.06, 0.12, trunkH, 5);
    const tMat = new THREE.MeshLambertMaterial({ color: 0x4a3018 });
    const trunk = new THREE.Mesh(tGeo, tMat);
    trunk.position.set(wx, baseY + trunkH * 0.5, wz);
    trunk.castShadow = true;
    group.add(trunk);

    // Main canopy sphere
    const canopyR = 0.35 + hv2 * 0.20;
    const canopyGeo = new THREE.SphereGeometry(canopyR, 6, 5);
    const canopyColor = treeType === "oak" ? 0x2a5a18 : 0x3a6a28;
    const canopyMat = new THREE.MeshLambertMaterial({ color: canopyColor });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(wx, baseY + trunkH + canopyR * 0.6, wz);
    canopy.scale.set(1.0, 0.8, 1.0);
    canopy.castShadow = true;
    group.add(canopy);

    // Secondary smaller canopy blobs for fullness
    for (let i = 0; i < 2; i++) {
      const angle = hv3 + i * Math.PI * 0.8;
      const subR = canopyR * 0.55;
      const subGeo = new THREE.SphereGeometry(subR, 5, 4);
      const subMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(canopyColor).multiplyScalar(0.85 + hv * 0.15).getHex() });
      const sub = new THREE.Mesh(subGeo, subMat);
      sub.position.set(
        wx + Math.cos(angle) * canopyR * 0.55,
        baseY + trunkH + canopyR * 0.4,
        wz + Math.sin(angle) * canopyR * 0.55
      );
      sub.castShadow = true;
      group.add(sub);
    }
    return;
  }

  // Pine tree (default)
  const trunkH = 0.5 + hash2(Math.round(wx * 10), Math.round(wz * 10)) * 0.55;
  const tGeo = new THREE.CylinderGeometry(0.04, 0.10, trunkH, 5);
  const tMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const trunk = new THREE.Mesh(tGeo, tMat);
  trunk.position.set(wx, baseY + trunkH * 0.5, wz);
  trunk.castShadow = true;
  group.add(trunk);

  // Layered foliage cones (more layers for taller trees)
  const foliageColor = treeType === "autumn" ? 0x8a5020 : 0x1a4018;
  const layerCount = 3 + (trunkH > 0.8 ? 1 : 0);
  for (let i = 0; i < layerCount; i++) {
    const frac = i / layerCount;
    const yOff = trunkH + 0.05 + frac * 0.55;
    const r = 0.45 - frac * 0.20;
    const h = 0.48 - frac * 0.12;
    const layerColor = new THREE.Color(foliageColor).multiplyScalar(0.9 + frac * 0.15).getHex();
    const fGeo = new THREE.ConeGeometry(r, h, 6);
    const fMat = new THREE.MeshLambertMaterial({ color: layerColor });
    const foliage = new THREE.Mesh(fGeo, fMat);
    foliage.position.set(wx, baseY + yOff, wz);
    foliage.castShadow = true;
    group.add(foliage);
  }

  // Exposed roots for larger pines
  if (trunkH > 0.7) {
    for (let r = 0; r < 2; r++) {
      const rootAngle = r * Math.PI + hv3 * 2;
      const rootGeo = new THREE.CylinderGeometry(0.01, 0.03, 0.14, 3);
      const rootMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });
      const root = new THREE.Mesh(rootGeo, rootMat);
      root.position.set(wx + Math.cos(rootAngle) * 0.10, baseY + 0.03, wz + Math.sin(rootAngle) * 0.10);
      root.rotation.z = Math.cos(rootAngle) * 1.0;
      group.add(root);
    }
  }
}

// ─── ROCK BUILDER ────────────────────────────────────────────────────────────

function addRock(group, wx, baseY, wz, size, color = 0x6a6a6a) {
  const h1 = hash2(Math.round(wx), Math.round(wz));
  const h2 = hash2b(Math.round(wx), Math.round(wz));

  // Main rock body
  const rGeo = new THREE.DodecahedronGeometry(size, 0);
  const rMat = new THREE.MeshLambertMaterial({ color });
  const rock = new THREE.Mesh(rGeo, rMat);
  rock.position.set(wx, baseY + size * 0.55, wz);
  rock.rotation.set(h1 * 3, h2 * 3, 0);
  rock.scale.set(1.0, 0.7 + h1 * 0.5, 1.0 + (h2 - 0.5) * 0.4);
  rock.castShadow = true;
  group.add(rock);

  // Smaller accent pebbles for larger rocks
  if (size > 0.12) {
    const pebbles = Math.floor(h1 * 2) + 1;
    for (let i = 0; i < pebbles; i++) {
      const pa = hash2c(Math.round(wx) + i, Math.round(wz)) * Math.PI * 2;
      const pd = size * 0.8 + hash2(i, Math.round(wz)) * size * 0.4;
      const ps = size * 0.25 + hash2b(i, Math.round(wx)) * size * 0.2;
      const pGeo = new THREE.DodecahedronGeometry(ps, 0);
      const pMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.85).getHex() });
      const pebble = new THREE.Mesh(pGeo, pMat);
      pebble.position.set(wx + Math.cos(pa) * pd, baseY + ps * 0.4, wz + Math.sin(pa) * pd);
      pebble.rotation.set(hash2c(i, Math.round(wx)) * 3, 0, 0);
      group.add(pebble);
    }
  }
}

// ─── GRASS TUFT ──────────────────────────────────────────────────────────────

function addGrass(group, wx, baseY, wz, color = 0x3a5520) {
  const count = 4 + Math.floor(hash2(Math.round(wx * 3), Math.round(wz * 3)) * 4);
  for (let g = 0; g < count; g++) {
    const ga = (g / count) * Math.PI * 2 + hash2c(g, Math.round(wx)) * 0.6;
    const dist = 0.06 + hash2b(g, Math.round(wz)) * 0.14;
    const h = 0.14 + hash2(Math.round(wx) + g, Math.round(wz) + g) * 0.18;
    const bladeGeo = new THREE.ConeGeometry(0.025, h, 3);
    const bladeMat = new THREE.MeshLambertMaterial({ color });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(
      wx + Math.cos(ga) * dist,
      baseY + h * 0.5,
      wz + Math.sin(ga) * dist
    );
    blade.rotation.z = (hash2(Math.round(wx) + g, Math.round(wz)) - 0.5) * 0.35;
    blade.rotation.x = (hash2b(Math.round(wx), Math.round(wz) + g) - 0.5) * 0.2;
    group.add(blade);
  }
}

// ─── MUSHROOM CLUSTER ────────────────────────────────────────────────────────

function addMushroom(group, wx, baseY, wz) {
  const count = 1 + Math.floor(hash2(Math.round(wx * 5), Math.round(wz * 5)) * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + hash2c(i, Math.round(wx)) * 1.5;
    const dist = i * 0.08;
    const mx = wx + Math.cos(angle) * dist;
    const mz = wz + Math.sin(angle) * dist;
    const stemH = 0.08 + hash2b(Math.round(mx * 10), Math.round(mz * 10)) * 0.10;
    const capR = 0.04 + hash2(Math.round(mx * 10), Math.round(mz * 10)) * 0.05;

    const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, stemH, 4);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xddd0b8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(mx, baseY + stemH * 0.5, mz);
    group.add(stem);

    const capGeo = new THREE.SphereGeometry(capR, 5, 3, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const capColor = hash2c(Math.round(mx * 10), Math.round(mz * 10)) > 0.5 ? 0xcc3322 : 0x886644;
    const capMat = new THREE.MeshLambertMaterial({ color: capColor });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(mx, baseY + stemH + capR * 0.1, mz);
    group.add(cap);
  }
}

// ─── FLOWER PATCH ────────────────────────────────────────────────────────────

function addFlower(group, wx, baseY, wz) {
  const colors = [0xff6688, 0xffaa44, 0xaa66ff, 0xffff55, 0x66ccff];
  const count = 2 + Math.floor(hash2(Math.round(wx * 7), Math.round(wz * 7)) * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 0.05 + hash2b(i, Math.round(wx)) * 0.12;
    const fx = wx + Math.cos(angle) * dist;
    const fz = wz + Math.sin(angle) * dist;
    const stemH = 0.12 + hash2c(i, Math.round(wz)) * 0.10;

    const sGeo = new THREE.CylinderGeometry(0.01, 0.015, stemH, 3);
    const sMat = new THREE.MeshLambertMaterial({ color: 0x3a6a20 });
    const stem = new THREE.Mesh(sGeo, sMat);
    stem.position.set(fx, baseY + stemH * 0.5, fz);
    group.add(stem);

    const petalColor = colors[Math.floor(hash2(Math.round(fx * 10), Math.round(fz * 10)) * colors.length)];
    const pGeo = new THREE.SphereGeometry(0.03, 4, 3);
    const pMat = new THREE.MeshLambertMaterial({ color: petalColor });
    const petal = new THREE.Mesh(pGeo, pMat);
    petal.position.set(fx, baseY + stemH + 0.02, fz);
    group.add(petal);
  }
}

// ─── CAMPFIRE ────────────────────────────────────────────────────────────────

function addCampfire(group, wx, baseY, wz) {
  // Ring of stones
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const sGeo = new THREE.DodecahedronGeometry(0.06, 0);
    const sMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const stone = new THREE.Mesh(sGeo, sMat);
    stone.position.set(wx + Math.cos(angle) * 0.18, baseY + 0.03, wz + Math.sin(angle) * 0.18);
    group.add(stone);
  }
  // Logs
  const logGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.22, 4);
  const logMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
  [-0.5, 0.5].forEach(r => {
    const log = new THREE.Mesh(logGeo, logMat);
    log.position.set(wx, baseY + 0.04, wz);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = r;
    group.add(log);
  });
  // Flame
  const fGeo = new THREE.ConeGeometry(0.06, 0.18, 5);
  const fMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const flame = new THREE.Mesh(fGeo, fMat);
  flame.position.set(wx, baseY + 0.14, wz);
  group.add(flame);
  const fGeo2 = new THREE.ConeGeometry(0.035, 0.12, 4);
  const fMat2 = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const flame2 = new THREE.Mesh(fGeo2, fMat2);
  flame2.position.set(wx, baseY + 0.16, wz + 0.02);
  group.add(flame2);
}

// ─── CRYSTAL CLUSTER ─────────────────────────────────────────────────────────

function addCrystal(group, wx, baseY, wz, color = 0x8844ff) {
  const count = 2 + Math.floor(hash2(Math.round(wx * 9), Math.round(wz * 9)) * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.3;
    const dist = hash2b(i, Math.round(wx)) * 0.12;
    const h = 0.15 + hash2c(i, Math.round(wz)) * 0.25;
    const r = 0.03 + hash2(i, Math.round(wx)) * 0.03;
    const cGeo = new THREE.CylinderGeometry(0.005, r, h, 5);
    const cMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.8 });
    cMat.emissive = new THREE.Color(color);
    cMat.emissiveIntensity = 0.3;
    const crystal = new THREE.Mesh(cGeo, cMat);
    crystal.position.set(wx + Math.cos(angle) * dist, baseY + h * 0.5, wz + Math.sin(angle) * dist);
    crystal.rotation.z = (hash2(Math.round(wx) + i, Math.round(wz)) - 0.5) * 0.4;
    crystal.rotation.x = (hash2b(Math.round(wx), Math.round(wz) + i) - 0.5) * 0.3;
    group.add(crystal);
  }
}

// ─── FALLEN LOG ──────────────────────────────────────────────────────────────

function addFallenLog(group, wx, baseY, wz) {
  const len = 0.8 + hash2(Math.round(wx * 3), Math.round(wz * 3)) * 0.6;
  const logGeo = new THREE.CylinderGeometry(0.06, 0.08, len, 5);
  const logMat = new THREE.MeshLambertMaterial({ color: 0x3a2a10 });
  const log = new THREE.Mesh(logGeo, logMat);
  log.position.set(wx, baseY + 0.06, wz);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = hash2b(Math.round(wx), Math.round(wz)) * Math.PI;
  log.castShadow = true;
  group.add(log);

  // Moss on log
  if (hash2c(Math.round(wx * 5), Math.round(wz * 5)) > 0.5) {
    const mossGeo = new THREE.BoxGeometry(len * 0.5, 0.03, 0.10);
    const mossMat = new THREE.MeshLambertMaterial({ color: 0x2a5a18 });
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(wx, baseY + 0.12, wz);
    moss.rotation.y = log.rotation.y;
    group.add(moss);
  }
}

// ─── SWAMP POOL ──────────────────────────────────────────────────────────────

function addSwampPool(group, wx, baseY, wz) {
  const r = 0.3 + hash2(Math.round(wx * 4), Math.round(wz * 4)) * 0.3;
  const poolGeo = new THREE.CircleGeometry(r, 8);
  const poolMat = new THREE.MeshLambertMaterial({ color: 0x1a3020, transparent: true, opacity: 0.7 });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(wx, baseY + 0.01, wz);
  group.add(pool);

  // Reeds around edge
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + hash2c(i, Math.round(wx)) * 0.5;
    const reedGeo = new THREE.CylinderGeometry(0.01, 0.015, 0.35, 3);
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x3a4a18 });
    const reed = new THREE.Mesh(reedGeo, reedMat);
    reed.position.set(wx + Math.cos(a) * (r + 0.05), baseY + 0.17, wz + Math.sin(a) * (r + 0.05));
    reed.rotation.z = (hash2b(i, Math.round(wz)) - 0.5) * 0.2;
    group.add(reed);
  }
}

// ─── BUILD ALL PROPS FOR VISIBLE AREA ────────────────────────────────────────

export function buildTerrainProps(cx, cy, range = 32) {
  const group = new THREE.Group();
  group.name = "terrainProps";

  const x0 = Math.max(0, cx - range);
  const x1 = Math.min(60, cx + range);
  const y0 = Math.max(0, cy - range);
  const y1 = Math.min(50, cy + range);

  const poiSet = new Set(POINTS_OF_INTEREST.map(p => `${p.x},${p.y}`));

  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      if (poiSet.has(`${tx},${ty}`)) continue;

      const tileName = getTile(tx, ty);
      const zone = getZoneAt(tx, ty);
      const h1 = hash2(tx, ty);
      const h2 = hash2b(tx, ty);
      const h3 = hash2c(tx, ty);
      const baseY = getTerrainHeight(tx, ty);
      const wx = tx * TILE_SIZE + (h2 - 0.5) * 1.2;
      const wz = ty * TILE_SIZE + (h3 - 0.5) * 1.2;

      if (zone?.id === "the_thornwild") {
        if (h1 < 0.12) addTree(group, wx, baseY, wz, "pine");
        else if (h1 < 0.20) addTree(group, wx, baseY, wz, h3 > 0.5 ? "oak" : "pine");
        else if (h1 < 0.24) addRock(group, wx, baseY, wz, 0.10 + h2 * 0.08, 0x3a4030);
        else if (h1 < 0.30) addGrass(group, wx, baseY, wz, 0x1a3018);
        else if (h1 < 0.33) addMushroom(group, wx, baseY, wz);
        else if (h1 < 0.36) addFallenLog(group, wx, baseY, wz);
        else if (h1 < 0.38) addFlower(group, wx, baseY, wz);
      } else if (zone?.id === "greyfen_reach") {
        if (h1 < 0.10) addTree(group, wx, baseY, wz, "dead");
        else if (h1 < 0.16) addGrass(group, wx, baseY, wz, 0x2a3a1a);
        else if (h1 < 0.20) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x3a3a2a);
        else if (h1 < 0.24) addSwampPool(group, wx, baseY, wz);
        else if (h1 < 0.27) addMushroom(group, wx, baseY, wz);
        else if (h1 < 0.29) addFallenLog(group, wx, baseY, wz);
      } else if (zone?.id === "kharum_deep") {
        if (h1 < 0.14) addRock(group, wx, baseY, wz, 0.14 + h2 * 0.18, 0x666666);
        else if (h1 < 0.18) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x555555);
        else if (h1 < 0.21) addCrystal(group, wx, baseY, wz, 0x6688ff);
        else if (h1 < 0.23) {
          // Ore vein
          const oreGeo = new THREE.DodecahedronGeometry(0.10 + h2 * 0.06, 0);
          const oreColor = h3 > 0.5 ? 0xb87333 : 0x888888;
          const oreMat = new THREE.MeshLambertMaterial({ color: oreColor });
          oreMat.emissive = new THREE.Color(oreColor);
          oreMat.emissiveIntensity = 0.15;
          const ore = new THREE.Mesh(oreGeo, oreMat);
          ore.position.set(wx, baseY + 0.08, wz);
          ore.rotation.set(h2 * 3, h3 * 3, 0);
          group.add(ore);
        }
      } else if (zone?.id === "the_ashen_march") {
        if (h1 < 0.05) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x7a6a50);
        else if (h1 < 0.10) addGrass(group, wx, baseY, wz, 0x5a6828);
        else if (h1 < 0.16) {
          // Wheat stalk cluster
          const stalks = 2 + Math.floor(h2 * 3);
          for (let s = 0; s < stalks; s++) {
            const sa = (s / stalks) * Math.PI * 2;
            const sd = 0.06 + hash2c(Math.round(wx) + s, Math.round(wz)) * 0.08;
            const sh = 0.35 + hash2b(s, Math.round(wx)) * 0.25;
            const stalkGeo = new THREE.CylinderGeometry(0.015, 0.03, sh, 4);
            const stalkMat = new THREE.MeshLambertMaterial({ color: 0xd4aa30 });
            const stalk = new THREE.Mesh(stalkGeo, stalkMat);
            stalk.position.set(wx + Math.cos(sa) * sd, baseY + sh * 0.5, wz + Math.sin(sa) * sd);
            stalk.rotation.z = (hash2(s, Math.round(wz)) - 0.5) * 0.15;
            group.add(stalk);
            // Wheat head
            const headGeo = new THREE.SphereGeometry(0.025, 4, 3);
            const headMat = new THREE.MeshLambertMaterial({ color: 0xeebb40 });
            const head = new THREE.Mesh(headGeo, headMat);
            head.scale.set(0.8, 1.4, 0.8);
            head.position.set(wx + Math.cos(sa) * sd, baseY + sh + 0.015, wz + Math.sin(sa) * sd);
            group.add(head);
          }
        }
        else if (h1 < 0.18) addFlower(group, wx, baseY, wz);
        else if (h1 < 0.19) addCampfire(group, wx, baseY, wz);
        else if (h1 < 0.21) addTree(group, wx, baseY, wz, "oak");
      } else if (zone?.id === "vale_of_cinders") {
        if (h1 < 0.10) addRock(group, wx, baseY, wz, 0.12 + h2 * 0.14, 0x3a1a0a);
        else if (h1 < 0.15) {
          // Ember glow stone
          const eGeo = new THREE.DodecahedronGeometry(0.10 + h2 * 0.08, 0);
          const eMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
          const ember = new THREE.Mesh(eGeo, eMat);
          ember.position.set(wx, baseY + 0.08, wz);
          group.add(ember);
        }
        else if (h1 < 0.18) addCrystal(group, wx, baseY, wz, 0xff4400);
        else if (h1 < 0.20) {
          // Lava crack / vent
          const crackGeo = new THREE.BoxGeometry(0.08, 0.02, 0.5 + h2 * 0.3);
          const crackMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
          const crack = new THREE.Mesh(crackGeo, crackMat);
          crack.position.set(wx, baseY + 0.01, wz);
          crack.rotation.y = h3 * Math.PI;
          group.add(crack);
          // Steam
          const steamGeo = new THREE.ConeGeometry(0.06, 0.25, 4);
          const steamMat = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.3 });
          const steam = new THREE.Mesh(steamGeo, steamMat);
          steam.position.set(wx, baseY + 0.15, wz);
          group.add(steam);
        }
      } else if (zone?.id === "the_sunken_crown") {
        if (h1 < 0.08) addRock(group, wx, baseY, wz, 0.10 + h2 * 0.08, 0x6a6a7a);
        else if (h1 < 0.12) {
          // Ruined pillar
          const pH = 0.4 + h2 * 0.6;
          const pGeo = new THREE.CylinderGeometry(0.06, 0.08, pH, 6);
          const pMat = new THREE.MeshLambertMaterial({ color: 0x8a8a9a });
          const pillar = new THREE.Mesh(pGeo, pMat);
          pillar.position.set(wx, baseY + pH * 0.5, wz);
          pillar.rotation.z = (h3 - 0.5) * 0.3;
          group.add(pillar);
        }
        else if (h1 < 0.16) addGrass(group, wx, baseY, wz, 0x4a5a3a);
        else if (h1 < 0.18) addSwampPool(group, wx, baseY, wz);
      } else if (zone?.id === "high_bastion") {
        if (h1 < 0.03) {
          // Barrel cluster
          const barrelCount = 1 + Math.floor(h2 * 2);
          for (let b = 0; b < barrelCount; b++) {
            const ba = (b / barrelCount) * Math.PI * 2;
            const barrelGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.22, 6);
            const barrelMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.position.set(wx + Math.cos(ba) * 0.12, baseY + 0.11, wz + Math.sin(ba) * 0.12);
            group.add(barrel);
            // Barrel rim
            const rimGeo = new THREE.TorusGeometry(0.085, 0.012, 4, 8);
            const rimMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.x = Math.PI / 2;
            rim.position.set(wx + Math.cos(ba) * 0.12, baseY + 0.16, wz + Math.sin(ba) * 0.12);
            group.add(rim);
          }
        }
        else if (h1 < 0.05) {
          // Crate stack
          const crateGeo = new THREE.BoxGeometry(0.18, 0.16, 0.18);
          const crateMat = new THREE.MeshLambertMaterial({ color: 0x6a5030 });
          const crate = new THREE.Mesh(crateGeo, crateMat);
          crate.position.set(wx, baseY + 0.08, wz);
          group.add(crate);
          if (h2 > 0.5) {
            const crate2 = new THREE.Mesh(crateGeo, crateMat.clone());
            crate2.material.color.multiplyScalar(0.85);
            crate2.position.set(wx + 0.04, baseY + 0.24, wz - 0.02);
            crate2.rotation.y = 0.3;
            group.add(crate2);
          }
        }
        else if (h1 < 0.07) addFlower(group, wx, baseY, wz);
        else if (h1 < 0.08) {
          // Street lamp
          const poleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.8, 5);
          const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(wx, baseY + 0.40, wz);
          group.add(pole);
          const lampGeo = new THREE.SphereGeometry(0.06, 5, 4);
          const lampMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
          const lamp = new THREE.Mesh(lampGeo, lampMat);
          lamp.position.set(wx, baseY + 0.84, wz);
          group.add(lamp);
        }
      } else if (tileName === "grass" && !zone) {
        // Wilderness — more variety
        if (h1 < 0.04) addGrass(group, wx, baseY, wz);
        else if (h1 < 0.06) addTree(group, wx, baseY, wz, h3 > 0.6 ? "oak" : "pine");
        else if (h1 < 0.07) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x6a6a6a);
        else if (h1 < 0.08) addFlower(group, wx, baseY, wz);
        else if (h1 < 0.085) addFallenLog(group, wx, baseY, wz);
      } else if (tileName === "forest" && !zone) {
        if (h1 < 0.18) addTree(group, wx, baseY, wz, h3 > 0.4 ? "oak" : "pine");
        else if (h1 < 0.22) addGrass(group, wx, baseY, wz, 0x1a3a18);
        else if (h1 < 0.25) addMushroom(group, wx, baseY, wz);
        else if (h1 < 0.27) addFallenLog(group, wx, baseY, wz);
      } else if (tileName === "stone" && !zone) {
        if (h1 < 0.12) addRock(group, wx, baseY, wz, 0.12 + h2 * 0.14, 0x666666);
        else if (h1 < 0.15) addCrystal(group, wx, baseY, wz, 0x8888cc);
      } else if (tileName === "sand" && !zone) {
        if (h1 < 0.05) addRock(group, wx, baseY, wz, 0.06 + h2 * 0.06, 0x9a8a6a);
        else if (h1 < 0.07) addGrass(group, wx, baseY, wz, 0x6a7a40);
      }
    }
  }

  // ── POI BUILDINGS ──
  POINTS_OF_INTEREST.forEach(poi => {
    if (poi.x < x0 || poi.x >= x1 || poi.y < y0 || poi.y >= y1) return;
    addPOIProp(group, poi);
  });

  // ── TOWN WALLS ──
  const townZone = ZONES.find(z => z.id === "high_bastion");
  if (townZone) buildTownWalls(group, townZone);

  return group;
}

// ─── POI PROP BUILDER ────────────────────────────────────────────────────────

function addPOIProp(group, poi) {
  const wx = poi.x * TILE_SIZE;
  const wz = poi.y * TILE_SIZE;
  const baseY = getTerrainHeight(poi.x, poi.y);

  if (poi.station === "forge" || (poi.type === "crafting_station" && poi.station === "forge")) {
    // ── FORGE / BLACKSMITH ──
    // Stone building with chimney and anvil
    const wallGeo = new THREE.BoxGeometry(1.6, 1.4, 1.6);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x5a5050 });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.set(wx, baseY + 0.70, wz);
    walls.castShadow = true;
    group.add(walls);

    // Dark stone trim at base
    const trimGeo = new THREE.BoxGeometry(1.7, 0.15, 1.7);
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(wx, baseY + 0.075, wz);
    group.add(trim);

    // Roof
    const roofGeo = new THREE.ConeGeometry(1.2, 0.65, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a3a2a });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(wx, baseY + 1.72, wz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Chimney
    const chimGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
    const chimMat = new THREE.MeshLambertMaterial({ color: 0x4a4040 });
    const chim = new THREE.Mesh(chimGeo, chimMat);
    chim.position.set(wx - 0.55, baseY + 1.85, wz - 0.55);
    group.add(chim);
    // Smoke glow
    const smokeGeo = new THREE.SphereGeometry(0.12, 5, 4);
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
    const smoke = new THREE.Mesh(smokeGeo, smokeMat);
    smoke.position.set(wx - 0.55, baseY + 2.35, wz - 0.55);
    group.add(smoke);

    // Anvil outside
    const anvilBase = new THREE.BoxGeometry(0.20, 0.14, 0.12);
    const anvilMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const anvil = new THREE.Mesh(anvilBase, anvilMat);
    anvil.position.set(wx + 1.0, baseY + 0.07, wz + 0.3);
    group.add(anvil);
    const anvilTop = new THREE.BoxGeometry(0.28, 0.06, 0.16);
    const anvTop = new THREE.Mesh(anvilTop, anvilMat);
    anvTop.position.set(wx + 1.0, baseY + 0.17, wz + 0.3);
    group.add(anvTop);

    // Door
    const doorGeo = new THREE.BoxGeometry(0.35, 0.65, 0.04);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a2a10 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(wx, baseY + 0.35, wz + 0.82);
    group.add(door);

  } else if (poi.station === "alchemy" || (poi.type === "crafting_station" && poi.station === "alchemy")) {
    // ── APOTHECARY / ALCHEMY ──
    // Taller, narrower building with shelving and glowing bottles
    const wallGeo = new THREE.BoxGeometry(1.3, 1.8, 1.3);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x6a5a70 });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.set(wx, baseY + 0.90, wz);
    walls.castShadow = true;
    group.add(walls);

    const roofGeo = new THREE.ConeGeometry(1.0, 0.8, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a2a5a });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(wx, baseY + 2.20, wz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Glowing bottle window
    const bottleColors = [0x44ff88, 0xff44aa, 0x4488ff];
    bottleColors.forEach((c, i) => {
      const bGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.12, 5);
      const bMat = new THREE.MeshBasicMaterial({ color: c });
      const bottle = new THREE.Mesh(bGeo, bMat);
      bottle.position.set(wx + 0.68, baseY + 1.1 + i * 0.16, wz + (i - 1) * 0.15);
      group.add(bottle);
    });

    // Herb bundles on wall
    for (let i = 0; i < 2; i++) {
      const herbGeo = new THREE.ConeGeometry(0.08, 0.18, 4);
      const herbMat = new THREE.MeshLambertMaterial({ color: 0x2a6a20 });
      const herb = new THREE.Mesh(herbGeo, herbMat);
      herb.position.set(wx - 0.68, baseY + 1.4 + i * 0.22, wz + (i - 0.5) * 0.25);
      herb.rotation.z = Math.PI;
      group.add(herb);
    }

    const doorGeo = new THREE.BoxGeometry(0.30, 0.60, 0.04);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a2040 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(wx, baseY + 0.32, wz + 0.67);
    group.add(door);

  } else if (poi.station === "workbench" || (poi.type === "crafting_station" && poi.station === "workbench")) {
    // ── CARPENTER'S WORKSHOP ──
    const wallGeo = new THREE.BoxGeometry(1.5, 1.3, 1.5);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x7a5a30 });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.set(wx, baseY + 0.65, wz);
    walls.castShadow = true;
    group.add(walls);

    // Timber frame accents
    [-0.76, 0.76].forEach(side => {
      const beamGeo = new THREE.BoxGeometry(0.06, 1.3, 0.06);
      const beamMat = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(wx + side, baseY + 0.65, wz + 0.76);
      group.add(beam);
    });

    const roofGeo = new THREE.BoxGeometry(1.8, 0.12, 1.8);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(wx, baseY + 1.36, wz);
    group.add(roof);

    // Lumber stack outside
    for (let l = 0; l < 3; l++) {
      const logGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5);
      const logMat = new THREE.MeshLambertMaterial({ color: 0x6a4a20 });
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(wx + 0.95, baseY + 0.06 + l * 0.11, wz - 0.2 + l * 0.08);
      log.rotation.z = Math.PI / 2;
      group.add(log);
    }

    const doorGeo = new THREE.BoxGeometry(0.38, 0.60, 0.04);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x4a2a08 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(wx, baseY + 0.32, wz + 0.77);
    group.add(door);

  } else if (poi.type === "crafting_station" || poi.type === "npc") {
    // ── GENERIC BUILDING (guild hall, barracks, quest giver) ──
    const wallGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x706050 });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.set(wx, baseY + 0.75, wz);
    walls.castShadow = true;
    group.add(walls);

    // Foundation
    const foundGeo = new THREE.BoxGeometry(1.65, 0.12, 1.65);
    const foundMat = new THREE.MeshLambertMaterial({ color: 0x555050 });
    const found = new THREE.Mesh(foundGeo, foundMat);
    found.position.set(wx, baseY + 0.06, wz);
    group.add(found);

    const roofGeo = new THREE.ConeGeometry(1.15, 0.7, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b3a2a });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(wx, baseY + 1.85, wz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Window
    const winGeo = new THREE.BoxGeometry(0.18, 0.22, 0.04);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(wx + 0.40, baseY + 1.1, wz + 0.77);
    group.add(win);

    // Door
    const doorGeo = new THREE.BoxGeometry(0.35, 0.65, 0.04);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a2a10 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(wx - 0.15, baseY + 0.35, wz + 0.77);
    group.add(door);

  } else if (poi.type === "shop") {
    // ── MARKET SHOP ──
    const baseGeo = new THREE.BoxGeometry(1.8, 0.5, 1.8);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x8b6030 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(wx, baseY + 0.25, wz);
    base.castShadow = true;
    group.add(base);

    const topGeo = new THREE.BoxGeometry(1.6, 0.7, 1.6);
    const topMat = new THREE.MeshLambertMaterial({ color: 0x9a7040 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(wx, baseY + 0.85, wz);
    group.add(top);

    // Awning
    const awnGeo = new THREE.BoxGeometry(2.0, 0.06, 0.8);
    const awnMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
    const awning = new THREE.Mesh(awnGeo, awnMat);
    awning.position.set(wx, baseY + 1.28, wz + 1.0);
    awning.rotation.x = 0.15;
    group.add(awning);

    // Sign post
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a3a10 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(wx + 0.95, baseY + 1.25, wz + 0.5);
    group.add(post);

    const signGeo = new THREE.BoxGeometry(0.45, 0.25, 0.05);
    const signMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(wx + 0.95, baseY + 1.75, wz + 0.5);
    group.add(sign);

    // Goods display
    const crateGeo = new THREE.BoxGeometry(0.16, 0.14, 0.16);
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x6a4a20 });
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(wx - 0.5 + i * 0.25, baseY + 1.27, wz + 0.5);
      group.add(crate);
    }

    const doorGeo = new THREE.BoxGeometry(0.35, 0.55, 0.04);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x4a2a08 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(wx, baseY + 0.30, wz + 0.92);
    group.add(door);

  } else if (poi.type === "rest") {
    // ── TAVERN / INN ──
    // Larger 2-story building
    const floor1Geo = new THREE.BoxGeometry(2.2, 1.2, 2.2);
    const floor1Mat = new THREE.MeshLambertMaterial({ color: 0x8a6840 });
    const floor1 = new THREE.Mesh(floor1Geo, floor1Mat);
    floor1.position.set(wx, baseY + 0.60, wz);
    floor1.castShadow = true;
    group.add(floor1);

    // Second floor (slightly narrower)
    const floor2Geo = new THREE.BoxGeometry(2.0, 0.8, 2.0);
    const floor2Mat = new THREE.MeshLambertMaterial({ color: 0x9a7850 });
    const floor2 = new THREE.Mesh(floor2Geo, floor2Mat);
    floor2.position.set(wx, baseY + 1.60, wz);
    group.add(floor2);

    // Timber frame
    [-1.12, 1.12].forEach(side => {
      const beamGeo = new THREE.BoxGeometry(0.06, 2.0, 0.06);
      const beamMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(wx + side, baseY + 1.0, wz + 1.12);
      group.add(beam);
    });

    const roofGeo = new THREE.ConeGeometry(1.6, 0.9, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xaa4422 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(wx, baseY + 2.45, wz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Windows (lit)
    [[-0.5, 0.9], [0.5, 0.9], [-0.4, 1.7], [0.4, 1.7]].forEach(([ox, oy]) => {
      const winGeo = new THREE.BoxGeometry(0.18, 0.20, 0.04);
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(wx + ox, baseY + oy, wz + 1.12);
      group.add(win);
    });

    // Entrance door (wide)
    const doorGeo = new THREE.BoxGeometry(0.50, 0.70, 0.04);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(wx, baseY + 0.37, wz + 1.12);
    group.add(door);

    // Hanging sign
    const hangGeo = new THREE.BoxGeometry(0.35, 0.22, 0.04);
    const hangMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
    const hang = new THREE.Mesh(hangGeo, hangMat);
    hang.position.set(wx + 1.18, baseY + 1.50, wz + 0.4);
    hang.rotation.y = Math.PI / 2;
    group.add(hang);

  } else if (poi.type === "heal_station") {
    // ── TEMPLE / SHRINE ──
    // Open-air stone temple with pillars and glowing center
    const floorGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.12, 8);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(wx, baseY + 0.06, wz);
    group.add(floor);

    // 4 pillars
    const pillarPositions = [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    pillarPositions.forEach(([px, pz]) => {
      const pGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.0, 6);
      const pMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
      const pillar = new THREE.Mesh(pGeo, pMat);
      pillar.position.set(wx + px, baseY + 1.0, wz + pz);
      pillar.castShadow = true;
      group.add(pillar);
      // Capital
      const capGeo = new THREE.BoxGeometry(0.30, 0.10, 0.30);
      const cap = new THREE.Mesh(capGeo, new THREE.MeshLambertMaterial({ color: 0xd0c8b0 }));
      cap.position.set(wx + px, baseY + 2.05, wz + pz);
      group.add(cap);
    });

    // Lintel
    const lintelGeo = new THREE.BoxGeometry(1.8, 0.14, 1.8);
    const lintelMat = new THREE.MeshLambertMaterial({ color: 0xd0c8b0 });
    const lintel = new THREE.Mesh(lintelGeo, lintelMat);
    lintel.position.set(wx, baseY + 2.17, wz);
    group.add(lintel);

    // Mini dome
    const domeGeo = new THREE.SphereGeometry(0.45, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshLambertMaterial({ color: 0xc0b8a0 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(wx, baseY + 2.30, wz);
    group.add(dome);

    // Glowing healing orb
    const orbGeo = new THREE.SphereGeometry(0.15, 6, 5);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x44ff88 });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(wx, baseY + 0.50, wz);
    group.add(orb);

  } else if (poi.type === "resource_node") {
    const zone = getZoneAt(poi.x, poi.y);
    if (poi.resource === "wheat" || zone?.id === "the_ashen_march") {
      // Wheat field with fence
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 0.25 + (i % 3) * 0.12;
        const sh = 0.5 + hash2(poi.x + i, poi.y) * 0.35;
        const wGeo = new THREE.CylinderGeometry(0.015, 0.035, sh, 4);
        const wMat = new THREE.MeshLambertMaterial({ color: 0xd4aa30 });
        const stalk = new THREE.Mesh(wGeo, wMat);
        stalk.position.set(wx + Math.cos(angle) * r, baseY + sh * 0.5, wz + Math.sin(angle) * r);
        stalk.rotation.z = (hash2b(poi.x + i, poi.y) - 0.5) * 0.15;
        group.add(stalk);
        const headGeo = new THREE.SphereGeometry(0.025, 4, 3);
        const headMat = new THREE.MeshLambertMaterial({ color: 0xeebb40 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.scale.set(0.8, 1.5, 0.8);
        head.position.set(wx + Math.cos(angle) * r, baseY + sh + 0.01, wz + Math.sin(angle) * r);
        group.add(head);
      }
    } else if (poi.resource === "iron_ore") {
      // Mining node with ore veins
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + 0.3;
        const r = 0.25 + i * 0.08;
        addRock(group, wx + Math.cos(angle) * r, baseY, wz + Math.sin(angle) * r, 0.18 + i * 0.04, 0x666666);
      }
      // Ore veins
      for (let i = 0; i < 2; i++) {
        const oreGeo = new THREE.DodecahedronGeometry(0.08, 0);
        const oreMat = new THREE.MeshLambertMaterial({ color: 0xbb7733 });
        oreMat.emissive = new THREE.Color(0x553311);
        oreMat.emissiveIntensity = 0.2;
        const ore = new THREE.Mesh(oreGeo, oreMat);
        ore.position.set(wx + (i - 0.5) * 0.3, baseY + 0.20, wz + 0.15);
        group.add(ore);
      }
      // Pickaxe
      const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4);
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(wx + 0.45, baseY + 0.25, wz);
      handle.rotation.z = 0.8;
      group.add(handle);
    } else {
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        addRock(group, wx + Math.cos(angle) * 0.38, baseY, wz + Math.sin(angle) * 0.38, 0.18 + i * 0.04, 0x887060);
      }
    }
  } else if (poi.type === "mystery") {
    // ── MYSTERY ALTAR ──
    // Stone obelisk with rune glow
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.2, 6);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
    const mBase = new THREE.Mesh(baseGeo, baseMat);
    mBase.position.set(wx, baseY + 0.10, wz);
    group.add(mBase);

    const obelGeo = new THREE.BoxGeometry(0.35, 2.2, 0.35);
    const obelMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const obelisk = new THREE.Mesh(obelGeo, obelMat);
    obelisk.position.set(wx, baseY + 1.30, wz);
    obelisk.castShadow = true;
    group.add(obelisk);

    // Capstone
    const capGeo = new THREE.ConeGeometry(0.28, 0.35, 4);
    const capMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(wx, baseY + 2.57, wz);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);

    // Glowing rune lines
    const runeGeo = new THREE.BoxGeometry(0.04, 0.80, 0.02);
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x8866ff });
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.set(wx, baseY + 1.30, wz + 0.19);
    group.add(rune);
    const rune2Geo = new THREE.BoxGeometry(0.30, 0.04, 0.02);
    const rune2 = new THREE.Mesh(rune2Geo, runeMat);
    rune2.position.set(wx, baseY + 1.50, wz + 0.19);
    group.add(rune2);

    // Floating particles (static orbs)
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const pGeo = new THREE.SphereGeometry(0.04, 4, 3);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xaa88ff, transparent: true, opacity: 0.6 });
      const particle = new THREE.Mesh(pGeo, pMat);
      particle.position.set(wx + Math.cos(angle) * 0.4, baseY + 1.8 + i * 0.15, wz + Math.sin(angle) * 0.4);
      group.add(particle);
    }

  } else if (poi.type === "dungeon") {
    // ── DUNGEON ENTRANCE ──
    // Archway leading into darkness
    const archPillarGeo = new THREE.BoxGeometry(0.4, 2.0, 0.4);
    const archMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
    [-0.6, 0.6].forEach(side => {
      const pillar = new THREE.Mesh(archPillarGeo, archMat);
      pillar.position.set(wx + side, baseY + 1.0, wz);
      pillar.castShadow = true;
      group.add(pillar);
    });

    const archTopGeo = new THREE.BoxGeometry(1.6, 0.30, 0.45);
    const archTop = new THREE.Mesh(archTopGeo, archMat);
    archTop.position.set(wx, baseY + 2.15, wz);
    group.add(archTop);

    // Skull decoration
    const skullGeo = new THREE.SphereGeometry(0.10, 5, 4);
    const skullMat = new THREE.MeshLambertMaterial({ color: 0xdde0e4 });
    const skull = new THREE.Mesh(skullGeo, skullMat);
    skull.position.set(wx, baseY + 2.35, wz + 0.22);
    group.add(skull);

    // Dark void behind arch
    const voidGeo = new THREE.BoxGeometry(0.8, 1.6, 0.08);
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x050510 });
    const dVoid = new THREE.Mesh(voidGeo, voidMat);
    dVoid.position.set(wx, baseY + 0.80, wz - 0.15);
    group.add(dVoid);

    // Steps leading down
    for (let i = 0; i < 3; i++) {
      const stepGeo = new THREE.BoxGeometry(1.0, 0.10, 0.25);
      const stepMat = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(wx, baseY + 0.05 - i * 0.08, wz + 0.3 + i * 0.25);
      group.add(step);
    }

    // Torches
    [-0.6, 0.6].forEach(side => {
      const tGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.25, 4);
      const tMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
      const torch = new THREE.Mesh(tGeo, tMat);
      torch.position.set(wx + side, baseY + 1.65, wz + 0.22);
      group.add(torch);
      const flameGeo = new THREE.ConeGeometry(0.04, 0.10, 4);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8844 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(wx + side, baseY + 1.82, wz + 0.22);
      group.add(flame);
    });

  } else if (poi.type === "boss_encounter") {
    // ── BOSS LAIR ──
    // Dramatic rocky formation with glow
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const r = 0.5 + i * 0.1;
      const rh = 0.6 + hash2(poi.x + i, poi.y) * 1.0;
      addRock(group, wx + Math.cos(angle) * r, baseY, wz + Math.sin(angle) * r, 0.25 + i * 0.05, 0x3a1a0a);
    }
    // Central glow
    const glowGeo = new THREE.SphereGeometry(0.2, 6, 5);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.5 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(wx, baseY + 0.3, wz);
    group.add(glow);
    // Scorched ground
    const scorch = new THREE.CircleGeometry(0.8, 10);
    const scorchMat = new THREE.MeshLambertMaterial({ color: 0x1a0800 });
    const scorchMesh = new THREE.Mesh(scorch, scorchMat);
    scorchMesh.rotation.x = -Math.PI / 2;
    scorchMesh.position.set(wx, baseY + 0.02, wz);
    group.add(scorchMesh);
  }

  // Forest POI trees
  if (poi.zone === "the_thornwild" || poi.zone === "greyfen_reach") {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      const r = 0.8 + i * 0.2;
      addTree(group, wx + Math.cos(angle) * r, baseY, wz + Math.sin(angle) * r,
        poi.zone === "greyfen_reach" ? "dead" : "pine");
    }
  }
}

// ─── TOWN WALLS (copied from original, adapted to use getTerrainHeight) ──────

function buildTownWalls(group, zone) {
  const wallH = 1.0;
  const wallThick = 0.28;
  const wallColor = 0x7a6a54;
  const parapetColor = 0x6a5a44;
  const towerColor = 0x8a7a64;

  const x0w = zone.x * TILE_SIZE - TILE_SIZE * 0.5;
  const x1w = (zone.x + zone.w) * TILE_SIZE - TILE_SIZE * 0.5;
  const z0w = zone.y * TILE_SIZE - TILE_SIZE * 0.5;
  const z1w = (zone.y + zone.h) * TILE_SIZE - TILE_SIZE * 0.5;
  const baseY = getTerrainHeight(zone.x + zone.w / 2, zone.y + zone.h / 2);
  const wallY = baseY + wallH * 0.5;

  const addWall = (cx, cy, cz, lenX, lenZ) => {
    const wGeo = new THREE.BoxGeometry(lenX, wallH, lenZ);
    const wMat = new THREE.MeshLambertMaterial({ color: wallColor });
    const wall = new THREE.Mesh(wGeo, wMat);
    wall.position.set(cx, cy, cz);
    wall.castShadow = true;
    group.add(wall);

    const crenW = lenX > lenZ ? lenX : lenZ;
    const isHoriz = lenX > lenZ;
    const count = Math.floor(crenW / (TILE_SIZE * 0.8));
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) continue;
      const cGeo = new THREE.BoxGeometry(
        isHoriz ? TILE_SIZE * 0.32 : wallThick + 0.1,
        wallH * 0.35,
        isHoriz ? wallThick + 0.1 : TILE_SIZE * 0.32
      );
      const cMat = new THREE.MeshLambertMaterial({ color: parapetColor });
      const cren = new THREE.Mesh(cGeo, cMat);
      const offset = (i / (count - 1) - 0.5) * crenW * 0.85;
      cren.position.set(
        cx + (isHoriz ? offset : 0),
        cy + wallH * 0.5 + wallH * 0.175,
        cz + (isHoriz ? 0 : offset)
      );
      group.add(cren);
    }
  };

  const addTower = (tx, tz) => {
    const tGeo = new THREE.BoxGeometry(0.9, wallH + 0.5, 0.9);
    const tMat = new THREE.MeshLambertMaterial({ color: towerColor });
    const tower = new THREE.Mesh(tGeo, tMat);
    tower.position.set(tx, baseY + (wallH + 0.5) * 0.5, tz);
    tower.castShadow = true;
    group.add(tower);
    const ttGeo = new THREE.BoxGeometry(1.1, 0.25, 1.1);
    const ttop = new THREE.Mesh(ttGeo, new THREE.MeshLambertMaterial({ color: parapetColor }));
    ttop.position.set(tx, baseY + wallH + 0.5 + 0.12, tz);
    group.add(ttop);
  };

  const midX = (x0w + x1w) / 2;
  const midZ = (z0w + z1w) / 2;
  const lenX = x1w - x0w;
  const lenZ = z1w - z0w;
  const gateGap = TILE_SIZE * 2.4;

  addWall(midX - (gateGap / 2 + lenX * 0.25) * 0.5, wallY, z0w, lenX * 0.5 - gateGap * 0.5 - 0.2, wallThick);
  addWall(midX + (gateGap / 2 + lenX * 0.25) * 0.5, wallY, z0w, lenX * 0.5 - gateGap * 0.5 - 0.2, wallThick);
  addWall(midX, wallY, z1w, lenX, wallThick);
  addWall(x0w, wallY, midZ, wallThick, lenZ);
  addWall(x1w, wallY, midZ, wallThick, lenZ);

  addTower(x0w, z0w);
  addTower(x1w, z0w);
  addTower(x0w, z1w);
  addTower(x1w, z1w);

  // Gate arch
  const gx = midX;
  const gz = z0w;
  const pillarH = wallH + 0.7;
  [-1, 1].forEach(side => {
    const pGeo = new THREE.BoxGeometry(0.4, pillarH, 0.4);
    const pillar = new THREE.Mesh(pGeo, new THREE.MeshLambertMaterial({ color: 0x9a8870 }));
    pillar.position.set(gx + side * (gateGap / 2), baseY + pillarH * 0.5, gz);
    pillar.castShadow = true;
    group.add(pillar);
  });
  const lGeo = new THREE.BoxGeometry(gateGap + 0.4, 0.28, 0.44);
  const lintel = new THREE.Mesh(lGeo, new THREE.MeshLambertMaterial({ color: 0x7a6850 }));
  lintel.position.set(gx, baseY + pillarH + 0.14, gz);
  group.add(lintel);
  const sgGeo = new THREE.BoxGeometry(gateGap * 0.55, 0.30, 0.12);
  const sg = new THREE.Mesh(sgGeo, new THREE.MeshLambertMaterial({ color: 0xd4a017 }));
  sg.position.set(gx, baseY + pillarH + 0.46, gz);
  group.add(sg);

  // Gate torches
  [-1, 1].forEach(side => {
    const tGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.30, 4);
    const tMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
    const torch = new THREE.Mesh(tGeo, tMat);
    torch.position.set(gx + side * (gateGap / 2 + 0.15), baseY + pillarH * 0.7, gz + 0.22);
    group.add(torch);
    const fGeo = new THREE.ConeGeometry(0.05, 0.12, 4);
    const fMat = new THREE.MeshBasicMaterial({ color: 0xff8844 });
    const flame = new THREE.Mesh(fGeo, fMat);
    flame.position.set(gx + side * (gateGap / 2 + 0.15), baseY + pillarH * 0.7 + 0.21, gz + 0.22);
    group.add(flame);
  });

  // Banner flags on towers
  [
    [x0w, z0w], [x1w, z0w], [x0w, z1w], [x1w, z1w]
  ].forEach(([bx, bz], i) => {
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(bx, baseY + wallH + 0.5 + 0.5, bz);
    group.add(pole);
    const flagColors = [0xcc2222, 0x2244aa, 0xcc8822, 0x22aa44];
    const flagGeo = new THREE.BoxGeometry(0.35, 0.22, 0.02);
    const flagMat = new THREE.MeshLambertMaterial({ color: flagColors[i] });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(bx + 0.20, baseY + wallH + 0.5 + 0.85, bz);
    group.add(flag);
  });
}