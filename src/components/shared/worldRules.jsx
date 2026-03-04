/**
 * WORLD RULESET FOUNDATIONS
 * 
 * Single source of truth for:
 * - Safe zones, frontier zones, siege zones, arena zones
 * - PvP flagging and duel consent
 * - Hostility rules between players, agents, monsters
 * - Death penalties and respawn logic by zone type
 * 
 * All combat decisions route through these rules.
 */

import { getZoneAt } from "./worldZones";

// ─── ZONE TYPES ───────────────────────────────────────────────────────────────

export const ZONE_TYPES = {
  SAFE_TOWN: "safe_town",        // Town of Agentica: no PvP, light death penalty
  FRONTIER: "frontier",           // Most wilderness: PvP enabled, moderate penalty
  SIEGE: "siege",                 // Guild territories: war rules apply
  ARENA: "arena",                 // Duel arenas: consented combat only
  DUNGEON: "dungeon",             // Instanced/special: zone-specific rules
};

// ─── ZONE CONFIGURATION ───────────────────────────────────────────────────────

export const ZONE_CONFIG = {
  town_center: {
    type: ZONE_TYPES.SAFE_TOWN,
    safeFrom: ["player", "ai_agent"],  // No PvP between any characters
    duelAllowed: true,                 // Can initiate duels here
    deathPenalty: { goldLoss: 0.05, lootDrop: false },
    respawnX: 30, respawnY: 25,        // Safe town center
    loreLabel: "Safehold",
    loreDescription: "A chartered safehold. Steel stays sheathed within these walls.",
  },
  dark_forest: {
    type: ZONE_TYPES.FRONTIER,
    safeFrom: [],                      // PvP-enabled
    pvpFlag: true,                     // Players must be PvP-flagged to fight
    deathPenalty: { goldLoss: 0.15, lootDrop: false },
    respawnX: 22, respawnY: 25,
  },
  iron_hills: {
    type: ZONE_TYPES.FRONTIER,
    safeFrom: [],
    pvpFlag: true,
    deathPenalty: { goldLoss: 0.15, lootDrop: false },
    respawnX: 22, respawnY: 25,
  },
  cursed_swamp: {
    type: ZONE_TYPES.FRONTIER,
    safeFrom: [],
    pvpFlag: true,
    deathPenalty: { goldLoss: 0.2, lootDrop: true },  // Harsher frontier
    respawnX: 22, respawnY: 25,
  },
  golden_plains: {
    type: ZONE_TYPES.FRONTIER,
    safeFrom: [],
    pvpFlag: true,
    deathPenalty: { goldLoss: 0.15, lootDrop: false },
    respawnX: 22, respawnY: 25,
  },
  volcanic_badlands: {
    type: ZONE_TYPES.FRONTIER,
    safeFrom: [],
    pvpFlag: true,
    deathPenalty: { goldLoss: 0.2, lootDrop: true },
    respawnX: 22, respawnY: 25,
  },
  coastal_ruins: {
    type: ZONE_TYPES.FRONTIER,
    safeFrom: [],
    pvpFlag: true,
    deathPenalty: { goldLoss: 0.15, lootDrop: false },
    respawnX: 22, respawnY: 25,
  },
};

// ─── HOSTILITY RULES ──────────────────────────────────────────────────────────

/**
 * Determine if attacker can legally attack target.
 * Returns { canAttack: boolean, reason: string }
 */
export function canAttack(attacker, target, zone, relationshipState = {}) {
  // Can't attack self
  if (attacker.id === target.id) {
    return { canAttack: false, reason: "Cannot attack yourself" };
  }

  // Monsters are always attackable (player attacking monster)
  if (target.species || (target.is_alive !== undefined && !target.type)) {
    return { canAttack: true, reason: "Monster — always attackable" };
  }

  // Monster vs anything: always can attack (will be controlled by encounter logic)
  if (attacker.type === "monster") {
    return { canAttack: true, reason: "Monster can attack" };
  }

  // Resolve zone config — zone may be a raw zone object or a config object
  const zoneConfig = zone ? (ZONE_CONFIG[zone.id] || zone) : null;

  // Safe zone: no player/agent attacks allowed
  if (zoneConfig?.type === ZONE_TYPES.SAFE_TOWN) {
    // Exception: duel consent overrides safe zone
    if (relationshipState.duelActive) {
      return { canAttack: true, reason: "Duel active in safe zone" };
    }
    return { canAttack: false, reason: "Safe zone—no PvP" };
  }

  // Player attacking player in frontier/siege
  if (attacker.type === "human" && target.type === "human") {
    const attackerFlagged = relationshipState.attackerPvPFlag || false;
    const targetFlagged = relationshipState.targetPvPFlag || false;
    const atWar = relationshipState.warStatus === "active";
    if (!atWar && (!attackerFlagged || !targetFlagged)) {
      return { canAttack: false, reason: "Target not PvP-flagged" };
    }
    return { canAttack: true, reason: "PvP-enabled zone, both flagged or at war" };
  }

  // Player attacking AI agent
  if (attacker.type === "human" && target.type === "ai_agent") {
    if (zoneConfig?.type === ZONE_TYPES.FRONTIER || zoneConfig?.type === ZONE_TYPES.SIEGE) {
      return { canAttack: true, reason: "Can attack AI in frontier/siege zones" };
    }
    return { canAttack: false, reason: "Cannot attack AI in safe zone" };
  }

  // AI agent attacking player
  if (attacker.type === "ai_agent" && target.type === "human") {
    if (relationshipState.hostileAIFlag || relationshipState.warStatus === "active") {
      return { canAttack: true, reason: "AI is hostile or at war" };
    }
    return { canAttack: false, reason: "AI is not hostile to this player" };
  }

  // AI attacking AI
  if (attacker.type === "ai_agent" && target.type === "ai_agent") {
    if (relationshipState.warStatus === "active") {
      return { canAttack: true, reason: "Guilds at war" };
    }
    return { canAttack: false, reason: "No conflict between AI agents" };
  }

  return { canAttack: false, reason: "Unknown hostility state" };
}

/**
 * Get zone rules for death/respawn
 */
export function getDeathRules(zoneId) {
  const zone = Object.values(ZONE_CONFIG).find(z => z.id === zoneId) ||
               ZONE_CONFIG[zoneId];
  
  if (!zone) {
    return {
      type: ZONE_TYPES.FRONTIER,
      deathPenalty: { goldLoss: 0.1, lootDrop: false },
      respawnX: 30,
      respawnY: 25,
    };
  }

  return {
    type: zone.type,
    deathPenalty: zone.deathPenalty,
    respawnX: zone.respawnX,
    respawnY: zone.respawnY,
  };
}

/**
 * Calculate death penalty: gold loss, loot drop, etc.
 */
export function applyDeathPenalty(character, zoneId) {
  const rules = getDeathRules(zoneId);
  const penalty = rules.deathPenalty;

  const goldLoss = Math.floor((character.gold || 0) * (penalty.goldLoss || 0));
  const newGold = Math.max(0, (character.gold || 0) - goldLoss);

  return {
    gold: newGold,
    goldLost: goldLoss,
    shouldDropLoot: penalty.lootDrop || false,
  };
}

/**
 * Get respawn location for a zone
 */
export function getRespawnLocation(zoneId) {
  const rules = getDeathRules(zoneId);
  return { x: rules.respawnX, y: rules.respawnY };
}

/**
 * Check if a position is in a safe zone
 */
export function isSafeZone(x, y) {
  const zone = getZoneAt(x, y);
  if (!zone) return false;
  const config = ZONE_CONFIG[zone.id];
  return config?.type === ZONE_TYPES.SAFE_TOWN;
}

/**
 * Get distance between two positions (Manhattan/taxicab)
 */
export function getDistance(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Check line of sight (basic: same zone or adjacent zones for now)
 */
export function hasLineOfSight(x1, y1, x2, y2) {
  const dist = getDistance(x1, y1, x2, y2);
  // For tile-based grid: can see/attack up to 8 tiles away
  return dist <= 8;
}

/**
 * Check if target is in valid attack range
 * Melee: 1 tile, Ranged: 5 tiles, Magic: 8 tiles
 */
export function isInAttackRange(attacker, target, rangeType = "melee") {
  const dist = getDistance(attacker.x || 0, attacker.y || 0, target.x || 0, target.y || 0);
  const ranges = { melee: 1, ranged: 5, magic: 8 };
  return dist <= (ranges[rangeType] || ranges.melee);
}

/**
 * Validate a target before attack
 */
export function validateTarget(attacker, target, zone, relationshipState = {}) {
  if (!target) {
    return { valid: false, reason: "No target" };
  }

  // Check line of sight
  if (!hasLineOfSight(attacker.x || 0, attacker.y || 0, target.x || 0, target.y || 0)) {
    return { valid: false, reason: "Target out of range or blocked" };
  }

  // Check hostility rules
  const hostility = canAttack(attacker, target, zone, relationshipState);
  if (!hostility.canAttack) {
    return { valid: false, reason: hostility.reason };
  }

  return { valid: true, reason: "Valid target" };
}