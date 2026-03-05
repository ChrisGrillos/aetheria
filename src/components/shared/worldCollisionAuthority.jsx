import { MAP_W, MAP_H, POINTS_OF_INTEREST, ZONES } from "./worldZones";

/**
 * CollisionCell
 * @typedef {{ x: number, y: number, blocked: boolean, reason: "wall"|"building"|"poi"|"dynamic", occupantId?: string }} CollisionCell
 */

/**
 * CollisionSnapshot
 * @typedef {{ staticVersion: string, dynamicVersion: number, cellsBlocked: CollisionCell[] }} CollisionSnapshot
 */

const STATIC_VERSION = "2026-03-05-hybrid-v2";
const staticBlocked = new Map();
let dynamicBlocked = new Map();
let dynamicVersion = 0;

const keyOf = (x, y) => `${x},${y}`;

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

function stampCell(store, x, y, reason) {
  if (!inBounds(x, y)) return;
  store.set(keyOf(x, y), { x, y, blocked: true, reason });
}

function stampRect(store, centerX, centerY, halfW, halfH, reason) {
  const minX = Math.floor(centerX - halfW);
  const maxX = Math.ceil(centerX + halfW);
  const minY = Math.floor(centerY - halfH);
  const maxY = Math.ceil(centerY + halfH);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      stampCell(store, x, y, reason);
    }
  }
}

function poiFootprint(poi) {
  if (poi.type === "shop") return { halfW: 1.0, halfH: 1.0, reason: "building" };
  if (poi.type === "rest") return { halfW: 1.1, halfH: 1.1, reason: "building" };
  if (poi.type === "crafting_station") return { halfW: 1.0, halfH: 1.0, reason: "building" };
  if (poi.type === "npc") {
    if (String(poi.id || "").includes("gate")) return { halfW: 0.45, halfH: 0.45, reason: "poi" };
    return { halfW: 1.0, halfH: 1.0, reason: "building" };
  }
  if (poi.type === "heal_station") return { halfW: 0.9, halfH: 0.9, reason: "poi" };
  if (poi.type === "dungeon") return { halfW: 0.9, halfH: 0.9, reason: "poi" };
  if (poi.type === "mystery") return { halfW: 0.8, halfH: 0.8, reason: "poi" };
  if (poi.type === "boss_encounter") return { halfW: 0.9, halfH: 0.9, reason: "poi" };
  if (poi.type === "resource_node") return { halfW: 0.8, halfH: 0.8, reason: "poi" };
  return null;
}

function stampTownWalls(store) {
  const town = ZONES.find((z) => z.id === "high_bastion");
  if (!town) return;

  const x0 = town.x;
  const x1 = town.x + town.w - 1;
  const y0 = town.y;
  const y1 = town.y + town.h - 1;

  const wallThickness = 2;
  const gateCenter = Math.floor(town.x + (town.w / 2));
  const gateMin = gateCenter - 1;
  const gateMax = gateCenter + 1;

  for (let x = x0; x <= x1; x += 1) {
    for (let t = 0; t < wallThickness; t += 1) {
      if (x < gateMin || x > gateMax) stampCell(store, x, y0 + t, "wall");
      stampCell(store, x, y1 - t, "wall");
    }
  }
  for (let y = y0; y <= y1; y += 1) {
    for (let t = 0; t < wallThickness; t += 1) {
      stampCell(store, x0 + t, y, "wall");
      stampCell(store, x1 - t, y, "wall");
    }
  }
}

function buildStatic() {
  staticBlocked.clear();
  stampTownWalls(staticBlocked);

  POINTS_OF_INTEREST.forEach((poi) => {
    const fp = poiFootprint(poi);
    if (!fp) return;
    stampRect(staticBlocked, poi.x, poi.y, fp.halfW, fp.halfH, fp.reason);
  });
}

buildStatic();

export function getStaticCollisionCell(x, y) {
  return staticBlocked.get(keyOf(x, y)) || null;
}

export function getDynamicCollisionCell(x, y, ignoreOccupantId = null) {
  const cell = dynamicBlocked.get(keyOf(x, y));
  if (!cell) return null;
  if (ignoreOccupantId && cell.occupantId && cell.occupantId === ignoreOccupantId) return null;
  return cell;
}

export function setDynamicCollisionCells(cells = []) {
  const next = new Map();
  cells.forEach((row) => {
    const x = Number(row?.x);
    const y = Number(row?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (!inBounds(x, y)) return;
    next.set(keyOf(x, y), {
      x,
      y,
      blocked: true,
      reason: "dynamic",
      occupantId: row?.occupantId ? String(row.occupantId) : undefined,
    });
  });
  dynamicBlocked = next;
  dynamicVersion += 1;
}

export function getCollisionSnapshot() {
  const cellsBlocked = [
    ...staticBlocked.values(),
    ...dynamicBlocked.values(),
  ];
  return {
    staticVersion: STATIC_VERSION,
    dynamicVersion,
    cellsBlocked,
  };
}
