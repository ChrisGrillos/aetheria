/**
 * ProceduralTerrain — Generates a continuous heightmap mesh with biome coloring.
 * Uses simplex-style noise (hand-rolled, no npm dependency) for organic terrain.
 * Replaces the old per-tile BoxGeometry approach with a single PlaneGeometry.
 */

import * as THREE from "three";
import { getTile, getZoneAt, MAP_W, MAP_H, ZONES, POINTS_OF_INTEREST } from "@/components/shared/worldZones";

const TILE_SIZE = 2;

// ─── SIMPLEX-LIKE NOISE (2D) ─────────────────────────────────────────────────
// Deterministic hash-based gradient noise — good enough for terrain, zero deps.

const PERM = new Uint8Array(512);
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates with fixed seed
  let seed = 42;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807 + 7) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function dot2(g, x, y) { return g[0] * x + g[1] * y; }

function noise2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const aa = PERM[PERM[X] + Y] & 7;
  const ab = PERM[PERM[X] + Y + 1] & 7;
  const ba = PERM[PERM[X + 1] + Y] & 7;
  const bb = PERM[PERM[X + 1] + Y + 1] & 7;
  const x1 = dot2(GRAD[aa], xf, yf) * (1 - u) + dot2(GRAD[ba], xf - 1, yf) * u;
  const x2 = dot2(GRAD[ab], xf, yf - 1) * (1 - u) + dot2(GRAD[bb], xf - 1, yf - 1) * u;
  return x1 * (1 - v) + x2 * v;
}

function fbm(x, y, octaves = 4) {
  let val = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / maxAmp;
}

// ─── BIOME HEIGHT CONFIGS ────────────────────────────────────────────────────

const ZONE_TERRAIN_CONFIG = {
  high_bastion:     { baseH: 0.3,  noiseScale: 0.06, noiseAmp: 0.15, flatness: 0.7 },
  the_thornwild:    { baseH: 0.5,  noiseScale: 0.10, noiseAmp: 0.8,  flatness: 0.3 },
  kharum_deep:      { baseH: 1.2,  noiseScale: 0.08, noiseAmp: 1.8,  flatness: 0.1 },
  greyfen_reach:    { baseH: -0.1, noiseScale: 0.07, noiseAmp: 0.3,  flatness: 0.5 },
  the_ashen_march:  { baseH: 0.2,  noiseScale: 0.05, noiseAmp: 0.25, flatness: 0.6 },
  vale_of_cinders:  { baseH: 0.8,  noiseScale: 0.09, noiseAmp: 1.4,  flatness: 0.15 },
  the_sunken_crown: { baseH: -0.2, noiseScale: 0.06, noiseAmp: 0.4,  flatness: 0.4 },
};

const DEFAULT_CONFIG = { baseH: 0.15, noiseScale: 0.07, noiseAmp: 0.5, flatness: 0.4 };

// ─── BIOME COLORS ────────────────────────────────────────────────────────────

const BIOME_COLORS = {
  grass:  new THREE.Color(0x3a6b32),
  forest: new THREE.Color(0x1e4020),
  water:  new THREE.Color(0x1a3d6e),
  stone:  new THREE.Color(0x606060),
  sand:   new THREE.Color(0xa08060),
  lava:   new THREE.Color(0x8b2500),
  swamp:  new THREE.Color(0x2e4422),
  plains: new THREE.Color(0x5a6e28),
};

const ZONE_ACCENT = {
  high_bastion:     new THREE.Color(0x4a7a3a),
  the_thornwild:    new THREE.Color(0x143014),
  kharum_deep:      new THREE.Color(0x505050),
  greyfen_reach:    new THREE.Color(0x1a2a14),
  the_ashen_march:  new THREE.Color(0x606828),
  vale_of_cinders:  new THREE.Color(0x6a1a00),
  the_sunken_crown: new THREE.Color(0x4a5a6e),
};

// ─── HEIGHT FUNCTION ─────────────────────────────────────────────────────────

export function getTerrainHeight(tx, ty) {
  const zone = getZoneAt(tx, ty);
  const cfg = zone ? (ZONE_TERRAIN_CONFIG[zone.id] || DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const n = fbm(tx * cfg.noiseScale, ty * cfg.noiseScale, 4);
  const height = cfg.baseH + n * cfg.noiseAmp * (1 - cfg.flatness);

  // Flatten under POIs
  const hasPOI = POINTS_OF_INTEREST.some(p => Math.abs(p.x - tx) < 1.5 && Math.abs(p.y - ty) < 1.5);
  if (hasPOI) return cfg.baseH + 0.05;

  // Water tiles sink
  const tile = getTile(tx, ty);
  if (tile === "water") return Math.min(height, -0.3);

  return height;
}

// ─── COLOR FUNCTION ──────────────────────────────────────────────────────────

function getTerrainColor(tx, ty, height) {
  const tile = getTile(tx, ty);
  const zone = getZoneAt(tx, ty);
  const base = BIOME_COLORS[tile] || BIOME_COLORS.grass;
  const accent = zone ? (ZONE_ACCENT[zone.id] || base) : base;

  const color = base.clone();

  // Blend accent by noise for variation
  const n = (fbm(tx * 0.15 + 100, ty * 0.15 + 100, 2) + 1) * 0.5;
  color.lerp(accent, n * 0.4);

  // Height-based shading: darker in valleys, lighter on peaks
  const shade = THREE.MathUtils.clamp(height * 0.3 + 0.5, 0.35, 1.1);
  color.multiplyScalar(shade);

  // Snow on high peaks (mountains)
  if (zone?.id === "kharum_deep" && height > 2.0) {
    const snowBlend = THREE.MathUtils.clamp((height - 2.0) * 0.5, 0, 0.6);
    color.lerp(new THREE.Color(0xdde8f0), snowBlend);
  }

  // Lava glow
  if (tile === "lava") {
    const glowN = (fbm(tx * 0.3, ty * 0.3, 2) + 1) * 0.5;
    color.lerp(new THREE.Color(0xff4400), glowN * 0.4);
  }

  return color;
}

// ─── BUILD TERRAIN MESH ──────────────────────────────────────────────────────

export function buildProceduralTerrain(cx, cy, range = 32) {
  const x0 = Math.max(0, cx - range);
  const x1 = Math.min(MAP_W, cx + range);
  const y0 = Math.max(0, cy - range);
  const y1 = Math.min(MAP_H, cy + range);

  const segW = x1 - x0;
  const segH = y1 - y0;

  // Create PlaneGeometry with enough segments for per-tile detail
  const geo = new THREE.PlaneGeometry(
    segW * TILE_SIZE,
    segH * TILE_SIZE,
    segW,
    segH
  );
  geo.rotateX(-Math.PI / 2);

  const positions = geo.attributes.position.array;
  const colors = new Float32Array(positions.length);

  for (let iy = 0; iy <= segH; iy++) {
    for (let ix = 0; ix <= segW; ix++) {
      const idx = (iy * (segW + 1) + ix) * 3;
      const tx = x0 + ix;
      const ty = y0 + iy;

      const h = getTerrainHeight(tx, ty);

      // PlaneGeometry after rotateX(-PI/2): x = local x, y = up, z = local z
      // Vertices are laid out left-to-right, top-to-bottom
      positions[idx]     = (x0 + ix) * TILE_SIZE;   // x world
      positions[idx + 1] = h;                        // y (height)
      positions[idx + 2] = (y0 + iy) * TILE_SIZE;   // z world

      const color = getTerrainColor(tx, ty, h);
      colors[idx]     = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "proceduralTerrain";

  // Store tile lookup data for raycasting
  mesh.userData = { x0, y0, x1, y1, segW, segH };

  return mesh;
}

// ─── RAYCAST HELPER: world position → tile coords ───────────────────────────

export function worldPosToTile(worldX, worldZ) {
  return {
    tx: Math.round(worldX / TILE_SIZE),
    ty: Math.round(worldZ / TILE_SIZE),
  };
}