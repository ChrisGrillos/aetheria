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
  if (treeType === "dead") {
    // Bare trunk
    const trunkH = 0.8 + hash2(Math.round(wx), Math.round(wz)) * 0.5;
    const tGeo = new THREE.CylinderGeometry(0.04, 0.09, trunkH, 5);
    const tMat = new THREE.MeshLambertMaterial({ color: 0x2a1e10 });
    const trunk = new THREE.Mesh(tGeo, tMat);
    trunk.position.set(wx, baseY + trunkH * 0.5, wz);
    trunk.rotation.z = (hash2b(Math.round(wx), Math.round(wz)) - 0.5) * 0.25;
    trunk.castShadow = true;
    group.add(trunk);

    // A few bare branches
    for (let i = 0; i < 2; i++) {
      const brH = 0.25 + hash2c(Math.round(wx) + i, Math.round(wz)) * 0.2;
      const brGeo = new THREE.CylinderGeometry(0.015, 0.03, brH, 3);
      const brMat = new THREE.MeshLambertMaterial({ color: 0x2a1e10 });
      const br = new THREE.Mesh(brGeo, brMat);
      const side = i === 0 ? 1 : -1;
      br.position.set(wx + side * 0.12, baseY + trunkH * (0.5 + i * 0.2), wz);
      br.rotation.z = side * 0.8;
      group.add(br);
    }
    return;
  }

  // Pine tree (default)
  const trunkH = 0.6 + hash2(Math.round(wx * 10), Math.round(wz * 10)) * 0.5;
  const tGeo = new THREE.CylinderGeometry(0.05, 0.10, trunkH, 5);
  const tMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const trunk = new THREE.Mesh(tGeo, tMat);
  trunk.position.set(wx, baseY + trunkH * 0.5, wz);
  trunk.castShadow = true;
  group.add(trunk);

  // Layered foliage cones
  const foliageColor = treeType === "autumn" ? 0x8a5020 : 0x1a4018;
  const layers = [
    { yOff: trunkH + 0.05, r: 0.45, h: 0.50 },
    { yOff: trunkH + 0.30, r: 0.35, h: 0.40 },
    { yOff: trunkH + 0.50, r: 0.22, h: 0.30 },
  ];
  layers.forEach(l => {
    const fGeo = new THREE.ConeGeometry(l.r, l.h, 6);
    const fMat = new THREE.MeshLambertMaterial({ color: foliageColor });
    const foliage = new THREE.Mesh(fGeo, fMat);
    foliage.position.set(wx, baseY + l.yOff, wz);
    foliage.castShadow = true;
    group.add(foliage);
  });
}

// ─── ROCK BUILDER ────────────────────────────────────────────────────────────

function addRock(group, wx, baseY, wz, size, color = 0x6a6a6a) {
  const rGeo = new THREE.DodecahedronGeometry(size, 0);
  const rMat = new THREE.MeshLambertMaterial({ color });
  const rock = new THREE.Mesh(rGeo, rMat);
  rock.position.set(wx, baseY + size * 0.55, wz);
  rock.rotation.set(hash2(Math.round(wx), Math.round(wz)) * 3, hash2b(Math.round(wx), Math.round(wz)) * 3, 0);
  rock.castShadow = true;
  group.add(rock);
}

// ─── GRASS TUFT ──────────────────────────────────────────────────────────────

function addGrass(group, wx, baseY, wz, color = 0x3a5520) {
  for (let g = 0; g < 3; g++) {
    const ga = (g / 3) * Math.PI * 2;
    const bladeGeo = new THREE.ConeGeometry(0.04, 0.22, 3);
    const bladeMat = new THREE.MeshLambertMaterial({ color });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(
      wx + Math.cos(ga) * 0.12,
      baseY + 0.11,
      wz + Math.sin(ga) * 0.12
    );
    blade.rotation.z = (hash2(Math.round(wx) + g, Math.round(wz)) - 0.5) * 0.3;
    group.add(blade);
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
        if (h1 < 0.22) addTree(group, wx, baseY, wz, "pine");
        else if (h1 < 0.28) addRock(group, wx, baseY, wz, 0.10 + h2 * 0.08, 0x3a4030);
        else if (h1 < 0.34) addGrass(group, wx, baseY, wz, 0x1a3018);
      } else if (zone?.id === "greyfen_reach") {
        if (h1 < 0.10) addTree(group, wx, baseY, wz, "dead");
        else if (h1 < 0.18) addGrass(group, wx, baseY, wz, 0x2a3a1a);
        else if (h1 < 0.22) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x3a3a2a);
      } else if (zone?.id === "kharum_deep") {
        if (h1 < 0.16) addRock(group, wx, baseY, wz, 0.14 + h2 * 0.18, 0x666666);
        else if (h1 < 0.20) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x555555);
      } else if (zone?.id === "the_ashen_march") {
        if (h1 < 0.06) addRock(group, wx, baseY, wz, 0.08 + h2 * 0.06, 0x7a6a50);
        else if (h1 < 0.12) addGrass(group, wx, baseY, wz, 0x5a6828);
        else if (h1 < 0.16) {
          // Wheat stalk
          const stalkGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.55, 4);
          const stalkMat = new THREE.MeshLambertMaterial({ color: 0xd4aa30 });
          const stalk = new THREE.Mesh(stalkGeo, stalkMat);
          stalk.position.set(wx, baseY + 0.28, wz);
          group.add(stalk);
        }
      } else if (zone?.id === "vale_of_cinders") {
        if (h1 < 0.12) addRock(group, wx, baseY, wz, 0.12 + h2 * 0.14, 0x3a1a0a);
        else if (h1 < 0.16) {
          // Ember glow stone
          const eGeo = new THREE.DodecahedronGeometry(0.10 + h2 * 0.08, 0);
          const eMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
          const ember = new THREE.Mesh(eGeo, eMat);
          ember.position.set(wx, baseY + 0.08, wz);
          group.add(ember);
        }
      } else if (zone?.id === "high_bastion") {
        // Sparse decoration — flower pots, barrels
        if (h1 < 0.04) {
          const barrelGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.24, 6);
          const barrelMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
          const barrel = new THREE.Mesh(barrelGeo, barrelMat);
          barrel.position.set(wx, baseY + 0.12, wz);
          group.add(barrel);
        }
      } else if (tileName === "grass" && !zone) {
        // Wilderness grass tufts
        if (h1 < 0.06) addGrass(group, wx, baseY, wz);
        else if (h1 < 0.08) addTree(group, wx, baseY, wz, "pine");
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

  if (poi.type === "crafting_station" || poi.type === "npc") {
    const bGeo = new THREE.BoxGeometry(1.4, 1.6, 1.4);
    const bMat = new THREE.MeshLambertMaterial({ color: 0x706050 });
    const bldg = new THREE.Mesh(bGeo, bMat);
    bldg.position.set(wx, baseY + 0.80, wz);
    bldg.castShadow = true;
    group.add(bldg);
    const rGeo = new THREE.ConeGeometry(1.1, 0.7, 4);
    const rMat = new THREE.MeshLambertMaterial({ color: 0x8b3a2a });
    const roof = new THREE.Mesh(rGeo, rMat);
    roof.position.set(wx, baseY + 1.95, wz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else if (poi.type === "shop") {
    const sGeo = new THREE.BoxGeometry(1.8, 1.2, 1.8);
    const sMat = new THREE.MeshLambertMaterial({ color: 0x8b6030 });
    const shop = new THREE.Mesh(sGeo, sMat);
    shop.position.set(wx, baseY + 0.60, wz);
    shop.castShadow = true;
    group.add(shop);
    const postGeo = new THREE.BoxGeometry(0.06, 0.8, 0.06);
    const post = new THREE.Mesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x5a3a10 }));
    post.position.set(wx + 0.95, baseY + 1.25, wz);
    group.add(post);
    const signGeo = new THREE.BoxGeometry(0.40, 0.22, 0.05);
    const sign = new THREE.Mesh(signGeo, new THREE.MeshLambertMaterial({ color: 0xd4a017 }));
    sign.position.set(wx + 0.95, baseY + 1.68, wz);
    group.add(sign);
  } else if (poi.type === "rest") {
    const iGeo = new THREE.BoxGeometry(2.0, 1.4, 2.0);
    const iMat = new THREE.MeshLambertMaterial({ color: 0x9a7050 });
    const inn = new THREE.Mesh(iGeo, iMat);
    inn.position.set(wx, baseY + 0.70, wz);
    inn.castShadow = true;
    group.add(inn);
    const rGeo = new THREE.ConeGeometry(1.5, 0.8, 4);
    const rMat = new THREE.MeshLambertMaterial({ color: 0xaa4422 });
    const roof = new THREE.Mesh(rGeo, rMat);
    roof.position.set(wx, baseY + 1.70, wz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else if (poi.type === "heal_station") {
    const pGeo = new THREE.CylinderGeometry(0.30, 0.34, 2.0, 8);
    const pMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
    [-0.7, 0.7].forEach(ox => {
      const pillar = new THREE.Mesh(pGeo, pMat);
      pillar.position.set(wx + ox, baseY + 1.0, wz);
      group.add(pillar);
    });
    const capGeo = new THREE.BoxGeometry(2.2, 0.18, 1.2);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
    cap.position.set(wx, baseY + 2.10, wz);
    group.add(cap);
  } else if (poi.type === "resource_node") {
    const zone = getZoneAt(poi.x, poi.y);
    if (poi.resource === "wheat" || zone?.id === "the_ashen_march") {
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const wGeo = new THREE.CylinderGeometry(0.03, 0.06, 0.85, 4);
        const wMat = new THREE.MeshLambertMaterial({ color: 0xd4aa30 });
        const stalk = new THREE.Mesh(wGeo, wMat);
        stalk.position.set(wx + Math.cos(angle) * 0.35, baseY + 0.42, wz + Math.sin(angle) * 0.35);
        group.add(stalk);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        addRock(group, wx + Math.cos(angle) * 0.42, baseY, wz + Math.sin(angle) * 0.42, 0.22 + i * 0.05, 0x887060);
      }
    }
  } else if (poi.type === "mystery" || poi.type === "dungeon") {
    const sGeo = new THREE.BoxGeometry(0.5, 2.4, 0.5);
    const sMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
    const stone = new THREE.Mesh(sGeo, sMat);
    stone.position.set(wx, baseY + 1.2, wz);
    stone.rotation.y = 0.3;
    stone.castShadow = true;
    group.add(stone);
    const cGeo = new THREE.BoxGeometry(0.75, 0.25, 0.75);
    const cap = new THREE.Mesh(cGeo, new THREE.MeshLambertMaterial({ color: 0x222233 }));
    cap.position.set(wx, baseY + 2.52, wz);
    group.add(cap);
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
}