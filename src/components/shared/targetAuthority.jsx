/**
 * TARGET AUTHORITY
 *
 * Single source of truth for selection, targeting, and target validation.
 * All input surfaces (WorldMap, WorldScene3D, useInputController, CombatOverlay)
 * must route target changes through here.
 *
 * Grammar:
 *   left click    → select / interact
 *   right click   → move (handled by movementAuthority)
 *   double click  → engage (attack if valid)
 *   tab           → cycle nearest hostile
 *   escape        → clear target
 *
 * Target types: "monster" | "player" | "ai_agent" | "npc" | "object"
 */

import { isSafeZone, ZONE_TYPES, ZONE_CONFIG } from "./worldRules";
import { getZoneAt } from "./worldZones";

// ─── TARGET TYPES ────────────────────────────────────────────────────────────

export const TARGET_TYPE = {
  MONSTER:  "monster",
  PLAYER:   "player",
  AI_AGENT: "ai_agent",
  NPC:      "npc",
  OBJECT:   "object",
  SELF:     "self",
};

// ─── HOSTILITY CLASSIFICATION ────────────────────────────────────────────────

/**
 * Given viewer (myCharacter) and a target entity, determine the visual hostility
 * class for UI coloring and interaction grammar.
 *
 * Returns: "hostile" | "friendly" | "neutral" | "self" | "pvp_flagged"
 */
export function getHostilityClass(viewer, target, zone) {
  if (!viewer || !target) return "neutral";
  if (viewer.id === target.id) return "self";

  // Monsters are always hostile
  if (target.is_alive !== undefined && !target.name?.startsWith?.("Player")) return "hostile";
  if (target.species) return "hostile";

  const inSafe = isSafeZone(viewer.x, viewer.y);

  // Other players
  if (target.type === "human") {
    if (inSafe) return "friendly";   // safe zone — never hostile coloring
    return "pvp_flagged";            // frontier — neutral until engaged
  }

  // AI agents
  if (target.type === "ai_agent") {
    if (inSafe) return "friendly";
    return "neutral";
  }

  return "neutral";
}

/**
 * Get zone rule summary for a position (used in target/combat UI).
 */
export function getZoneRuleSummary(x, y) {
  const zone = getZoneAt(x, y);
  if (!zone) return { label: "Frontier", isSafe: false, dangerLevel: 3, pvpAllowed: true };

  const config = ZONE_CONFIG[zone.id];
  const isSafe = config?.type === ZONE_TYPES.SAFE_TOWN;

  return {
    label: isSafe ? "Safehold" : "Frontier",
    isSafe,
    zoneName: zone.name,
    dangerLevel: zone.danger ?? 3,
    pvpAllowed: !isSafe,
    emoji: isSafe ? "🛡️" : "⚔️",
    color: isSafe ? "text-green-400" : "text-red-400",
    borderColor: isSafe ? "border-green-700" : "border-red-700",
    bgColor: isSafe ? "bg-green-900/20" : "bg-red-900/20",
  };
}

/**
 * Determine if an engage action is legal given viewer, target, current zone.
 * Returns { legal: boolean, reason: string, blockedBySafe?: boolean }
 */
export function canEngage(viewer, target, x, y) {
  if (!viewer || !target) return { legal: false, reason: "No target" };
  if (viewer.id === target.id) return { legal: false, reason: "Cannot attack yourself" };

  const safe = isSafeZone(x, y);

  // Monsters always engageable
  if (target.species || (target.is_alive !== undefined && target.type === undefined)) {
    return { legal: true, reason: "Monster — engage freely" };
  }

  if (safe) {
    return { legal: false, reason: "Safehold — no hostile action permitted", blockedBySafe: true };
  }

  return { legal: true, reason: "Frontier zone — engagement permitted" };
}

/**
 * Cycle nearest hostile from a list of monsters/entities relative to character.
 * Returns next target (entity) or null.
 */
export function cycleNearestHostile(character, entities, currentTargetId = null) {
  if (!character || !entities?.length) return null;

  const alive = entities.filter(e => e.is_alive !== false);
  if (!alive.length) return null;

  alive.sort((a, b) =>
    (Math.abs(a.x - character.x) + Math.abs(a.y - character.y)) -
    (Math.abs(b.x - character.x) + Math.abs(b.y - character.y))
  );

  const curIdx = currentTargetId ? alive.findIndex(e => e.id === currentTargetId) : -1;
  return alive[(curIdx + 1) % alive.length];
}