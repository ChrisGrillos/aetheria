/**
 * MOVEMENT AUTHORITY
 *
 * Single source of truth for movement validation and pathing.
 * All input surfaces (WASD, click-to-move, 3D scene) should route here.
 */

import { getTile, getZoneAt, MAP_W, MAP_H } from "./worldZones";
import { isSafeZone } from "./worldRules";
import {
  getCollisionSnapshot,
  getDynamicCollisionCell,
  getStaticCollisionCell,
  setDynamicCollisionCells,
} from "./worldCollisionAuthority";

const ORTHO_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

/**
 * Returns rich passability data for a tile.
 * @param {number} x
 * @param {number} y
 * @param {{ ignoreOccupantId?: string }} options
 */
export function getPassability(x, y, options = {}) {
  if (!inBounds(x, y)) {
    return { passable: false, reason: "Out of bounds", collisionReason: "boundary" };
  }

  if (getTile(x, y) === "water") {
    return { passable: false, reason: "Water tile", collisionReason: "water" };
  }

  const staticCell = getStaticCollisionCell(x, y);
  if (staticCell) {
    return {
      passable: false,
      reason: `Blocked by ${staticCell.reason}`,
      collisionReason: staticCell.reason,
      cell: staticCell,
    };
  }

  const dynamicCell = getDynamicCollisionCell(x, y, options.ignoreOccupantId);
  if (dynamicCell) {
    return {
      passable: false,
      reason: "Blocked by entity",
      collisionReason: "dynamic",
      cell: dynamicCell,
    };
  }

  return { passable: true };
}

/**
 * Backward-compatible boolean passability check.
 * @param {number} x
 * @param {number} y
 * @param {{ ignoreOccupantId?: string }} options
 */
export function isPassable(x, y, options = {}) {
  return getPassability(x, y, options).passable;
}

/**
 * Returns movement cost of a tile.
 */
export function moveCost(x, y) {
  const tile = getTile(x, y);
  if (tile === "forest" || tile === "swamp") return 2;
  if (tile === "stone" || tile === "lava") return 3;
  return 1;
}

/**
 * Returns movement context for a position.
 */
export function getMovementContext(x, y) {
  const zone = getZoneAt(x, y);
  return {
    zone,
    isSafe: isSafeZone(x, y),
    zoneId: zone?.id || null,
  };
}

/**
 * Validates whether a segment from (fromX,fromY) to (toX,toY) crosses blocked tiles.
 * Handles non-adjacent movement defensively to prevent tunneling.
 */
export function isSegmentPassable(fromX, fromY, toX, toY, options = {}) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return { passable: true };

  const stepX = dx / steps;
  const stepY = dy / steps;
  let lastX = fromX;
  let lastY = fromY;

  for (let i = 1; i <= steps; i += 1) {
    const sx = Math.round(fromX + (stepX * i));
    const sy = Math.round(fromY + (stepY * i));
    const check = getPassability(sx, sy, options);
    if (!check.passable) return check;

    // Prevent corner-cutting on diagonal transitions.
    const crossDx = sx - lastX;
    const crossDy = sy - lastY;
    if (Math.abs(crossDx) === 1 && Math.abs(crossDy) === 1) {
      const a = getPassability(lastX + crossDx, lastY, options);
      const b = getPassability(lastX, lastY + crossDy, options);
      if (!a.passable || !b.passable) {
        return {
          passable: false,
          reason: "Blocked corner transition",
          collisionReason: "corner",
        };
      }
    }

    lastX = sx;
    lastY = sy;
  }

  return { passable: true };
}

/**
 * BFS pathfinder.
 * Returns [x,y] steps from start to destination (excluding start), or [] if unreachable.
 */
export function buildPath(x0, y0, x1, y1, maxSteps = 60, options = {}) {
  if (x0 === x1 && y0 === y1) return [];
  if (!isPassable(x1, y1, options)) return [];

  const key = (x, y) => `${x},${y}`;
  const queue = [[x0, y0]];
  const visited = new Set([key(x0, y0)]);
  const parent = {};

  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === x1 && cy === y1) {
      const path = [];
      let cur = key(x1, y1);
      const start = key(x0, y0);
      while (cur !== start) {
        const [px, py] = cur.split(",").map(Number);
        path.unshift([px, py]);
        cur = parent[cur];
      }
      return path;
    }

    if (visited.size > maxSteps * 4) break;

    for (const [dx, dy] of ORTHO_DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (!isPassable(nx, ny, options)) continue;
      visited.add(k);
      parent[k] = key(cx, cy);
      queue.push([nx, ny]);
    }
  }

  return [];
}

/**
 * Validate a single move step.
 * Returns { valid: boolean, reason?: string, collisionReason?: string }.
 */
export function validateStep(fromX, fromY, toX, toY, options = {}) {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  if (dx + dy !== 1) {
    return { valid: false, reason: "Not an adjacent tile", collisionReason: "adjacency" };
  }

  const segment = isSegmentPassable(fromX, fromY, toX, toY, options);
  if (!segment.passable) {
    return {
      valid: false,
      reason: segment.reason || "Tile is not passable",
      collisionReason: segment.collisionReason,
    };
  }

  return { valid: true };
}

/**
 * Allow world authority to publish dynamic blockers.
 * Expects rows like { x, y, occupantId }.
 */
export function setMovementDynamicBlockers(rows = []) {
  setDynamicCollisionCells(rows);
}

/**
 * Exposes current collision state for debugging overlays and tooling.
 */
export function getMovementCollisionSnapshot() {
  return getCollisionSnapshot();
}

/**
 * Calculate energy regen for a movement step.
 */
export function movementEnergyRegen(character) {
  const wisdomMax = 50 + ((character.stats?.wisdom || 10) * 2);
  const current = character.energy ?? wisdomMax;
  const next = Math.min(wisdomMax, current + 5);
  return { energy: next, maxEnergy: wisdomMax };
}
